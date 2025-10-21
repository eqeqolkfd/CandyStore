import React, { useEffect, useState } from 'react';
import './OrdersAdmin.css';
import { API_ENDPOINTS } from '../../../constants/api';

function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [oRes, sRes] = await Promise.all([
          fetch(`${API_ENDPOINTS.ORDERS}/admin/all`),
          fetch(`${API_ENDPOINTS.ORDERS}/admin/statuses`)
        ]);
        const o = oRes.ok ? await oRes.json() : [];
        const s = sRes.ok ? await sRes.json() : [];
        const ordersData = Array.isArray(o) ? o : [];
        setOrders(ordersData);
        setFilteredOrders(ordersData);
        setStatuses(Array.isArray(s) ? s : []);
      } catch (e) {
        setError('Не удалось загрузить заказы');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOrders(orders);
    } else {
      const filtered = orders.filter(order => {
        if (!order.order_id) return false;
        const orderIdStr = String(order.order_id);
        const searchStr = searchTerm.trim().toLowerCase();
        return orderIdStr.toLowerCase().includes(searchStr);
      });
      setFilteredOrders(filtered);
    }
  }, [searchTerm, orders]);


  const saveStatus = async (orderId, code) => {
    setSavingId(orderId);
    try {
      const res = await fetch(`${API_ENDPOINTS.ORDERS}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!res.ok) throw new Error('Failed to update');
      const updatedOrders = orders.map(o => o.order_id === orderId ? { ...o, status_code: code, status_name: statuses.find(x=>x.code===code)?.name_orderstatuses || o.status_name } : o);
      setOrders(updatedOrders);
      setFilteredOrders(updatedOrders);
    } catch (e) {
      setError('Не удалось сохранить статус');
    } finally {
      setSavingId(null);
    }
  };

  const deleteOrdersOfDeletedUsers = async () => {
    setCleaningUp(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.ORDERS}/admin/cleanup-deleted-users`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        console.log(data.message);
        
        const [oRes, sRes] = await Promise.all([
          fetch(`${API_ENDPOINTS.ORDERS}/admin/all`),
          fetch(`${API_ENDPOINTS.ORDERS}/admin/statuses`)
        ]);
        const o = oRes.ok ? await oRes.json() : [];
        const s = sRes.ok ? await sRes.json() : [];
        const ordersData = Array.isArray(o) ? o : [];
        setOrders(ordersData);
        setFilteredOrders(ordersData);
        setStatuses(Array.isArray(s) ? s : []);
      }
    } catch (e) {
      console.error('Ошибка удаления заказов удаленных пользователей:', e);
    } finally {
      setCleaningUp(false);
    }
  };

  if (loading) return <div className="orders-admin">Загрузка...</div>;
  if (error) return <div className="orders-admin error">{error}</div>;

  return (
    <div className="orders-admin">
      <div className="orders-admin-header">
        <div>
          <h2>Список заказов</h2>
          {searchTerm && (
            <div className="orders-search-info">
              Найдено: {filteredOrders.length} из {orders.length} заказов
              {filteredOrders.length === 0 && (
                <span style={{ color: '#dc3545', marginLeft: '10px' }}>
                  (Заказы с номером "{searchTerm}" не найдены)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="orders-admin-controls">
          <input
            type="text"
            placeholder="Поиск по номеру заказа..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="orders-search-input"
          />
          <button 
            className="orders-cleanup-btn"
            onClick={deleteOrdersOfDeletedUsers}
            disabled={cleaningUp}
            title="Удалить заказы удаленных пользователей"
          >
            {cleaningUp ? 'Очистка...' : 'Очистить заказы удаленных пользователей'}
          </button>
        </div>
      </div>
      <table className="orders-admin-table">
        <thead>
          <tr>
            <th>Номер заказа</th>
            <th>Пользователь</th>
            <th>Email</th>
            <th>Создан</th>
            <th>Сумма</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.length === 0 && searchTerm ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Заказы с номером "{searchTerm}" не найдены
              </td>
            </tr>
          ) : (
            filteredOrders.map(o => (
                <tr key={o.order_id}>
                  <td>{o.order_id}</td>
                  <td>{`${o.first_name || ''} ${o.last_name || ''}`.trim()}</td>
                  <td>{o.email || '—'}</td>
                  <td>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
                  <td>{Number(o.total_amount).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</td>
                  <td>
                    <select
                      value={o.status_code || 'new'}
                      onChange={(e)=> saveStatus(o.order_id, e.target.value)}
                      disabled={savingId === o.order_id}
                    >
                      {statuses.map(s => (
                        <option key={s.status_id} value={s.code}>{s.name_orderstatuses}</option>
                      ))}
                    </select>
                  </td>
                </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default OrdersAdmin;