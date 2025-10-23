const { toPublicImagePath } = require('../../../utils/imagePath');

describe('🖼️ УТИЛИТЫ - Пути к изображениям', () => {
  describe('📁 Конвертация в публичный путь', () => {
    test('✅ должен возвращать null для null входа', () => {
      const result = toPublicImagePath(null);
      expect(result).toBeNull();
    });

    test('✅ должен возвращать null для undefined входа', () => {
      const result = toPublicImagePath(undefined);
      expect(result).toBeNull();
    });

    test('✅ должен возвращать null для пустой строки', () => {
      const result = toPublicImagePath('');
      expect(result).toBeNull();
    });

    test('✅ должен возвращать путь как есть если уже начинается с /images/', () => {
      const input = '/images/product123.jpg';
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/product123.jpg');
    });

    test('✅ должен конвертировать Windows путь в публичный путь', () => {
      const input = 'C:\\Users\\Lenovo\\shop\\first-site\\public\\images\\product123.jpg';
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/product123.jpg');
    });

    test('✅ должен конвертировать Unix путь в публичный путь', () => {
      const input = '/home/user/shop/first-site/public/images/product123.jpg';
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/product123.jpg');
    });

    test('✅ должен обрабатывать смешанные разделители', () => {
      const input = 'C:/Users/Lenovo/shop/first-site/public/images/product123.jpg';
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/product123.jpg');
    });

    test('✅ должен обрабатывать только имя файла', () => {
      const input = 'product123.jpg';
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/product123.jpg');
    });

    test('✅ должен обрабатывать путь с множественными разделителями', () => {
      const input = 'path/to/images//product123.jpg';
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/product123.jpg');
    });

    test('✅ должен обрабатывать числовой ввод', () => {
      const input = 123;
      const result = toPublicImagePath(input);
      expect(result).toBe('/images/123');
    });
  });
});
