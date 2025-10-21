import './ForgotPassword.css';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { API_ENDPOINTS } from '../../../../constants/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Валидация email (из Login.jsx)
  function validateEmail(val) {
    if (!val) return '';
    if (/[А-Яа-яЁё]/.test(val)) return 'Почта не должна содержать русские буквы';
    if (val.length > 255) return 'E-mail не должен превышать 255 символов';
    const pattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!pattern.test(val)) return 'Введите почту, как в примере "example@example.ru"';
    return '';
  }

  // Обработка отправки email для восстановления пароля
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSuccess(false);
    const newErrors = {};
    
    const emailErr = validateEmail(email);
    if (!email) {
      newErrors.email = 'Введите почту, как в примере "example@example.ru"';
    } else if (emailErr) {
      newErrors.email = emailErr;
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setServerError(data?.error || 'Ошибка отправки письма');
        return;
      }
      
      // Показываем успешное сообщение
      setSuccess(true);
      setServerError('');
    } catch (err) {
      setServerError('Сервер недоступен, попробуйте позже');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">Восстановление пароля</h2>
        
        {success ? (
          // Сообщение об успешной отправке
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h3>Письмо отправлено!</h3>
            <p>На вашу почту <strong>{email}</strong> отправлено письмо с новым паролем от администратора.</p>
            <p>Проверьте почту и войдите в систему с новым паролем.</p>
            <div className="form-actions">
              <Link to="/login" className="auth-button">Вернуться к входу</Link>
            </div>
          </div>
        ) : (
          // Форма ввода email
          <form className="auth-form" onSubmit={handleEmailSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="forgot-email">E-mail</label>
              <input
                id="forgot-email"
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
            
            {serverError && <div className="field-error">{serverError}</div>}
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="auth-button"
                disabled={loading}
              >
                {loading ? 'Отправка...' : 'Отправить письмо для восстановления'}
              </button>
              <Link to="/login" className="link-secondary">Вернуться к входу</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
