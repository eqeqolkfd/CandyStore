// audit.routes.js
const express = require('express');
const router = express.Router();
const {
  getAuditLogs,
  createAuditLog,
  getAuditStats
} = require('./audit.service');

// Получить журнал аудита
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, action, user, dateFrom, dateTo, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    
    const result = await getAuditLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      action,
      user,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder
    });
    
    res.json(result);
  } catch (e) {
    console.error('Ошибка в API аудита:', e);
    res.status(500).json({ error: e.message });
  }
});

// Создать запись аудита
router.post('/', async (req, res) => {
  try {
    const { action, userId, targetType, targetId, targetName, details, severity = 'LOW' } = req.body;
    
    if (!action || !userId) {
      return res.status(400).json({ error: 'action and userId are required' });
    }
    
    const auditLog = await createAuditLog({
      action,
      userId,
      targetType,
      targetId,
      targetName,
      details,
      severity
    });
    
    res.status(201).json(auditLog);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить статистику аудита
router.get('/stats', async (req, res) => {
  try {
    const stats = await getAuditStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
