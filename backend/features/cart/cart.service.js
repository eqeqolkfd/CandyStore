const { getCartById, addItemToCart, updateItemInCart, removeItemFromCart } = require('./cart.repository');

async function getCart(sessionId) {
  const cart = await getCartById(sessionId);
  return cart || { items: [], totalItems: 0, totalPrice: 0 };
}

async function addToCart(sessionId, productId, quantity) {
  return await addItemToCart(sessionId, productId, quantity);
}

async function updateCart(sessionId, productId, quantity) {
  if (quantity <= 0) {
    return await removeItemFromCart(sessionId, productId);
  }
  return await updateItemInCart(sessionId, productId, quantity);
}

async function removeFromCart(sessionId, productId) {
  return await removeItemFromCart(sessionId, productId);
}

module.exports = { getCart, addToCart, updateCart, removeFromCart };