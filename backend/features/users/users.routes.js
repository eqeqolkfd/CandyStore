const express = require('express');
const router = express.Router();
const {
  getUserRole,
  loginUser,
  registerUser,
  registerUserWithoutEmail,
  getProfile,
  getUserPayments,
  updateProfile,
  checkPassword,
  deleteUserAccount,
  sendPasswordResetEmail,
  listUsers,
  updateUserRole,
} = require('./users.service');
const { logAuditEvent } = require('../../utils/auditLogger');

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

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const user = await loginUser({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const userProfile = await getProfile(user.userId).catch(() => null);

    await logAuditEvent({
      action: 'LOGIN',
      userId: user.userId,
      targetType: 'USER',
      targetId: user.userId,
      targetName: userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || `User ${user.userId}` : `User ${user.userId}`,
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

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email, password are required' });
  }
  try {
    const result = await registerUser({ firstName, lastName, email, password });
    if (result?.conflict) return res.status(409).json({ error: 'Email already exists' });

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

router.post('/admin-create', async (req, res) => {
  const { firstName, lastName, email, password, role = 'client' } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email, password are required' });
  }
  try {
    const result = await registerUserWithoutEmail({ firstName, lastName, email, password, role });
    if (result?.conflict) return res.status(409).json({ error: 'Email already exists' });

    const adminUserId = req.user?.userId || 1;
    
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

router.get('/', async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/update', async (req, res) => {
  const { userId, first_name, last_name, oldPassword, newPassword, actorId: bodyActorId, actorRole: bodyActorRole } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!first_name && !last_name && !oldPassword && !newPassword) {
    return res.status(400).json({ error: 'At least one field (first_name, last_name, oldPassword, newPassword) is required' });
  }
  try {
    const beforeProfile = await getProfile(userId).catch(() => null);

    const updatedProfile = await updateProfile({ userId, first_name, last_name, oldPassword, newPassword });
    if (!updatedProfile) return res.status(404).json({ error: 'User not found' });

    const actorId = req.user?.userId || bodyActorId || userId;
    const actorRole = (req.user?.role || bodyActorRole || '').toLowerCase();
    const isAdminActor = actorRole === 'admin';
    const isSelfUpdate = String(actorId) === String(userId);
    const actionName = (isAdminActor && !isSelfUpdate) ? 'UPDATE_USER' : 'UPDATE_PROFILE';

    await logAuditEvent({
      action: actionName,
      userId: actorId,
      targetType: 'USER',
      targetId: userId,
      targetName: `${updatedProfile.first_name || ''} ${updatedProfile.last_name || ''}`.trim(),
      details: {
        updatedFields: {
          first_name: first_name !== undefined,
          last_name: last_name !== undefined
        }
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      beforeData: beforeProfile ? {
        user_id: beforeProfile.user_id,
        first_name: beforeProfile.first_name,
        last_name: beforeProfile.last_name,
        email: beforeProfile.email
      } : {},
      afterData: {
        user_id: updatedProfile.user_id,
        first_name: updatedProfile.first_name,
        last_name: updatedProfile.last_name,
        email: updatedProfile.email
      }
    });

    if (newPassword) {
      await logAuditEvent({
        action: 'CHANGE_PASSWORD',
        userId: userId,
        targetType: 'USER',
        targetId: userId,
        targetName: `${updatedProfile.first_name || ''} ${updatedProfile.last_name || ''}`.trim(),
        details: { byUser: true },
        severity: 'MEDIUM',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        beforeData: {},
        afterData: {}
      });
    }
    res.json(updatedProfile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (userId) {
      await logAuditEvent({
        action: 'LOGOUT',
        userId,
        targetType: 'USER',
        targetId: userId,
        targetName: `User ${userId}`,
        details: {},
        severity: 'LOW',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        beforeData: {},
        afterData: {}
      });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/role', async (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId || !role) return res.status(400).json({ error: 'userId and role required' });

  try {
    const beforeProfile = await getProfile(userId).catch(() => null);
    const updated = await updateUserRole({ userId, role });

    const userInfo = await getProfile(userId).catch(()=>null);
    const adminUserId = req.user?.userId || 1;

    await logAuditEvent({
      action: 'CHANGE_ROLE',
      userId: adminUserId,
      targetType: 'USER',
      targetId: userId,
      targetName: userInfo ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || `User ${userId}` : `User ${userId}`,
      details: { 
        oldRole: updated.oldRole,
        newRole: role,
        changedBy: 'admin'
      },
      severity: 'HIGH',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      beforeData: beforeProfile ? {
        user_id: beforeProfile.user_id,
        first_name: beforeProfile.first_name,
        last_name: beforeProfile.last_name,
        email: beforeProfile.email,
        role: updated.oldRole
      } : { role: updated.oldRole },
      afterData: {
        user_id: userId,
        role: role
      }
    });
    
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

router.delete('/delete', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const userInfo = await getUserRole({ userId });
    const adminUserId = req.user?.userId || 1;
    
    await deleteUserAccount(userId);

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
