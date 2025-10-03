const express = require('express');
const router = express.Router();
const { getCatalogProducts } = require('./products.service');

router.get('/', async (req, res) => {
  try {
    const products = await getCatalogProducts();
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

module.exports = router;