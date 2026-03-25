interface RateLimiterOptions {
  /** Maximum attempts allowed within the window */
  maxAttempts: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimiter {
  /** Check if key has exceeded rate limit — throws 429 if exceeded */
  check(key: string): void;
  /** Record a failed attempt for the key */
  record(key: string): void;
  /** Clear all attempts for the key (e.g., on successful auth) */
  clear(key: string): void;
}

/**
 * Create an in-memory rate limiter.
 * Each limiter maintains its own attempt map.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { maxAttempts, windowMs } = options;
  const attempts = new Map<string, { count: number; firstAttempt: number }>();

  return {
    check(key: string): void {
      const now = Date.now();
      const record = attempts.get(key);

      if (record) {
        // Reset window if expired
        if (now - record.firstAttempt > windowMs) {
          attempts.delete(key);
          return;
        }
        if (record.count >= maxAttempts) {
          const remainingSec = Math.ceil((windowMs - (now - record.firstAttempt)) / 1000);
          throw createError({
            statusCode: 429,
            message: `请求次数过多，请 ${Math.ceil(remainingSec / 60)} 分钟后再试`,
          });
        }
      }
    },

    record(key: string): void {
      const now = Date.now();
      const record = attempts.get(key);

      if (!record || now - record.firstAttempt > windowMs) {
        attempts.set(key, { count: 1, firstAttempt: now });
      } else {
        record.count++;
      }
    },

    clear(key: string): void {
      attempts.delete(key);
    },
  };
}
