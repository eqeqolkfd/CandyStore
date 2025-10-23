const { authenticateToken, requireAdmin } = require('../../../middleware/auth');

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

const jwt = require('jsonwebtoken');

describe('🔐 БЕЗОПАСНОСТЬ - Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🎫 Аутентификация токена', () => {
    test('✅ должен возвращать 401 если токен не предоставлен', () => {
      const req = { headers: {} };
      const res = { 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn() 
      };
      const next = jest.fn();
      
      authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Токен доступа не предоставлен'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('✅ должен возвращать 401 если нет заголовка authorization', () => {
      const req = { headers: { authorization: null } };
      const res = { 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn() 
      };
      const next = jest.fn();
      
      authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Токен доступа не предоставлен'
      });
    });

    test('✅ должен возвращать 403 если токен невалидный', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = { 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn() 
      };
      const next = jest.fn();
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });
      
      authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Недействительный токен'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('✅ должен вызывать next если токен валидный', () => {
      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 1, role: 'admin' });
      });
      
      authenticateToken(req, res, next);
      
      expect(req.user).toEqual({ id: 1, role: 'admin' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('👑 Требование прав администратора', () => {
    test('✅ должен возвращать 401 если пользователь не аутентифицирован', () => {
      const req = {};
      const res = { 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn() 
      };
      const next = jest.fn();
      
      requireAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Пользователь не аутентифицирован'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('✅ должен возвращать 403 если пользователь не администратор', () => {
      const req = { user: { id: 1, role: 'user' } };
      const res = { 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn() 
      };
      const next = jest.fn();
      
      requireAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Доступ запрещен. Требуются права администратора'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('✅ должен вызывать next если пользователь администратор', () => {
      const req = { user: { id: 1, role: 'admin' } };
      const res = { 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn() 
      };
      const next = jest.fn();
      
      requireAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
