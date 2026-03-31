function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  req.flash('error', 'Please log in to access your account.');
  res.redirect('/account/login');
}

module.exports = { requireAuth };
