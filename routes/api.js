const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/products – for Room Visualizer AJAX
router.get('/products', (req, res) => {
  const category = req.query.category || '';
  const maxPrice = parseFloat(req.query.max_price) || 99999;
  const minEco = parseInt(req.query.min_eco) || 0;

  let query = `
    SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.image, p.eco_score, p.material, p.short_description,
           c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE COALESCE(p.sale_price, p.price) <= ? AND p.eco_score >= ?
  `;
  const params = [maxPrice, minEco];

  if (category) {
    query += ' AND c.slug = ?';
    params.push(category);
  }

  const products = db.prepare(query).all(...params);
  res.json(products);
});

// POST /api/cart/add – AJAX add to cart
router.post('/cart/add', (req, res) => {
  const id = parseInt(req.body.product_id);
  const qty = Math.max(1, parseInt(req.body.quantity) || 1);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const cart = req.session.cart || [];
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ id, quantity: qty });
  }
  req.session.cart = cart;

  res.json({
    success: true,
    cartCount: cart.reduce((s, i) => s + i.quantity, 0),
    message: `${product.name} added to cart.`,
  });
});

// POST /api/cart/add-bundle – add multiple products from Room Visualizer
router.post('/cart/add-bundle', (req, res) => {
  const ids = (req.body.product_ids || '').toString().split(',').map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'No products specified' });

  const cart = req.session.cart || [];
  let added = 0;
  for (const id of ids) {
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!product) continue;
    const existing = cart.find(i => i.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ id, quantity: 1 });
    }
    added++;
  }
  req.session.cart = cart;

  res.json({
    success: true,
    added,
    cartCount: cart.reduce((s, i) => s + i.quantity, 0),
    cartUrl: '/cart',
  });
});

// GET /api/wishlist – get product details for wishlist items
router.get('/wishlist', (req, res) => {
  const idsParam = req.query.ids || '';
  const ids = idsParam.split(',').map(Number).filter(Boolean);
  if (!ids.length) return res.json([]);

  const placeholders = ids.map(() => '?').join(',');
  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.image, p.eco_score,
           c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE p.id IN (${placeholders})
  `).all(...ids);

  res.json(products);
});

// POST /api/newsletter
router.post('/newsletter', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ success: false, error: 'Please enter a valid email address.' });
  }

  const existing = db.prepare('SELECT id FROM newsletter_subscribers WHERE email = ?').get(email);
  if (existing) {
    return res.json({ success: true, message: "You're already subscribed!" });
  }

  db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email);
  res.json({ success: true, message: "You're subscribed! Welcome to FurniSpace." });
});

module.exports = router;
