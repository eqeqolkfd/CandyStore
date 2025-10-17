const { createPayment } = require('./payments.repository');

function normalizeMethod(method) {
  const key = String(method || '').trim().toLowerCase();
  if (key === 'card' || key === 'visa' || key === 'mastercard' || key === 'bank_card') return 'card';
  if (key === 'sbp' || key === 'fast_payment_system') return 'sbp';
  if (key === 'meet' || key === 'cod' || key === 'cash_on_delivery' || key === 'upon_receipt') return 'cod';
  return key || 'unknown';
}

async function createPaymentForOrder({ orderId, amount, method, status }) {
  const normalizedMethod = normalizeMethod(method);
  const normalizedStatus = String(status || 'pending');
  return await createPayment({ orderId, amount, method: normalizedMethod, status: normalizedStatus });
}

module.exports = { createPaymentForOrder };



