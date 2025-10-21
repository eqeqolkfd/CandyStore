const express = require('express');
const router = express.Router();
const { 
  getCategoriesService, 
  createCategoryService, 
  updateCategoryService, 
  deleteCategoryService, 
  getCategoryById 
} = require('./categories.service');
const { logAuditEvent } = require('../../utils/auditLogger');

router.get('/', async (req, res) => {
  try {
    const categories = await getCategoriesService();
    res.json(categories);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

router.post('/', async (req, res) => {
  try {
    const categoryData = req.body;
    const newCategory = await createCategoryService(categoryData);

    await logAuditEvent({
      action: 'CREATE_CATEGORY',
      userId: req.user?.userId || 1,
      targetType: 'CATEGORY',
      targetId: newCategory.category_id,
      targetName: newCategory.name_categories,
      details: {
        name: newCategory.name_categories,
        description: newCategory.description
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json(newCategory);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    const categoryData = req.body;

    const oldCategory = await getCategoryById(categoryId);
    if (!oldCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const updatedCategory = await updateCategoryService(categoryId, categoryData);

    await logAuditEvent({
      action: 'UPDATE_CATEGORY',
      userId: req.user?.userId || 1,
      targetType: 'CATEGORY',
      targetId: categoryId,
      targetName: updatedCategory.name_categories,
      details: {
        oldValues: {
          name: oldCategory.name_categories,
          description: oldCategory.description
        },
        newValues: {
          name: updatedCategory.name_categories,
          description: updatedCategory.description
        }
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.json(updatedCategory);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await deleteCategoryService(categoryId);

    await logAuditEvent({
      action: 'DELETE_CATEGORY',
      userId: req.user?.userId || 1,
      targetType: 'CATEGORY',
      targetId: categoryId,
      targetName: category.name_categories,
      details: {
        oldValues: {
          name: category.name_categories,
          description: category.description
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
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
