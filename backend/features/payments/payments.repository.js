const pool = require('../../db');

async function createPayment({ orderId, amount, method, status }) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO payments (order_id, amount, method_payments, status, created_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (order_id) DO UPDATE SET amount = EXCLUDED.amount, method_payments = EXCLUDED.method_payments, status = EXCLUDED.status
       RETURNING payment_id`,
      [orderId, amount, method, status]
    );
    return res.rows[0].payment_id;
  } finally {
    client.release();
  }
}

module.exports = { createPayment };



