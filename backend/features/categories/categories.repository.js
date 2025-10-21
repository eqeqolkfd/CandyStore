const pool = require('../../db.js');

async function findAllCategories() {
  const sql = `
    SELECT 
      category_id,
      name_categories,
      description
    FROM categories 
    ORDER BY name_categories ASC
  `;
  
  const result = await pool.query(sql);
  return result.rows;
}

async function findCategoryById(id) {
  const sql = `
    SELECT 
      category_id,
      name_categories,
      description
    FROM categories 
    WHERE category_id = $1
  `;
  
  const result = await pool.query(sql, [id]);
  return result.rows[0];
}

async function findCategoryByName(name) {
  const sql = `
    SELECT 
      category_id,
      name_categories,
      description
    FROM categories 
    WHERE name_categories = $1
  `;
  
  const result = await pool.query(sql, [name]);
  return result.rows[0];
}

async function createCategory(categoryData) {
  const sql = `
    INSERT INTO categories (name_categories, description)
    VALUES ($1, $2)
    RETURNING *
  `;
  
  const result = await pool.query(sql, [
    categoryData.name,
    categoryData.description || null
  ]);
  
  return result.rows[0];
}

async function updateCategory(id, categoryData) {
  const sql = `
    UPDATE categories SET
      name_categories = $1,
      description = $2
    WHERE category_id = $3
    RETURNING *
  `;
  
  const result = await pool.query(sql, [
    categoryData.name,
    categoryData.description || null,
    id
  ]);
  
  return result.rows[0];
}

async function deleteCategory(id) {
  const result = await pool.query('DELETE FROM categories WHERE category_id = $1', [id]);
  return result.rowCount > 0;
}

async function isCategoryReferencedInProducts(id) {
  const res = await pool.query('SELECT EXISTS (SELECT 1 FROM products WHERE category_id = $1) AS in_products', [id]);
  return Boolean(res.rows?.[0]?.in_products);
}

module.exports = { 
  findAllCategories, 
  findCategoryById, 
  findCategoryByName,
  createCategory, 
  updateCategory, 
  deleteCategory,
  isCategoryReferencedInProducts 
};
