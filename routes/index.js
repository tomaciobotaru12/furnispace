const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  const featured = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE p.featured = 1
    LIMIT 8
  `).all();

  const categories = db.prepare('SELECT * FROM categories').all();

  // Shop-the-look bundles: pick 4 products from 3 different rooms
  const livingBundle = db.prepare(`SELECT p.* FROM products p JOIN categories c ON p.category_id = c.id WHERE c.slug = 'living-room' LIMIT 4`).all();
  const bedroomBundle = db.prepare(`SELECT p.* FROM products p JOIN categories c ON p.category_id = c.id WHERE c.slug = 'bedroom' LIMIT 4`).all();
  const officeBundle = db.prepare(`SELECT p.* FROM products p JOIN categories c ON p.category_id = c.id WHERE c.slug = 'office' LIMIT 4`).all();

  res.render('index', {
    title: 'FurniSpace – Furniture That Feels Like Home',
    isHome: true,
    featured,
    categories,
    bundles: [
      { name: 'The Living Room', slug: 'living-room', products: livingBundle },
      { name: 'The Bedroom',    slug: 'bedroom',     products: bedroomBundle },
      { name: 'The Home Office', slug: 'office',     products: officeBundle },
    ],
  });
});

module.exports = router;
