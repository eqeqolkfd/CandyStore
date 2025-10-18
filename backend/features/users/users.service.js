const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
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
  if (String(user.password_hash) !== String(password)) return null;
  return { userId: user.user_id, email: user.email, role: user.role || null };
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

    const inserted = await insertUser(client, { firstName, lastName, email, password });
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
      subject: 'Успешная регистрация',
      text: `Здравствуйте, ${firstName}! Ваша регистрация в SweetShop прошла успешно.`,
      html: `<p>Здравствуйте, <b>${firstName}</b>!<br/>Ваша регистрация в SweetShop прошла успешно.</p>`
    });

    return { userId: inserted.user_id, email, role: 'client', token };
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
    // Проверяем, существует ли пользователь
    const existingUser = await getUserProfileById(userId);
    if (!existingUser) {
      return null;
    }

    // Если пытаемся изменить пароль, проверяем старый пароль
    if (oldPassword && newPassword) {
      // Получаем текущий пароль пользователя
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }
      
      const currentPasswordHash = userResult.rows[0].password_hash;
      
      // Проверяем, совпадает ли старый пароль с текущим
      if (String(currentPasswordHash) !== String(oldPassword)) {
        throw new Error('Неверный старый пароль');
      }
    }

    // Подготавливаем запрос обновления
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
      return existingUser; // Ничего не обновляем
    }

    // Добавляем userId в конец для WHERE условия
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
    
    // Получаем роль пользователя
    const role = await getUserRoleByEmailOrId(null, userId);

    // == Отправка уведомления о смене пароля клиенты ==
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
    // Получаем текущий пароль пользователя
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      console.log('Пользователь не найден:', userId);
      return false; // Пользователь не найден
    }
    
    const currentPasswordHash = result.rows[0].password_hash;
    
    // Добавляем логирование для отладки
    console.log('Проверка пароля для userId:', userId);
    console.log('Хранимый пароль:', currentPasswordHash);
    console.log('Введенный пароль:', password);
    console.log('Сравнение:', String(currentPasswordHash) === String(password));
    
    // Сравниваем пароли точно так же, как в loginUser
    return String(currentPasswordHash) === String(password);
    
  } catch (error) {
    console.error('Ошибка проверки пароля:', error);
    return false;
  }
}

module.exports = {
  getUserRole,
  loginUser,
  registerUser,
  getProfile,
  getUserPayments,
  updateProfile,
  checkPassword,
};



