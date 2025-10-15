const express = require('express');
const router = express.Router();
const { createPaymentForOrder } = require('./payments.service');
const pool = require('../../db');

router.post('/', async (req, res) => {
  try {
    const { orderId, method, status } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const totalRes = await pool.query('SELECT total_amount FROM orders WHERE order_id = $1', [orderId]);
    if (totalRes.rows.length === 0) return res.status(404).json({ error: 'order not found' });
    const amount = totalRes.rows[0].total_amount;

    const paymentId = await createPaymentForOrder({ orderId, amount, method, status });
    res.status(201).json({ paymentId });
  } catch (e) {
    console.error('Create payment error:', e.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

module.exports = router;


