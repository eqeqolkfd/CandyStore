const { toPublicImagePath } = require('../../utils/imagePath');
const { findAllProducts, createProduct, updateProduct, deleteProduct, findProductById } = require('./products.repository');
const fs = require('fs');
const path = require('path');

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
  const created = await createProduct(productData);
  const full = await findProductById(created.product_id || created.id);
  return full || created;
}

async function updateProductService(id, productData) {
  await updateProduct(id, productData);
  const full = await findProductById(id);
  return full;
}

async function deleteProductService(id) {
  const product = await findProductById(id);
  const deleted = await deleteProduct(id);

  if (deleted && product && product.photo_url) {
    try {
      const publicPath = toPublicImagePath(product.photo_url);
      const filename = publicPath.split('/').pop();

      if (filename) {
        const feImagesDir = path.join(__dirname, '../../../first-site/public/images');
        const feImagePath = path.join(feImagesDir, filename);

        if (fs.existsSync(feImagePath)) {
          fs.unlinkSync(feImagePath);
        }
      }
    } catch (_e) {
    }
  }

  return deleted;
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