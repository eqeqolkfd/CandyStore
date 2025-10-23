const {
  getUserRole,
  loginUser
} = require('../../../../features/users/users.service');

// Mock dependencies
jest.mock('../../../../features/users/users.repository', () => ({
  getUserRoleByEmailOrId: jest.fn(),
  getUserByEmail: jest.fn(),
  pool: {
    query: jest.fn()
  }
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

const {
  getUserRoleByEmailOrId,
  getUserByEmail,
  pool
} = require('../../../../features/users/users.repository');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

describe('👤 ПОЛЬЗОВАТЕЛИ - Аутентификация', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('🔐 Получение роли пользователя', () => {
    test('✅ должен возвращать роль пользователя по email', async () => {
      const mockRole = 'admin';
      getUserRoleByEmailOrId.mockResolvedValue(mockRole);

      const result = await getUserRole({ email: 'test@test.com' });

      expect(getUserRoleByEmailOrId).toHaveBeenCalledWith('test@test.com', undefined);
      expect(result).toBe(mockRole);
    });

    test('✅ должен возвращать роль пользователя по userId', async () => {
      const mockRole = 'client';
      getUserRoleByEmailOrId.mockResolvedValue(mockRole);

      const result = await getUserRole({ userId: 1 });

      expect(getUserRoleByEmailOrId).toHaveBeenCalledWith(undefined, 1);
      expect(result).toBe(mockRole);
    });
  });

  describe('🔑 Вход пользователя', () => {
    test('✅ должен возвращать данные пользователя с токеном для валидных учетных данных', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password',
        role: 'client'
      };

      getUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock_token');

      const result = await loginUser({
        email: 'test@test.com',
        password: 'password123'
      });

      expect(result).toEqual({
        userId: 1,
        email: 'test@test.com',
        role: 'client',
        token: 'mock_token'
      });
    });

    test('should return null for invalid email', async () => {
      getUserByEmail.mockResolvedValue(null);

      const result = await loginUser({
        email: 'nonexistent@test.com',
        password: 'password123'
      });

      expect(result).toBeNull();
    });

    test('should return null for invalid password', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password'
      };

      getUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const result = await loginUser({
        email: 'test@test.com',
        password: 'wrong_password'
      });

      expect(result).toBeNull();
    });

    test('should handle plain text password fallback', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@test.com',
        password_hash: 'plain_password',
        role: 'admin'
      };

      getUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);
      jwt.sign.mockReturnValue('mock_token');

      const result = await loginUser({
        email: 'test@test.com',
        password: 'plain_password'
      });

      expect(result).toEqual({
        userId: 1,
        email: 'test@test.com',
        role: 'admin',
        token: 'mock_token'
      });
    });

    test('should handle user without role', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password'
      };

      getUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock_token');

      const result = await loginUser({
        email: 'test@test.com',
        password: 'password123'
      });

      expect(result.role).toBeNull();
    });
  });
});
