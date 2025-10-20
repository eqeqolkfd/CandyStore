import { useState, useEffect } from 'react';
import './Audit.css';

const API_URL = 'http://localhost:5000/api';

const Audit = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    user: '',
    dateFrom: '',
    dateTo: ''
  });
  const [searchUser, setSearchUser] = useState(''); // Отдельное состояние для поиска пользователя
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isSearching, setIsSearching] = useState(false); // Состояние для индикатора поиска


  // Загрузка журнала аудита
  useEffect(() => {
    loadAuditLogs();
  }, [currentPage, sortBy, sortOrder, filters]);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError('');
    setIsSearching(true);
    
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        sortBy,
        sortOrder,
        ...filters
      });

      const url = `${API_URL}/audit?${params}`;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка ответа:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAuditLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Ошибка загрузки журнала аудита:', err);
      setError(`Не удалось загрузить журнал аудита: ${err.message}`);
      setAuditLogs([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };


  const handleFilterChange = (field, value) => {
    if (field === 'user') {
      setSearchUser(value);
    } else {
      setFilters(prev => ({ ...prev, [field]: value }));
      setCurrentPage(1);
    }
  };

  // Функция для выполнения поиска
  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      user: searchUser
    }));
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      'CREATE_USER': 'Создание пользователя',
      'UPDATE_USER': 'Обновление пользователя',
      'DELETE_USER': 'Удаление пользователя',
      'CHANGE_ROLE': 'Изменение роли',
      'CREATE_PRODUCT': 'Создание товара',
      'UPDATE_PRODUCT': 'Обновление товара',
      'DELETE_PRODUCT': 'Удаление товара',
      'LOGIN': 'Вход в систему',
      'LOGOUT': 'Выход из системы',
      'CHANGE_PASSWORD': 'Смена пароля',
      'UPDATE_PROFILE': 'Обновление профиля'
    };
    return labels[action] || action;
  };

  const getSeverityClass = (severity) => {
    const classes = {
      'LOW': 'audit-severity-low',
      'MEDIUM': 'audit-severity-medium',
      'HIGH': 'audit-severity-high'
    };
    return classes[severity] || 'audit-severity-low';
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      user: '',
      dateFrom: '',
      dateTo: ''
    });
    setSearchUser('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="audit-container">
        <div className="audit-loading">
          <div className="audit-spinner"></div>
          <p>Загрузка журнала аудита...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-container">
      <div className="audit-header">
        <h1>Журнал аудита</h1>
        <p>Полная история действий всех пользователей в системе</p>
      </div>

      {/* Фильтры */}
      <div className="audit-filters">
        <div className="audit-filter-group">
          <label>Действие:</label>
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
          >
            <option value="">Все действия</option>
            <option value="CREATE_USER">Создание пользователя</option>
            <option value="UPDATE_USER">Обновление пользователя</option>
            <option value="DELETE_USER">Удаление пользователя</option>
            <option value="CHANGE_ROLE">Изменение роли</option>
            <option value="CREATE_PRODUCT">Создание товара</option>
            <option value="UPDATE_PRODUCT">Обновление товара</option>
            <option value="DELETE_PRODUCT">Удаление товара</option>
            <option value="LOGIN">Вход в систему</option>
            <option value="LOGOUT">Выход из системы</option>
            <option value="CHANGE_PASSWORD">Смена пароля</option>
            <option value="UPDATE_PROFILE">Обновление профиля</option>
          </select>
        </div>

        <div className="audit-filter-group">
          <label>Пользователь:</label>
          <input
            type="text"
            value={searchUser}
            onChange={(e) => handleFilterChange('user', e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Поиск по имени пользователя"
          />
        </div>

        <div className="audit-filter-actions">
          <button 
            className="audit-search-btn" 
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? 'Поиск...' : 'Поиск'}
          </button>
          <button className="audit-clear-filters" onClick={clearFilters}>
            Очистить фильтры
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="audit-stats">
        <div className="audit-stat-item">
          <span className="audit-stat-number">{auditLogs.length}</span>
          <span className="audit-stat-label">Всего записей</span>
        </div>
        <div className="audit-stat-item">
          <span className="audit-stat-number">
            {auditLogs.filter(log => log.severity === 'HIGH').length}
          </span>
          <span className="audit-stat-label">Критические</span>
        </div>
        <div className="audit-stat-item">
          <span className="audit-stat-number">
            {auditLogs.filter(log => log.action === 'LOGIN').length}
          </span>
          <span className="audit-stat-label">Входов</span>
        </div>
      </div>

      {/* Таблица журнала */}
      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')} className="audit-sortable">
                Время {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('action')} className="audit-sortable">
                Действие {sortBy === 'action' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('userName')} className="audit-sortable">
                Пользователь {sortBy === 'userName' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Объект</th>
              <th onClick={() => handleSort('severity')} className="audit-sortable">
                Уровень {sortBy === 'severity' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id} className="audit-log-row">
                <td className="audit-timestamp">
                  {formatDate(log.timestamp)}
                </td>
                <td className="audit-action">
                  <span className={`audit-action-badge audit-action-${log.action.toLowerCase()}`}>
                    {getActionLabel(log.action)}
                  </span>
                </td>
                <td className="audit-user">
                  <div className="audit-user-info">
                    <span className="audit-user-name">
                      {log.userName && log.userName !== 'undefined undefined' ? log.userName : `User ${log.userId}`}
                    </span>
                    <span className="audit-user-id">ID: {log.userId}</span>
                  </div>
                </td>
                <td className="audit-target">
                  <div className="audit-target-info">
                    <span className="audit-target-type">{log.targetType}</span>
                    <span className="audit-target-name">{log.targetName}</span>
                  </div>
                </td>
                <td className="audit-severity">
                  <span className={`audit-severity-badge ${getSeverityClass(log.severity)}`}>
                    {log.severity}
                  </span>
                </td>
                <td className="audit-details">
                  <div className="audit-details-content">
                    <div className="audit-detail-item">
                      <strong>IP:</strong> {log.ipAddress || 'N/A'}
                    </div>
                    {log.details && typeof log.details === 'object' && (
                      <>
                        {log.details.oldValues && (
                          <div className="audit-detail-item">
                            <strong>Было:</strong> {JSON.stringify(log.details.oldValues)}
                          </div>
                        )}
                        {log.details.newValues && (
                          <div className="audit-detail-item">
                            <strong>Стало:</strong> {JSON.stringify(log.details.newValues)}
                          </div>
                        )}
                        {log.details.ipAddress && (
                          <div className="audit-detail-item">
                            <strong>IP (детали):</strong> {log.details.ipAddress}
                          </div>
                        )}
                      </>
                    )}
                    {/* Было/Стало на базе before_data/after_data для ключевых экшенов */}
                    {['CHANGE_ROLE','UPDATE_PRODUCT','UPDATE_USER','CHANGE_PASSWORD','UPDATE_PROFILE'].includes(log.action) && (
                      <>
                        {log.before_data && (
                          <div className="audit-detail-item">
                            <strong>Было:</strong> {log.action === 'CHANGE_ROLE' && log.before_data.role ? log.before_data.role : (typeof log.before_data === 'string' ? log.before_data : JSON.stringify(log.before_data))}
                          </div>
                        )}
                        {log.after_data && (
                          <div className="audit-detail-item">
                            <strong>Стало:</strong> {log.action === 'CHANGE_ROLE' && log.after_data.role ? log.after_data.role : (typeof log.after_data === 'string' ? log.after_data : JSON.stringify(log.after_data))}
                          </div>
                        )}
                      </>
                    )}
                    {log.userAgent && (
                      <div className="audit-detail-item">
                        <strong>User Agent:</strong> {log.userAgent.substring(0, 50)}...
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="audit-pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="audit-pagination-btn"
          >
            ← Предыдущая
          </button>
          
          <div className="audit-pagination-info">
            Страница {currentPage} из {totalPages}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="audit-pagination-btn"
          >
            Следующая →
          </button>
        </div>
      )}

      {error && (
        <div className="audit-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Audit;
