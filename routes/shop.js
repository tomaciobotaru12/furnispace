const express = require('express');
const router = express.Router();
const db = require('../database/db');

const PER_PAGE = 12;

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const sort = req.query.sort || 'default';
  const minEco = parseInt(req.query.eco) || 0;
  const maxPrice = parseFloat(req.query.max_price) || 99999;

  let orderClause = 'p.featured DESC, p.id ASC';
  if (sort === 'price_asc')  orderClause = 'p.price ASC';
  if (sort === 'price_desc') orderClause = 'p.price DESC';
  if (sort === 'name_asc')   orderClause = 'p.name ASC';
  if (sort === 'eco_desc')   orderClause = 'p.eco_score DESC';

  const where = `WHERE p.eco_score >= ? AND COALESCE(p.sale_price, p.price) <= ?`;
  const params = [minEco, maxPrice];

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM products p JOIN categories c ON p.category_id = c.id ${where}
  `).get(...params).n;

  const products = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    ${where}
    ORDER BY ${orderClause}
    LIMIT ? OFFSET ?
  `).all(...params, PER_PAGE, (page - 1) * PER_PAGE);

  const categories = db.prepare('SELECT * FROM categories').all();

  res.render('shop', {
    title: 'Shop – FurniSpace',
    products,
    categories,
    category: null,
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    sort,
    minEco,
    maxPrice,
    perPage: PER_PAGE,
  });
});

router.get('/:slug', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
  if (!category) return res.redirect('/shop');

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const sort = req.query.sort || 'default';
  const minEco = parseInt(req.query.eco) || 0;
  const maxPrice = parseFloat(req.query.max_price) || 99999;

  let orderClause = 'p.id ASC';
  if (sort === 'price_asc')  orderClause = 'p.price ASC';
  if (sort === 'price_desc') orderClause = 'p.price DESC';
  if (sort === 'name_asc')   orderClause = 'p.name ASC';
  if (sort === 'eco_desc')   orderClause = 'p.eco_score DESC';

  const where = `WHERE p.category_id = ? AND p.eco_score >= ? AND COALESCE(p.sale_price, p.price) <= ?`;
  const params = [category.id, minEco, maxPrice];

  const total = db.prepare(`SELECT COUNT(*) as n FROM products p ${where}`).get(...params).n;

  const products = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    ${where}
    ORDER BY ${orderClause}
    LIMIT ? OFFSET ?
  `).all(...params, PER_PAGE, (page - 1) * PER_PAGE);

  const categories = db.prepare('SELECT * FROM categories').all();

  res.render('shop', {
    title: `${category.name} – FurniSpace`,
    products,
    categories,
    category,
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    sort,
    minEco,
    maxPrice,
    perPage: PER_PAGE,
  });
});

module.exports = router;
