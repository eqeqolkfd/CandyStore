const {
  listOrdersByUser
} = require('../../../../features/orders/orders.service');

// Mock dependencies
jest.mock('../../../../features/orders/orders.repository', () => ({
  fetchOrdersByUser: jest.fn()
}));

const { fetchOrdersByUser } = require('../../../../features/orders/orders.repository');

describe('📦 ЗАКАЗЫ - Получение', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('📋 Получение заказов пользователя', () => {
    test('✅ должен возвращать заказы для конкретного пользователя', async () => {
      const userId = 1;
      const mockOrders = [
        {
          order_id: 1,
          user_id: 1,
          total_amount: 250,
          status: 'delivered',
          created_at: '2023-01-01T00:00:00Z'
        },
        {
          order_id: 2,
          user_id: 1,
          total_amount: 150,
          status: 'processing',
          created_at: '2023-01-02T00:00:00Z'
        }
      ];

      fetchOrdersByUser.mockResolvedValue(mockOrders);

      const result = await listOrdersByUser(userId);

      expect(fetchOrdersByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockOrders);
      expect(result).toHaveLength(2);
    });

    test('✅ должен возвращать пустой массив для пользователя без заказов', async () => {
      const userId = 999;
      fetchOrdersByUser.mockResolvedValue([]);

      const result = await listOrdersByUser(userId);

      expect(result).toEqual([]);
      expect(fetchOrdersByUser).toHaveBeenCalledWith(userId);
    });

    test('✅ должен обрабатывать ошибки базы данных', async () => {
      const userId = 1;
      const error = new Error('Database query failed');
      fetchOrdersByUser.mockRejectedValue(error);

      await expect(listOrdersByUser(userId)).rejects.toThrow('Database query failed');
    });

    test('✅ должен обрабатывать null userId', async () => {
      const userId = null;
      fetchOrdersByUser.mockResolvedValue([]);

      const result = await listOrdersByUser(userId);

      expect(fetchOrdersByUser).toHaveBeenCalledWith(null);
      expect(result).toEqual([]);
    });

    test('✅ должен обрабатывать заказы с разными статусами', async () => {
      const userId = 1;
      const mockOrders = [
        { order_id: 1, status: 'new' },
        { order_id: 2, status: 'processing' },
        { order_id: 3, status: 'shipped' },
        { order_id: 4, status: 'delivered' },
        { order_id: 5, status: 'canceled' }
      ];

      fetchOrdersByUser.mockResolvedValue(mockOrders);

      const result = await listOrdersByUser(userId);

      expect(result).toHaveLength(5);
      expect(result[0].status).toBe('new');
      expect(result[4].status).toBe('canceled');
    });

    test('✅ должен обрабатывать заказы с разными суммами', async () => {
      const userId = 1;
      const mockOrders = [
        { order_id: 1, total_amount: 0 },
        { order_id: 2, total_amount: 50.50 },
        { order_id: 3, total_amount: 1000.99 }
      ];

      fetchOrdersByUser.mockResolvedValue(mockOrders);

      const result = await listOrdersByUser(userId);

      expect(result).toHaveLength(3);
      expect(result[0].total_amount).toBe(0);
      expect(result[2].total_amount).toBe(1000.99);
    });
  });
});
