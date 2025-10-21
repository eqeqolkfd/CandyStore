const jwt = require('jsonwebtoken');

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Токен доступа не предоставлен' });
  }

  jwt.verify(token, process.env.JWT_SECRET || '8f3c9a1b2e4d6f7a9b0c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
};

// Middleware для проверки роли администратора
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Пользователь не аутентифицирован' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Доступ запрещен. Требуются права администратора' });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin
};
