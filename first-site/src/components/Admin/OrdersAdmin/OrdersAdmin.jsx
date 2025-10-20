import React, { useEffect, useState } from 'react';
import './OrdersAdmin.css';

const API = 'http://localhost:5000/api';

function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [oRes, sRes] = await Promise.all([
          fetch(`${API}/orders/admin/all`),
          fetch(`${API}/orders/admin/statuses`)
        ]);
        const o = oRes.ok ? await oRes.json() : [];
        const s = sRes.ok ? await sRes.json() : [];
        setOrders(Array.isArray(o) ? o : []);
        setStatuses(Array.isArray(s) ? s : []);
      } catch (e) {
        setError('Не удалось загрузить заказы');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const saveStatus = async (orderId, code) => {
    setSavingId(orderId);
    try {
      const res = await fetch(`${API}/orders/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!res.ok) throw new Error('Failed to update');
      setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status_code: code, status_name: statuses.find(x=>x.code===code)?.name_orderstatuses || o.status_name } : o));
    } catch (e) {
      setError('Не удалось сохранить статус');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="orders-admin">Загрузка...</div>;
  if (error) return <div className="orders-admin error">{error}</div>;

  return (
    <div className="orders-admin">
      <h2>Заказы (админ)</h2>
      <table className="orders-admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Пользователь</th>
            <th>Email</th>
            <th>Создан</th>
            <th>Сумма</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.order_id}>
              <td>{o.order_id}</td>
              <td>{o.first_name || o.last_name ? `${o.first_name || ''} ${o.last_name || ''}`.trim() : o.user_id}</td>
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
              <td>
                <button onClick={()=>window.open(`/orders?orderId=${o.order_id}`, '_blank')}>Открыть</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OrdersAdmin;

