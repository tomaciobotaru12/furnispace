const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// ── Register ──────────────────────────────────────────────────
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/account');
  res.render('account/register', { title: 'Create Account – FurniSpace', formData: {} });
});

router.post('/register', async (req, res) => {
  const { first_name, last_name, email, password, password_confirm } = req.body;
  const formData = { first_name, last_name, email };

  if (!first_name || !last_name || !email || !password) {
    return res.render('account/register', { title: 'Create Account – FurniSpace', formData, error: 'All fields are required.' });
  }
  if (password.length < 6) {
    return res.render('account/register', { title: 'Create Account – FurniSpace', formData, error: 'Password must be at least 6 characters.' });
  }
  if (password !== password_confirm) {
    return res.render('account/register', { title: 'Create Account – FurniSpace', formData, error: 'Passwords do not match.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.render('account/register', { title: 'Create Account – FurniSpace', formData, error: 'An account with this email already exists.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(first_name, last_name, email.toLowerCase(), hash);

  req.session.userId = result.lastInsertRowid;
  req.session.userName = first_name;
  req.flash('success', `Welcome, ${first_name}! Your account has been created.`);
  res.redirect('/account');
});

// ── Login ────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/account');
  res.render('account/login', { title: 'Login – FurniSpace', redirect: req.query.redirect || '' });
});

router.post('/login', async (req, res) => {
  const { email, password, redirect } = req.body;

  if (!email || !password) {
    return res.render('account/login', { title: 'Login – FurniSpace', redirect, error: 'Please enter your email and password.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.render('account/login', { title: 'Login – FurniSpace', redirect, error: 'No account found with that email.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.render('account/login', { title: 'Login – FurniSpace', redirect, error: 'Incorrect password.' });
  }

  req.session.userId = user.id;
  req.session.userName = user.first_name;
  req.flash('success', `Welcome back, ${user.first_name}!`);
  res.redirect(redirect && redirect.startsWith('/') ? redirect : '/account');
});

// ── Logout ───────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── Dashboard ────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) { req.session.destroy(); return res.redirect('/account/login'); }

  const orders = db.prepare(`
    SELECT o.*, ob.first_name, ob.last_name, ob.email
    FROM orders o
    LEFT JOIN order_billing ob ON o.id = ob.order_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
    LIMIT 5
  `).all(user.id);

  res.render('account/dashboard', {
    title: 'My Account – FurniSpace',
    user,
    orders,
  });
});

// ── Order history ─────────────────────────────────────────────
router.get('/orders', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const orders = db.prepare(`
    SELECT o.*, ob.first_name, ob.last_name
    FROM orders o
    LEFT JOIN order_billing ob ON o.id = ob.order_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `).all(user.id);

  res.render('account/orders', {
    title: 'My Orders – FurniSpace',
    user,
    orders,
  });
});

// ── Single order detail ───────────────────────────────────────
router.get('/orders/:orderNumber', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?')
    .get(req.params.orderNumber, req.session.userId);
  if (!order) return res.redirect('/account/orders');

  const items   = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const billing = db.prepare('SELECT * FROM order_billing WHERE order_id = ?').get(order.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  res.render('account/order-detail', {
    title: `Order ${order.order_number} – FurniSpace`,
    order,
    items,
    billing,
    user,
  });
});

// ── Profile update ────────────────────────────────────────────
router.post('/profile', requireAuth, async (req, res) => {
  const { first_name, last_name, email, current_password, new_password, confirm_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  if (!first_name || !last_name || !email) {
    req.flash('error', 'Name and email are required.');
    return res.redirect('/account');
  }

  // Check email not taken by another user
  const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), user.id);
  if (emailTaken) {
    req.flash('error', 'That email is already in use by another account.');
    return res.redirect('/account');
  }

  // Password change (optional)
  let newHash = user.password_hash;
  if (new_password) {
    if (!current_password || !(await bcrypt.compare(current_password, user.password_hash))) {
      req.flash('error', 'Current password is incorrect.');
      return res.redirect('/account');
    }
    if (new_password.length < 6) {
      req.flash('error', 'New password must be at least 6 characters.');
      return res.redirect('/account');
    }
    if (new_password !== confirm_password) {
      req.flash('error', 'New passwords do not match.');
      return res.redirect('/account');
    }
    newHash = await bcrypt.hash(new_password, 10);
  }

  db.prepare('UPDATE users SET first_name=?, last_name=?, email=?, password_hash=? WHERE id=?')
    .run(first_name, last_name, email.toLowerCase(), newHash, user.id);

  req.session.userName = first_name;
  req.flash('success', 'Profile updated successfully.');
  res.redirect('/account');
});

module.exports = router;
