const express = require('express');
const router = express.Router();
const db = require('../database/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const nodemailer = require('nodemailer');

function buildCart(session) {
  const cart = session.cart || [];
  return cart.map(item => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id);
    if (!p) return null;
    return { ...p, quantity: item.quantity, lineTotal: (p.sale_price || p.price) * item.quantity };
  }).filter(Boolean);
}

function generateOrderNumber() {
  return 'FS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

router.get('/', (req, res) => {
  const cartItems = buildCart(req.session);
  if (!cartItems.length) return res.redirect('/cart');

  const subtotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
  const shipping = subtotal >= 1000 ? 0 : 50;
  const total = subtotal + shipping;

  res.render('checkout', {
    title: 'Checkout – FurniSpace',
    cartItems,
    subtotal,
    shipping,
    total,
    billing: {},
  });
});

// Create Stripe PaymentIntent
router.post('/create-payment-intent', async (req, res) => {
  try {
    const cartItems = buildCart(req.session);
    if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

    const subtotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
    const shipping = subtotal >= 1000 ? 0 : 50;
    const total = subtotal + shipping;

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // RON in bani
      currency: 'ron',
      automatic_payment_methods: { enabled: true },
      metadata: { cart: JSON.stringify(cartItems.map(i => ({ id: i.id, qty: i.quantity }))) },
    });

    // Store billing info in session for later
    req.session.pendingBilling = req.body;

    res.json({ clientSecret: intent.client_secret, total });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Complete order after successful payment
router.post('/complete', (req, res) => {
  const { payment_intent_id, billing } = req.body;
  const cartItems = buildCart(req.session);
  if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

  const subtotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
  const shipping = subtotal >= 1000 ? 0 : 50;
  const total = subtotal + shipping;
  const orderNumber = generateOrderNumber();

  const userId = req.session.userId || null;

  const saveOrder = db.transaction(() => {
    const orderId = db.prepare(`
      INSERT INTO orders (order_number, status, subtotal, shipping, tax, total, payment_method, stripe_payment_id, user_id)
      VALUES (?, 'paid', ?, ?, 0, ?, 'stripe', ?, ?)
    `).run(orderNumber, subtotal, shipping, total, payment_intent_id || null, userId).lastInsertRowid;

    const b = billing || {};
    db.prepare(`
      INSERT INTO order_billing (order_id, first_name, last_name, email, phone, address, city, county, postal_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, b.first_name||'', b.last_name||'', b.email||'', b.phone||'', b.address||'', b.city||'', b.county||'', b.postal_code||'');

    for (const item of cartItems) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, item.id, item.name, item.image, item.sale_price || item.price, item.quantity);
    }

    return orderId;
  });

  const orderId = saveOrder();
  req.session.cart = [];

  // Send confirmation email (fire and forget)
  const billing_data = billing || {};
  if (billing_data.email) {
    sendConfirmationEmail(billing_data, cartItems, total, orderNumber, shipping).catch(console.error);
  }

  res.json({ success: true, orderNumber, orderId });
});

// Order success page
router.get('/success/:orderNumber', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!order) return res.redirect('/');

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const billing = db.prepare('SELECT * FROM order_billing WHERE order_id = ?').get(order.id);

  res.render('order-success', {
    title: 'Order Confirmed – FurniSpace',
    order,
    items,
    billing,
  });
});

// Invoice page
router.get('/invoice/:orderNumber', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!order) return res.redirect('/');

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const billing = db.prepare('SELECT * FROM order_billing WHERE order_id = ?').get(order.id);

  res.render('invoice', {
    title: `Invoice ${order.order_number} – FurniSpace`,
    order,
    items,
    billing,
    layout: false,
  });
});

async function sendConfirmationEmail(billing, items, total, orderNumber, shipping) {
  if (!process.env.EMAIL_USER) return;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const itemRows = items.map(i =>
    `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${(i.price).toFixed(2)} RON</td><td>${(i.price * i.quantity).toFixed(2)} RON</td></tr>`
  ).join('');

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'FurniSpace <no-reply@furnispace.ro>',
    to: billing.email,
    subject: `Order Confirmed – ${orderNumber}`,
    html: `
      <h2>Thank you for your order, ${billing.first_name}!</h2>
      <p>Order number: <strong>${orderNumber}</strong></p>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${itemRows}
      </table>
      <p>Shipping: ${shipping === 0 ? 'Free' : shipping + ' RON'}</p>
      <p><strong>Total: ${total.toFixed(2)} RON</strong></p>
      <p>We'll notify you when your order ships. Thank you for choosing FurniSpace!</p>
    `,
  });
}

module.exports = router;
