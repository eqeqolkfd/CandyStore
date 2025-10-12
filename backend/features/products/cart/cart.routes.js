const express = require('express');
const router = express.Router();
const { getCart, addToCart, updateCart, removeFromCart } = require('./cart.service');

router.get('/:sessionId', async (req, res) => {
  try {
    const cart = await getCart(req.params.sessionId);
    res.json(cart);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

router.post('/:sessionId/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const cart = await addToCart(req.params.sessionId, productId, quantity);
    res.json(cart);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

router.put('/:sessionId/update', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await updateCart(req.params.sessionId, productId, quantity);
    res.json(cart);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

router.delete('/:sessionId/remove/:productId', async (req, res) => {
  try {
    const cart = await removeFromCart(req.params.sessionId, req.params.productId);
    res.json(cart);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

module.exports = router;