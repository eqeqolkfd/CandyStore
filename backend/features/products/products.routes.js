const express = require('express');
const router = express.Router();
const { getCatalogProducts } = require('./products.service');

router.get('/', async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      manufacturer: req.query.manufacturer,
      priceSort: req.query.priceSort,
      weightSort: req.query.weightSort
    };
    const products = await getCatalogProducts(filters);
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

module.exports = router;