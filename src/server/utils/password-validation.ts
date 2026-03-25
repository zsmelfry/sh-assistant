import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '~/utils/password-rules';

// Top ~100 common passwords blocklist (NIST SP 800-63B)
const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', '1234567890', 'qwerty123',
  'password1', 'iloveyou', 'sunshine', 'princess', 'football',
  'charlie', 'access14', 'trustno1', 'superman', 'michael',
  'master12', 'dragon12', 'qwertyui', 'baseball', 'abcdefgh',
  'letmein1', 'monkey12', 'shadow12', 'jessica1', 'michael1',
  'jennifer', 'jordan23', 'harley12', 'ranger12', 'thomas12',
  'daniel12', 'matthew1', 'whatever', 'computer', 'internet',
  'starwars', 'mercedes', 'maverick', 'passw0rd', 'p@ssw0rd',
  'p@ssword', 'password123', '12345678a', 'qwerty1234', 'abc12345',
  'abcd1234', 'admin123', 'welcome1', 'monkey123', 'dragon123',
  'master123', 'login123', 'hello123', 'charlie1', 'donald12',
  'loveme12', 'sunshine1', 'princess1', 'football1', 'shadow123',
  'superman1', 'trustno12', 'iloveyou1', 'batman123', 'access123',
  'mustang1', 'michael123', 'pass1234', '1q2w3e4r', 'zaq12wsx',
  'qazwsxedc', 'q1w2e3r4', '1qaz2wsx', 'password12', 'password!',
  'changeme', 'asdfghjk', 'zxcvbnm1', 'qwerty12', 'letmein12',
  '11111111', '00000000', '88888888', '12341234', 'aaaaaaaa',
  'abcdefg1', 'aabbccdd', 'welcome123', 'test1234', 'guest1234',
  'passpass', 'pass1word', 'qweasdzxc', 'asdf1234', 'temptemp',
  '1a2b3c4d', 'number12', 'sample12', 'secure12', 'default1',
]);

/** Display-friendly password rules for frontend */
export const PASSWORD_RULES = '密码长度 8-128 个字符，不能使用常见密码';

/**
 * Validate password strength per NIST SP 800-63B.
 * Throws createError if invalid — use in API handlers.
 */
export function validatePassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, message: '密码不能为空' });
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `密码长度不能少于 ${PASSWORD_MIN_LENGTH} 个字符`,
    });
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `密码长度不能超过 ${PASSWORD_MAX_LENGTH} 个字符`,
    });
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw createError({
      statusCode: 400,
      message: '该密码过于常见，请选择更安全的密码',
    });
  }
}
