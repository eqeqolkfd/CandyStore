const request = require('supertest');
const app = require('../../server');

describe('Products API', () => {
  test('GET /api/products should return products list', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /api/products should return products with required fields', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);
    
    if (response.body.length > 0) {
      const product = response.body[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('weightGrams');
      expect(product).toHaveProperty('image_url');
    }
  });

  test('GET /api/products should return valid JSON', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);
    
    expect(response.headers['content-type']).toMatch(/json/);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/products should return products with correct data types', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);
    
    if (response.body.length > 0) {
      const product = response.body[0];
      expect(typeof product.id).toBe('number');
      expect(typeof product.name).toBe('string');
      expect(typeof product.price).toBe('string');
      expect(typeof product.weightGrams).toBe('number');
      expect(typeof product.image_url).toBe('string');
    }
  });
});
