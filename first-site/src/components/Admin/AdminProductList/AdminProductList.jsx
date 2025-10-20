import { useEffect, useState } from 'react';
import "./AdminProductList.css";
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api/products'; // совпадает с Catalog

const AdminProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    manufacturer: '',
    priceSort: '',
    weightSort: ''
  });
  const navigate = useNavigate();

  // Состояния для модальных окон
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Состояния для форм
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    weight: '',
    category: '',
    manufacturer: '',
    sku: '',
    imageUrl: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const updateFilters = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setLoading(true);
    setError('');
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
        setError('Ошибка загрузки товаров');
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // поиск по имени
  const items = Array.isArray(products) ? products : [];
  const filteredItems = items.filter(item =>
    (item.name || item.name_product || '')
      .toString()
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const normalizeDescription = (text) => {
    const raw = (text ?? '').toString().trim().replace(/\s+/g, ' ');
    if (!raw) return 'Описание отсутствует';
    return raw;
  };

  const normalizeImg = (url) => {
    if (!url) return '';
    const m = url.match(/[/\\]images[/\\][^/\\]+$/i);
    if (m) return '/images/' + m[0].split(/[/\\]/g).pop();
    return url.replace(/^.*(\/images\/[^/]+)$/i, '$1').replace(/\\/g, '/');
  };

  // Функции для работы с модальными окнами
  const openAddModal = () => {
    setProductForm({
      name: '',
      description: '',
      price: '',
      weight: '',
      category: '',
      manufacturer: '',
      sku: '',
      imageUrl: ''
    });
    setFormErrors({});
    setSelectedFile(null);
    setImagePreview(null);
    setShowAddModal(true);
  };

  const openEditModal = (product) => {
    setProductForm({
      name: product.name || product.name_product || '',
      description: product.description || '',
      price: product.price || '',
      weight: product.weight_grams || product.weightGrams || '',
      category: product.category || product.category_name || '',
      manufacturer: product.manufacturer || product.manufacturer_name || '',
      sku: product.sku || '',
      imageUrl: product.image_url || product.photo_url || ''
    });
    setFormErrors({});
    setSelectedFile(null);
    setImagePreview(null);
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const openDeleteModal = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedProduct(null);
    setFormErrors({});
  };

  // Валидация формы
  const validateForm = () => {
    const errors = {};
    const nameStr = String(productForm.name ?? '').trim();
    const priceStr = String(productForm.price ?? '').trim();
    const weightStr = String(productForm.weight ?? '').trim();

    if (!nameStr) errors.name = 'Название обязательно';
    if (!priceStr) errors.price = 'Цена обязательна';
    if (!weightStr) errors.weight = 'Вес обязателен';

    if (priceStr && isNaN(Number(priceStr))) errors.price = 'Цена должна быть числом';
    if (weightStr && isNaN(Number(weightStr))) errors.weight = 'Вес должен быть числом';
    if (priceStr && Number(priceStr) < 0) errors.price = 'Цена не может быть отрицательной';
    if (weightStr && Number(weightStr) < 0) errors.weight = 'Вес не может быть отрицательным';
    
    // Для создания товара изображение обязательно
    if (showAddModal && !selectedFile && !productForm.imageUrl) {
      errors.image = 'Изображение обязательно';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Обработка изменения формы
  const handleFormChange = (field, value) => {
    setProductForm(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Обработка выбора файла
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      
      // Создаем превью изображения
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Загрузка изображения на сервер
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('http://localhost:5000/api/upload/product-image', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Ошибка загрузки изображения');
    }

    const result = await response.json();
    return result.imageUrl;
  };

  // Создание товара
  const handleCreateProduct = async () => {
    if (!validateForm()) return;
    
    setFormLoading(true);
    try {
      let imageUrl = null;
      
      // Если выбран файл, загружаем его
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      } else if (productForm.imageUrl) {
        imageUrl = productForm.imageUrl;
      } else {
        throw new Error('Изображение обязательно для создания товара');
      }
      
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price: Number(productForm.price),
          weight_grams: Number(productForm.weight),
          category: productForm.category,
          manufacturer: productForm.manufacturer,
          sku: productForm.sku,
          image_url: imageUrl
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Ошибка создания товара');
      }

      const newProduct = await res.json();
      setProducts(prev => [...prev, newProduct]);
      closeModals();
    } catch (e) {
      console.error(e);
      setFormErrors({ submit: e.message });
    } finally {
      setFormLoading(false);
    }
  };

  // Обновление товара
  const handleUpdateProduct = async () => {
    if (!validateForm() || !selectedProduct) return;
    
    setFormLoading(true);
    try {
      let imageUrl = productForm.imageUrl;
      
      // Если выбран новый файл, загружаем его
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      }
      
      const id = selectedProduct.product_id || selectedProduct.id;
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price: Number(productForm.price),
          weight_grams: Number(productForm.weight),
          category: productForm.category,
          manufacturer: productForm.manufacturer,
          sku: productForm.sku,
          image_url: imageUrl
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Ошибка обновления товара');
      }

      const updatedProduct = await res.json();
      setProducts(prev => prev.map(p => 
        (p.product_id || p.id) === id ? updatedProduct : p
      ));
      closeModals();
    } catch (e) {
      console.error(e);
      setFormErrors({ submit: e.message });
    } finally {
      setFormLoading(false);
    }
  };

  // Удаление товара
  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    setFormLoading(true);
    try {
      const id = selectedProduct.product_id || selectedProduct.id;
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Ошибка удаления');
      }
      
      setProducts(prev => prev.filter(p => (p.product_id || p.id) !== id));
      closeModals();
    } catch (e) {
      console.error(e);
      setFormErrors({ submit: 'Не удалось удалить товар: ' + (e.message || '') });
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <div className="admin-list-loading">Загрузка...</div>;
  if (error) return <div className="admin-list-error">{error}</div>;

  return (
    <section className="admin-product-list">
      <div className="admin-header">
        <h2>Управление товарами</h2>
        <button className="admin-add-btn" onClick={openAddModal}>
          + Добавить товар
        </button>
      </div>
      
      <div className="admin-controls">
        <div className="admin-search">
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
          />
        </div>

        <div className="admin-filters">
          <select
            value={filters.category}
            onChange={(e) => updateFilters('category', e.target.value)}
            className="admin-filter-select"
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
            className="admin-filter-select"
          >
            <option value="">Все производители</option>
            <option value="Сладкая Фабрика">Сладкая Фабрика</option>
            <option value="Шоколадная фабрика">Шоколадная фабрика</option>
          </select>

          <select
            value={filters.priceSort}
            onChange={(e) => updateFilters('priceSort', e.target.value)}
            className="admin-filter-select"
          >
            <option value="">Цена</option>
            <option value="ASC">По возрастанию</option>
            <option value="DESC">По убыванию</option>
          </select>

          <select
            value={filters.weightSort}
            onChange={(e) => updateFilters('weightSort', e.target.value)}
            className="admin-filter-select"
          >
            <option value="">Вес</option>
            <option value="ASC">По возрастанию</option>
            <option value="DESC">По убыванию</option>
          </select>
        </div>
      </div>

      <div className="admin-catalog-grid">
        {filteredItems.length === 0 ? (
          <div className="admin-list-empty">
            {searchTerm ? 'Товары не найдены' : 'Нет товаров'}
          </div>
        ) : (
          filteredItems.map((p) => {
            const id = p.product_id || p.id;
            const name = p.name || p.name_product || 'Товар';
            const image = p.image_url || p.photo_url || '';
            const price = p.price ?? 0;
            return (
              <article
                key={id}
                className="admin-product-card"
                role="article"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') {/* noop */} }}
              >
                <div className="admin-product-thumb">
                  {image ? <img src={normalizeImg(image)} alt={name} /> : <div className="admin-thumb-placeholder">Нет фото</div>}
                </div>

                <div className="admin-product-body">
                  <h3 className="admin-product-title">{name}</h3>
                  <p className="admin-product-desc">{normalizeDescription(p.description || p.name_description)}</p>

                  <div className="admin-meta-grid">
                    { (p.category || p.category_name) && <span className="admin-meta-chip">Категория: {p.category || p.category_name}</span> }
                    { (p.manufacturer || p.manufacturer_name) && <span className="admin-meta-chip">Производитель: {p.manufacturer || p.manufacturer_name}</span> }
                    { (p.weightGrams || p.weight_grams) && <span className="admin-meta-chip">Вес: {p.weightGrams || p.weight_grams} г</span> }
                    { p.sku && <span className="admin-meta-chip">Артикул: {p.sku}</span> }
                  </div>

                  <div className="admin-product-footer">
                    <span className="admin-product-price">
                      {Number(price).toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 })}
                    </span>

                    <div className="admin-product-actions">
                      <button
                        className="admin-action-btn"
                        onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                        title="Редактировать"
                      >
                        Редактировать
                      </button>
                      <button
                        className="admin-action-btn admin-action-delete"
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(p); }}
                        title="Удалить"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Модальное окно добавления товара */}
      {showAddModal && (
        <div className="admin-modal-backdrop" onClick={closeModals}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Добавить товар</h3>
              <button className="admin-modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="admin-modal-body">
              <form onSubmit={(e) => { e.preventDefault(); handleCreateProduct(); }}>
                <div className="admin-form-group">
                  <label>Название товара *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Введите название товара"
                  />
                  {formErrors.name && <div className="admin-form-error">{formErrors.name}</div>}
                </div>

                <div className="admin-form-group">
                  <label>Описание</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Введите описание товара"
                    rows="3"
                  />
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Цена (руб.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => handleFormChange('price', e.target.value)}
                      placeholder="0.00"
                    />
                    {formErrors.price && <div className="admin-form-error">{formErrors.price}</div>}
                  </div>

                  <div className="admin-form-group">
                    <label>Вес (г) *</label>
                    <input
                      type="number"
                      value={productForm.weight}
                      onChange={(e) => handleFormChange('weight', e.target.value)}
                      placeholder="0"
                    />
                    {formErrors.weight && <div className="admin-form-error">{formErrors.weight}</div>}
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Категория</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => handleFormChange('category', e.target.value)}
                    >
                      <option value="">Выберите категорию</option>
                      <option value="Шоколад">Шоколад</option>
                      <option value="Конфеты">Конфеты</option>
                      <option value="Торты">Торты</option>
                      <option value="Чизкейки">Чизкейки</option>
                      <option value="Капкейк">Капкейк</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label>Производитель</label>
                    <select
                      value={productForm.manufacturer}
                      onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                    >
                      <option value="">Выберите производителя</option>
                      <option value="Сладкая Фабрика">Сладкая Фабрика</option>
                      <option value="Шоколадная фабрика">Шоколадная фабрика</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Артикул (SKU)</label>
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => handleFormChange('sku', e.target.value)}
                      placeholder="Введите артикул"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Изображение товара *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="admin-file-input"
                      required
                    />
                    {imagePreview && (
                      <div className="admin-image-preview">
                        <img src={imagePreview} alt="Превью" />
                      </div>
                    )}
                  </div>
                </div>

                {formErrors.submit && <div className="admin-form-error">{formErrors.submit}</div>}

                <div className="admin-modal-actions">
                  <button type="button" onClick={closeModals} disabled={formLoading}>
                    Отмена
                  </button>
                  <button type="submit" disabled={formLoading}>
                    {formLoading ? 'Создание...' : 'Создать товар'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования товара */}
      {showEditModal && (
        <div className="admin-modal-backdrop" onClick={closeModals}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Редактировать товар</h3>
              <button className="admin-modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="admin-modal-body">
              <form onSubmit={(e) => { e.preventDefault(); handleUpdateProduct(); }}>
                <div className="admin-form-group">
                  <label>Название товара *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Введите название товара"
                  />
                  {formErrors.name && <div className="admin-form-error">{formErrors.name}</div>}
                </div>

                <div className="admin-form-group">
                  <label>Описание</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Введите описание товара"
                    rows="3"
                  />
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Цена (руб.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => handleFormChange('price', e.target.value)}
                      placeholder="0.00"
                    />
                    {formErrors.price && <div className="admin-form-error">{formErrors.price}</div>}
                  </div>

                  <div className="admin-form-group">
                    <label>Вес (г) *</label>
                    <input
                      type="number"
                      value={productForm.weight}
                      onChange={(e) => handleFormChange('weight', e.target.value)}
                      placeholder="0"
                    />
                    {formErrors.weight && <div className="admin-form-error">{formErrors.weight}</div>}
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Категория</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => handleFormChange('category', e.target.value)}
                    >
                      <option value="">Выберите категорию</option>
                      <option value="Шоколад">Шоколад</option>
                      <option value="Конфеты">Конфеты</option>
                      <option value="Торты">Торты</option>
                      <option value="Чизкейки">Чизкейки</option>
                      <option value="Капкейк">Капкейк</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label>Производитель</label>
                    <select
                      value={productForm.manufacturer}
                      onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                    >
                      <option value="">Выберите производителя</option>
                      <option value="Сладкая Фабрика">Сладкая Фабрика</option>
                      <option value="Шоколадная фабрика">Шоколадная фабрика</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label>Артикул (SKU)</label>
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => handleFormChange('sku', e.target.value)}
                      placeholder="Введите артикул"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Изображение товара</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="admin-file-input"
                    />
                    {imagePreview && (
                      <div className="admin-image-preview">
                        <img src={imagePreview} alt="Превью" />
                      </div>
                    )}
                    {!imagePreview && productForm.imageUrl && (
                      <div className="admin-image-preview">
                        <img src={productForm.imageUrl} alt="Текущее изображение" />
                        <p className="admin-current-image-text">Текущее изображение</p>
                      </div>
                    )}
                    {formErrors.image && <div className="admin-form-error">{formErrors.image}</div>}
                  </div>
                </div>

                {formErrors.submit && <div className="admin-form-error">{formErrors.submit}</div>}

                <div className="admin-modal-actions">
                  <button type="button" onClick={closeModals} disabled={formLoading}>
                    Отмена
                  </button>
                  <button type="submit" disabled={formLoading}>
                    {formLoading ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && selectedProduct && (
        <div className="admin-modal-backdrop" onClick={closeModals}>
          <div className="admin-modal-card admin-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="admin-modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="admin-modal-body">
              <p>Вы действительно хотите удалить товар <strong>"{selectedProduct.name || selectedProduct.name_product}"</strong>?</p>
              <p className="admin-delete-warning">Это действие нельзя отменить.</p>
              
              {formErrors.submit && <div className="admin-form-error">{formErrors.submit}</div>}

              <div className="admin-modal-actions">
                <button type="button" onClick={closeModals} disabled={formLoading}>
                  Отмена
                </button>
                <button 
                  type="button" 
                  onClick={handleDeleteProduct} 
                  disabled={formLoading}
                  className="admin-delete-btn"
                >
                  {formLoading ? 'Удаление...' : 'Удалить товар'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminProductList;
