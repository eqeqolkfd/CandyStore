const { createAuditLog } = require('../features/audit/audit.service');

async function logAuditEvent({
  action,
  userId,
  targetType = null,
  targetId = null,
  targetName = null,
  details = {},
  severity = 'LOW',
  ipAddress = null,
  userAgent = null,
  beforeData = null,
  afterData = null
}) {
  try {
    const result = await createAuditLog({
      action,
      userId,
      targetType,
      targetId,
      targetName,
      details,
      beforeData,
      afterData,
      severity,
      ipAddress,
      userAgent
    });
  } catch (error) {
  }
}

module.exports = {
  logAuditEvent
};