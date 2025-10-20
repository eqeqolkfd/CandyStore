const pool = require('../../db');

async function getUserRoleByEmailOrId(email, userId) {
  const result = await pool.query(
    `SELECT r.name_role
       FROM user_roles uR
       JOIN roles r ON r.role_id = uR.role_id
       JOIN users u ON u.user_id = uR.user_id
       WHERE ${email ? 'u.email = $1' : 'u.user_id = $1'}
       LIMIT 1`,
    [email || userId]
  );
  return result.rows[0]?.name_role || null;
}

async function getUserByEmail(email) {
  const result = await pool.query(
    `SELECT u.user_id, u.email, u.password_hash,
            (SELECT r.name_role
               FROM user_roles ur
               JOIN roles r ON r.role_id = ur.role_id
               WHERE ur.user_id = u.user_id
               LIMIT 1) AS role
       FROM users u
       WHERE u.email = $1
       LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function emailExists(client, email) {
  const result = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
  return result.rows.length > 0;
}

async function insertUser(client, { firstName, lastName, email, password }) {
  const result = await client.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, created_at)
     VALUES ($1,$2,$3,$4, now())
     RETURNING user_id, email`,
    [firstName, lastName, email, password]
  );
  return result.rows[0];
}

async function getRoleIdByName(client, roleName) {
  const result = await client.query('SELECT role_id FROM roles WHERE name_role = $1 LIMIT 1', [roleName]);
  return result.rows[0]?.role_id || null;
}

async function assignUserRole(client, userId, roleId) {
  await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)', [userId, roleId]);
}

async function getAdminEmail() {
  const result = await pool.query(
    `SELECT u.email
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.user_id
       JOIN roles r ON r.role_id = ur.role_id
       WHERE r.name_role = 'admin'
       ORDER BY u.user_id ASC
       LIMIT 1`
  );
  return result.rows[0]?.email || null;
}

async function getUserProfileById(userId) {
  const result = await pool.query(
    `SELECT u.user_id, u.first_name, u.last_name, u.email, u.created_at,
            (SELECT r.name_role
               FROM user_roles ur
               JOIN roles r ON r.role_id = ur.role_id
               WHERE ur.user_id = u.user_id
               LIMIT 1) AS role
       FROM users u
       WHERE u.user_id = $1
       LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getPaymentsByUserId(userId) {
  const result = await pool.query(
    `SELECT p.payment_id,
            p.order_id,
            p.amount,
            p.method_payments,
            p.status AS payment_status,
            p.created_at,
            s.code  AS order_status_code,
            s.name_orderstatuses AS order_status_name
       FROM payments p
       JOIN orders o ON o.order_id = p.order_id
       LEFT JOIN order_statuses s ON s.status_id = o.status_id
      WHERE o.user_id = $1
      ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getAllUsers() {
  const result = await pool.query(
    `SELECT u.user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.created_at,
            (SELECT r.name_role
               FROM user_roles ur
               JOIN roles r ON r.role_id = ur.role_id
               WHERE ur.user_id = u.user_id
               LIMIT 1) AS role
       FROM users u
       ORDER BY u.user_id ASC`
  );
  return result.rows;
}

async function setUserRole(userId, roleName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT role_id FROM roles WHERE name_role = $1 LIMIT 1', [roleName]);
    const roleId = r.rows[0]?.role_id;
    if (!roleId) {
      throw new Error('Role not found: ' + roleName);
    }

    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)', [userId, roleId]);

    await client.query('COMMIT');
    return { userId, role: roleName };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

async function deleteUserById(userId) {
  await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
}

module.exports = {
  getUserRoleByEmailOrId,
  getUserByEmail,
  emailExists,
  insertUser,
  getRoleIdByName,
  assignUserRole,
  getAdminEmail,
  getUserProfileById,
  getPaymentsByUserId,
  getAllUsers,
  setUserRole,
  deleteUserById,
  pool
};
