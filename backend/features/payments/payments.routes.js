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

// GET payments by userId or orderId
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const orderId = req.query.orderId ? Number(req.query.orderId) : null;
    if (!userId && !orderId) return res.status(400).json({ error: 'userId or orderId is required' });

    let rows;
    if (orderId) {
      const r = await pool.query(
        `SELECT p.payment_id, p.order_id, p.amount, p.method_payments, p.status AS payment_status, p.created_at
           FROM payments p
          WHERE p.order_id = $1
          ORDER BY p.created_at DESC`,
        [orderId]
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT p.payment_id, p.order_id, p.amount, p.method_payments, p.status AS payment_status, p.created_at,
                s.code AS order_status_code, s.name_orderstatuses AS order_status_name
           FROM payments p
           JOIN orders o ON o.order_id = p.order_id
           LEFT JOIN order_statuses s ON s.status_id = o.status_id
          WHERE o.user_id = $1
          ORDER BY p.created_at DESC`,
        [userId]
      );
      rows = r.rows;
    }
    res.json(rows);
  } catch (e) {
    console.error('List payments error:', e.message);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;





