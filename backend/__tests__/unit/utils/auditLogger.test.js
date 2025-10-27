const { logAuditEvent } = require('../../../utils/auditLogger');

jest.mock('../../../features/audit/audit.service', () => ({
  createAuditLog: jest.fn()
}));

const { createAuditLog } = require('../../../features/audit/audit.service');

describe('📝 УТИЛИТЫ - Логирование аудита', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('📋 Логирование события аудита', () => {
    test('✅ должен вызывать createAuditLog с правильными параметрами', async () => {
      const auditData = {
        action: 'CREATE',
        userId: 1,
        targetType: 'PRODUCT',
        targetId: 123,
        targetName: 'Test Product',
        details: { field: 'value' },
        severity: 'MEDIUM',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        beforeData: { old: 'value' },
        afterData: { new: 'value' }
      };

      createAuditLog.mockResolvedValue({ success: true });

      await logAuditEvent(auditData);

      expect(createAuditLog).toHaveBeenCalledWith({
        action: 'CREATE',
        userId: 1,
        targetType: 'PRODUCT',
        targetId: 123,
        targetName: 'Test Product',
        details: { field: 'value' },
        beforeData: { old: 'value' },
        afterData: { new: 'value' },
        severity: 'MEDIUM',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });
    });

    test('✅ должен обрабатывать минимальные параметры', async () => {
      const auditData = {
        action: 'LOGIN',
        userId: 1
      };

      createAuditLog.mockResolvedValue({ success: true });

      await logAuditEvent(auditData);

      expect(createAuditLog).toHaveBeenCalledWith({
        action: 'LOGIN',
        userId: 1,
        targetType: null,
        targetId: null,
        targetName: null,
        details: {},
        beforeData: null,
        afterData: null,
        severity: 'LOW',
        ipAddress: null,
        userAgent: null
      });
    });

    test('✅ должен корректно обрабатывать ошибки createAuditLog', async () => {
      const auditData = {
        action: 'CREATE',
        userId: 1
      };

      const error = new Error('Database connection failed');
      createAuditLog.mockRejectedValue(error);

      await expect(logAuditEvent(auditData)).resolves.toBeUndefined();
    });

    test('✅ должен обрабатывать null параметры', async () => {
      const auditData = {
        action: 'DELETE',
        userId: null,
        targetType: null,
        targetId: null,
        targetName: null,
        details: null,
        severity: null,
        ipAddress: null,
        userAgent: null,
        beforeData: null,
        afterData: null
      };

      createAuditLog.mockResolvedValue({ success: true });

      await logAuditEvent(auditData);

      expect(createAuditLog).toHaveBeenCalledWith({
        action: 'DELETE',
        userId: null,
        targetType: null,
        targetId: null,
        targetName: null,
        details: null,
        beforeData: null,
        afterData: null,
        severity: null,
        ipAddress: null,
        userAgent: null
      });
    });
  });
});
