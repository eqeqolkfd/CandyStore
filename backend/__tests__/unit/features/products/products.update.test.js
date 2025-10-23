const {
  updateProductService
} = require('../../../../features/products/products.service');

jest.mock('../../../../features/products/products.repository', () => ({
  updateProduct: jest.fn(),
  findProductById: jest.fn()
}));

const { updateProduct, findProductById } = require('../../../../features/products/products.repository');

describe('🛍️ ТОВАРЫ - Обновление', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✏️ Обновление товара', () => {
    test('✅ должен обновлять товар и возвращать обновленные данные', async () => {
      const productId = 1;
      const productData = { name: 'Updated Product' };
      const mockUpdated = {
        product_id: 1,
        name_product: 'Updated Product',
        price: '150.00'
      };

      updateProduct.mockResolvedValue();
      findProductById.mockResolvedValue(mockUpdated);

      const result = await updateProductService(productId, productData);

      expect(updateProduct).toHaveBeenCalledWith(productId, productData);
      expect(findProductById).toHaveBeenCalledWith(productId);
      expect(result).toEqual(mockUpdated);
    });

    test('✅ должен обрабатывать обновление с несколькими полями', async () => {
      const productId = 1;
      const productData = {
        name: 'Updated Product',
        price: 200,
        weight: 400,
        description: 'Updated description'
      };
      const mockUpdated = {
        product_id: 1,
        name_product: 'Updated Product',
        price: '200.00',
        weight_grams: 400,
        description: 'Updated description'
      };

      updateProduct.mockResolvedValue();
      findProductById.mockResolvedValue(mockUpdated);

      const result = await updateProductService(productId, productData);

      expect(updateProduct).toHaveBeenCalledWith(productId, productData);
      expect(result).toEqual(mockUpdated);
    });

    test('✅ должен обрабатывать обновление с пустыми данными', async () => {
      const productId = 1;
      const productData = {};
      const mockUpdated = {
        product_id: 1,
        name_product: 'Original Product'
      };

      updateProduct.mockResolvedValue();
      findProductById.mockResolvedValue(mockUpdated);

      const result = await updateProductService(productId, productData);

      expect(updateProduct).toHaveBeenCalledWith(productId, productData);
      expect(result).toEqual(mockUpdated);
    });

    test('✅ должен обрабатывать ошибки базы данных при обновлении', async () => {
      const productId = 1;
      const productData = { name: 'Updated Product' };
      const error = new Error('Database update failed');
      
      updateProduct.mockRejectedValue(error);

      await expect(updateProductService(productId, productData)).rejects.toThrow('Database update failed');
    });

    test('✅ должен обрабатывать ошибки базы данных при получении', async () => {
      const productId = 1;
      const productData = { name: 'Updated Product' };
      const error = new Error('Database query failed');
      
      updateProduct.mockResolvedValue();
      findProductById.mockRejectedValue(error);

      await expect(updateProductService(productId, productData)).rejects.toThrow('Database query failed');
    });

    test('✅ должен обрабатывать обновление несуществующего товара', async () => {
      const productId = 999;
      const productData = { name: 'Updated Product' };
      
      updateProduct.mockResolvedValue();
      findProductById.mockResolvedValue(null);

      const result = await updateProductService(productId, productData);

      expect(result).toBeNull();
    });
  });
});
