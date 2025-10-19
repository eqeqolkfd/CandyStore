import React, { useState, useEffect } from 'react';
import './Cart.css';

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [address, setAddress] = useState({
    city: '',
    street: '',
    house: '',
    apartment: '',
    postalCode: ''
  });
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [unitType, setUnitType] = useState('house'); // 'house' | 'apartment'

  const normalizeImg = (url) => {
    if (!url) return '';
    const m = url.match(/[/\\]images[/\\][^/\\]+$/i);
    if (m) return '/images/' + m[0].split(/[/\\]/g).pop();
    return url.replace(/^.*(\/images\/[^/]+)$/i, '$1').replace(/\\/g, '/');
  };

  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const userId = currentUser?.userId || null;
  const cartKey = userId ? `cart_${userId}` : null;

  // Validators (aligned to DB constraints) + content rules
  const onlyCyrillic = (v) => /^[А-Яа-яЁё\s-]+$/.test(v); // буквы/пробел/дефис
  const cyrillicOrDigits = (v) => /^[0-9А-Яа-яЁё\-\/]+$/.test(v); // цифры/кириллица/ - /

  const validateCity = (v) => {
    if (!v) return 'Введите город';
    if (v.length > 100) return 'Максимум 100 символов';
    if (!onlyCyrillic(v)) return 'Город: только русские буквы, без спецсимволов';
    return '';
  };
  const validateStreet = (v) => {
    if (!v) return 'Введите улицу';
    if (v.length > 200) return 'Максимум 200 символов';
    if (!onlyCyrillic(v)) return 'Улица: только русские буквы, без спецсимволов';
    return '';
  };
  const validateHouse = (v) => {
    if (!v) return 'Введите дом';
    if (v.length > 50) return 'Максимум 50 символов';
    if (!cyrillicOrDigits(v)) return 'Дом: только цифры и русские буквы';
    return '';
  };
  const validateApartment = (v) => {
    if (!v) return 'Введите квартиру';
    if (v.length > 50) return 'Максимум 50 символов';
    if (!cyrillicOrDigits(v)) return 'Квартира: только цифры и русские буквы';
    return '';
  };
  const validatePostalCode = (v) => {
    if (!v) return 'Введите индекс';
    if (!/^\d{6}$/.test(v)) return 'Индекс: строго 6 цифр';
    return '';
  };
  const validateDelivery = (v) => (!v ? 'Выберите способ доставки' : '');
  const validatePayment = (v) => (!v ? 'Выберите способ оплаты' : '');

  useEffect(() => {
    const savedCart = cartKey ? localStorage.getItem(cartKey) : null;
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
    setLoading(false);
  }, [cartKey]);

  useEffect(() => {
    if (!cartKey) return;
    if (cartItems.length > 0) {
        localStorage.setItem(cartKey, JSON.stringify(cartItems));
    } else {
        localStorage.removeItem(cartKey);
    }
    }, [cartItems, cartKey]);

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setConfirmClear(false);
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  };

  if (loading) {
    return <div className="cart-loading">Загрузка корзины...</div>;
  }

  const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const current = stored ? JSON.parse(stored) : null;
  const uid = current?.userId || null;
  if (!uid) {
    return (
      <div className="cart">
        <div className="cart-empty">
          <h3>Пользователь не авторизован или не зарегистрирован</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="cart">
      <div className="cart-header">
        <div className="cart-summary">
          <span className="cart-total-price">
            Итого: {getTotalPrice().toLocaleString('ru-RU', {
              style: 'currency',
              currency: 'RUB',
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
        {cartItems.length > 0 && (
          <button 
            className="clear-cart-btn"
            onClick={() => setConfirmClear(true)}
          >
            Удалить все
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="cart-empty">
          <h2>Корзина пуста</h2>
          <p>Добавьте товары из каталога</p>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            {cartItems.map(item => (
              <div key={item.id} className="cart-item">
                 <div className="cart-item-image">
                    {item.image_url ? (
                        <img src={normalizeImg(item.image_url)} alt={item.name} />
                    ) : (
                    <div className="cart-item-placeholder">Нет фото</div>
                    )}
                </div>
                <div className="cart-item-details">
                  <h3 className="cart-item-name">{item.name}</h3>
                  <p className="cart-item-price">
                    {Number(item.price).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>

                <div className="cart-item-controls">
                  <div className="quantity-controls">
                    <button
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                  <button
                    className="remove-btn"
                    onClick={() => setConfirmDeleteItem(item)}
                  >
                    Удалить
                  </button>
                </div>

                <div className="cart-item-total">
                  {(item.price * item.quantity).toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="cart-checkout">
            <div className="checkout-summary">
              <div className="checkout-row">
                <span>Товаров:</span>
                <span>{getTotalItems()} шт.</span>
              </div>
              <div className="checkout-row total">
                <span>Итого:</span>
                <span>
                  {getTotalPrice().toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>
            <button className="checkout-btn" onClick={() => setCheckoutOpen(true)}>
              Оформить заказ
            </button>
          </div>
        </div>
      )}

      {confirmClear && (
        <div className="cart-modal-backdrop" onClick={() => setConfirmClear(false)}>
          <div
            className="cart-modal-card cart-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cart-modal-body">
              <h3 className="cart-modal-title">Подтверждение</h3>
              <p className="cart-modal-desc">
                Вы действительно хотите удалить все товары из корзины?
              </p>
              <div className="cart-modal-footer">
                <button
                  className="cart-product-btn cancel-btn"
                  onClick={() => setConfirmClear(false)}
                >
                  Отмена
                </button>
                <button
                  className="cart-product-btn"
                  onClick={clearCart}
                  style={{ backgroundColor: '#dc3545' }}
                >
                  Удалить все
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteItem && (
        <div className="cart-modal-backdrop" onClick={() => setConfirmDeleteItem(null)}>
            <div
            className="cart-modal-card cart-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            >
            <div className="cart-modal-body">
              <h3 className="cart-modal-title">Подтверждение удаления</h3>
              <p className="cart-modal-desc">
                Вы действительно хотите удалить <strong>{confirmDeleteItem.name}</strong> из корзины?
              </p>
              <div className="cart-modal-footer">
                <button
                  className="cart-product-btn cancel-btn"
                  onClick={() => setConfirmDeleteItem(null)}
                >
                  Отмена
                </button>
                <button
                  className="cart-product-btn"
                  onClick={() => {
                    removeFromCart(confirmDeleteItem.id);
                    setConfirmDeleteItem(null);
                  }}
                  style={{ backgroundColor: '#dc3545' }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="cart-modal-backdrop" onClick={() => setCheckoutOpen(false)}>
          <div
            className="cart-modal-card cart-checkout-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <div className="cart-modal-body">
              <h3 id="checkout-title" className="cart-modal-title">Оформление заказа</h3>
              <p className="cart-modal-desc">Введите адрес доставки и подтвердите заказ.</p>

              <form
                className="cart-address-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (checkoutSubmitting) return;
                  const errs = {
                    city: validateCity(address.city),
                    street: validateStreet(address.street),
                    house: unitType === 'house' ? validateHouse(address.house) : '',
                    apartment: unitType === 'apartment' ? validateApartment(address.apartment) : '',
                    postalCode: validatePostalCode(address.postalCode),
                    deliveryMethod: validateDelivery(deliveryMethod),
                    paymentMethod: validatePayment(paymentMethod),
                  };
                  setFormErrors(errs);
                  const hasErr = Object.values(errs).some(Boolean);
                  if (hasErr) return;
                  setCheckoutSubmitting(true);
                  
                  try {
                    const response = await fetch('http://localhost:5000/api/orders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: uid,
                        address: address,
                        deliveryMethod: deliveryMethod,
                        paymentMethod: paymentMethod,
                        items: cartItems.map(item => ({
                          product_id: item.id,
                          quantity: item.quantity
                        }))
                      })
                    });

                    if (response.ok) {
                      const { orderId } = await response.json();
                      try {
                        await fetch('http://localhost:5000/api/payments', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            orderId,
                            method: paymentMethod,
                            status: paymentMethod === 'meet' ? 'pending' : 'pending'
                          })
                        });
                      } catch (e) {
                        console.error('Payment creation error:', e.message);
                      }

                      setCartItems([]);
                      setCheckoutOpen(false);
                    } else {
                      const error = await response.json();
                      console.error('Order creation failed:', error.error);
                    }
                  } catch (error) {
                    console.error('Order creation error:', error.message);
                  } finally {
                    setCheckoutSubmitting(false);
                  }
                }}
              >
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="addressUnitType">Тип адреса</label>
                    <select
                      id="addressUnitType"
                      value={unitType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUnitType(val);
                        if (val === 'house') {
                          // Очистить квартиру
                          setAddress({ ...address, apartment: '' });
                          setFormErrors({ ...formErrors, apartment: '' });
                        } else {
                          // Очистить дом
                          setAddress({ ...address, house: '' });
                          setFormErrors({ ...formErrors, house: '' });
                        }
                      }}
                      required
                    >
                      <option value="house">Дом</option>
                      <option value="apartment">Квартира</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="city">Город</label>
                    <input
                      id="city"
                      type="text"
                      placeholder="Москва"
                      value={address.city}
                      maxLength={100}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAddress({ ...address, city: v });
                        setFormErrors({ ...formErrors, city: validateCity(v) });
                      }}
                      required
                    />
                    {formErrors.city && <div className="cart-field-error">{formErrors.city}</div>}
                  </div>
                  <div className="form-field">
                    <label htmlFor="street">Улица</label>
                    <input
                      id="street"
                      type="text"
                      placeholder="Тверская"
                      value={address.street}
                      maxLength={200}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAddress({ ...address, street: v });
                        setFormErrors({ ...formErrors, street: validateStreet(v) });
                      }}
                      required
                    />
                    {formErrors.street && <div className="cart-field-error">{formErrors.street}</div>}
                  </div>
                  {unitType === 'house' ? (
                    <div className="form-field">
                      <label htmlFor="house">Дом</label>
                      <input
                        id="house"
                        type="text"
                        placeholder="10"
                        value={address.house}
                        maxLength={5}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddress({ ...address, house: v, apartment: '' });
                          setFormErrors({ ...formErrors, house: validateHouse(v), apartment: '' });
                        }}
                        required
                      />
                      {formErrors.house && <div className="cart-field-error">{formErrors.house}</div>}
                    </div>
                  ) : (
                    <div className="form-field">
                      <label htmlFor="apartment">Квартира</label>
                      <input
                        id="apartment"
                        type="text"
                        placeholder="45"
                        value={address.apartment}
                        maxLength={5}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddress({ ...address, apartment: v, house: '' });
                          setFormErrors({ ...formErrors, apartment: validateApartment(v), house: '' });
                        }}
                        required
                      />
                      {formErrors.apartment && <div className="cart-field-error">{formErrors.apartment}</div>}
                    </div>
                  )}
                  <div className="form-field">
                    <label htmlFor="postalCode">Почтовый индекс</label>
                    <input
                      id="postalCode"
                      type="text"
                      placeholder="101000"
                      value={address.postalCode}
                      onChange={(e) => {
                        // Разрешаем только цифры и максимум 6
                        const digits = (e.target.value || '').replace(/\D/g, '').slice(0, 6);
                        setAddress({ ...address, postalCode: digits });
                        setFormErrors({ ...formErrors, postalCode: validatePostalCode(digits) });
                      }}
                      required
                      inputMode="numeric"
                      maxLength={6}
                    />
                    {formErrors.postalCode && <div className="cart-field-error">{formErrors.postalCode}</div>}
                  </div>
                  
                  <div className="form-field">
                    <label htmlFor="deliveryMethod">Способ доставки</label>
                    <select
                      id="deliveryMethod"
                      value={deliveryMethod}
                      onChange={(e) => {
                        setDeliveryMethod(e.target.value);
                        setFormErrors({ ...formErrors, deliveryMethod: validateDelivery(e.target.value) });
                      }}
                      required
                    >
                      <option value="">Выберите способ доставки</option>
                      <option value="courier">Курьер</option>
                      <option value="pickup">Самовывоз</option>
                      <option value="post">На почту</option>
                    </select>
                    {formErrors.deliveryMethod && <div className="cart-field-error">{formErrors.deliveryMethod}</div>}
                  </div>
                  
                  <div className="form-field">
                    <label htmlFor="paymentMethod">Способ оплаты</label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        setFormErrors({ ...formErrors, paymentMethod: validatePayment(e.target.value) });
                      }}
                      required
                    >
                      <option value="">Выберите способ оплаты</option>
                      <option value="card">Банковская карта</option>
                      <option value="meet">При получении</option>
                      <option value="sbp">СБП</option>
                    </select>
                    {formErrors.paymentMethod && <div className="cart-field-error">{formErrors.paymentMethod}</div>}
                  </div>
                </div>

                <div className="cart-modal-footer">
                  <button
                    type="button"
                    className="cart-product-btn cancel-btn"
                    onClick={() => setCheckoutOpen(false)}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="cart-product-btn"
                    disabled={checkoutSubmitting}
                    style={{ backgroundColor: '#9E8279' }}
                  >
                    {checkoutSubmitting ? 'Оформляем...' : 'Подтвердить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default Cart;