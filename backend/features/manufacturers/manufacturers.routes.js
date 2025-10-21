const express = require('express');
const router = express.Router();
const { 
  getManufacturersService, 
  createManufacturerService, 
  updateManufacturerService, 
  deleteManufacturerService, 
  getManufacturerById 
} = require('./manufacturers.service');
const { logAuditEvent } = require('../../utils/auditLogger');

router.get('/', async (req, res) => {
  try {
    const manufacturers = await getManufacturersService();
    res.json(manufacturers);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const manufacturer = await getManufacturerById(req.params.id);
    if (!manufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    res.json(manufacturer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch manufacturer' });
  }
});

router.post('/', async (req, res) => {
  try {
    const manufacturerData = req.body;
    const newManufacturer = await createManufacturerService(manufacturerData);

    await logAuditEvent({
      action: 'CREATE_MANUFACTURER',
      userId: req.user?.userId || 1,
      targetType: 'MANUFACTURER',
      targetId: newManufacturer.manufacturer_id,
      targetName: newManufacturer.name_manufacturers,
      details: {
        name: newManufacturer.name_manufacturers,
        description: newManufacturer.description
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json(newManufacturer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create manufacturer' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const manufacturerId = req.params.id;
    const manufacturerData = req.body;

    const oldManufacturer = await getManufacturerById(manufacturerId);
    if (!oldManufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    
    const updatedManufacturer = await updateManufacturerService(manufacturerId, manufacturerData);

    await logAuditEvent({
      action: 'UPDATE_MANUFACTURER',
      userId: req.user?.userId || 1,
      targetType: 'MANUFACTURER',
      targetId: manufacturerId,
      targetName: updatedManufacturer.name_manufacturers,
      details: {
        oldValues: {
          name: oldManufacturer.name_manufacturers,
          description: oldManufacturer.description
        },
        newValues: {
          name: updatedManufacturer.name_manufacturers,
          description: updatedManufacturer.description
        }
      },
      severity: 'LOW',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    res.json(updatedManufacturer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update manufacturer' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const manufacturerId = req.params.id;

    const manufacturer = await getManufacturerById(manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ error: 'Manufacturer not found' });
    }
    
    await deleteManufacturerService(manufacturerId);

    await logAuditEvent({
      action: 'DELETE_MANUFACTURER',
      userId: req.user?.userId || 1,
      targetType: 'MANUFACTURER',
      targetId: manufacturerId,
      targetName: manufacturer.name_manufacturers,
      details: {
        oldValues: {
          name: manufacturer.name_manufacturers,
          description: manufacturer.description
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
    res.status(500).json({ error: 'Failed to delete manufacturer' });
  }
});

module.exports = router;
