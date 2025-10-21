const { findAllManufacturers, createManufacturer, updateManufacturer, deleteManufacturer, findManufacturerById } = require('./manufacturers.repository');

async function getManufacturersService() {
  const rows = await findAllManufacturers();
  return rows.map((r) => ({
    id: r.manufacturer_id,
    name: r.name_manufacturers,
    description: r.description
  }));
}

async function createManufacturerService(manufacturerData) {
  const created = await createManufacturer(manufacturerData);
  return created;
}

async function updateManufacturerService(id, manufacturerData) {
  await updateManufacturer(id, manufacturerData);
  const full = await findManufacturerById(id);
  return full;
}

async function deleteManufacturerService(id) {
  const deleted = await deleteManufacturer(id);
  return deleted;
}

async function getManufacturerById(id) {
  return await findManufacturerById(id);
}

module.exports = { 
  getManufacturersService, 
  createManufacturerService, 
  updateManufacturerService, 
  deleteManufacturerService, 
  getManufacturerById 
};
