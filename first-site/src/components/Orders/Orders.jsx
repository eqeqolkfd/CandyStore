import React, { useEffect, useState } from 'react';
import './Orders.css';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const userId = stored ? JSON.parse(stored).userId : null;

  const DELIVERY_LABELS = {
    courier: 'Курьер',
    курьер: 'Курьер',
    pickup: 'Самовывоз',
    самовывоз: 'Самовывоз',
    post: 'На почту',
    mail: 'На почту',
    почта: 'На почту',
    'на почту': 'На почту'
  };

  const PAYMENT_LABELS = {
    card: 'Банковская карта',
    bank_card: 'Банковская карта',
    visa: 'Банковская карта',
    mastercard: 'Банковская карта',
    'банковская карта': 'Банковская карта',
    meet: 'При получении',
    cod: 'При получении',
    cash_on_delivery: 'При получении',
    upon_receipt: 'При получении',
    'при получении': 'При получении',
    sbp: 'СБП',
    fast_payment_system: 'СБП',
    'сбп': 'СБП'
  };

  const getDeliveryLabel = (value) => {
    if (!value) return '—';
    const key = String(value).trim().toLowerCase();
    return DELIVERY_LABELS[key] || '—';
  };

  const getPaymentLabel = (value) => {
    if (!value) return '—';
    const raw = String(value).trim();
    const key = raw.toLowerCase();
    if (key.includes('получ')) return 'При получении';
    if (key.includes('on_delivery') || key.includes('on-delivery') || key.includes('cod')) return 'При получении';
    if (key.includes('receipt')) return 'При получении';
    return PAYMENT_LABELS[key] || '—';
  };

  useEffect(() => {
    async function load() {
      try {
        if (!userId) {
          setLoading(false);
          return;
        }
        const res = await fetch(`http://localhost:5000/api/orders?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data = await res.json();
        setOrders(data);
      } catch (e) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  if (!userId) {
    return (
      <div className="orders">
        <div className="orders-unauth">
          <h3>Пользователь не авторизован или не зарегистрирован</h3>
        </div>
      </div>
    );
  }

  if (loading) return <div className="orders-loading">Загрузка истории...</div>;
  if (error) return <div className="orders-error">{error}</div>;

  if (orders.length === 0) {
    return (
      <div className="orders-empty">
        <h2>Заказов пока нет</h2>
        <p>Оформите заказ в корзине, и он появится здесь.</p>
      </div>
    );
  }

  return (
    <div className="orders">
      <h2 className="orders-title">История заказов</h2>
      <div className="orders-list">
        {orders.map(order => (
          <div className="order-card" key={order.order_id}>
            <div className="order-header">
              <div className="order-id">Заказ №{order.order_id}</div>
              <div className="order-meta">
                <span>{new Date(order.created_at).toLocaleString('ru-RU')}</span>
                <span className={`order-status order-status-${order.status_code}`}>
                  {order.status_name}
                </span>
              </div>
            </div>

            <div className="order-items">
              {order.items.map(item => (
                <div className={`order-item ${item.name_product === 'Товар удален' ? 'order-item-deleted' : ''}`} key={item.order_item_id}>
                  <div className="order-item-name">{item.name_product}</div>
                  <div className="order-item-qty">x{item.quantity}</div>
                  <div className="order-item-price">
                    {(Number(item.price) * item.quantity).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="order-footer">
              <div className="order-total">
                Итого: {Number(order.total_amount).toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                  maximumFractionDigits: 0
                })}
              </div>
              <div className="order-details">
                <div className="order-address">
                  <strong>Адрес:</strong> {order.address_text || '—'}
                </div>
                <div className="order-delivery">
                  <strong>Доставка:</strong> {getDeliveryLabel(order.delivery_method)}
                </div>
                <div className="order-payment">
                  <strong>Оплата:</strong> {getPaymentLabel(order.payment_method)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Orders;