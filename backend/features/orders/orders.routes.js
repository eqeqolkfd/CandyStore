const express = require('express');
const router = express.Router();
const { createOrderFromCart, listOrdersByUser } = require('./orders.service');
const { fetchOrdersByUser } = require('./orders.repository');
const pool = require('../../db');

router.get('/', async (req, res) => {
  try {
    const orderId = req.query.orderId ? Number(req.query.orderId) : null;
    if (orderId) {
      // Find order by ID, with its items
      const all = await fetchOrdersByUser(null, orderId);
      if (!all || !all.length) return res.status(404).json({ error: 'Order not found' });
      res.json(all[0]);
      return;
    }
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const orders = await listOrdersByUser(userId);
    res.json(orders);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось загрузить заказы' });
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

// Admin: list all orders with status and items count
router.get('/admin/all', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT o.order_id, o.user_id, o.total_amount, o.created_at,
             o.delivery_method, o.payment_method,
             s.code AS status_code, s.name_orderstatuses AS status_name,
             COALESCE((SELECT COUNT(1) FROM order_items oi WHERE oi.order_id = o.order_id), 0) AS items_count,
             u.first_name, u.last_name, u.email
        FROM orders o
        LEFT JOIN order_statuses s ON s.status_id = o.status_id
        LEFT JOIN users u ON u.user_id = o.user_id
       ORDER BY o.created_at DESC`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: list statuses
router.get('/admin/statuses', async (_req, res) => {
  try {
    const r = await pool.query('SELECT status_id, code, name_orderstatuses FROM order_statuses ORDER BY status_id');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// Admin: update order status by code
router.put('/admin/orders/:id/status', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { code } = req.body || {};
    if (!orderId || !code) return res.status(400).json({ error: 'orderId and code are required' });
    const s = await pool.query('SELECT status_id FROM order_statuses WHERE code = $1 LIMIT 1', [String(code).toLowerCase()]);
    if (s.rows.length === 0) return res.status(400).json({ error: 'Unknown status code' });
    const statusId = s.rows[0].status_id;
    const u = await pool.query('UPDATE orders SET status_id = $1 WHERE order_id = $2 RETURNING order_id', [statusId, orderId]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});