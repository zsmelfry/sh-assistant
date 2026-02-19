export default defineEventHandler((event) => {
  if (
    getRequestURL(event).pathname.startsWith('/api/_test/') &&
    process.env.NODE_ENV === 'production'
  ) {
    throw createError({ statusCode: 403, message: 'Test endpoints are disabled in production' });
  }
});
