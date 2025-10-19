import { useEffect, useState } from 'react';
import './Catalog.css';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api/products';

function Catalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    manufacturer: '',
    priceSort: '',
    weightSort: ''
  });

  const [confirmAdd, setConfirmAdd] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const navigate = useNavigate();
  const getCurrentUser = () => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
    const currentUser = stored ? JSON.parse(stored) : null;
    return currentUser && currentUser.userId ? currentUser : null;
  };
  const getCartKey = (userId) => `cart_${userId}`;
  const getFavoritesKey = (userId) => `favorites_${userId}`;

  const openDetails = (product) => setSelectedProduct(product);
  const closeDetails = () => setSelectedProduct(null);

  const updateFilters = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const normalizeImg = (url) => {
    if (!url) return '';
    const m = url.match(/[/\\]images[/\\][^/\\]+$/i);
    if (m) return '/images/' + m[0].split(/[/\\]/g).pop();
    return url.replace(/^.*(\/images\/[^/]+)$/i, '$1').replace(/\\/g, '/');
  };

  const addToCart = (product) => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/register');
      return;
    }
    setConfirmAdd(product);
  };

  const confirmAddToCart = () => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/register');
      setConfirmAdd(null);
      return;
    }
    const product = confirmAdd;
    const cartKey = getCartKey(user.userId);
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

  const toggleFavorite = (product) => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/register');
      return;
    }
    const key = getFavoritesKey(user.userId);
    const isFav = favorites.some(item => item.id === product.id);
    const updatedFavorites = isFav
      ? favorites.filter(item => item.id !== product.id)
      : [...favorites, product];
    setFavorites(updatedFavorites);
    localStorage.setItem(key, JSON.stringify(updatedFavorites));
  };

  const isFavorite = (product) => {
    return favorites.some(item => item.id === product.id);
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.manufacturer) params.append('manufacturer', filters.manufacturer);
    if (filters.priceSort) params.append('priceSort', filters.priceSort);
    if (filters.weightSort) params.append('weightSort', filters.weightSort);
    
    const queryString = params.toString();
    const url = queryString ? `${API_URL}?${queryString}` : API_URL;
    
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`HTTP ${r.status}: ${text}`);
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          console.warn('Unexpected payload:', data);
          setProducts([]);
        }
      })
      .catch((e) => {
        console.error(e);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setFavorites([]);
      return;
    }
    const key = getFavoritesKey(user.userId);
    const savedFavorites = JSON.parse(localStorage.getItem(key) || '[]');
    setFavorites(savedFavorites);
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        closeDetails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedProduct]);

  if (loading) return <div className="catalog-loading">Загрузка...</div>;

  const items = Array.isArray(products) ? products : [];
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const normalizeDescription = (text) => {
    const raw = (text ?? '').toString().trim().replace(/\s+/g, ' ');
    if (!raw) return 'Описание скоро добавим';
    return raw;
  };

  return (
    <section className="catalog">
      <div className="catalog-search">
        <input
          type="text"
          placeholder="Поиск товаров..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="catalog-filters">
        <select 
          value={filters.category} 
          onChange={(e) => updateFilters('category', e.target.value)}
          className="filter-select"
        >
          <option value="">Все категории</option>
          <option value="Шоколад">Шоколад</option>
          <option value="Конфеты">Конфеты</option>
          <option value="Торты">Торты</option>
          <option value="Чизкейки">Чизкейки</option>
          <option value="Капкейк">Капкейк</option>
        </select>

        <select 
          value={filters.manufacturer} 
          onChange={(e) => updateFilters('manufacturer', e.target.value)}
          className="filter-select"
        >
          <option value="">Все производители</option>
          <option value="Сладкая Фабрика">Сладкая Фабрика</option>
          <option value="Шоколадная фабрика">Шоколадная фабрика</option>
        </select>

        <select 
          value={filters.priceSort} 
          onChange={(e) => updateFilters('priceSort', e.target.value)}
          className="filter-select"
        >
          <option value="">Цена</option>
          <option value="ASC">По возрастанию</option>
          <option value="DESC">По убыванию</option>
        </select>

        <select 
          value={filters.weightSort} 
          onChange={(e) => updateFilters('weightSort', e.target.value)}
          className="filter-select"
        >
          <option value="">Вес</option>
          <option value="ASC">По возрастанию</option>
          <option value="DESC">По убыванию</option>
        </select>
      </div>

      <div className="catalog-grid">
        {filteredItems.length === 0 ? (
          <div className="no-results">
            {searchTerm ? 'Товары не найдены' : 'Нет товаров'}
          </div>
        ) : (
          filteredItems.map((p) => (
            <article
              key={p.id}
              className="product-card"
              onClick={() => openDetails(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openDetails(p);
              }}
            >
              <div className="product-thumb">
                {p.image_url ? (
                  <img src={normalizeImg(p.image_url)} alt={p.name} />
                ) : (
                  <div className="product-thumb--placeholder">Нет фото</div>
                )}
              </div>
              <div className="product-body">
                <h3 className="product-title">{p.name}</h3>
                <p className="product-desc">{normalizeDescription(p.description)}</p>
                <div className="product-footer">
                  <span className="product-price">
                    {Number(p.price).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <div className="product-actions">
                    <span
                      className={`favorite-heart ${isFavorite(p) ? 'favorite-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(p);
                      }}
                      aria-label={isFavorite(p) ? 'Удалить из избранного' : 'Добавить в избранное'}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          toggleFavorite(p);
                        }
                      }}
                    >
                      ♥
                    </span>
                  </div>
                  <button
                    className="product-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(p);
                    }}
                  >
                    В корзину
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {selectedProduct && (
        <div className="catalog-modal-backdrop" onClick={closeDetails}>
          <div
            className="catalog-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >

            <div className="catalog-modal-thumb">
              {selectedProduct.image_url ? (
                <img src={normalizeImg(selectedProduct.image_url)} alt={selectedProduct.name} />
              ) : (
                <div className="product-thumb--placeholder">Нет фото</div>
              )}
            </div>

            <div className="catalog-modal-body">
              <h3 className="catalog-modal-title">{selectedProduct.name}</h3>

              {(selectedProduct.category || selectedProduct.manufacturer || selectedProduct.weightGrams || selectedProduct.sku) && (
                <div className="catalog-modal-meta">
                  {selectedProduct.category && (
                    <span className="catalog-meta-chip">Категория: {selectedProduct.category}</span>
                  )}
                  {selectedProduct.manufacturer && (
                    <span className="catalog-meta-chip">Производитель: {selectedProduct.manufacturer}</span>
                  )}
                  {selectedProduct.weightGrams && (
                    <span className="catalog-meta-chip">Вес: {selectedProduct.weightGrams}г</span>
                  )}
                  {selectedProduct.sku && (
                    <span className="catalog-meta-chip">Артикул: {selectedProduct.sku}</span>
                  )}
                </div>
              )}

              {selectedProduct.description ? (
                <p className="catalog-modal-desc">{selectedProduct.description}</p>
              ) : null}
            </div>
          </div>
        </div>
)}

      {confirmAdd && (
        <div className="catalog-modal-backdrop" onClick={cancelAddToCart}>
          <div
            className="catalog-modal-card catalog-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="catalog-modal-body">
              <h3 className="catalog-modal-title">Подтверждение</h3>
              <p className="catalog-modal-desc">
                Вы хотите добавить товар "{confirmAdd.name}" в корзину?
              </p>
              <div className="catalog-modal-footer">
                <button
                  className="catalog-product-btn cancel-btn"
                  onClick={cancelAddToCart}
                >
                  Отмена
                </button>
                <button
                  className="catalog-product-btn"
                  onClick={confirmAddToCart}
                >
                  Добавить в корзину
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

export default Catalog;