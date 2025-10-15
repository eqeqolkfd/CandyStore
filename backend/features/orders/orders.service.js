const { insertOrderWithAddress, fetchOrdersByUser } = require('./orders.repository');

async function createOrderFromCart({ userId, address, deliveryMethod, paymentMethod, items }) {
  return await insertOrderWithAddress({ userId, address, deliveryMethod, paymentMethod, items });
}

async function listOrdersByUser(userId) {
  return await fetchOrdersByUser(userId);
}

module.exports = { createOrderFromCart, listOrdersByUser };