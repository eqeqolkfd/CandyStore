const { toPublicImagePath } = require('../../utils/imagePath');
const { findAllProducts, createProduct, updateProduct, deleteProduct, findProductById } = require('./products.repository');

async function getCatalogProducts(filters = {}) {
  const rows = await findAllProducts(filters);
  return rows.map((r) => ({
    id: r.product_id,
    name: r.name_product,
    description: r.description,
    price: r.price,
    weightGrams: r.weight_grams,
    image_url: toPublicImagePath(r.photo_url),
    category: r.category_name || null,
    manufacturer: r.manufacturer_name || null,
    sku: r.sku
  }));
}

async function createProductService(productData) {
  return await createProduct(productData);
}

async function updateProductService(id, productData) {
  return await updateProduct(id, productData);
}

async function deleteProductService(id) {
  return await deleteProduct(id);
}

async function getProductById(id) {
  return await findProductById(id);
}

module.exports = { 
  getCatalogProducts, 
  createProductService, 
  updateProductService, 
  deleteProductService, 
  getProductById 
};