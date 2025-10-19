import './Login.css';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();

  function validateEmail(val) {
    if (!val) return '';
    if (/[А-Яа-яЁё]/.test(val)) return 'Почта не должна содержать русские буквы';
    if (val.length > 255) return 'E-mail не должен превышать 255 символов';
    const pattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!pattern.test(val)) return 'Введите почту, как в примере "example@example.ru"';
    return '';
  }
  function validatePassword(val) {
    if (val.length < 8) return 'Пароль должен содержать не менее 8 символов';
    if (val.length > 16) return 'Пароль должен содержать не более 16 символов';
    if (!/^[A-Za-z0-9]+$/.test(val)) return 'Пароль должен содержать латинские буквы и цифры';
    if (!(/[A-Za-z]/.test(val) && /[0-9]/.test(val))) return 'Пароль должен содержать латинские буквы и цифры';
    return '';
  }
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const newErrors = {};
    const emailErr = validateEmail(email);
    if (!email) newErrors.email = 'Введите почту, как в примере "example@example.ru"';
    else if (emailErr) newErrors.email = emailErr;
    const passErr = validatePassword(password);
    if (!password) newErrors.password = 'Введите пароль';
    else if (passErr) newErrors.password = passErr;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const res = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data?.error || 'Ошибка входа');
        return;
      }
      if (data.role !== 'client') {
        setServerError('Доступ разрешён только пользователям с ролью клиента');
        return;
      }
      localStorage.setItem('currentUser', JSON.stringify({ userId: data.userId, email: data.email, role: data.role }));
      navigate('/');
    } catch (err) {
      setServerError('Сервер недоступен, попробуйте позже');
    }
  };
  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">Вход</h2>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              placeholder="example@example.ru"
              maxLength={255}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({ ...errors, email: validateEmail(e.target.value) });
              }}
              required
            />
            {errors.email && <div className="field-error">{errors.email}</div>}
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Пароль</label>
            <div className="input-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                maxLength={16}
                value={password}
                placeholder="Пароль: 8-16 символов"
                onChange={e => {
                  setPassword(e.target.value);
                  setErrors({ ...errors, password: validatePassword(e.target.value) });
                }}
                required
              />
              <button className="icon-eye-btn" type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
                {showPassword ? (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                    <path d="M5 5l12 12" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>
          {serverError && <div className="field-error">{serverError}</div>}
          <div className="form-actions">
            <button type="submit" className="auth-button">Войти</button>
            <div className="auth-links">
              <Link to="/register" className="link-secondary">Нет аккаунта? Регистрация</Link>
              <Link to="/forgot-password" className="link-secondary">Не помните пароль?</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;