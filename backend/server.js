const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productsRoutes = require('./features/products/products.routes');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.get('/', (_req, res) => res.send('API сервер работает!'));

app.use('/api/products', productsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});