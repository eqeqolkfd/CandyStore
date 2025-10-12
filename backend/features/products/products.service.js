const { toPublicImagePath } = require('../../utils/imagePath');
const { findAllProducts } = require('./products.repository');

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
  }));
}

module.exports = { getCatalogProducts };