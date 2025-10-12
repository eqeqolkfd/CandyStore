const pool = require('../../db');

async function findAllProducts(filters = {}) {
  let sql = `
    SELECT
      p.product_id,
      p.name_product,
      p.description,
      p.price,
      p.weight_grams,
      p.photo_url,
      c.name_categories   AS category_name,
      m.name_manufacturers AS manufacturer_name
    FROM products p
    LEFT JOIN categories c
      ON c.category_id = p.category_id
    LEFT JOIN manufacturers m
      ON m.manufacturer_id = p.manufacturer_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.category) {
    sql += ` AND c.name_categories = $${paramCount}`;
    params.push(filters.category);
    paramCount++;
  }

  if (filters.manufacturer) {
    sql += ` AND m.name_manufacturers = $${paramCount}`;
    params.push(filters.manufacturer);
    paramCount++;
  }

  let orderBy = '';
  if (filters.priceSort) {
    orderBy = ` ORDER BY p.price ${filters.priceSort}`;
  } else if (filters.weightSort) {
    orderBy = ` ORDER BY p.weight_grams ${filters.weightSort}`;
  } else {
    orderBy = ` ORDER BY p.product_id DESC`;
  }
  sql += orderBy;

  const result = await pool.query(sql, params);
  return result.rows;
}

module.exports = { findAllProducts };