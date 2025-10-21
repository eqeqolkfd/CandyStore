export const API_BASE_URL = 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  PRODUCTS: `${API_BASE_URL}/products`,

  CATEGORIES: `${API_BASE_URL}/categories`,

  MANUFACTURERS: `${API_BASE_URL}/manufacturers`,

  USERS: `${API_BASE_URL}/users`,
  LOGIN: `${API_BASE_URL}/users/login`,
  REGISTER: `${API_BASE_URL}/users/register`,
  LOGOUT: `${API_BASE_URL}/users/logout`,

  UPLOAD_PRODUCT_IMAGE: `${API_BASE_URL}/upload/product-image`,

  ORDERS: `${API_BASE_URL}/orders`,

  AUDIT: `${API_BASE_URL}/audit`
};

export default API_ENDPOINTS;
