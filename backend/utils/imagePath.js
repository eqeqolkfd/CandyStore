function toPublicImagePath(photoUrl) {
  if (!photoUrl) return null;

  if (String(photoUrl).startsWith('/images/')) {
    return photoUrl;
  }
  const parts = String(photoUrl).split(/[\\\/]/);
  const filename = parts[parts.length - 1];
  return `/images/${filename}`;
}

module.exports = { toPublicImagePath };