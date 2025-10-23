const {
  getCatalogProducts,
  getProductById
} = require('../../../../features/products/products.service');

// Mock dependencies
jest.mock('../../../../features/products/products.repository', () => ({
  findAllProducts: jest.fn(),
  findProductById: jest.fn()
}));

jest.mock('../../../../utils/imagePath', () => ({
  toPublicImagePath: jest.fn((path) => path ? `/images/${path.split('/').pop()}` : null)
}));

const { findAllProducts, findProductById } = require('../../../../features/products/products.repository');
const { toPublicImagePath } = require('../../../../utils/imagePath');

describe('🛍️ ТОВАРЫ - Получение данных', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('📋 Получение каталога товаров', () => {
    test('✅ должен возвращать отформатированный список товаров', async () => {
      const mockProducts = [
        {
          product_id: 1,
          name_product: 'Test Product',
          description: 'Test Description',
          price: '100.00',
          weight_grams: 200,
          photo_url: '/path/to/image.jpg',
          category_name: 'Test Category',
          manufacturer_name: 'Test Manufacturer',
          sku: 'TEST123'
        }
      ];

      findAllProducts.mockResolvedValue(mockProducts);
      toPublicImagePath.mockReturnValue('/images/image.jpg');

      const result = await getCatalogProducts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Test Product',
        description: 'Test Description',
        price: '100.00',
        weightGrams: 200,
        image_url: '/images/image.jpg',
        category: 'Test Category',
        manufacturer: 'Test Manufacturer',
        sku: 'TEST123'
      });
    });

    test('✅ должен обрабатывать пустой список товаров', async () => {
      findAllProducts.mockResolvedValue([]);

      const result = await getCatalogProducts();

      expect(result).toEqual([]);
      expect(findAllProducts).toHaveBeenCalledWith({});
    });

    test('✅ должен передавать фильтры в репозиторий', async () => {
      const filters = { category: 'Test Category' };
      findAllProducts.mockResolvedValue([]);

      await getCatalogProducts(filters);

      expect(findAllProducts).toHaveBeenCalledWith(filters);
    });

    test('✅ должен обрабатывать товары с пустыми категориями и производителями', async () => {
      const mockProducts = [
        {
          product_id: 1,
          name_product: 'Test Product',
          description: 'Test Description',
          price: '100.00',
          weight_grams: 200,
          photo_url: '/path/to/image.jpg',
          category_name: null,
          manufacturer_name: null,
          sku: 'TEST123'
        }
      ];

      findAllProducts.mockResolvedValue(mockProducts);
      toPublicImagePath.mockReturnValue('/images/image.jpg');

      const result = await getCatalogProducts();

      expect(result[0].category).toBeNull();
      expect(result[0].manufacturer).toBeNull();
    });
  });

  describe('🔍 Получение товара по ID', () => {
    test('✅ должен возвращать товар по ID', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        name_product: 'Test Product',
        price: '100.00'
      };

      findProductById.mockResolvedValue(mockProduct);

      const result = await getProductById(productId);

      expect(findProductById).toHaveBeenCalledWith(productId);
      expect(result).toEqual(mockProduct);
    });

    test('✅ должен обрабатывать несуществующий товар', async () => {
      const productId = 999;
      findProductById.mockResolvedValue(null);

      const result = await getProductById(productId);

      expect(result).toBeNull();
    });
  });
});
