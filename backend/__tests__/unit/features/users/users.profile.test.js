const {
  getProfile,
  getUserPayments,
  updateProfile,
  checkPassword,
  deleteUserAccount,
  listUsers
} = require('../../../../features/users/users.service');

jest.mock('../../../../features/users/users.repository', () => ({
  getUserProfileById: jest.fn(),
  getPaymentsByUserId: jest.fn(),
  getAllUsers: jest.fn(),
  deleteUserById: jest.fn(),
  getUserRoleByEmailOrId: jest.fn(),
  getAdminEmail: jest.fn(),
  pool: {
    connect: jest.fn(),
    query: jest.fn()
  }
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

const {
  getUserProfileById,
  getPaymentsByUserId,
  getAllUsers,
  deleteUserById,
  getUserRoleByEmailOrId,
  getAdminEmail,
  pool
} = require('../../../../features/users/users.repository');

const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

describe('👤 ПОЛЬЗОВАТЕЛИ - Профиль', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';
  });

  describe('👤 Получение профиля', () => {
    test('✅ должен возвращать профиль пользователя', async () => {
      const mockProfile = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com'
      };

      getUserProfileById.mockResolvedValue(mockProfile);

      const result = await getProfile(1);

      expect(getUserProfileById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('💳 Получение платежей', () => {
    test('✅ должен возвращать платежи пользователя', async () => {
      const mockPayments = [
        { payment_id: 1, amount: 100 },
        { payment_id: 2, amount: 200 }
      ];

      getPaymentsByUserId.mockResolvedValue(mockPayments);

      const result = await getUserPayments(1);

      expect(getPaymentsByUserId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockPayments);
    });
  });

  describe('✏️ Обновление профиля', () => {

    test('✅ должен возвращать null для несуществующего пользователя', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValue(mockClient);
      getUserProfileById.mockResolvedValue(null);

      const result = await updateProfile({
        userId: 999,
        first_name: 'John Updated'
      });

      expect(result).toBeNull();
    });

    test('✅ должен обрабатывать обновление пароля', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      const mockExistingUser = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com'
      };
      const mockUpdatedUser = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com',
        created_at: '2023-01-01'
      };

      pool.connect.mockResolvedValue(mockClient);
      getUserProfileById.mockResolvedValue(mockExistingUser);
      getUserRoleByEmailOrId.mockResolvedValue('client');
      getAdminEmail.mockResolvedValue('admin@test.com');

      mockClient.query.mockResolvedValueOnce({
        rows: [{ password_hash: 'old_hashed_password' }]
      });

      bcrypt.compare.mockResolvedValue(true);

      mockClient.query.mockResolvedValueOnce({
        rows: [mockUpdatedUser]
      });

      const mockTransporter = {
        sendMail: jest.fn()
      };
      nodemailer.createTransport.mockReturnValue(mockTransporter);

      const result = await updateProfile({
        userId: 1,
        oldPassword: 'old_password',
        newPassword: 'new_password'
      });

      expect(result).toEqual({
        ...mockUpdatedUser,
        role: 'client'
      });
    });
  });

  describe('🔐 Проверка пароля', () => {
    test('✅ должен возвращать true для валидного пароля', async () => {
      const mockResult = {
        rows: [{ password_hash: 'hashed_password' }]
      };
      pool.query.mockResolvedValue(mockResult);
      bcrypt.compare.mockResolvedValue(true);

      const result = await checkPassword(1, 'password123');

      expect(result).toBe(true);
    });

    test('✅ должен возвращать false для невалидного пароля', async () => {
      const mockResult = {
        rows: [{ password_hash: 'hashed_password' }]
      };
      pool.query.mockResolvedValue(mockResult);
      bcrypt.compare.mockResolvedValue(false);

      const result = await checkPassword(1, 'wrong_password');

      expect(result).toBe(false);
    });

    test('✅ должен возвращать false для несуществующего пользователя', async () => {
      const mockResult = { rows: [] };
      pool.query.mockResolvedValue(mockResult);

      const result = await checkPassword(999, 'password123');

      expect(result).toBe(false);
    });
  });

  describe('🗑️ Удаление аккаунта', () => {
    test('✅ должен удалять аккаунт пользователя', async () => {
      const mockResult = { success: true };
      deleteUserById.mockResolvedValue(mockResult);

      const result = await deleteUserAccount(1);

      expect(result).toEqual(mockResult);
      expect(deleteUserById).toHaveBeenCalledWith(1);
    });
  });

  describe('📋 Список пользователей', () => {
    test('✅ должен возвращать список пользователей', async () => {
      const mockUsers = [
        { user_id: 1, email: 'user1@test.com' },
        { user_id: 2, email: 'user2@test.com' }
      ];
      getAllUsers.mockResolvedValue(mockUsers);

      const result = await listUsers();

      expect(result).toEqual(mockUsers);
      expect(getAllUsers).toHaveBeenCalled();
    });
  });
});
