const {
  createOrderFromCart
} = require('../../../../features/orders/orders.service');

jest.mock('../../../../features/orders/orders.repository', () => ({
  insertOrderWithAddress: jest.fn()
}));

const { insertOrderWithAddress } = require('../../../../features/orders/orders.repository');

describe('📦 ЗАКАЗЫ - Создание', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🛒 Создание заказа из корзины', () => {
    test('✅ должен успешно создавать заказ из корзины', async () => {
      const orderData = {
        userId: 1,
        address: {
          city: 'Moscow',
          street: 'Red Square',
          house: '1',
          apartment: '1',
          postal_code: '101000',
          full_name: 'John Doe'
        },
        deliveryMethod: 'courier',
        paymentMethod: 'card',
        items: [
          { product_id: 1, quantity: 2, price: 100 },
          { product_id: 2, quantity: 1, price: 150 }
        ]
      };

      const mockOrder = {
        order_id: 1,
        user_id: 1,
        total_amount: 350,
        status: 'new',
        created_at: '2023-01-01T00:00:00Z'
      };

      insertOrderWithAddress.mockResolvedValue(mockOrder);

      const result = await createOrderFromCart(orderData);

      expect(insertOrderWithAddress).toHaveBeenCalledWith(orderData);
      expect(result).toEqual(mockOrder);
    });

    test('✅ должен обрабатывать создание заказа с минимальными данными', async () => {
      const orderData = {
        userId: 1,
        address: {
          city: 'Moscow',
          street: 'Red Square',
          house: '1'
        },
        deliveryMethod: 'pickup',
        paymentMethod: 'cash',
        items: [{ product_id: 1, quantity: 1, price: 100 }]
      };

      const mockOrder = {
        order_id: 1,
        user_id: 1,
        total_amount: 100
      };

      insertOrderWithAddress.mockResolvedValue(mockOrder);

      const result = await createOrderFromCart(orderData);

      expect(result).toEqual(mockOrder);
    });

    test('✅ должен обрабатывать создание заказа с пустыми товарами', async () => {
      const orderData = {
        userId: 1,
        address: { city: 'Moscow' },
        deliveryMethod: 'courier',
        paymentMethod: 'card',
        items: []
      };

      const mockOrder = {
        order_id: 1,
        user_id: 1,
        total_amount: 0
      };

      insertOrderWithAddress.mockResolvedValue(mockOrder);

      const result = await createOrderFromCart(orderData);

      expect(result).toEqual(mockOrder);
    });

    test('✅ должен обрабатывать ошибки базы данных при создании заказа', async () => {
      const orderData = {
        userId: 1,
        address: { city: 'Moscow' },
        deliveryMethod: 'courier',
        paymentMethod: 'card',
        items: [{ product_id: 1, quantity: 1, price: 100 }]
      };

      const error = new Error('Database connection failed');
      insertOrderWithAddress.mockRejectedValue(error);

      await expect(createOrderFromCart(orderData)).rejects.toThrow('Database connection failed');
    });

    test('✅ должен обрабатывать ошибки валидации', async () => {
      const orderData = {
        userId: null,
        address: null,
        deliveryMethod: 'courier',
        paymentMethod: 'card',
        items: [{ product_id: 1, quantity: 1, price: 100 }]
      };

      const error = new Error('Invalid order data');
      insertOrderWithAddress.mockRejectedValue(error);

      await expect(createOrderFromCart(orderData)).rejects.toThrow('Invalid order data');
    });
  });
});
