const pool = require('../../db');

const carts = new Map();

async function getCartById(sessionId) {
  const cart = carts.get(sessionId);
  if (!cart) return null;

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return {
    ...cart,
    totalItems,
    totalPrice
  };
}

async function addItemToCart(sessionId, productId, quantity) {

  const productResult = await pool.query(
    'SELECT product_id, name_product, price, photo_url FROM products WHERE product_id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  const product = productResult.rows[0];

  let cart = carts.get(sessionId) || { items: [] };

  const existingItem = cart.items.find(item => item.productId === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      productId: product.product_id,
      name: product.name_product,
      price: product.price,
      image_url: product.photo_url,
      quantity: quantity
    });
  }

  carts.set(sessionId, cart);
  return await getCartById(sessionId);
}

async function updateItemInCart(sessionId, productId, quantity) {
  const cart = carts.get(sessionId);
  if (!cart) return { items: [], totalItems: 0, totalPrice: 0 };

  const item = cart.items.find(item => item.productId === productId);
  if (item) {
    item.quantity = quantity;
  }

  carts.set(sessionId, cart);
  return await getCartById(sessionId);
}

async function removeItemFromCart(sessionId, productId) {
  const cart = carts.get(sessionId);
  if (!cart) return { items: [], totalItems: 0, totalPrice: 0 };

  cart.items = cart.items.filter(item => item.productId !== productId);
  carts.set(sessionId, cart);
  return await getCartById(sessionId);
}

module.exports = { getCartById, addItemToCart, updateItemInCart, removeItemFromCart };