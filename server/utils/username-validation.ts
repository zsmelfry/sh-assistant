/**
 * Validate username format. Used in all user creation entry points.
 * Rules: lowercase alphanumeric + underscore + hyphen, 3-30 chars.
 */
const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

export function validateUsername(username: string): void {
  if (!USERNAME_REGEX.test(username)) {
    throw createError({
      statusCode: 400,
      message: '用户名格式无效：仅允许小写字母、数字、下划线、连字符，长度3-30',
    });
  }
}
