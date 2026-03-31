const express = require('express');
const router = express.Router();

// Wishlist is purely client-side (localStorage), this page is just the shell
router.get('/', (req, res) => {
  res.render('wishlist', { title: 'Wishlist – FurniSpace' });
});

module.exports = router;
