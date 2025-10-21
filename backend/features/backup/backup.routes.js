const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const backupService = require('./backup.service');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// Создаем папку backups если её нет
const ensureBackupsDir = async () => {
  const backupPath = path.join(__dirname, '../../../backups');
  try {
    await fs.access(backupPath);
  } catch {
    await fs.mkdir(backupPath, { recursive: true });
    console.log('📁 Создана папка backups:', backupPath);
  }
};

// Инициализируем папку при загрузке модуля
ensureBackupsDir();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const backupPath = path.join(__dirname, '../../../backups');
    console.log('📁 Путь для загрузки файлов:', backupPath);
    cb(null, backupPath);
  },
  filename: function (req, file, cb) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    // Сохраняем с оригинальным расширением (.bak или .sql)
    const originalExt = path.extname(file.originalname);
    const filename = `restore_${timestamp}${originalExt}`;
    console.log('📄 Имя файла для сохранения:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    console.log('📁 Проверка файла:', file.originalname, 'Тип:', file.mimetype);
    if (file.originalname.endsWith('.bak') || file.originalname.endsWith('.sql')) {
      cb(null, true);
    } else {
      console.log('❌ Неподдерживаемый тип файла:', file.originalname);
      cb(new Error('Разрешены только файлы .bak и .sql'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Middleware для обработки ошибок multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Ошибка multer:', error.message);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Файл слишком большой (максимум 100MB)' });
    }
    return res.status(400).json({ success: false, message: 'Ошибка загрузки файла: ' + error.message });
  } else if (error) {
    console.error('❌ Ошибка загрузки файла:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
  next();
};

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
    console.log(`Запрос на удаление бекапа: ${filename}`);
    
    const result = await backupService.deleteBackup(filename);
    
    console.log('Результат удаления:', result);
    res.json({ 
      success: true, 
      message: result.message,
      fileDeleted: result.fileDeleted,
      recordsDeleted: result.recordsDeleted
    });
  } catch (error) {
    console.error('Ошибка удаления бекапа:', error);
    res.status(500).json({ success: false, message: 'Ошибка удаления бекапа', error: error.message });
  }
});

// Восстановить из загруженного файла
router.post('/restore-upload', authenticateToken, requireAdmin, upload.single('backupFile'), handleMulterError, async (req, res) => {
  try {
    console.log('🚀 Получен запрос на восстановление из файла');
    console.log('📁 req.file:', req.file);
    console.log('👤 req.user:', req.user);
    console.log('📋 req.headers:', req.headers);

    if (!req.file) {
      console.error('❌ Файл не был загружен');
      return res.status(400).json({ success: false, message: 'Файл не был загружен' });
    }

    console.log('✅ Файл загружен:', req.file.originalname, 'Путь:', req.file.path, 'Размер:', req.file.size);
    
    // Проверяем существование файла перед восстановлением
    try {
      await fs.access(req.file.path);
      console.log('✅ Файл существует на диске');
    } catch (accessError) {
      console.error('❌ Файл не найден на диске:', req.file.path);
      return res.status(500).json({ success: false, message: 'Загруженный файл не найден на сервере' });
    }

    await backupService.restoreFromUploadedFile(req.file.path, req.user.userId);
    
    console.log('✅ Восстановление завершено успешно');
    
    // Удаляем временный файл после восстановления
    try {
      await fs.unlink(req.file.path);
      console.log('🗑️ Временный файл удален:', req.file.path);
    } catch (unlinkError) {
      console.warn('⚠️ Не удалось удалить временный файл:', unlinkError.message);
    }

    res.json({ success: true, message: 'База данных восстановлена из загруженного файла' });
  } catch (error) {
    console.error('❌ Ошибка восстановления из загруженного файла:', error);
    res.status(500).json({ success: false, message: 'Ошибка восстановления из загруженного файла', error: error.message });
  }
});

module.exports = router;
