import { useEffect, useState } from 'react';
import './ProfileClient.css';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../../../constants/api';

function ProfileClient() {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const currentUser = stored ? JSON.parse(stored) : null;
  const userId = currentUser?.userId || null;

  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOrder, setModalOrder] = useState(null);
  const [modalProducts, setModalProducts] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    oldPassword: '',
    confirmOldPassword: '',
    newPassword: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState({
    oldPassword: false,
    confirmOldPassword: false,
    newPassword: false
  });
  const [passwordCheckLoading, setPasswordCheckLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ show: false, filename: '', backupName: '' });
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoringFromFile, setRestoringFromFile] = useState(false);

  const navigate = useNavigate();

  const isAdmin = currentUser && currentUser.role === 'admin';

  const loadBackups = async () => {
    if (!isAdmin) return;
    
    setBackupLoading(true);
    setBackupError('');
    try {
      const token = currentUser?.token || localStorage.getItem('token');
      if (!token) {
        setBackupError('Токен аутентификации не найден');
        return;
      }
      
      const response = await fetch(`${API_ENDPOINTS.BACKUP}/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
        setBackupError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setBackupError(errorData.message || 'Не удалось загрузить список бекапов');
      }
    } catch (err) {
      setBackupError('Ошибка загрузки бекапов');
    } finally {
      setBackupLoading(false);
    }
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    setBackupError('');
    setBackupSuccess('');

    try {
      const token = currentUser?.token || localStorage.getItem('token');
      if (!token) {
        setBackupError('Токен аутентификации не найден');
        return;
      }
      
      const response = await fetch(`${API_ENDPOINTS.BACKUP}/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBackupSuccess('Бекап создан успешно!');
        loadBackups();
      } else {
        const errorData = await response.json();
        setBackupError(errorData.message || 'Ошибка создания бекапа');
      }
    } catch (err) {
      setBackupError('Ошибка создания бекапа');
    } finally {
      setCreatingBackup(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const token = currentUser?.token || localStorage.getItem('token');
      if (!token) {
        setBackupError('Токен аутентификации не найден');
        return;
      }
      
      const response = await fetch(`${API_ENDPOINTS.BACKUP}/download/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setBackupError('Ошибка скачивания бекапа');
      }
    } catch (err) {
      setBackupError('Ошибка скачивания бекапа');
    }
  };

  const openDeleteModal = (filename, backupName) => {
    setDeleteModal({ show: true, filename, backupName });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, filename: '', backupName: '' });
  };

  const confirmDeleteBackup = async () => {
    const { filename } = deleteModal;
    
    try {
      const token = currentUser?.token || localStorage.getItem('token');
      if (!token) {
        setBackupError('Токен аутентификации не найден');
        return;
      }
      
      console.log('Удаляем бекап:', filename);
      
      const response = await fetch(`${API_ENDPOINTS.BACKUP}/${filename}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Результат удаления:', result);
        
        let successMessage = 'Бекап удален успешно!';
        if (result.fileDeleted) {
          successMessage += ' (файл удален с диска)';
        } else {
          successMessage += ' (файл не найден на диске, но запись из БД удалена)';
        }
        
        setBackupSuccess(successMessage);
        loadBackups();
        closeDeleteModal();
      } else {
        const errorData = await response.json();
        console.error('Ошибка удаления:', errorData);
        setBackupError(errorData.message || 'Ошибка удаления бекапа');
      }
    } catch (err) {
      console.error('Ошибка при удалении бекапа:', err);
      setBackupError('Ошибка удаления бекапа: ' + err.message);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('Выбран файл:', file.name, 'Размер:', file.size, 'Тип:', file.type);
      
      if (file.name.endsWith('.bak') || file.name.endsWith('.sql')) {
        setRestoreFile(file);
        setBackupError('');
        setBackupSuccess('');
      } else {
        setBackupError('Разрешены только файлы .bak и .sql');
        setRestoreFile(null);
        event.target.value = '';
      }
    } else {
      setRestoreFile(null);
    }
  };

  const restoreFromFile = async () => {
    if (!restoreFile) {
      setBackupError('Выберите файл для восстановления');
      return;
    }

    setRestoringFromFile(true);
    setBackupError('');
    setBackupSuccess('');

    try {
      const token = currentUser?.token || localStorage.getItem('token');
      if (!token) {
        setBackupError('Токен аутентификации не найден');
        return;
      }

      const formData = new FormData();
      formData.append('backupFile', restoreFile);

      console.log('Отправка файла на восстановление:', restoreFile.name);

      const response = await fetch(`${API_ENDPOINTS.BACKUP}/restore-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('Ответ сервера:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('Результат восстановления:', result);
        setBackupSuccess('База данных восстановлена из загруженного файла!');
        clearFileInput();
      } else {
        const errorData = await response.json();
        console.error('Ошибка восстановления:', errorData);
        setBackupError(errorData.message || 'Ошибка восстановления из файла');
      }
    } catch (err) {
      console.error('Ошибка при восстановлении:', err);
      setBackupError('Ошибка восстановления из файла: ' + err.message);
    } finally {
      setRestoringFromFile(false);
    }
  };

  const clearFileInput = () => {
    setRestoreFile(null);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (sizeInMB) => {
    return `${sizeInMB} MB`;
  };

  const methodLabel = (m) => {
    const key = String(m || '').toLowerCase();
    if (key === 'card') return 'Банковская карта';
    if (key === 'cod' || key === 'meet') return 'При получении';
    if (key === 'sbp') return 'СБП';
    return '—';
  };
  const paymentStatusLabel = (s) => {
    const key = String(s || '').toLowerCase();
    if (key === 'pending') return 'В ожидании';
    if (key === 'paid') return 'Оплачен';
    return '—';
  };

  const displayedPaymentStatus = (payment) => {
    const methodKey = String(payment?.method_payments || '').toLowerCase();
    if (methodKey === 'meet' || methodKey === 'cod') return 'В ожидании';
    if (methodKey === 'card' || methodKey === 'sbp') return 'Оплачен';
    return paymentStatusLabel(payment?.payment_status);
  };
  const roleLabel = (r) => {
    const key = String(r || '').toLowerCase();
    if (key === 'client') return 'Клиент';
    if (key === 'admin') return 'Администратор';
    if (key === 'manager') return 'Менеджер';
    return '—';
  };

  const fetchOrderProducts = async (orderId) => {
    setModalLoading(true);
    setModalProducts([]);
    try {
      const r = await fetch(`${API_ENDPOINTS.ORDERS}?orderId=${orderId}`);
      if (!r.ok) {
        setModalProducts([{ error: 'Ошибка загрузки информации о заказе' }]);
      } else {
        const data = await r.json();
        setModalProducts((Array.isArray(data.items) && data.items.length > 0)
          ? data.items
          : (Array.isArray(data) && data.length > 0 ? data[0].items : [])
        );
      }
    } catch (e) {
      setModalProducts([{ error: 'Ошибка загрузки информации о заказе' }]);
    } finally {
      setModalLoading(false);
    }
  };

  const normalizeImg = (url) => {
    if (!url) return '';
    const m = url.match(/[/\\]images[/\\][^/\\]+$/i);
    if (m) return '/images/' + m[0].split(/[/\\]/g).pop();
    return url.replace(/^.*(\/images\/[^/]+)$/i, '$1').replace(/\\/g, '/');
  };

  function validateName(val) {
    if (val.length > 50) return 'Максимум 50 символов';
    return '';
  }

  function validateLastName(val) {
    if (val.length > 50) return 'Максимум 50 символов';
    return '';
  }

  function validatePassword(val) {
    if (val.length < 8) return 'Пароль должен содержать не менее 8 символов';
    if (val.length > 16) return 'Пароль должен содержать не более 16 символов';
    if (!/^[A-Za-z0-9]+$/.test(val)) return 'Пароль должен содержать латинские буквы и цифры';
    if (!(/[A-Za-z]/.test(val) && /[0-9]/.test(val))) return 'Пароль должен содержать латинские буквы и цифры';
    return '';
  }

  const handleEditStart = () => {
    setEditForm({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      oldPassword: '',
      confirmOldPassword: '',
      newPassword: ''
    });
    setIsEditing(true);
    setEditError('');
    setEditFieldErrors({});
    setShowPasswords({
      oldPassword: false,
      confirmOldPassword: false,
      newPassword: false
    });
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditForm({ 
      first_name: '', 
      last_name: '', 
      oldPassword: '', 
      confirmOldPassword: '', 
      newPassword: '' 
    });
    setEditError('');
    setEditFieldErrors({});
  };

  const handleEditChange = async (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));

    let error = '';
    if (field === 'first_name') {
      error = validateName(value);
    } else if (field === 'last_name') {
      error = validateLastName(value);
    } else if (field === 'newPassword') {
      error = validatePassword(value);
    } else if (field === 'confirmOldPassword') {
      error = editForm.oldPassword !== value ? 'Пароли не совпадают' : '';
    } else if (field === 'oldPassword') {
      if (value.trim()) {
        const isValid = await checkOldPassword(value);
        if (!isValid) {
          error = 'Неверный старый пароль';
        }
      }
    }

    setEditFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const checkOldPassword = async (password) => {
    if (!password.trim()) return false;
    
    setPasswordCheckLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.USERS}/check-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: userId, 
          password: password 
        })
      });

      const data = await response.json();
      return data.isValid || false;
    } catch (error) {
      console.error('Ошибка проверки пароля:', error);
      return false;
    } finally {
      setPasswordCheckLoading(false);
    }
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError('');

    const newErrors = {};
    
    if (!editForm.first_name.trim()) {
      newErrors.first_name = 'Введите имя';
    } else {
      const nameError = validateName(editForm.first_name);
      if (nameError) newErrors.first_name = nameError;
    }
    
    if (!editForm.last_name.trim()) {
      newErrors.last_name = 'Введите фамилию';
    } else {
      const lastNameError = validateLastName(editForm.last_name);
      if (lastNameError) newErrors.last_name = lastNameError;
    }

    const wantsToChangePassword = editForm.oldPassword || editForm.confirmOldPassword || editForm.newPassword;
    
    if (wantsToChangePassword) {
      if (!editForm.oldPassword.trim()) {
        newErrors.oldPassword = 'Введите старый пароль';
      } else {
        const isValidOldPassword = await checkOldPassword(editForm.oldPassword);
        if (!isValidOldPassword) {
          newErrors.oldPassword = 'Неверный старый пароль';
        }
      }
      
      if (!editForm.confirmOldPassword.trim()) {
        newErrors.confirmOldPassword = 'Подтвердите старый пароль';
      } else if (editForm.oldPassword !== editForm.confirmOldPassword) {
        newErrors.confirmOldPassword = 'Пароли не совпадают';
      }
      
      if (!editForm.newPassword.trim()) {
        newErrors.newPassword = 'Введите новый пароль';
      } else {
        const passwordError = validatePassword(editForm.newPassword);
        if (passwordError) newErrors.newPassword = passwordError;
      }
    }

    setEditFieldErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      setEditLoading(false);
      return;
    }
    
    try {
      const updateData = {
        userId: userId,
        first_name: editForm.first_name,
        last_name: editForm.last_name
      };

      if (wantsToChangePassword) {
        updateData.oldPassword = editForm.oldPassword;
        updateData.newPassword = editForm.newPassword;
      }

      const response = await fetch(`${API_ENDPOINTS.USERS}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка обновления профиля');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setIsEditing(false);
      setEditForm({ 
        first_name: '', 
        last_name: '', 
        oldPassword: '', 
        confirmOldPassword: '', 
        newPassword: '' 
      });
      
      if (currentUser && currentUser.userId === userId) {
        const updatedCurrentUser = {
          ...currentUser,
          firstName: updatedProfile.first_name,
          lastName: updatedProfile.last_name
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
      }
      
    } catch (error) {
      setEditError(error.message || 'Ошибка обновления профиля');
    } finally {
      setEditLoading(false);
    }
  };

  async function handleDeleteAccount() {
    setDeleteError('');
    try {
      const response = await fetch(`${API_ENDPOINTS.USERS}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const err = await response.json();
        setDeleteError(err?.error || 'Ошибка при удалении аккаунта');
        return;
      }
      localStorage.removeItem('currentUser');
      setShowDeleteModal(false);
      navigate('/');
    } catch(e) {
      setDeleteError('Ошибка связи с сервером: ' + (e.message || ''));
    }
  }

  useEffect(() => {
    async function load() {
      try {
        if (!userId) {
          setError('Пользователь не авторизован или не зарегистрирован');
          setLoading(false);
          return;
        }
        const [meRes, payRes] = await Promise.all([
          fetch(`${API_ENDPOINTS.USERS}/me?userId=${userId}`),
          fetch(`${API_ENDPOINTS.USERS}/payments?userId=${userId}`)
        ]);
        if (!meRes.ok) throw new Error('Не удалось получить профиль');
        const me = await meRes.json();
        const pays = payRes.ok ? await payRes.json() : [];
        setProfile(me);
        setPayments(Array.isArray(pays) ? pays : []);
      } catch (e) {
        setError(e.message || 'Ошибка загрузки профиля');
      } finally {
        setLoading(false);
      }
    }
    load();

    if (isAdmin) {
      loadBackups();
    }
  }, [userId, isAdmin]);

  if (!userId) {
    return (
      <div className="profile-client">
        <div className="profile-unauth">
          <h3>Пользователь не авторизован или не зарегистрирован</h3>
        </div>
      </div>
    );
  }

  if (loading) return <div className="profile-loading">Загрузка профиля...</div>;
  if (error) return <div className="profile-error">{error}</div>;
  if (!profile) return null;

  return (
    <div className="profile-client">
      <div className="profile-header">
        <h2 className="profile-title">Профиль</h2>
        <div className="profile-header-btns">
        {!isEditing && (
          <>
          <button className="profile-edit-btn" onClick={handleEditStart}>Редактировать</button>
          {!isAdmin && (
            <button className="profile-delete-btn" onClick={()=>setShowDeleteModal(true)}>Удалить аккаунт</button>
          )}
          </>
        )}
        </div>
      </div>
      
      <div className="profile-card">
        <div className="profile-row">
          <span className="profile-label">Имя:</span>
          {isEditing ? (
            <div className="profile-edit-field-wrapper">
              <input
                id="profile-first-name"
                type="text"
                className="profile-edit-input"
                maxLength={50}
                value={editForm.first_name}
                onChange={(e) => handleEditChange('first_name', e.target.value)}
                placeholder="Введите имя"
                required
              />
              {editFieldErrors.first_name && <div className="profile-field-error">{editFieldErrors.first_name}</div>}
            </div>
          ) : (
            <span className="profile-value">{profile.first_name}</span>
          )}
        </div>
        
        <div className="profile-row">
          <span className="profile-label">Фамилия:</span>
          {isEditing ? (
            <div className="profile-edit-field-wrapper">
              <input
                id="profile-last-name"
                type="text"
                className="profile-edit-input"
                maxLength={50}
                value={editForm.last_name}
                onChange={(e) => handleEditChange('last_name', e.target.value)}
                placeholder="Введите фамилию"
                required
              />
              {editFieldErrors.last_name && <div className="profile-field-error">{editFieldErrors.last_name}</div>}
            </div>
          ) : (
            <span className="profile-value">{profile.last_name}</span>
          )}
        </div>
        
        <div className="profile-row">
          <span className="profile-label">Почта:</span>
          <span className="profile-value profile-value--readonly">{profile.email}</span>
        </div>
        
        <div className="profile-row">
          <span className="profile-label">Пароль:</span>
          {isEditing ? (
            <div className="profile-password-section">
              <div className="profile-edit-field-wrapper">
                <div className="profile-password-input-wrapper">
                  <input
                    id="profile-old-password"
                    type={showPasswords.oldPassword ? 'text' : 'password'}
                    className="profile-edit-input profile-edit-input--password"
                    minLength={8}
                    maxLength={16}
                    value={editForm.oldPassword}
                    onChange={(e) => handleEditChange('oldPassword', e.target.value)}
                    placeholder="Введите старый пароль"
                  />
                  <button 
                    type="button" 
                    className="profile-password-toggle-btn" 
                    tabIndex={-1}
                    onClick={() => togglePasswordVisibility('oldPassword')}
                    aria-label={showPasswords.oldPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPasswords.oldPassword ? (
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                        <path d="M5 5l12 12" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                      </svg>
                    )}
                  </button>
                </div>
                {passwordCheckLoading && (
                  <div className="profile-field-loading">Проверка пароля...</div>
                )}
                {editFieldErrors.oldPassword && <div className="profile-field-error">{editFieldErrors.oldPassword}</div>}
              </div>
              
              <div className="profile-edit-field-wrapper">
                <div className="profile-password-input-wrapper">
                  <input
                    id="profile-confirm-old-password"
                    type={showPasswords.confirmOldPassword ? 'text' : 'password'}
                    className="profile-edit-input profile-edit-input--password"
                    minLength={8}
                    maxLength={16}
                    value={editForm.confirmOldPassword}
                    onChange={(e) => handleEditChange('confirmOldPassword', e.target.value)}
                    placeholder="Подтвердите старый пароль"
                  />
                  <button 
                    type="button" 
                    className="profile-password-toggle-btn" 
                    tabIndex={-1}
                    onClick={() => togglePasswordVisibility('confirmOldPassword')}
                    aria-label={showPasswords.confirmOldPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPasswords.confirmOldPassword ? (
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                        <path d="M5 5l12 12" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                      </svg>
                    )}
                  </button>
                </div>
                {editFieldErrors.confirmOldPassword && <div className="profile-field-error">{editFieldErrors.confirmOldPassword}</div>}
              </div>
              
              <div className="profile-edit-field-wrapper">
                <div className="profile-password-input-wrapper">
                  <input
                    id="profile-new-password"
                    type={showPasswords.newPassword ? 'text' : 'password'}
                    className="profile-edit-input profile-edit-input--password"
                    minLength={8}
                    maxLength={16}
                    value={editForm.newPassword}
                    onChange={(e) => handleEditChange('newPassword', e.target.value)}
                    placeholder="Введите новый пароль (8-16 символов)"
                  />
                  <button 
                    type="button" 
                    className="profile-password-toggle-btn" 
                    tabIndex={-1}
                    onClick={() => togglePasswordVisibility('newPassword')}
                    aria-label={showPasswords.newPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPasswords.newPassword ? (
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                        <path d="M5 5l12 12" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 11s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm10 3.5A3.5 3.5 0 1 0 11 7a3.5 3.5 0 0 0 0 7Z" stroke="#888" strokeWidth="1.7"/>
                      </svg>
                    )}
                  </button>
                </div>
                {editFieldErrors.newPassword && <div className="profile-field-error">{editFieldErrors.newPassword}</div>}
              </div>
            </div>
          ) : (
            <span className="profile-value">••••••••</span>
          )}
        </div>
        
        <div className="profile-row">
          <span className="profile-label">Роль:</span>
          <span className="profile-value profile-value--readonly">{roleLabel(profile.role)}</span>
        </div>
        
        <div className="profile-row">
          <span className="profile-label">Дата создания:</span>
          <span className="profile-value profile-value--readonly">
            {profile.created_at ? new Date(profile.created_at).toLocaleString('ru-RU') : '—'}
          </span>
        </div>
        
        {editError && (
          <div className="profile-edit-error">{editError}</div>
        )}
        
        {isEditing && (
          <div className="profile-edit-actions">
            <button 
              className="profile-save-btn" 
              onClick={handleEditSave}
              disabled={editLoading}
            >
              {editLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button 
              className="profile-cancel-btn" 
              onClick={handleEditCancel}
              disabled={editLoading}
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {!isAdmin && currentUser?.role !== 'manager' && (
        <>
          <h3 className="payments-title">Платежи</h3>
          <div className="payments-list payments-list--grid3">
            {payments.map(p => (
              <div className="payment-item" key={p.payment_id}>
                <div>Платёж №{p.payment_id} по заказу №{p.order_id}</div>
                <div>Сумма: {Number(p.amount).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</div>
                <div>Метод: {methodLabel(p.method_payments)}</div>
                <div>Статус платежа: {displayedPaymentStatus(p)}</div>
                <div>Статус заказа: {p.order_status_name || '—'}</div>
                <div>Дата: {new Date(p.created_at).toLocaleString('ru-RU')}</div>
                <button className="profile-details-btn" onClick={() => {setModalOrder(p.order_id); fetchOrderProducts(p.order_id);}}>Подробнее</button>
              </div>
            ))}
          </div>
          {modalOrder && (
            <div className="profile-modal-backdrop" onClick={() => setModalOrder(null)}>
              <div className="profile-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <h3 className="profile-modal-title">Детали заказа №{modalOrder}</h3>
                {modalLoading ? (
                  <div style={{padding: 16}}>Загрузка...</div>
                ) : modalProducts.length === 0 ? (
                  <div style={{padding: 16}}>Нет информации о товарах заказа</div>
                ) : modalProducts[0].error ? (
                  <div style={{padding: 16}}>{modalProducts[0].error}</div>
                ) : (
                  <div className="profile-modal-products-grid">
                    {modalProducts.map((prod, idx) => (
                      <div key={idx} className={`profile-modal-product-card ${prod.name_product === 'Товар удален' ? 'profile-modal-product-deleted' : ''}`}>
                        {prod.photo_url ? (
                          <img src={normalizeImg(prod.photo_url)} alt={prod.name_product || prod.name || 'Товар'} className="profile-modal-product-img" />
                        ) : (
                          <div className="profile-modal-product-img profile-modal-product-img--placeholder">
                            {prod.name_product === 'Товар удален' ? 'Товар удален' : 'Нет фото'}
                          </div>
                        )}
                        <div className="profile-modal-product-info">
                          <div className="profile-modal-product-name">{prod.name_product || prod.name || 'Товар'}</div>
                          <div className="profile-modal-product-row">Цена за 1: {prod.price ? Number(prod.price).toLocaleString('ru-RU', {style:'currency',currency:'RUB'}) : '—'}</div>
                          <div className="profile-modal-product-row">Количество: {prod.quantity || 1}</div>
                          <div className="profile-modal-product-row">Всего: {(prod.price && prod.quantity) ? (Number(prod.price) * Number(prod.quantity)).toLocaleString('ru-RU', {style:'currency',currency:'RUB'}) : '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="profile-modal-footer">
                  <button className="profile-modal-close" onClick={()=>setModalOrder(null)}>Закрыть</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {showDeleteModal && (
        <div className="profile-delete-modal-backdrop">
          <div className="profile-delete-modal-card">
            <div className="profile-delete-modal-title">Удалить аккаунт?</div>
            <div className="profile-delete-modal-text">
              Все ваши данные и история заказов будут удалены безвозвратно. Действие необратимо.
            </div>
            {deleteError && <div className="profile-delete-modal-error">{deleteError}</div>}
            <div className="profile-delete-modal-actions">
              <button className="profile-delete-modal-confirm" onClick={handleDeleteAccount}>Точно удалить</button>
              <button className="profile-delete-modal-cancel" onClick={()=>setShowDeleteModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="profile-backup-section">
            <div className="profile-backup-header">
              <h3 className="profile-backup-title">Управление бекапами</h3>
              <button 
                className="profile-backup-create-btn"
                onClick={createBackup}
                disabled={creatingBackup}
              >
                {creatingBackup ? 'Создание...' : 'Создать бекап'}
              </button>
            </div>

            {backupError && (
              <div className="profile-backup-error">
                {backupError}
              </div>
            )}

            {backupSuccess && (
              <div className="profile-backup-success">
                {backupSuccess}
              </div>
            )}

            <div className="profile-backup-info">
              <p>Бекапы содержат полную копию базы данных. Рекомендуется создавать бекапы регулярно.</p>
            </div>

            <div className="profile-backup-upload-section">
              <h4>Восстановление из файла</h4>
              <div className="profile-backup-upload-controls">
                <input
                  type="file"
                  accept=".bak,.sql"
                  onChange={handleFileUpload}
                  className="profile-backup-file-input"
                  id="backup-file-input"
                />
                <label htmlFor="backup-file-input" className="profile-backup-file-label">
                  {restoreFile ? `Выбран: ${restoreFile.name}` : 'Выберите файл .bak или .sql'}
                </label>
                {restoreFile && (
                  <button
                    className="profile-backup-clear-btn"
                    onClick={clearFileInput}
                    type="button"
                    title="Очистить выбранный файл"
                  >
                    ✕
                  </button>
                )}
                <button
                  className="profile-backup-restore-btn"
                  onClick={restoreFromFile}
                  disabled={!restoreFile || restoringFromFile}
                >
                  {restoringFromFile ? 'Восстановление...' : 'Восстановить из файла'}
                </button>
              </div>
            </div>

            <div className="profile-backup-list">
              {backupLoading ? (
                <div className="profile-backup-loading">Загрузка бекапов...</div>
              ) : backups.length === 0 ? (
                <div className="profile-backup-empty">
                  Бекапы не найдены. Создайте первый бекап.
                </div>
              ) : (
                <div className="profile-backup-table">
                  <div className="profile-backup-table-header">
                    <div>Имя файла</div>
                    <div>Размер</div>
                    <div>Создан</div>
                    <div>Создал</div>
                    <div>Действия</div>
                  </div>
                  {backups.map((backup, index) => (
                    <div key={index} className="profile-backup-table-row">
                      <div className="profile-backup-filename">{backup.filename}</div>
                      <div className="profile-backup-size">{formatSize(backup.size)}</div>
                      <div className="profile-backup-date">{formatDate(backup.createdAt)}</div>
                      <div className="profile-backup-created-by">{backup.createdBy}</div>
                      <div className="profile-backup-actions">
                        <button 
                          className="profile-backup-download-btn"
                          onClick={() => downloadBackup(backup.filename)}
                          title="Скачать бекап"
                        >
                          Скачать бекап
                        </button>
                        <button 
                          className="profile-backup-delete-btn"
                          onClick={() => openDeleteModal(backup.filename, backup.filename)}
                          title="Удалить бекап"
                        >
                          Удалить бекап
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {deleteModal.show && (
        <div className="profile-backup-delete-modal-overlay">
          <div className="profile-backup-delete-modal">
            <div className="profile-backup-delete-modal-header">
              <h3>Подтверждение удаления</h3>
            </div>
            <div className="profile-backup-delete-modal-body">
              <p>Вы уверены, что хотите удалить бекап:</p>
              <p className="profile-backup-delete-modal-filename">"{deleteModal.backupName}"</p>
              <p className="profile-backup-delete-modal-warning">
                Это действие нельзя отменить!
              </p>
            </div>
            <div className="profile-backup-delete-modal-footer">
              <button 
                className="profile-backup-delete-modal-cancel"
                onClick={closeDeleteModal}
              >
                Отмена
              </button>
              <button 
                className="profile-backup-delete-modal-confirm"
                onClick={confirmDeleteBackup}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileClient;
