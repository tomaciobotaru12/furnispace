require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'furnispace-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Flash messages
app.use(flash());

// Global locals for all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.cart = req.session.cart || [];
  res.locals.cartCount = (req.session.cart || []).reduce((sum, i) => sum + i.quantity, 0);
  res.locals.stripePK = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.locals.siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
  res.locals.currentUser = req.session.userId ? { id: req.session.userId, name: req.session.userName } : null;
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/shop', require('./routes/shop'));
app.use('/product', require('./routes/product'));
app.use('/cart', require('./routes/cart'));
app.use('/checkout', require('./routes/checkout'));
app.use('/wishlist', require('./routes/wishlist'));
app.use('/visualizer', require('./routes/visualizer'));
app.use('/about', require('./routes/about'));
app.use('/contact', require('./routes/contact'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('404', { title: 'Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`FurniSpace running at http://localhost:${PORT}`);
});
