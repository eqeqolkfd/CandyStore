// users.service.js
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const {
  getUserRoleByEmailOrId,
  getUserByEmail,
  emailExists,
  insertUser,
  getRoleIdByName,
  assignUserRole,
  getAdminEmail,
  getUserProfileById,
  getPaymentsByUserId,
  getAllUsers,
  setUserRole,        // <-- новый репозиторный метод
  deleteUserById,
  pool,
} = require('./users.repository');

function ensureEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function getUserRole({ email, userId }) {
  return await getUserRoleByEmailOrId(email, userId);
}

async function loginUser({ email, password }) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  
  // Проверяем пароль (может быть хешированный или новый сгенерированный)
  if (await bcrypt.compare(password, user.password_hash)) {
    return { userId: user.user_id, email: user.email, role: user.role || null };
  }
  
  // Если bcrypt не сработал, проверяем как обычную строку (для новых сгенерированных паролей)
  if (password === user.password_hash) {
    return { userId: user.user_id, email: user.email, role: user.role || null };
  }
  
  return null;
}

async function registerUser({ firstName, lastName, email, password }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await emailExists(client, email);
    if (exists) {
      await client.query('ROLLBACK');
      return { conflict: true };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const inserted = await insertUser(client, { firstName, lastName, email, password: hashedPassword });
    const roleId = await getRoleIdByName(client, 'client');
    if (!roleId) throw new Error('Role client not found');
    await assignUserRole(client, inserted.user_id, roleId);

    await client.query('COMMIT');

    const adminEmail = await getAdminEmail();
    if (!adminEmail) throw new Error('Admin email not found');

    const token = jwt.sign(
      { userId: inserted.user_id, email, role: 'client' },
      ensureEnv('JWT_SECRET'),
      { expiresIn: '1h' }
    );

    const transporter = nodemailer.createTransport({
      host: ensureEnv('SMTP_HOST'),
      port: Number(ensureEnv('SMTP_PORT')),
      secure: ensureEnv('SMTP_SECURE') === 'true',
      auth: {
        user: ensureEnv('SMTP_USER'),
        pass: ensureEnv('SMTP_PASS')
      }
    });

    await transporter.sendMail({
      from: adminEmail,
      to: email,
      subject: 'Добро пожаловать в SweetShop!',
      text: `Здравствуйте, ${firstName}! Ваш профиль в SweetShop успешно создан. Ваш пароль: ${password}\nЕго хеш: ${hashedPassword}`,
      html: `<p>Здравствуйте, <b>${firstName}</b>!<br/>Ваш профиль в SweetShop успешно создан.<br/><b>Ваш пароль: </b>${password}<br/><b>Его хеш: </b>${hashedPassword}</p>`
    });

    return { userId: inserted.user_id, email, role: 'client', token };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

// Новая функция для регистрации без отправки писем (для админов)
async function registerUserWithoutEmail({ firstName, lastName, email, password, role = 'client' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await emailExists(client, email);
    if (exists) {
      await client.query('ROLLBACK');
      return { conflict: true };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const inserted = await insertUser(client, { firstName, lastName, email, password: hashedPassword });
    const roleId = await getRoleIdByName(client, role);
    if (!roleId) throw new Error(`Role ${role} not found`);
    await assignUserRole(client, inserted.user_id, roleId);

    await client.query('COMMIT');

    return { userId: inserted.user_id, email, role };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

async function getProfile(userId) {
  const profile = await getUserProfileById(userId);
  return profile;
}

async function getUserPayments(userId) {
  return await getPaymentsByUserId(userId);
}

async function updateProfile({ userId, first_name, last_name, oldPassword, newPassword }) {
  const client = await pool.connect();
  try {
    const existingUser = await getUserProfileById(userId);
    if (!existingUser) {
      return null;
    }

  if (oldPassword && newPassword) {
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE user_id = $1',
        [userId]
      );
      if (userResult.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }
      const currentPasswordHash = userResult.rows[0].password_hash;
      let isValid = false;
      try {
        isValid = await bcrypt.compare(oldPassword, currentPasswordHash);
      } catch (_) {
        isValid = false;
      }
      if (!isValid) {
        isValid = String(currentPasswordHash) === String(oldPassword);
      }
      if (!isValid) {
        throw new Error('Неверный старый пароль');
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updateFields.push(`first_name = $${paramIndex++}`);
      updateValues.push(first_name);
    }

    if (last_name !== undefined) {
      updateFields.push(`last_name = $${paramIndex++}`);
      updateValues.push(last_name);
    }

    if (newPassword !== undefined && newPassword.trim() !== '') {
      updateFields.push(`password_hash = $${paramIndex++}`);
      updateValues.push(newPassword);
    }

    if (updateFields.length === 0) {
      return existingUser;
    }

    updateValues.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING user_id, first_name, last_name, email, created_at
    `;

    const result = await client.query(query, updateValues);
    
    if (result.rows.length === 0) {
      return null;
    }

    const updatedUser = result.rows[0];
    
    const role = await getUserRoleByEmailOrId(null, userId);

    if (
      newPassword &&
      role === 'client' &&
      updatedUser.email
    ) {
      try {
        const adminEmail = await getAdminEmail();
        if (adminEmail) {
          const transporter = nodemailer.createTransport({
            host: ensureEnv('SMTP_HOST'),
            port: Number(ensureEnv('SMTP_PORT')),
            secure: ensureEnv('SMTP_SECURE') === 'true',
            auth: {
              user: ensureEnv('SMTP_USER'),
              pass: ensureEnv('SMTP_PASS')
            }
          })
          await transporter.sendMail({
            from: adminEmail,
            to: updatedUser.email,
            subject: 'Ваш пароль был изменен!',
            text:
              `Здравствуйте, ${updatedUser.first_name}! Ваш пароль успешно изменён. Новый пароль: ${newPassword}`,
            html:
              `<p>Здравствуйте, <b>${updatedUser.first_name}</b>!<br/>Ваш пароль успешно изменён.<br/><b>Новый пароль: </b>${newPassword}</p>`
          });
        }
      } catch(e) {
        console.error('Не удалось отправить письмо о смене пароля:', e);
      }
    }

    return {
      ...updatedUser,
      role: role || 'client'
    };

  } finally {
    client.release();
  }
}

async function checkPassword(userId, password) {
  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return false;
    }
    const currentPasswordHash = result.rows[0].password_hash;
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, currentPasswordHash);
    } catch (_) {
      isValid = false;
    }
    if (!isValid) {
      isValid = String(currentPasswordHash) === String(password);
    }
    return isValid;
  } catch (error) {
    console.error('Ошибка проверки пароля:', error);
    return false;
  }
}

async function deleteUserAccount(userId) {
  return deleteUserById(userId);
}

// Возвращает список пользователей (без password_hash), с ролью
async function listUsers() {
  const rows = await getAllUsers();
  return rows;
}

// Обновление роли пользователя (admin action)
// Валидация роли и делегирование репозиторию
async function updateUserRole({ userId, role }) {
  if (!userId) throw new Error('userId required');
  if (!role) throw new Error('role required');

  const allowed = ['client', 'manager', 'admin'];
  if (!allowed.includes(String(role).toLowerCase())) {
    throw new Error('Invalid role');
  }

  // Репозиторий выполнит транзакцию: удалит старые роли и добавит новую
  const updated = await setUserRole(userId, String(role).toLowerCase());
  return updated; // { userId, role }
}


// Функции для восстановления пароля и генерации
function generateRandomPassword() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  
  let password = '';
  password += letters[Math.floor(Math.random() * letters.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  const remainingLength = 14;
  const allChars = letters + numbers;
  
  for (let i = 0; i < remainingLength; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function sendPasswordResetEmail(email) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Пользователь с таким email не найден');
  }

  if (user.role !== 'client') {
    throw new Error('Восстановление пароля доступно только для клиентов');
  }

  const newPassword = generateRandomPassword();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2',
      [newPassword, user.user_id]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const adminEmail = await getAdminEmail();
  try {
    const transporter = nodemailer.createTransport({
      host: ensureEnv('SMTP_HOST'),
      port: Number(ensureEnv('SMTP_PORT')),
      secure: ensureEnv('SMTP_SECURE') === 'true',
      auth: {
        user: ensureEnv('SMTP_USER'),
        pass: ensureEnv('SMTP_PASS')
      }
    });

    await transporter.sendMail({
      from: adminEmail,
      to: email,
      subject: 'Восстановление пароля - Кондитерская',
      text: `Здравствуйте, ${user.first_name}! По вашему запросу администратор сгенерировал новый пароль для вашего аккаунта. Ваш новый пароль: ${newPassword}`,
      html: `<p>Здравствуйте, <b>${user.first_name}</b>!<br/>По вашему запросу администратор сгенерировал новый пароль для вашего аккаунта.<br/><b>Ваш новый пароль: </b>${newPassword}</p>`
    });
  } catch (emailError) {
    console.error('Ошибка отправки email:', emailError.message);
  }

  console.log('=== ВОССТАНОВЛЕНИЕ ПАРОЛЯ ===');
  console.log(`От: ${adminEmail}`);
  console.log(`Кому: ${email}`);
  console.log(`Новый пароль: ${newPassword}`);
  console.log('===============================');

  return { 
    success: true, 
    message: 'Письмо с новым паролем отправлено на вашу почту от администратора',
    newPassword: newPassword
  };
}

module.exports = {
  getUserRole,
  loginUser,
  registerUser,
  registerUserWithoutEmail,  // <-- новая функция
  getProfile,
  getUserPayments,
  updateProfile,
  checkPassword,
  deleteUserAccount,
  listUsers,
  updateUserRole,      // <-- экспортируем
  sendPasswordResetEmail
};
