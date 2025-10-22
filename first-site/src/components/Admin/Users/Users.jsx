import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './Users.css';
import { API_ENDPOINTS } from '../../../constants/api';

const API_URL = API_ENDPOINTS.USERS;

const roleNames = {
  admin: 'Администратор',
  manager: 'Менеджер',
  client: 'Клиент',
  null: 'Не указана',
  undefined: 'Не указана',
  '': 'Не указана'
};

function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'client'
  });
  const [addFormErrors, setAddFormErrors] = useState({});
  const [showAddPassword, setShowAddPassword] = useState(false);
  
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const resetAddForm = () => {
    setAddForm({ firstName: '', lastName: '', email: '', password: '', role: 'client' });
    setAddFormErrors({});
    setAddError('');
    setShowAddPassword(false);
  };

  const openAddModal = () => {
    setShowAddModal(true);
    resetAddForm();
  };
  const closeAddModal = () => {
    setShowAddModal(false);
    setAddLoading(false);
    setAddError('');
    setAddFormErrors({});
    setShowAddPassword(false);
  };

  const handleAddFormChange = e => {
    const { name, value } = e.target;
    setAddForm(f => ({ ...f, [name]: value }));
    setAddFormErrors(prev => ({ ...prev, [name]: validateField(name, value, addForm) }));
  };

  function validateEmail(val) {
    if (!val) return 'Введите почту';
    if (/[А-Яа-яЁё]/.test(val)) return 'Почта не должна содержать русские буквы';
    const pattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!pattern.test(val)) return 'Введите почту, как в примере "example@example.ru"';
    return '';
  }

  function validatePassword(val) {
    if (!val) return 'Пароль обязателен';
    if (val.length < 8) return 'Пароль должен содержать не менее 8 символов';
    if (val.length > 16) return 'Пароль должен содержать не более 16 символов';
    if (!/^[A-Za-z0-9]+$/.test(val)) return 'Пароль должен содержать только латинские буквы и цифры';
    if (!(/[A-Za-z]/.test(val) && /[0-9]/.test(val))) return 'Пароль должен содержать и буквы, и цифры';
    return '';
  }

  function validateName(val) {
    if (!val) return 'Введите имя';
    if (val.length > 50) return 'Максимум 50 символов';
    return '';
  }
  function validateLastName(val) {
    if (!val) return 'Введите фамилию';
    if (val.length > 50) return 'Максимум 50 символов';
    return '';
  }
  function validateEmailLength(val) {
    return val.length > 255 ? 'E-mail не должен превышать 255 символов' : '';
  }

  function validateField(name, value, fullForm) {
    switch (name) {
      case 'firstName':
        return validateName(value);
      case 'lastName':
        return validateLastName(value);
      case 'email': {
        const e1 = validateEmail(value);
        if (e1) return e1;
        const e2 = validateEmailLength(value);
        if (e2) return e2;
        return '';
      }
      case 'password':
        return validatePassword(value);
      default:
        return '';
    }
  }

  const currentUser = useMemo(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
      const obj = stored ? JSON.parse(stored) : null;
      return obj || null;
    } catch {
      return null;
    }
  }, []);

  const token = useMemo(() => currentUser?.token || null, [currentUser]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_URL, { method: 'GET', headers })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data)) setUsers(data);
        else if (Array.isArray(data.users)) setUsers(data.users);
        else setUsers([]);
      })
      .catch((err) => {
        console.error('Ошибка загрузки пользователей:', err);
        setError('Не удалось загрузить список пользователей. Проверьте консоль / network');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [token]);

  const handleDelete = async (user_id) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      let res = await fetch(`${API_URL}/${user_id}`, { method: 'DELETE', headers });
      if (res.status === 404) {
        res = await fetch(`${API_URL}/delete`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ userId: user_id })
        });
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      setError('Не удалось удалить пользователя. Проверьте консоль.');
    }
  };

  const openDeleteUserModal = (user) => {
    setSelectedUser(user);
    setShowDeleteUserModal(true);
  };

  const closeDeleteUserModal = () => {
    setShowDeleteUserModal(false);
    setSelectedUser(null);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    await handleDelete(selectedUser.user_id || selectedUser.id);
    closeDeleteUserModal();
  };

  const openEditRole = (user) => {
    const myId = currentUser?.userId ?? currentUser?.user_id ?? currentUser?.id ?? null;
    if (myId != null && String(myId) === String(user.user_id || user.id)) {
      setError('Нельзя изменить роль себе самому.');
      setTimeout(()=>setError(''), 3000);
      return;
    }
    setEditUser(user);
    setEditRole(String((user.role || user.name_role || 'client')).toLowerCase());
    setEditFirstName(user.first_name || '');
    setEditLastName(user.last_name || '');
    setEditError('');
  };

  const closeEditModal = () => {
    setEditUser(null);
    setEditRole('');
    setEditError('');
    setEditLoading(false);
  };

  const saveRole = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');

    if (editRole === 'admin') {
      setEditError('Нельзя назначить роль администратора через интерфейс');
      setEditLoading(false);
      return;
    }

    const id = editUser.user_id || editUser.id;
    const payload = { userId: id, role: editRole };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const res = await fetch(`${API_URL}/role`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorText;
        try {
          const errorData = await res.json();
          errorText = errorData?.error || errorData?.message || `HTTP ${res.status}`;
        } catch {
          errorText = await res.text() || `HTTP ${res.status}`;
        }
        throw new Error(errorText);
      }

      let updated;
      try {
        updated = await res.json();
      } catch (jsonError) {
        console.error('Ошибка парсинга JSON при обновлении роли:', jsonError);
        throw new Error('Ошибка сервера: получен некорректный ответ');
      }

      closeEditModal();

      window.location.reload();
    } catch (e) {
      console.error('Ошибка сохранения роли:', e);
      setEditError('Не удалось сохранить роль. Подробнее в консоли.');
    } finally {
      setEditLoading(false);
    }
  };

  const saveProfileNames = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');
    try {
      const id = editUser.user_id || editUser.id;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const res = await fetch(`${API_URL}/update`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          userId: id,
          first_name: editFirstName,
          last_name: editLastName
        })
      });
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(errTxt || `HTTP ${res.status}`);
      }

      closeEditModal();
      window.location.reload();
    } catch (e) {
      console.error('Ошибка сохранения профиля:', e);
      setEditError('Не удалось сохранить имя/фамилию. Подробнее в консоли.');
    } finally {
      setEditLoading(false);
    }
  };

  const saveAll = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');
    const id = editUser.user_id || editUser.id;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
      const firstChanged = (editFirstName ?? '') !== (editUser.first_name ?? '');
      const lastChanged  = (editLastName  ?? '') !== (editUser.last_name  ?? '');
      if (firstChanged || lastChanged) {
        const r1 = await fetch(`${API_URL}/update`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            userId: id,
            first_name: editFirstName,
            last_name: editLastName,
            actorId: currentUser?.userId,
            actorRole: currentUser?.role
          })
        });
        if (!r1.ok) {
          const t = await r1.text();
          throw new Error(t || `HTTP ${r1.status}`);
        }
      }

      const currentRole = String((editUser.role || editUser.name_role || 'client')).toLowerCase();
      if (editRole && editRole !== currentRole) {
        const r2 = await fetch(`${API_URL}/role`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ userId: id, role: editRole })
        });
        if (!r2.ok) {
          const t = await r2.text();
          throw new Error(t || `HTTP ${r2.status}`);
        }
      }

      closeEditModal();
      const currentUserId = currentUser?.userId || currentUser?.user_id;
      if (currentUserId && String(currentUserId) === String(id)) {
        const updatedUser = {
          ...currentUser,
          role: editRole
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        if (editRole === 'admin') {
          navigate('/admin/users');
        } else if (editRole === 'manager') {
          navigate('/manager');
        } else if (editRole === 'client') {
          navigate('/catalog');
        }
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error('Ошибка сохранения пользователя:', e);
      setEditError('Не удалось сохранить изменения. Подробнее в консоли.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setAddLoading(true);
    setAddError('');
    setAddFormErrors({});

    const errs = {};
    errs.firstName = validateName(addForm.firstName);
    errs.lastName = validateLastName(addForm.lastName);
    errs.email = validateEmail(addForm.email) || validateEmailLength(addForm.email);
    errs.password = validatePassword(addForm.password);

    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k]; });

    if (Object.keys(errs).length > 0) {
      setAddFormErrors(errs);
      setAddLoading(false);
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const regRes = await fetch(`${API_URL}/admin-create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          firstName: addForm.firstName,
          lastName: addForm.lastName,
          email: addForm.email,
          password: addForm.password,
          role: addForm.role || 'client'
        })
      });

      let regData;
      try {
        regData = await regRes.json();
        console.log('Ответ сервера регистрации:', regData);
      } catch (jsonError) {
        console.error('Ошибка парсинга JSON:', jsonError);
        setAddError('Ошибка сервера: получен некорректный ответ');
        setAddLoading(false);
        return;
      }

      const userId = regData?.userId || regData?.user_id || regData?.id;
      
      if (!regRes.ok) {
        const errorMessage = regData?.error || regData?.message || 'Ошибка создания пользователя';
        setAddError(errorMessage);
        setAddLoading(false);
        return;
      }
      
      if (!userId) {
        setAddError('Не удалось получить ID созданного пользователя');
        setAddLoading(false);
        return;
      }

      closeAddModal();
      window.location.reload();
    } catch (err) {
      console.error('Создание пользователя:', err);
      setAddError(err.message || 'Ошибка добавления пользователя');
    } finally {
      setAddLoading(false);
    }
  };

  const filteredSorted = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    let list = users.slice();

    const myId = currentUser?.userId ?? currentUser?.user_id ?? currentUser?.id ?? null;
    const myRole = (currentUser?.role ?? currentUser?.roleName ?? '').toString().toLowerCase();
    if (myId != null && myRole === 'admin') {
      list = list.filter(u => String(u.user_id || u.id) !== String(myId));
    }

    if (q) {
      list = list.filter(u => {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q) || String(u.user_id || u.id).includes(q);
      });
    }

    return list;
  }, [users, search, sortDir, currentUser]);

  return (
    <div className="admin-users-page">
      <div className="users-header">
        <h2>Пользователи</h2>
        <div className="users-actions">
          <input
            className="users-search"
            placeholder="Поиск по имени, email или ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск пользователей"
          />
          <button className="btn-add" onClick={openAddModal}>Добавить</button>
        </div>
      </div>

      <div className="users-controls">
        <label>
          Направление:
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="users-status">Загрузка...</div>
      ) : error ? (
        <div className="users-status users-error">{error}</div>
      ) : filteredSorted.length === 0 ? (
        <div className="users-status">Пользователи не найдены</div>
      ) : (
        <div className="users-table-wrapper">
          <table className="users-table" role="table" aria-label="Список пользователей">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Email</th>
                <th>Дата создания</th>
                <th>Роль</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map(u => (
                <tr key={u.user_id || u.id}>
                  <td>{u.user_id ?? u.id}</td>
                  <td>{u.first_name || '—'}</td>
                  <td>{u.last_name || '—'}</td>
                  <td className="users-email">{u.email || '—'}</td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                  <td>{roleNames[u.role] || roleNames[String(u.role).toLowerCase()] || u.role || '—'}</td>
                  <td className="users-actions-cell">
                    <button className="btn-edit" onClick={() => openEditRole(u)}>Редактировать</button>
                    <button className="btn-delete" onClick={() => openDeleteUserModal(u)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="users-cards" aria-hidden="true">
            {filteredSorted.map(u => (
              <article key={'card-' + (u.user_id || u.id)} className="user-card">
                <div className="user-card-row"><strong>ID:</strong> {u.user_id ?? u.id}</div>
                <div className="user-card-row"><strong>Имя:</strong> {u.first_name || '—'}</div>
                <div className="user-card-row"><strong>Фамилия:</strong> {u.last_name || '—'}</div>
                <div className="user-card-row"><strong>Email:</strong> {u.email || '—'}</div>
                <div className="user-card-row"><strong>Роль:</strong> {roleNames[u.role] || roleNames[String(u.role).toLowerCase()] || u.role || '—'}</div>
                <div className="user-card-row user-card-actions">
                  <button className="btn-edit" onClick={() => openEditRole(u)}>Ред.</button>
                  <button className="btn-delete" onClick={() => openDeleteUserModal(u)}>Удал.</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {editUser && (
        <div className="users-role-modal-backdrop" onClick={closeEditModal}>
          <div className="users-role-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="users-role-modal-header">
              <h3>Редактировать роль</h3>
              <button className="users-role-modal-close" onClick={closeEditModal} aria-label="Закрыть">✕</button>
            </div>

            <div className="users-role-modal-body">
              <div className="users-role-modal-row"><strong>Пользователь:</strong> {editUser.first_name} {editUser.last_name} (ID {editUser.user_id ?? editUser.id})</div>
              <div className="users-role-modal-row users-edit-names">
                <label>
                  Имя:
                  <input type="text" value={editFirstName} onChange={(e)=>setEditFirstName(e.target.value)} maxLength={50} />
                </label>
                <label>
                  Фамилия:
                  <input type="text" value={editLastName} onChange={(e)=>setEditLastName(e.target.value)} maxLength={50} />
                </label>
              </div>

              <label className="users-role-modal-label">
                Роль:
                <select className="users-role-modal-select" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="client">Клиент</option>
                  <option value="manager">Менеджер</option>
                </select>
              </label>

              {editError && <div className="users-role-modal-error">{editError}</div>}
            </div>

            <div className="users-role-modal-actions">
              <button className="btn-secondary" onClick={closeEditModal} disabled={editLoading}>Отмена</button>
              <button className="btn-primary" onClick={saveAll} disabled={editLoading}>
                {editLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="users-add-modal-backdrop" onClick={closeAddModal}>
          <div className="users-add-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="users-add-modal-header">
              <h3>Создать нового пользователя</h3>
              <button className="users-add-modal-close" onClick={closeAddModal} aria-label="Закрыть">✕</button>
            </div>
            <form className="users-add-modal-body" onSubmit={handleAddSubmit} autoComplete="off">
              <label className="users-add-modal-label">
                Имя*
                <input name="firstName" value={addForm.firstName} onChange={handleAddFormChange} required minLength={2} maxLength={50} type="text" autoFocus />
                {addFormErrors.firstName && <div className="users-add-modal-field-error">{addFormErrors.firstName}</div>}
              </label>
              <label className="users-add-modal-label">
                Фамилия*
                <input name="lastName" value={addForm.lastName} onChange={handleAddFormChange} required minLength={2} maxLength={50} type="text" />
                {addFormErrors.lastName && <div className="users-add-modal-field-error">{addFormErrors.lastName}</div>}
              </label>
              <label className="users-add-modal-label">
                Email*
                <input name="email" value={addForm.email} onChange={handleAddFormChange} required type="email" maxLength={255} pattern=".+@.+\..+" />
                {addFormErrors.email && <div className="users-add-modal-field-error">{addFormErrors.email}</div>}
              </label>
              <label className="users-add-modal-label">
                Пароль*
                <div className="input-password-wrapper">
                  <input 
                    name="password" 
                    value={addForm.password} 
                    onChange={handleAddFormChange} 
                    required 
                    type={showAddPassword ? 'text' : 'password'} 
                    minLength={8} 
                    maxLength={16} 
                    autoComplete="new-password" 
                  />
                  <button 
                    className="icon-eye-btn" 
                    type="button" 
                    tabIndex={-1} 
                    onClick={() => setShowAddPassword(!showAddPassword)} 
                    aria-label={showAddPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showAddPassword ? (
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
                {addFormErrors.password && <div className="users-add-modal-field-error">{addFormErrors.password}</div>}
              </label>
              <label className="users-add-modal-label">
                Роль*
                <select name="role" value={addForm.role} onChange={handleAddFormChange} required className="users-add-modal-select">
                  <option value="client">Клиент</option>
                  <option value="manager">Менеджер</option>
                </select>
              </label>

              {addError && <div className="users-add-modal-error">{addError}</div>}
            </form>
            <div className="users-add-modal-actions">
              <button className="btn-secondary" onClick={closeAddModal} disabled={addLoading}>Отмена</button>
              <button className="btn-primary" onClick={handleAddSubmit} disabled={addLoading} type="submit">
                {addLoading ? 'Создаём...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteUserModal && selectedUser && (
        <div className="users-modal-backdrop" onClick={closeDeleteUserModal}>
          <div className="users-modal-card users-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="users-modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="users-modal-close" onClick={closeDeleteUserModal}>×</button>
            </div>
            <div className="users-modal-body">
              <p>Вы действительно хотите удалить пользователя <strong>"{selectedUser.first_name} {selectedUser.last_name}"</strong>?</p>
              <p className="users-delete-warning">Это действие нельзя отменить.</p>
              
              <div className="users-modal-actions">
                <button type="button" onClick={closeDeleteUserModal}>
                  Отмена
                </button>
                <button 
                  type="button" 
                  onClick={confirmDeleteUser}
                  className="users-delete-btn"
                >
                  Удалить пользователя
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
