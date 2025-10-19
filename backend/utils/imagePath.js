function toPublicImagePath(photoUrl) {
  if (!photoUrl) return null;
  
  // Если уже начинается с /images/, возвращаем как есть
  if (String(photoUrl).startsWith('/images/')) {
    return photoUrl;
  }
  
  // Если это полный путь, извлекаем имя файла
  const parts = String(photoUrl).split(/[\\\/]/);
  const filename = parts[parts.length - 1];
  return `/images/${filename}`;
}

module.exports = { toPublicImagePath };