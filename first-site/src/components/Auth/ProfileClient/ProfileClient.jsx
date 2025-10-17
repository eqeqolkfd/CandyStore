import { useEffect, useState } from 'react';
import './ProfileClient.css';

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
    if (key === 'failed') return 'Неудачно';
    return '—';
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
      const r = await fetch(`http://localhost:5000/api/orders?orderId=${orderId}`);
      if (!r.ok) {
        setModalProducts([{ error: 'Ошибка загрузки информации о заказе' }]);
      } else {
        const data = await r.json();
        // Ожидается поле items (или products)
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
    // Оставить только путь начиная с /images/
    const m = url.match(/[/\\]images[/\\][^/\\]+$/i);
    if (m) return '/images/' + m[0].split(/[/\\]/g).pop();
    return url.replace(/^.*(\/images\/[^/]+)$/i, '$1').replace(/\\/g, '/');
  };

  useEffect(() => {
    async function load() {
      try {
        if (!userId) {
          setError('Пользователь не авторизован или не зарегистрирован');
          setLoading(false);
          return;
        }
        const [meRes, payRes] = await Promise.all([
          fetch(`http://localhost:5000/api/users/me?userId=${userId}`),
          fetch(`http://localhost:5000/api/users/payments?userId=${userId}`)
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
  }, [userId]);

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
      <h2 className="profile-title">Профиль</h2>
      <div className="profile-card">
        <div className="profile-row">
          <span className="profile-label">Имя:</span>
          <span className="profile-value">{profile.first_name}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">Фамилия:</span>
          <span className="profile-value">{profile.last_name}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">Почта:</span>
          <span className="profile-value">{profile.email}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">Пароль:</span>
          <span className="profile-value">••••••••</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">Роль:</span>
          <span className="profile-value">{roleLabel(profile.role)}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">Дата создания:</span>
          <span className="profile-value">{profile.created_at ? new Date(profile.created_at).toLocaleString('ru-RU') : '—'}</span>
        </div>
      </div>

      <h3 className="payments-title">Платежи</h3>
      <div className="payments-counter">Найдено платежей: {payments.length}</div>
      {payments.length === 0 ? (
        <div className="payments-empty">Платежей пока нет</div>
      ) : (
        <div className="payments-list payments-list--grid3">
          {payments.map(p => (
            <div className="payment-item" key={p.payment_id}>
              <div>Платёж №{p.payment_id} по заказу №{p.order_id}</div>
              <div>Сумма: {Number(p.amount).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}</div>
              <div>Метод: {methodLabel(p.method_payments)}</div>
              <div>Статус платежа: {paymentStatusLabel(p.payment_status)}</div>
              <div>Статус заказа: {p.order_status_name || '—'}</div>
              <div>Дата: {new Date(p.created_at).toLocaleString('ru-RU')}</div>
              <button className="profile-details-btn" onClick={() => {setModalOrder(p.order_id); fetchOrderProducts(p.order_id);}}>Подробнее</button>
            </div>
          ))}
        </div>
      )}

      {modalOrder && (
        <div className="profile-modal-backdrop" onClick={() => setModalOrder(null)}>
          <div
            className="profile-modal-card"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
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
                  <div key={idx} className="profile-modal-product-card">
                    {prod.photo_url ? (
                      <img src={normalizeImg(prod.photo_url)} alt={prod.name_product || prod.name || 'Товар'} className="profile-modal-product-img" />
                    ) : (
                      <div className="profile-modal-product-img profile-modal-product-img--placeholder">Нет фото</div>
                    )}
                    <div className="profile-modal-product-info">
                      <div className="profile-modal-product-name">{prod.name_product || prod.name || 'Товар'}</div>
                      <div className="profile-modal-product-row">Цена за 1: {prod.price ? Number(prod.price).toLocaleString('ru-RU', {style:'currency',currency:'RUB'}) : '—'}</div>
                      <div className="profile-modal-product-row">Количество: {prod.quantity || 1}</div>
                      <div className="profile-modal-product-row">Всего: {(prod.price && prod.quantity) ? (Number(prod.price) * Number(prod.quantity)).toLocaleString('ru-RU', {style:'currency',currency:'RUB'}) : '—'}</div>
                      <div className="profile-modal-product-desc">{prod.product_description || prod.description || ''}</div>
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
    </div>
  );
}

export default ProfileClient;
