const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productsRoutes = require('./features/products/products.routes');
const ordersRoutes = require('./features/orders/orders.routes');
const paymentsRoutes = require('./features/payments/payments.routes');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());
app.get('/', (_req, res) => res.send('API сервер работает!'));

app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});