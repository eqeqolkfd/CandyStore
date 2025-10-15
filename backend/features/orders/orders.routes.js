const express = require('express');
const router = express.Router();
const { createOrderFromCart, listOrdersByUser } = require('./orders.service');

router.get('/', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const orders = await listOrdersByUser(userId);
    res.json(orders);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, address, deliveryMethod, paymentMethod, items } = req.body;
    console.log('Creating order for user:', userId, 'items:', items);
    
    if (!userId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    const orderId = await createOrderFromCart({ userId, address, deliveryMethod, paymentMethod, items });
    console.log('Order created with ID:', orderId);
    res.status(201).json({ orderId });
  } catch (e) {
    console.error('Order creation failed:', e.message);
    res.status(500).json({ error: `Failed to create order: ${e.message}` });
  }
});

module.exports = router;