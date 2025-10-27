const {
  createProductService
} = require('../../../../features/products/products.service');

jest.mock('../../../../features/products/products.repository', () => ({
  createProduct: jest.fn(),
  findProductById: jest.fn()
}));

const { createProduct, findProductById } = require('../../../../features/products/products.repository');

describe('🛍️ ТОВАРЫ - Создание', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('➕ Создание товара', () => {
    test('✅ должен создавать товар и возвращать полные данные', async () => {
      const productData = {
        name: 'New Product',
        price: 150,
        weight: 300
      };

      const mockCreated = { product_id: 1, id: 1 };
      const mockFull = {
        product_id: 1,
        name_product: 'New Product',
        price: '150.00',
        weight_grams: 300
      };

      createProduct.mockResolvedValue(mockCreated);
      findProductById.mockResolvedValue(mockFull);

      const result = await createProductService(productData);

      expect(createProduct).toHaveBeenCalledWith(productData);
      expect(findProductById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockFull);
    });

    test('✅ должен возвращать созданный товар если полные данные не найдены', async () => {
      const productData = { name: 'New Product' };
      const mockCreated = { product_id: 1 };

      createProduct.mockResolvedValue(mockCreated);
      findProductById.mockResolvedValue(null);

      const result = await createProductService(productData);

      expect(result).toEqual(mockCreated);
    });

    test('✅ должен обрабатывать createProduct с разными именами полей ID', async () => {
      const productData = { name: 'New Product' };
      const mockCreated = { id: 1 };
      const mockFull = {
        product_id: 1,
        name_product: 'New Product'
      };

      createProduct.mockResolvedValue(mockCreated);
      findProductById.mockResolvedValue(mockFull);

      const result = await createProductService(productData);

      expect(findProductById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockFull);
    });

    test('✅ должен обрабатывать ошибки базы данных при создании', async () => {
      const productData = { name: 'New Product' };
      const error = new Error('Database connection failed');
      
      createProduct.mockRejectedValue(error);

      await expect(createProductService(productData)).rejects.toThrow('Database connection failed');
    });

    test('✅ должен обрабатывать ошибки базы данных при получении', async () => {
      const productData = { name: 'New Product' };
      const mockCreated = { product_id: 1 };
      const error = new Error('Database query failed');
      
      createProduct.mockResolvedValue(mockCreated);
      findProductById.mockRejectedValue(error);

      await expect(createProductService(productData)).rejects.toThrow('Database query failed');
    });
  });
});
