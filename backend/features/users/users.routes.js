// routes/users.js
const express = require('express');
const router = express.Router();
const {
  getUserRole,
  loginUser,
  registerUser,
  registerUserWithoutEmail,  // <-- новая функция
  getProfile,
  getUserPayments,
  updateProfile,
  checkPassword,
  deleteUserAccount,
  sendPasswordResetEmail,
  listUsers,
  updateUserRole, // <-- добавлено
} = require('./users.service');
const { logAuditEvent } = require('../../utils/auditLogger');

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
    
    // Записываем в журнал аудита
    await logAuditEvent({
      action: 'LOGIN',
      userId: user.userId,
      targetType: 'USER',
      targetId: user.userId,
      targetName: `${user.firstName} ${user.lastName}`,
      details: { email: user.email },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
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
    
    // Записываем в журнал аудита
    await logAuditEvent({
      action: 'CREATE_USER',
      userId: result.userId,
      targetType: 'USER',
      targetId: result.userId,
      targetName: `${firstName} ${lastName}`,
      details: { 
        email: email,
        role: result.role || 'client',
        method: 'self_registration'
      },
      severity: 'MEDIUM',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Регистрация без отправки писем (для админов)
router.post('/admin-create', async (req, res) => {
  const { firstName, lastName, email, password, role = 'client' } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email, password are required' });
  }
  try {
    const result = await registerUserWithoutEmail({ firstName, lastName, email, password, role });
    if (result?.conflict) return res.status(409).json({ error: 'Email already exists' });
    
    // Получаем ID администратора из токена (если есть)
    const adminUserId = req.user?.userId || 1; // Fallback на admin user
    
    // Записываем в журнал аудита
    await logAuditEvent({
      action: 'CREATE_USER',
      userId: adminUserId,
      targetType: 'USER',
      targetId: result.userId,
      targetName: `${firstName} ${lastName}`,
      details: { 
        email: email,
        role: role,
        method: 'admin_creation',
        createdBy: 'admin'
      },
      severity: 'MEDIUM',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
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

// Список пользователей (GET /api/users)
// В продакшене: сюда добавьте проверку авторизации и роли (middleware)
router.get('/', async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
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

// Обновление роли пользователя (PUT /api/users/role)
// В продакшене: проверка, что текущий пользователь — admin
router.put('/role', async (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId || !role) return res.status(400).json({ error: 'userId and role required' });

  try {
    const updated = await updateUserRole({ userId, role });
    
    // Получаем информацию о пользователе для аудита
    const userInfo = await getUserRole({ userId });
    const adminUserId = req.user?.userId || 1; // Fallback на admin user
    
    // Записываем в журнал аудита
    await logAuditEvent({
      action: 'CHANGE_ROLE',
      userId: adminUserId,
      targetType: 'USER',
      targetId: userId,
      targetName: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : `User ${userId}`,
      details: { 
        oldRole: updated.oldRole,
        newRole: role,
        changedBy: 'admin'
      },
      severity: 'HIGH',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.json(updated);
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
// В продакшене: проверка прав (admin)
router.delete('/delete', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    // Получаем информацию о пользователе перед удалением
    const userInfo = await getUserRole({ userId });
    const adminUserId = req.user?.userId || 1; // Fallback на admin user
    
    await deleteUserAccount(userId);
    
    // Записываем в журнал аудита
    await logAuditEvent({
      action: 'DELETE_USER',
      userId: adminUserId,
      targetType: 'USER',
      targetId: userId,
      targetName: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : `User ${userId}`,
      details: { 
        deletedUserEmail: userInfo?.email,
        deletedUserRole: userInfo?.role,
        deletedBy: 'admin'
      },
      severity: 'HIGH',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
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
