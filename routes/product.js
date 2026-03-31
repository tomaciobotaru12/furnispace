const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/:slug', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ?
  `).get(req.params.slug);

  if (!product) return res.redirect('/shop');

  // Related products: same category, different product
  const related = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ?
    LIMIT 4
  `).all(product.category_id, product.id);

  res.render('product', {
    title: `${product.name} – FurniSpace`,
    product,
    related,
  });
});

module.exports = router;
