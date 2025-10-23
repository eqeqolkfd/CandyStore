const {
  deleteProductService
} = require('../../../../features/products/products.service');

// Mock dependencies
jest.mock('../../../../features/products/products.repository', () => ({
  findProductById: jest.fn(),
  deleteProduct: jest.fn()
}));

jest.mock('../../../../utils/imagePath', () => ({
  toPublicImagePath: jest.fn((path) => path ? `/images/${path.split('/').pop()}` : null)
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  unlinkSync: jest.fn()
}));

const { findProductById, deleteProduct } = require('../../../../features/products/products.repository');
const { toPublicImagePath } = require('../../../../utils/imagePath');
const fs = require('fs');

describe('🛍️ ТОВАРЫ - Удаление', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🗑️ Удаление товара', () => {
    test('✅ должен удалять товар и возвращать результат удаления', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        photo_url: '/path/to/image.jpg'
      };

      findProductById.mockResolvedValue(mockProduct);
      deleteProduct.mockResolvedValue(true);
      toPublicImagePath.mockReturnValue('/images/image.jpg');
      fs.existsSync.mockReturnValue(true);

      const result = await deleteProductService(productId);

      expect(findProductById).toHaveBeenCalledWith(productId);
      expect(deleteProduct).toHaveBeenCalledWith(productId);
      expect(result).toBe(true);
    });

    test('✅ должен обрабатывать удаление без фото', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        photo_url: null
      };

      findProductById.mockResolvedValue(mockProduct);
      deleteProduct.mockResolvedValue(true);

      const result = await deleteProductService(productId);

      expect(result).toBe(true);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    test('✅ должен обрабатывать удаление с пустым photo_url', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        photo_url: ''
      };

      findProductById.mockResolvedValue(mockProduct);
      deleteProduct.mockResolvedValue(true);

      const result = await deleteProductService(productId);

      expect(result).toBe(true);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    test('✅ должен корректно обрабатывать ошибки удаления файлов', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        photo_url: '/path/to/image.jpg'
      };

      findProductById.mockResolvedValue(mockProduct);
      deleteProduct.mockResolvedValue(true);
      toPublicImagePath.mockReturnValue('/images/image.jpg');
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('File deletion failed');
      });

      const result = await deleteProductService(productId);

      expect(result).toBe(true);
    });

    test('✅ должен обрабатывать несуществующий файл при удалении', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        photo_url: '/path/to/image.jpg'
      };

      findProductById.mockResolvedValue(mockProduct);
      deleteProduct.mockResolvedValue(true);
      toPublicImagePath.mockReturnValue('/images/image.jpg');
      fs.existsSync.mockReturnValue(false);

      const result = await deleteProductService(productId);

      expect(result).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test('✅ должен обрабатывать ошибки базы данных при удалении', async () => {
      const productId = 1;
      const error = new Error('Database deletion failed');
      
      findProductById.mockRejectedValue(error);

      await expect(deleteProductService(productId)).rejects.toThrow('Database deletion failed');
    });

    test('✅ должен обрабатывать удаление несуществующего товара', async () => {
      const productId = 999;
      
      findProductById.mockResolvedValue(null);
      deleteProduct.mockResolvedValue(false);

      const result = await deleteProductService(productId);

      expect(result).toBe(false);
    });

    test('✅ должен обрабатывать ошибки toPublicImagePath', async () => {
      const productId = 1;
      const mockProduct = {
        product_id: 1,
        photo_url: '/path/to/image.jpg'
      };

      findProductById.mockResolvedValue(mockProduct);
      deleteProduct.mockResolvedValue(true);
      toPublicImagePath.mockImplementation(() => {
        throw new Error('Path conversion failed');
      });

      const result = await deleteProductService(productId);

      expect(result).toBe(true);
    });
  });
});
