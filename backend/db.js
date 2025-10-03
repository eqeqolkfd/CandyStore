const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:1*@localhost:5432/shop'
});

module.exports = pool;