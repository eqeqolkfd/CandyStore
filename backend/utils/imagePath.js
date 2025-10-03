function toPublicImagePath(photoUrl) {
  if (!photoUrl) return null;
  const parts = String(photoUrl).split('\\');
  const filename = parts[parts.length - 1];
  return `/images/${filename}`;
}

module.exports = { toPublicImagePath };