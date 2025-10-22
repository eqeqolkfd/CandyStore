import './Register.css';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../../../constants/api';

function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();

  function validateEmail(val) {
    if (!val) return '';
    if (/[А-Яа-яЁё]/.test(val)) return 'Почта не должна содержать русские буквы';
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
  function validateName(val) {
    if (val.length > 50) return 'Максимум 50 символов';
    return '';
  }
  function validateLastName(val) {
    if (val.length > 50) return 'Максимум 50 символов';
    return '';
  }
  function validateEmailLength(val) {
    return val.length > 255 ? 'E-mail не должен превышать 255 символов' : '';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const newErrors = {};
    if (!firstName) newErrors.firstName = 'Введите имя';
    else {
      const nErr = validateName(firstName); if (nErr) newErrors.firstName = nErr;
    }
    if (!lastName) newErrors.lastName = 'Введите фамилию';
    else {
      const nErr = validateLastName(lastName); if (nErr) newErrors.lastName = nErr;
    }
    if (!email) newErrors.email = 'Введите почту, как в примере "example@example.ru"';
    else {
      const errEmailField = validateEmail(email);
      if (errEmailField) newErrors.email = errEmailField;
    }
    const emailLenErr = validateEmailLength(email); if (emailLenErr) newErrors.email = emailLenErr;
    const pwErr = validatePassword(password); if (pwErr) newErrors.password = pwErr;
    if (!repeatPassword || password !== repeatPassword) newErrors.repeatPassword = 'Пароли не совпадают';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    try {
      const res = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data?.error || 'Ошибка регистрации');
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
        <h2 className="auth-title">Регистрация</h2>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="reg-first-name">Имя</label>
              <input
                id="reg-first-name"
                type="text"
                maxLength={50}
                value={firstName}
                placeholder="Иван"
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setErrors({ ...errors, firstName: validateName(e.target.value) });
                }}
                required
              />
              {errors.firstName && <div className="field-error">{errors.firstName}</div>}
            </div>
            <div className="form-field">
              <label htmlFor="reg-last-name">Фамилия</label>
              <input
                id="reg-last-name"
                type="text"
                maxLength={50}
                value={lastName}
                placeholder="Иванов"
                onChange={(e) => {
                  setLastName(e.target.value);
                  setErrors({ ...errors, lastName: validateLastName(e.target.value) });
                }}
                required
              />
              {errors.lastName && <div className="field-error">{errors.lastName}</div>}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="reg-email">E-mail</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              maxLength={255}
              placeholder="example@example.ru"
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({ ...errors, email: validateEmail(e.target.value) });
              }}
              required
            />
            {errors.email && <div className="field-error">{errors.email}</div>}
          </div>
          <div className="form-field">
            <label htmlFor="reg-password">Пароль</label>
            <div className="input-password-wrapper">
              <input
                id="reg-password"
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
          <div className="form-field">
            <label htmlFor="reg-password-repeat">Повторите пароль</label>
            <div className="input-password-wrapper">
              <input
                id="reg-password-repeat"
                type={showRepeatPassword ? 'text' : 'password'}
                minLength={8}
                maxLength={16}
                value={repeatPassword}
                placeholder="Ещё раз пароль (8-16)"
                onChange={e => {
                  setRepeatPassword(e.target.value);
                  setErrors({ ...errors, repeatPassword: (e.target.value !== password ? 'Пароли не совпадают' : '') });
                }}
                required
              />
              <button className="icon-eye-btn" type="button" tabIndex={-1} onClick={() => setShowRepeatPassword(v => !v)} aria-label={showRepeatPassword ? 'Скрыть пароль' : 'Показать пароль'}>
                {showRepeatPassword ? (
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
            {errors.repeatPassword && <div className="field-error">{errors.repeatPassword}</div>}
          </div>
          {serverError && <div className="field-error">{serverError}</div>}
          <div className="form-actions">
            <button type="submit" className="auth-button">Создать аккаунт</button>
            <Link to="/login" className="link-secondary">Уже есть аккаунт? Войти</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;


