export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) {
    // Replace any localhost references with production URL
    return path.replace(
      /http:\/\/localhost(:\d+)?/g,
      'https://brewing-hub.online'
    );
  }
  // Relative path - prepend production URL
  return 'https://brewing-hub.online/storage/' +
    path.replace(/^\/?(storage\/)?/, '');
}
