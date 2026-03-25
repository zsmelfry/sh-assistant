export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;

export function validateEmail(email: unknown): string {
  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, message: '邮箱不能为空' });
  }
  const trimmed = email.trim();
  if (!trimmed) {
    throw createError({ statusCode: 400, message: '邮箱不能为空' });
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    throw createError({ statusCode: 400, message: '邮箱长度不能超过254个字符' });
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    throw createError({ statusCode: 400, message: '邮箱格式不正确' });
  }
  return trimmed;
}
