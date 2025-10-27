const {
  updateUserRole,
  sendPasswordResetEmail
} = require('../../../../features/users/users.service');

jest.mock('../../../../features/users/users.repository', () => ({
  setUserRole: jest.fn(),
  getUserByEmail: jest.fn(),
  getAdminEmail: jest.fn(),
  pool: {
    connect: jest.fn(),
    query: jest.fn()
  }
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

const {
  setUserRole,
  getUserByEmail,
  getAdminEmail,
  pool
} = require('../../../../features/users/users.repository');

const nodemailer = require('nodemailer');

describe('👤 ПОЛЬЗОВАТЕЛИ - Роли', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';
  });

  describe('👑 Обновление роли пользователя', () => {
    test('✅ должен успешно обновлять роль пользователя', async () => {
      const mockUpdated = { user_id: 1, role: 'manager' };
      setUserRole.mockResolvedValue(mockUpdated);

      const result = await updateUserRole({
        userId: 1,
        role: 'manager'
      });

      expect(setUserRole).toHaveBeenCalledWith(1, 'manager');
      expect(result).toEqual(mockUpdated);
    });

    test('✅ должен обрабатывать роли без учета регистра', async () => {
      const mockUpdated = { user_id: 1, role: 'admin' };
      setUserRole.mockResolvedValue(mockUpdated);

      const result = await updateUserRole({
        userId: 1,
        role: 'ADMIN'
      });

      expect(setUserRole).toHaveBeenCalledWith(1, 'admin');
      expect(result).toEqual(mockUpdated);
    });

    test('✅ должен выбрасывать ошибку для невалидной роли', async () => {
      await expect(updateUserRole({
        userId: 1,
        role: 'invalid_role'
      })).rejects.toThrow('Invalid role');
    });

    test('✅ должен выбрасывать ошибку для отсутствующего userId', async () => {
      await expect(updateUserRole({
        role: 'admin'
      })).rejects.toThrow('userId required');
    });

    test('✅ должен выбрасывать ошибку для отсутствующей роли', async () => {
      await expect(updateUserRole({
        userId: 1
      })).rejects.toThrow('role required');
    });

    test('✅ должен обрабатывать все валидные роли', async () => {
      const validRoles = ['client', 'manager', 'admin'];
      
      for (const role of validRoles) {
        const mockUpdated = { user_id: 1, role };
        setUserRole.mockResolvedValue(mockUpdated);

        const result = await updateUserRole({
          userId: 1,
          role
        });

        expect(result.role).toBe(role);
      }
    });
  });

  describe('📧 Отправка email для сброса пароля', () => {
    test('✅ должен отправлять email для сброса пароля клиенту', async () => {
      const mockUser = {
        user_id: 1,
        first_name: 'John',
        email: 'john@test.com',
        role: 'client'
      };
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const mockAdminEmail = 'admin@test.com';
      const mockTransporter = {
        sendMail: jest.fn()
      };

      getUserByEmail.mockResolvedValue(mockUser);
      pool.connect.mockResolvedValue(mockClient);
      getAdminEmail.mockResolvedValue(mockAdminEmail);
      nodemailer.createTransport.mockReturnValue(mockTransporter);

      mockClient.query.mockResolvedValue({});

      const result = await sendPasswordResetEmail('john@test.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Письмо с новым паролем отправлено');
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    test('✅ должен выбрасывать ошибку для несуществующего пользователя', async () => {
      getUserByEmail.mockResolvedValue(null);

      await expect(sendPasswordResetEmail('nonexistent@test.com'))
        .rejects.toThrow('Пользователь с таким email не найден');
    });

    test('✅ должен выбрасывать ошибку для не-клиента', async () => {
      const mockUser = {
        user_id: 1,
        first_name: 'Admin',
        email: 'admin@test.com',
        role: 'admin'
      };

      getUserByEmail.mockResolvedValue(mockUser);

      await expect(sendPasswordResetEmail('admin@test.com'))
        .rejects.toThrow('Восстановление пароля доступно только для клиентов');
    });

    test('✅ должен обрабатывать ошибки базы данных при сбросе пароля', async () => {
      const mockUser = {
        user_id: 1,
        first_name: 'John',
        email: 'john@test.com',
        role: 'client'
      };
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const error = new Error('Database connection failed');

      getUserByEmail.mockResolvedValue(mockUser);
      pool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockRejectedValue(error);

      await expect(sendPasswordResetEmail('john@test.com'))
        .rejects.toThrow('Database connection failed');
    });

    test('✅ должен корректно обрабатывать ошибки отправки email', async () => {
      const mockUser = {
        user_id: 1,
        first_name: 'John',
        email: 'john@test.com',
        role: 'client'
      };
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const mockAdminEmail = 'admin@test.com';
      const mockTransporter = {
        sendMail: jest.fn()
      };

      getUserByEmail.mockResolvedValue(mockUser);
      pool.connect.mockResolvedValue(mockClient);
      getAdminEmail.mockResolvedValue(mockAdminEmail);
      nodemailer.createTransport.mockReturnValue(mockTransporter);

      mockClient.query.mockResolvedValue({});
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await sendPasswordResetEmail('john@test.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Письмо с новым паролем отправлено');
    });
  });
});
