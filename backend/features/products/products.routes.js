const express = require('express');
const router = express.Router();
const { 
  getCatalogProducts, 
  createProductService, 
  updateProductService, 
  deleteProductService, 
  getProductById 
} = require('./products.service');
const { logAuditEvent } = require('../../utils/auditLogger');

router.get('/', async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      manufacturer: req.query.manufacturer,
      priceSort: req.query.priceSort,
      weightSort: req.query.weightSort
    };
    const products = await getCatalogProducts(filters);
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    const newProduct = await createProductService(productData);

    await logAuditEvent({
      action: 'CREATE_PRODUCT',
      userId: req.user?.userId || 1,
      targetType: 'PRODUCT',
      targetId: newProduct.product_id,
      targetName: newProduct.name_product,
      details: {
        name: newProduct.name_product,
        price: newProduct.price,
        category: productData.category,
        manufacturer: productData.manufacturer
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json(newProduct);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const productData = req.body;

    const oldProduct = await getProductById(productId);
    if (!oldProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const updatedProduct = await updateProductService(productId, productData);

    await logAuditEvent({
      action: 'UPDATE_PRODUCT',
      userId: req.user?.userId || 1,
      targetType: 'PRODUCT',
      targetId: productId,
      targetName: updatedProduct.name_product,
      details: {
        oldValues: {
          name: oldProduct.name_product,
          price: oldProduct.price,
          category: oldProduct.category_name,
          manufacturer: oldProduct.manufacturer_name
        },
        newValues: {
          name: updatedProduct.name_product,
          price: updatedProduct.price,
          category: productData.category,
          manufacturer: productData.manufacturer
        }
      },
      beforeData: {
        product_id: oldProduct.product_id,
        name_product: oldProduct.name_product,
        description: oldProduct.description,
        price: oldProduct.price,
        weight_grams: oldProduct.weight_grams,
        photo_url: oldProduct.photo_url,
        category_name: oldProduct.category_name,
        manufacturer_name: oldProduct.manufacturer_name,
        sku: oldProduct.sku
      },
      afterData: {
        product_id: updatedProduct.product_id,
        name_product: updatedProduct.name_product,
        description: updatedProduct.description,
        price: updatedProduct.price,
        weight_grams: updatedProduct.weight_grams,
        photo_url: updatedProduct.photo_url,
        category_name: updatedProduct.category_name,
        manufacturer_name: updatedProduct.manufacturer_name,
        sku: updatedProduct.sku
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.json(updatedProduct);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await deleteProductService(productId);

    await logAuditEvent({
      action: 'DELETE_PRODUCT',
      userId: req.user?.userId || 1,
      targetType: 'PRODUCT',
      targetId: productId,
      targetName: product.name_product,
      details: {
        oldValues: {
          name: product.name_product,
          price: product.price,
          category: product.category_name,
          manufacturer: product.manufacturer_name
        },
        newValues: null
      },
      severity: 'HIGH',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;