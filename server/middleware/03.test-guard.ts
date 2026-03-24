export default defineEventHandler((event) => {
  // Deny-by-default: only allow test endpoints in test/development mode
  if (
    getRequestURL(event).pathname.startsWith('/api/_test/') &&
    process.env.NODE_ENV !== 'test' &&
    process.env.NODE_ENV !== 'development'
  ) {
    throw createError({ statusCode: 403, message: 'Test endpoints are disabled' });
  }
});
