const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productsRoutes = require('./features/products/products.routes');
const ordersRoutes = require('./features/orders/orders.routes');
const paymentsRoutes = require('./features/payments/payments.routes');
const auditRoutes = require('./features/audit/audit.routes');
const uploadRoutes = require('./features/upload/upload.routes');
const categoriesRoutes = require('./features/categories/categories.routes');
const manufacturersRoutes = require('./features/manufacturers/manufacturers.routes');

const app = express();
const PORT = Number(process.env.PORT || 5000);

const usersRoutes = require('./features/users/users.routes');

app.use(cors());
app.use(express.json());
app.get('/', (_req, res) => res.send('API сервер работает!'));

app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/manufacturers', manufacturersRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});