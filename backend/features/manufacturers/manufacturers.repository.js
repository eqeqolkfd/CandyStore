const pool = require('../../db.js');

async function findAllManufacturers() {
  const sql = `
    SELECT 
      manufacturer_id,
      name_manufacturers,
      description
    FROM manufacturers 
    ORDER BY name_manufacturers ASC
  `;
  
  const result = await pool.query(sql);
  return result.rows;
}

async function findManufacturerById(id) {
  const sql = `
    SELECT 
      manufacturer_id,
      name_manufacturers,
      description
    FROM manufacturers 
    WHERE manufacturer_id = $1
  `;
  
  const result = await pool.query(sql, [id]);
  return result.rows[0];
}

async function findManufacturerByName(name) {
  const sql = `
    SELECT 
      manufacturer_id,
      name_manufacturers,
      description
    FROM manufacturers 
    WHERE name_manufacturers = $1
  `;
  
  const result = await pool.query(sql, [name]);
  return result.rows[0];
}

async function createManufacturer(manufacturerData) {
  const sql = `
    INSERT INTO manufacturers (name_manufacturers, description)
    VALUES ($1, $2)
    RETURNING *
  `;
  
  const result = await pool.query(sql, [
    manufacturerData.name,
    manufacturerData.description || null
  ]);
  
  return result.rows[0];
}

async function updateManufacturer(id, manufacturerData) {
  const sql = `
    UPDATE manufacturers SET
      name_manufacturers = $1,
      description = $2
    WHERE manufacturer_id = $3
    RETURNING *
  `;
  
  const result = await pool.query(sql, [
    manufacturerData.name,
    manufacturerData.description || null,
    id
  ]);
  
  return result.rows[0];
}

async function deleteManufacturer(id) {
  const result = await pool.query('DELETE FROM manufacturers WHERE manufacturer_id = $1', [id]);
  return result.rowCount > 0;
}

async function isManufacturerReferencedInProducts(id) {
  const res = await pool.query('SELECT EXISTS (SELECT 1 FROM products WHERE manufacturer_id = $1) AS in_products', [id]);
  return Boolean(res.rows?.[0]?.in_products);
}

module.exports = { 
  findAllManufacturers, 
  findManufacturerById, 
  findManufacturerByName,
  createManufacturer, 
  updateManufacturer, 
  deleteManufacturer,
  isManufacturerReferencedInProducts 
};
