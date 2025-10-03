const { toPublicImagePath } = require('../../utils/imagePath');
const { findAllProducts } = require('./products.repository');

async function getCatalogProducts() {
  const rows = await findAllProducts();
  return rows.map((r) => ({
    id: r.product_id,
    name: r.name_product,
    description: r.description,
    price: r.price,
    weightGrams: r.weight_grams,
    image_url: toPublicImagePath(r.photo_url),
  }));
}

module.exports = { getCatalogProducts };