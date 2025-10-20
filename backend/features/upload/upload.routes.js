const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../../first-site/public/images');

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, 'product' + timestamp + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.post('/product-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const imageUrl = `/images/${req.file.filename}`;
    
    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.delete('/product-image/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../../first-site/public/images', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Файл удален' });
    } else {
      res.status(404).json({ error: 'Файл не найден' });
    }
  } catch (error) {
    console.error('Ошибка удаления файла:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

module.exports = router;
