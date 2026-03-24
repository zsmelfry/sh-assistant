export default defineEventHandler((event) => {
  const path = event.path;

  // API routes handle their own caching
  if (path.startsWith('/api/')) return;

  // Content-hashed assets — cache forever
  if (path.startsWith('/_nuxt/')) {
    setResponseHeader(event, 'cache-control', 'public, max-age=31536000, immutable');
    return;
  }

  // HTML pages — always revalidate to pick up new chunk hashes after deploy
  setResponseHeader(event, 'cache-control', 'no-cache, no-store, must-revalidate');
});
