const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  console.log('🔐 Проверка аутентификации для:', req.method, req.path);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('📋 Authorization header:', authHeader);
  console.log('🎫 Token:', token ? `${token.substring(0, 20)}...` : 'НЕТ');

  if (!token) {
    console.log('❌ Токен не предоставлен');
    return res.status(401).json({ success: false, message: 'Токен доступа не предоставлен' });
  }

  const jwtSecret = process.env.JWT_SECRET || '8f3c9a1b2e4d6f7a9b0c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4';
  console.log('🔑 JWT_SECRET установлен:', !!process.env.JWT_SECRET);

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      console.log('❌ Ошибка верификации токена:', err.message);
      return res.status(403).json({ success: false, message: 'Недействительный токен' });
    }
    console.log('✅ Токен валиден, пользователь:', user);
    req.user = user;
    next();
  });
};

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
