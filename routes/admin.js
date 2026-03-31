const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdmin } = require('../middleware/adminAuth');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@furnispace.ro';

// ── Login ─────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login – FurniSpace', error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'Admin Login – FurniSpace', error: 'Invalid credentials.' });
});

router.get('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

// ── Dashboard ─────────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const stats = {
    totalOrders:   db.prepare("SELECT COUNT(*) as n FROM orders").get().n,
    pendingOrders: db.prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'pending'").get().n,
    paidOrders:    db.prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'paid'").get().n,
    totalRevenue:  db.prepare("SELECT COALESCE(SUM(total),0) as n FROM orders WHERE status IN ('paid','completed')").get().n,
    totalProducts: db.prepare("SELECT COUNT(*) as n FROM products").get().n,
    totalUsers:    db.prepare("SELECT COUNT(*) as n FROM users").get().n,
  };

  const recentOrders = db.prepare(`
    SELECT o.*, ob.first_name, ob.last_name, ob.email
    FROM orders o
    LEFT JOIN order_billing ob ON o.id = ob.order_id
    ORDER BY o.created_at DESC
    LIMIT 8
  `).all();

  res.render('admin/dashboard', { title: 'Admin Dashboard – FurniSpace', stats, recentOrders });
});

// ── Orders list ───────────────────────────────────────────────
router.get('/orders', requireAdmin, (req, res) => {
  const status = req.query.status || '';
  const search = req.query.search || '';
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const PER    = 20;

  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND o.status = ?'; params.push(status); }
  if (search) { where += ' AND (o.order_number LIKE ? OR ob.email LIKE ? OR ob.first_name LIKE ? OR ob.last_name LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s, s); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM orders o LEFT JOIN order_billing ob ON o.id = ob.order_id ${where}`).get(...params).n;

  const orders = db.prepare(`
    SELECT o.*, ob.first_name, ob.last_name, ob.email
    FROM orders o
    LEFT JOIN order_billing ob ON o.id = ob.order_id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, PER, (page - 1) * PER);

  res.render('admin/orders', {
    title: 'Orders – Admin',
    orders, total, page,
    totalPages: Math.ceil(total / PER),
    status, search, PER,
  });
});

// ── Order detail + status update ──────────────────────────────
router.get('/orders/:orderNumber', requireAdmin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!order) return res.redirect('/admin/orders');

  const items   = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const billing = db.prepare('SELECT * FROM order_billing WHERE order_id = ?').get(order.id);
  const user    = order.user_id ? db.prepare('SELECT first_name, last_name, email FROM users WHERE id = ?').get(order.user_id) : null;

  res.render('admin/order-detail', { title: `Order ${order.order_number} – Admin`, order, items, billing, user });
});

router.post('/orders/:orderNumber/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.redirect(`/admin/orders/${req.params.orderNumber}`);
  db.prepare('UPDATE orders SET status = ? WHERE order_number = ?').run(status, req.params.orderNumber);
  res.redirect(`/admin/orders/${req.params.orderNumber}`);
});

// ── Products list ─────────────────────────────────────────────
router.get('/products', requireAdmin, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p JOIN categories c ON p.category_id = c.id
    ORDER BY c.name, p.name
  `).all();

  res.render('admin/products', { title: 'Products – Admin', products });
});

// ── Quick stock update ────────────────────────────────────────
router.post('/products/:id/stock', requireAdmin, (req, res) => {
  const stock = Math.max(0, parseInt(req.body.stock) || 0);
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, req.params.id);
  res.redirect('/admin/products');
});

// ── Newsletter subscribers ────────────────────────────────────
router.get('/subscribers', requireAdmin, (req, res) => {
  const subscribers = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all();
  res.render('admin/subscribers', { title: 'Subscribers – Admin', subscribers });
});

module.exports = router;
