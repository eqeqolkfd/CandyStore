const pool = require('../../db.js');

async function findAllProducts(filters = {}) {
  let sql = `
    SELECT
      p.product_id,
      p.name_product,
      p.description,
      p.price,
      p.weight_grams,
      p.photo_url,
      p.sku,
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

async function findProductById(id) {
  const sql = `
    SELECT
      p.product_id,
      p.name_product,
      p.description,
      p.price,
      p.weight_grams,
      p.photo_url,
      p.sku,
      c.name_categories   AS category_name,
      m.name_manufacturers AS manufacturer_name
    FROM products p
    LEFT JOIN categories c
      ON c.category_id = p.category_id
    LEFT JOIN manufacturers m
      ON m.manufacturer_id = p.manufacturer_id
    WHERE p.product_id = $1
  `;
  
  const result = await pool.query(sql, [id]);
  return result.rows[0];
}

async function createProduct(productData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Получаем или создаем категорию
    let categoryId = null;
    if (productData.category) {
      const categoryResult = await client.query(
        'SELECT category_id FROM categories WHERE name_categories = $1',
        [productData.category]
      );
      
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].category_id;
      } else {
        const newCategoryResult = await client.query(
          'INSERT INTO categories (name_categories) VALUES ($1) RETURNING category_id',
          [productData.category]
        );
        categoryId = newCategoryResult.rows[0].category_id;
      }
    }
    
    // Получаем или создаем производителя
    let manufacturerId = null;
    if (productData.manufacturer) {
      const manufacturerResult = await client.query(
        'SELECT manufacturer_id FROM manufacturers WHERE name_manufacturers = $1',
        [productData.manufacturer]
      );
      
      if (manufacturerResult.rows.length > 0) {
        manufacturerId = manufacturerResult.rows[0].manufacturer_id;
      } else {
        const newManufacturerResult = await client.query(
          'INSERT INTO manufacturers (name_manufacturers) VALUES ($1) RETURNING manufacturer_id',
          [productData.manufacturer]
        );
        manufacturerId = newManufacturerResult.rows[0].manufacturer_id;
      }
    }
    
    // Создаем товар
    const productResult = await client.query(`
      INSERT INTO products (
        name_product, 
        description, 
        price, 
        weight_grams, 
        photo_url, 
        category_id, 
        manufacturer_id, 
        sku
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `, [
      productData.name,
      productData.description || null,
      productData.price,
      productData.weight_grams,
      productData.image_url || null,
      categoryId,
      manufacturerId,
      productData.sku || null
    ]);
    
    await client.query('COMMIT');
    return productResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateProduct(id, productData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Получаем или создаем категорию
    let categoryId = null;
    if (productData.category) {
      const categoryResult = await client.query(
        'SELECT category_id FROM categories WHERE name_categories = $1',
        [productData.category]
      );
      
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].category_id;
      } else {
        const newCategoryResult = await client.query(
          'INSERT INTO categories (name_categories) VALUES ($1) RETURNING category_id',
          [productData.category]
        );
        categoryId = newCategoryResult.rows[0].category_id;
      }
    }
    
    // Получаем или создаем производителя
    let manufacturerId = null;
    if (productData.manufacturer) {
      const manufacturerResult = await client.query(
        'SELECT manufacturer_id FROM manufacturers WHERE name_manufacturers = $1',
        [productData.manufacturer]
      );
      
      if (manufacturerResult.rows.length > 0) {
        manufacturerId = manufacturerResult.rows[0].manufacturer_id;
      } else {
        const newManufacturerResult = await client.query(
          'INSERT INTO manufacturers (name_manufacturers) VALUES ($1) RETURNING manufacturer_id',
          [productData.manufacturer]
        );
        manufacturerId = newManufacturerResult.rows[0].manufacturer_id;
      }
    }
    
    // Обновляем товар
    const productResult = await client.query(`
      UPDATE products SET
        name_product = $1,
        description = $2,
        price = $3,
        weight_grams = $4,
        photo_url = $5,
        category_id = $6,
        manufacturer_id = $7,
        sku = $8
      WHERE product_id = $9
      RETURNING *
    `, [
      productData.name,
      productData.description || null,
      productData.price,
      productData.weight_grams,
      productData.image_url || null,
      categoryId,
      manufacturerId,
      productData.sku || null,
      id
    ]);
    
    await client.query('COMMIT');
    return productResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteProduct(id) {
  const result = await pool.query('DELETE FROM products WHERE product_id = $1', [id]);
  return result.rowCount > 0;
}

async function isProductReferencedInOrders(id) {
  const res = await pool.query('SELECT EXISTS (SELECT 1 FROM order_items WHERE product_id = $1) AS in_orders', [id]);
  return Boolean(res.rows?.[0]?.in_orders);
}

module.exports = { 
  findAllProducts, 
  findProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  isProductReferencedInOrders 
};