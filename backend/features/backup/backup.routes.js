const express = require('express');
const router = express.Router();
const backupService = require('./backup.service');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// Создать бекап
router.post('/create', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await backupService.createBackup(req.user.userId);
    res.json({ success: true, message: 'Бекап создан успешно', backup: result });
  } catch (error) {
    console.error('Ошибка создания бекапа:', error);
    res.status(500).json({ success: false, message: 'Ошибка создания бекапа', error: error.message });
  }
});

// Получить список бекапов
router.get('/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backups = await backupService.getBackupsList();
    res.json({ success: true, backups });
  } catch (error) {
    console.error('Ошибка получения списка бекапов:', error);
    res.status(500).json({ success: false, message: 'Ошибка получения списка бекапов', error: error.message });
  }
});

// Скачать бекап
router.get('/download/:filename', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = await backupService.getBackupPath(filename);
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Ошибка скачивания бекапа:', err);
        res.status(404).json({ success: false, message: 'Файл бекапа не найден' });
      }
    });
  } catch (error) {
    console.error('Ошибка скачивания бекапа:', error);
    res.status(500).json({ success: false, message: 'Ошибка скачивания бекапа', error: error.message });
  }
});

// Восстановить из бекапа
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Не указан файл бекапа' });
    }
    
    await backupService.restoreFromBackup(filename);
    res.json({ success: true, message: 'База данных восстановлена успешно' });
  } catch (error) {
    console.error('Ошибка восстановления из бекапа:', error);
    res.status(500).json({ success: false, message: 'Ошибка восстановления из бекапа', error: error.message });
  }
});

// Удалить бекап
router.delete('/:filename', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    await backupService.deleteBackup(filename);
    res.json({ success: true, message: 'Бекап удален успешно' });
  } catch (error) {
    console.error('Ошибка удаления бекапа:', error);
    res.status(500).json({ success: false, message: 'Ошибка удаления бекапа', error: error.message });
  }
});

module.exports = router;
