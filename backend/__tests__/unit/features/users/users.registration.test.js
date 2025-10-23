const {
  registerUser,
  registerUserWithoutEmail
} = require('../../../../features/users/users.service');

// Mock dependencies
jest.mock('../../../../features/users/users.repository', () => ({
  emailExists: jest.fn(),
  insertUser: jest.fn(),
  getRoleIdByName: jest.fn(),
  assignUserRole: jest.fn(),
  getAdminEmail: jest.fn(),
  pool: {
    connect: jest.fn(),
    query: jest.fn()
  }
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn()
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

const {
  emailExists,
  insertUser,
  getRoleIdByName,
  assignUserRole,
  getAdminEmail,
  pool
} = require('../../../../features/users/users.repository');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

describe('👤 ПОЛЬЗОВАТЕЛИ - Регистрация', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';
  });

  describe('📝 Регистрация пользователя', () => {
    test('✅ должен успешно регистрировать нового пользователя', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const mockInserted = { user_id: 1 };
      const mockRoleId = 2;
      const mockAdminEmail = 'admin@test.com';
      const mockTransporter = {
        sendMail: jest.fn()
      };

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(false);
      bcrypt.hash.mockResolvedValue('hashed_password');
      insertUser.mockResolvedValue(mockInserted);
      getRoleIdByName.mockResolvedValue(mockRoleId);
      getAdminEmail.mockResolvedValue(mockAdminEmail);
      nodemailer.createTransport.mockReturnValue(mockTransporter);
      jwt.sign.mockReturnValue('mock_token');

      const result = await registerUser({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123'
      });

      expect(result).toEqual({
        userId: 1,
        email: 'john@test.com',
        role: 'client',
        token: 'mock_token'
      });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('✅ должен возвращать конфликт для существующего email', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(true);

      const result = await registerUser({
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@test.com',
        password: 'password123'
      });

      expect(result).toEqual({ conflict: true });
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('✅ должен обрабатывать ошибки базы данных при регистрации', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const error = new Error('Database connection failed');

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(false);
      bcrypt.hash.mockRejectedValue(error);

      await expect(registerUser({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123'
      })).rejects.toThrow('Database connection failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('✅ должен обрабатывать ошибку отсутствующей роли', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(false);
      bcrypt.hash.mockResolvedValue('hashed_password');
      insertUser.mockResolvedValue({ user_id: 1 });
      getRoleIdByName.mockResolvedValue(null);

      await expect(registerUser({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123'
      })).rejects.toThrow('Role client not found');
    });
  });

  describe('📧 Регистрация без email', () => {
    test('✅ должен регистрировать пользователя без отправки email', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const mockInserted = { user_id: 1 };
      const mockRoleId = 1;

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(false);
      bcrypt.hash.mockResolvedValue('hashed_password');
      insertUser.mockResolvedValue(mockInserted);
      getRoleIdByName.mockResolvedValue(mockRoleId);

      const result = await registerUserWithoutEmail({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123',
        role: 'admin'
      });

      expect(result).toEqual({
        userId: 1,
        email: 'john@test.com',
        role: 'admin'
      });
    });

    test('✅ должен использовать роль клиента по умолчанию', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const mockInserted = { user_id: 1 };
      const mockRoleId = 2;

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(false);
      bcrypt.hash.mockResolvedValue('hashed_password');
      insertUser.mockResolvedValue(mockInserted);
      getRoleIdByName.mockResolvedValue(mockRoleId);

      const result = await registerUserWithoutEmail({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123'
      });

      expect(result.role).toBe('client');
    });

    test('✅ должен возвращать конфликт для существующего email', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValue(mockClient);
      emailExists.mockResolvedValue(true);

      const result = await registerUserWithoutEmail({
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@test.com',
        password: 'password123'
      });

      expect(result).toEqual({ conflict: true });
    });
  });
});
