import { useState, useEffect } from 'react';
import './Favorites.css';

function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmAdd, setConfirmAdd] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const currentUser = stored ? JSON.parse(stored) : null;
  const userId = currentUser?.userId || null;
  const favKey = userId ? `favorites_${userId}` : null;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const savedFavorites = JSON.parse(localStorage.getItem(favKey) || '[]');
    setFavorites(savedFavorites);
    setLoading(false);
  }, [userId]);

  if (!userId) {
    return (
      <section className="favorites">
        <div className="favorites-unauth">
          <h3>Пользователь не авторизован или не зарегистрирован</h3>
        </div>
      </section>
    );
  }

  const removeFromFavorites = (product) => {
    setConfirmRemove(product);
  };

  const confirmRemoveFromFavorites = () => {
    const product = confirmRemove;
    const updatedFavorites = favorites.filter(item => item.id !== product.id);
    setFavorites(updatedFavorites);
    localStorage.setItem(favKey, JSON.stringify(updatedFavorites));
    setConfirmRemove(null);
  };

  const cancelRemoveFromFavorites = () => {
    setConfirmRemove(null);
  };

  const addToCart = (product) => {
    setConfirmAdd(product);
  };

  const confirmAddToCart = () => {
    const product = confirmAdd;
    const cartKey = `cart_${userId}`;
    const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const existingItem = existingCart.find(item => item.id === product.id);

    if (existingItem) {
      const updatedCart = existingCart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      localStorage.setItem(cartKey, JSON.stringify(updatedCart));
    } else {
      const newCart = [...existingCart, { ...product, quantity: 1 }];
      localStorage.setItem(cartKey, JSON.stringify(newCart));
    }
    setConfirmAdd(null);
  };

  const cancelAddToCart = () => {
    setConfirmAdd(null);
  };


  const normalizeDescription = (text) => {
    const raw = (text ?? '').toString().trim().replace(/\s+/g, ' ');
    if (!raw) return 'Описание скоро добавим';
    return raw;
  };

  if (loading) {
    return <div className="favorite-loading">Загрузка...</div>;
  }

  return (
    <section className="favorites">
      {favorites.length === 0 ? (
        <div className="favorites-empty">
          <h3>В избранном пока ничего нет</h3>
          <p>Добавьте товары в избранное, нажав на сердечко в каталоге</p>
        </div>
      ) : (
        <div className="favorites-grid">
          {favorites.map((product) => (
            <article key={product.id} className="favorite-item">
              <button
                className="remove-favorite-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromFavorites(product);
                }}
                aria-label="Удалить из избранного"
                title="Удалить из избранного"
              >
                ×
              </button>
              
              <div className="favorite-thumb">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} />
                ) : (
                  <div className="favorite-thumb--placeholder">Нет фото</div>
                )}
              </div>
              
              <div className="favorite-body">
                <h3 className="favorite-title">{product.name}</h3>
                <p className="favorite-desc">{normalizeDescription(product.description)}</p>
                
                <div className="favorite-footer">
                  <span className="favorite-price">
                    {Number(product.price).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  
                  <div className="favorite-actions">
                    <button
                      className="favorite-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                    >
                      В корзину
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {confirmAdd && (
        <div className="favorites-modal-backdrop" onClick={cancelAddToCart}>
          <div
            className="favorites-modal-card favorites-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="favorites-modal-body">
              <h3 className="favorites-modal-title">Подтверждение</h3>
              <p className="favorites-modal-desc">
                Вы хотите добавить товар "{confirmAdd.name}" в корзину?
              </p>
              <div className="favorites-modal-footer">
                <button
                  className="favorite-btn cancel-btn"
                  onClick={cancelAddToCart}
                >
                  Отмена
                </button>
                <button
                  className="favorite-btn"
                  onClick={confirmAddToCart}
                >
                  Добавить в корзину
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="favorites-modal-backdrop" onClick={cancelRemoveFromFavorites}>
          <div
            className="favorites-modal-card favorites-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="favorites-modal-body">
              <h3 className="favorites-modal-title">Подтверждение удаления</h3>
              <p className="favorites-modal-desc">
                Вы действительно хотите удалить товар "{confirmRemove.name}" из избранного?
              </p>
              <div className="favorites-modal-footer">
                <button
                  className="favorite-btn cancel-btn"
                  onClick={cancelRemoveFromFavorites}
                >
                  Отмена
                </button>
                <button
                  className="favorite-btn"
                  onClick={confirmRemoveFromFavorites}
                  style={{ backgroundColor: '#dc3545' }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Favorites;