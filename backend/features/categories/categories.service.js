const { findAllCategories, createCategory, updateCategory, deleteCategory, findCategoryById } = require('./categories.repository');

async function getCategoriesService() {
  const rows = await findAllCategories();
  return rows.map((r) => ({
    id: r.category_id,
    name: r.name_categories,
    description: r.description
  }));
}

async function createCategoryService(categoryData) {
  const created = await createCategory(categoryData);
  return created;
}

async function updateCategoryService(id, categoryData) {
  await updateCategory(id, categoryData);
  const full = await findCategoryById(id);
  return full;
}

async function deleteCategoryService(id) {
  const deleted = await deleteCategory(id);
  return deleted;
}

async function getCategoryById(id) {
  return await findCategoryById(id);
}

module.exports = { 
  getCategoriesService, 
  createCategoryService, 
  updateCategoryService, 
  deleteCategoryService, 
  getCategoryById 
};
