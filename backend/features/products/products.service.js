const { toPublicImagePath } = require('../../utils/imagePath');
const { findAllProducts, createProduct, updateProduct, deleteProduct, findProductById, isProductReferencedInOrders } = require('./products.repository');
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
  // Return fully joined record so frontend has category/manufacturer names immediately
  const full = await findProductById(created.product_id || created.id);
  return full || created;
}

async function updateProductService(id, productData) {
  await updateProduct(id, productData);
  // Return fully joined record so frontend has category/manufacturer names immediately
  const full = await findProductById(id);
  return full;
}

async function deleteProductService(id) {
  // First, try to load the product to know its image path
  const product = await findProductById(id);

  const deleted = await deleteProduct(id);

  // If product was used in any order items, keep the image for client order history
  const referenced = await isProductReferencedInOrders(id);

  if (deleted && !referenced && product && product.photo_url) {
    try {
      // Derive filename regardless of absolute or public path stored
      const publicPath = toPublicImagePath(product.photo_url); // "/images/filename.jpg"
      const filename = publicPath.split('/').pop();

      if (filename) {
        // Frontend images directory (used by upload route)
        const feImagesDir = path.join(__dirname, '../../../first-site/public/images');
        const feImagePath = path.join(feImagesDir, filename);

        // Backend bundled images directory (in case older files were stored here)
        const beImagesDir = path.join(__dirname, '../../first-site/public/images');
        const beImagePath = path.join(beImagesDir, filename);

        // Best-effort deletion in both locations
        [feImagePath, beImagePath].forEach((filePath) => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (_e) {
            // Ignore file deletion errors to not block API flow
          }
        });
      }
    } catch (_e) {
      // Ignore errors from image cleanup
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