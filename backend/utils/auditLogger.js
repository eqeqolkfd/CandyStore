// auditLogger.js - Утилита для записи в журнал аудита
const { createAuditLog } = require('../features/audit/audit.service');

/**
 * Записывает действие в журнал аудита
 * @param {Object} params - Параметры записи
 * @param {string} params.action - Тип действия (LOGIN, CREATE_USER, etc.)
 * @param {number} params.userId - ID пользователя, выполнившего действие
 * @param {string} params.targetType - Тип объекта (USER, PRODUCT, ORDER)
 * @param {number} params.targetId - ID объекта
 * @param {string} params.targetName - Название объекта
 * @param {Object} params.details - Детальная информация
 * @param {string} params.severity - Уровень критичности (LOW, MEDIUM, HIGH)
 * @param {string} params.ipAddress - IP адрес
 * @param {string} params.userAgent - User Agent
 */
async function logAuditEvent({
  action,
  userId,
  targetType = null,
  targetId = null,
  targetName = null,
  details = {},
  severity = 'LOW',
  ipAddress = null,
  userAgent = null
}) {
  console.log('🔍 logAuditEvent вызвана:', { action, userId, targetName });
  try {
    const result = await createAuditLog({
      action,
      userId,
      targetType,
      targetId,
      targetName,
      details,
      severity,
      ipAddress,
      userAgent
    });
    console.log('✅ Запись аудита создана успешно:', result);
  } catch (error) {
    console.error('❌ Ошибка записи в журнал аудита:', error);
    // Не прерываем выполнение основного кода при ошибке аудита
  }
}

module.exports = {
  logAuditEvent
};
