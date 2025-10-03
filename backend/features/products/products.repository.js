const pool = require('../../db');

async function findAllProducts() {
  const sql = `
    SELECT
      product_id,
      name_product,
      description,
      price,
      weight_grams,
      photo_url
    FROM products
    ORDER BY product_id DESC
  `;
  const result = await pool.query(sql);
  return result.rows;
}

module.exports = { findAllProducts };