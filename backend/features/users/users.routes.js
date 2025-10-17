const express = require('express');
const router = express.Router();
const pool = require('../../db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

function ensureEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

// Получить роли пользователя по его email или user_id
router.get('/roles', async (req, res) => {
  const { email, userId } = req.query;
  try {
    const result = await pool.query(
      `SELECT r.name_role
         FROM user_roles uR
         JOIN roles r ON r.role_id = uR.role_id
         JOIN users u ON u.user_id = uR.user_id
         WHERE ${email ? 'u.email = $1' : 'u.user_id = $1'}
         LIMIT 1`,
      [email || userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User or role not found' });
    res.json({ role: result.rows[0].name_role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Логин по email и паролю (простая проверка по password_hash)
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const userRes = await pool.query(
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
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const u = userRes.rows[0];
    // Простая проверка (в проде надо bcrypt.compare)
    if (String(u.password_hash) !== String(password)) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ userId: u.user_id, email: u.email, role: u.role || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Регистрация нового пользователя: уникальный email, роль client, JWT, письмо от admin email
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email, password are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Вставка пользователя
    const userIns = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, created_at)
       VALUES ($1,$2,$3,$4, now())
       RETURNING user_id, email`,
      [firstName, lastName, email, password]
    );
    const newUserId = userIns.rows[0].user_id;

    // Назначаем роль client (ищем по БД)
    const roleRes = await client.query('SELECT role_id FROM roles WHERE name_role = $1 LIMIT 1', ['client']);
    if (roleRes.rows.length === 0) throw new Error('Role client not found');
    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)', [newUserId, roleRes.rows[0].role_id]);

    await client.query('COMMIT');

    // Получаем email администратора из БД (первая запись пользователя с ролью admin)
    const adminRes = await pool.query(
      `SELECT u.email
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.user_id
         JOIN roles r ON r.role_id = ur.role_id
         WHERE r.name_role = 'admin'
         ORDER BY u.user_id ASC
         LIMIT 1`
    );
    const adminEmail = adminRes.rows[0]?.email;
    if (!adminEmail) {
      return res.status(500).json({ error: 'Admin email not found' });
    }

    const token = jwt.sign(
      { userId: newUserId, email, role: 'client' },
      ensureEnv('JWT_SECRET'),
      { expiresIn: '1h' }
    );

    // Отправка письма об успешной регистрации
    const transporter = nodemailer.createTransport({
      host: ensureEnv('SMTP_HOST'),
      port: Number(ensureEnv('SMTP_PORT')),
      secure: ensureEnv('SMTP_SECURE') === 'true',
      auth: {
        user: ensureEnv('SMTP_USER'),
        pass: ensureEnv('SMTP_PASS')
      }
    });

    await transporter.sendMail({
      from: adminEmail,
      to: email,
      subject: 'Успешная регистрация',
      text: `Здравствуйте, ${firstName}! Ваша регистрация в SweetShop прошла успешно.`,
      html: `<p>Здравствуйте, <b>${firstName}</b>!<br/>Ваша регистрация в SweetShop прошла успешно.</p>`
    });

    res.status(201).json({ userId: newUserId, email, role: 'client', token });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Профиль пользователя по userId
router.get('/me', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Платежи пользователя: выбираем платежи по всем его заказам
router.get('/payments', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
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
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;