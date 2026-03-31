const express = require('express');
const router = express.Router();
const db = require('../database/db');

function getCart(session) {
  return session.cart || [];
}

router.get('/', (req, res) => {
  const cartItems = getCart(req.session);
  const enriched = cartItems.map(item => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id);
    if (!product) return null;
    return { ...product, quantity: item.quantity, lineTotal: (product.sale_price || product.price) * item.quantity };
  }).filter(Boolean);

  const subtotal = enriched.reduce((sum, i) => sum + i.lineTotal, 0);
  const shipping = subtotal > 0 ? (subtotal >= 1000 ? 0 : 50) : 0;
  const total = subtotal + shipping;

  res.render('cart', {
    title: 'Your Cart – FurniSpace',
    cartItems: enriched,
    subtotal,
    shipping,
    total,
  });
});

// Add to cart
router.post('/add', (req, res) => {
  const id = parseInt(req.body.product_id);
  const qty = Math.max(1, parseInt(req.body.quantity) || 1);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const cart = getCart(req.session);
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ id, quantity: qty });
  }
  req.session.cart = cart;

  if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.accepts('json')) {
    return res.json({ success: true, cartCount: cart.reduce((s, i) => s + i.quantity, 0) });
  }
  req.flash('success', `${product.name} added to cart.`);
  res.redirect(req.headers.referer || '/shop');
});

// Update quantity
router.post('/update', (req, res) => {
  const id = parseInt(req.body.product_id);
  const qty = parseInt(req.body.quantity);
  const cart = getCart(req.session);
  const item = cart.find(i => i.id === id);
  if (item) {
    if (qty <= 0) {
      req.session.cart = cart.filter(i => i.id !== id);
    } else {
      item.quantity = qty;
    }
  }
  res.redirect('/cart');
});

// Remove item
router.post('/remove', (req, res) => {
  const id = parseInt(req.body.product_id);
  req.session.cart = getCart(req.session).filter(i => i.id !== id);
  res.redirect('/cart');
});

// Clear cart
router.post('/clear', (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
});

module.exports = router;
