const express = require('express');
const router = express.Router();
const {
  getUserRole,
  loginUser,
  registerUser,
  getProfile,
  getUserPayments,
  updateProfile,
  checkPassword,
  deleteUserAccount,
  sendPasswordResetEmail,
} = require('./users.service');

// Получить роль пользователя по email или userId
router.get('/roles', async (req, res) => {
  const { email, userId } = req.query;
  try {
    const role = await getUserRole({ email, userId });
    if (!role) return res.status(404).json({ error: 'User or role not found' });
    res.json({ role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Логин
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const user = await loginUser({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Регистрация
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email, password are required' });
  }
  try {
    const result = await registerUser({ firstName, lastName, email, password });
    if (result?.conflict) return res.status(409).json({ error: 'Email already exists' });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Профиль
router.get('/me', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const profile = await getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Платежи пользователя
router.get('/payments', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const payments = await getUserPayments(userId);
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Обновление профиля пользователя
router.put('/update', async (req, res) => {
  const { userId, first_name, last_name, oldPassword, newPassword } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!first_name && !last_name && !oldPassword && !newPassword) {
    return res.status(400).json({ error: 'At least one field (first_name, last_name, oldPassword, newPassword) is required' });
  }
  try {
    const updatedProfile = await updateProfile({ userId, first_name, last_name, oldPassword, newPassword });
    if (!updatedProfile) return res.status(404).json({ error: 'User not found' });
    res.json(updatedProfile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Проверка правильности пароля пользователя
router.post('/check-password', async (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) {
    return res.status(400).json({ error: 'userId and password are required' });
  }
  try {
    const isValid = await checkPassword(userId, password);
    res.json({ isValid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Удаление пользователя (и всего связанного)
router.delete('/delete', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    await deleteUserAccount(userId);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Отправка письма для восстановления пароля
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const result = await sendPasswordResetEmail(email);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;