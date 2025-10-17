const pool = require('../../db');

async function insertOrderWithAddress({ userId, address, deliveryMethod, paymentMethod, items }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT 1 FROM users WHERE user_id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      throw new Error('User not found');
    }

    const houseValue = (address?.house && String(address.house).trim())
      ? String(address.house).trim()
      : ((address?.apartment && String(address.apartment).trim()) ? String(address.apartment).trim() : null);
    if (!houseValue) {
      throw new Error('Address house or apartment is required');
    }

    const addressRes = await client.query(
      `INSERT INTO addresses (user_id, city, street, house, apartment, postal_code, full_name, is_default, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false, now())
       RETURNING address_id`,
      [
        userId,
        address?.city || null,
        address?.street || null,
        houseValue,
        address?.apartment || null,
        address?.postalCode || null,
        address?.fullName || null
      ]
    );
    const addressId = addressRes.rows[0].address_id;

    const itemsJson = JSON.stringify(
      items.map(i => ({
        product_id: Number(i.product_id || i.id),
        quantity: Number(i.quantity || 1)
      }))
    );

    const orderRes = await client.query(
      `SELECT sp_create_order($1, $2, $3::json) AS order_id`,
      [userId, addressId, itemsJson]
    );
    const orderId = orderRes.rows[0].order_id;

    await client.query(
      `UPDATE orders SET delivery_method = $1, payment_method = $2 WHERE order_id = $3`,
      [deliveryMethod, paymentMethod, orderId]
    );

    await client.query('COMMIT');
    return orderId;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Order creation error:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

async function fetchOrdersByUser(userId, orderId) {
  let ordersRes, userClause = '', params = [], idx = 1;
  if (orderId) {
    userClause = 'o.order_id = $1';
    params = [orderId];
  } else {
    userClause = 'o.user_id = $1';
    params = [userId];
  }
  ordersRes = await pool.query(
    `SELECT
       o.order_id,
       o.user_id,
       o.total_amount,
       o.created_at,
       o.delivery_method,
       o.payment_method,
       COALESCE(s.code, 'unknown') AS status_code,
       COALESCE(s.name_orderstatuses, 'Неизвестно') AS status_name,
       a.city, a.street, a.house, a.apartment, a.postal_code, a.full_name
     FROM orders o
     LEFT JOIN order_statuses s ON s.status_id = o.status_id
     LEFT JOIN addresses a ON a.address_id = o.address_id
     WHERE ${userClause}
     ORDER BY o.created_at DESC`,
    params
  );

  if (ordersRes.rows.length === 0) return [];

  const orderIds = ordersRes.rows.map(r => r.order_id);
  const itemsRes = await pool.query(
    `SELECT
       oi.order_item_id,
       oi.order_id,
       oi.product_id,
       oi.quantity,
       oi.price,
       p.name_product,
       p.description as product_description,
       p.photo_url
     FROM order_items oi
     LEFT JOIN products p ON p.product_id = oi.product_id
     WHERE oi.order_id = ANY($1::int[])`,
    [orderIds]
  );

  const orderIdToItems = new Map();
  for (const row of itemsRes.rows) {
    if (!orderIdToItems.has(row.order_id)) orderIdToItems.set(row.order_id, []);
    orderIdToItems.get(row.order_id).push(row);
  }

  return ordersRes.rows.map(o => ({
    ...o,
    address_text: buildAddressText(o),
    items: orderIdToItems.get(o.order_id) || []
  }));
}

function buildAddressText(o) {
  const parts = [
    o.postal_code,
    o.city,
    [o.street, o.house].filter(Boolean).join(' '),
    o.apartment ? `кв. ${o.apartment}` : null,
    o.full_name
  ].filter(Boolean);
  return parts.join(', ');
}

module.exports = { insertOrderWithAddress, fetchOrdersByUser }; 