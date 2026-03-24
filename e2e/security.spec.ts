import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── Test constants ───
// Each test group uses a distinct username to avoid rate limit state leaking
const TEST_USER = { username: 'secuser', password: 'testpass123' };

// ─── Helpers ───

async function resetAndSeedUser(
  request: APIRequestContext,
  user = TEST_USER,
) {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', { data: user });
}

async function getAuthToken(
  request: APIRequestContext,
  user = TEST_USER,
): Promise<string> {
  const res = await request.post('/api/auth/login', { data: user });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token;
}

function authFetch(request: APIRequestContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request.get(url, { headers }),
    post: (url: string, data?: unknown) => request.post(url, { headers, data }),
    put: (url: string, data?: unknown) => request.put(url, { headers, data }),
    delete: (url: string) => request.delete(url, { headers }),
  };
}

// ═══════════════════════════════════════
// 1. Login Rate Limiting
// ═══════════════════════════════════════

test.describe('Login Rate Limiting', () => {
  // Use unique usernames per test to avoid in-memory rate limit leaking
  const RL_USER1 = { username: 'rluser1', password: 'testpass123' };
  const RL_USER2 = { username: 'rluser2', password: 'testpass123' };
  const RL_USER3 = { username: 'rluser3', password: 'testpass123' };

  test('blocks login after 5 failed attempts', async ({ request }) => {
    await request.post('/api/_test/reset');
    await request.post('/api/_test/seed-user', { data: RL_USER1 });

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/auth/login', {
        data: { username: RL_USER1.username, password: 'wrong' },
      });
      expect(res.status()).toBe(401);
    }

    // 6th attempt should be rate limited (429)
    const blocked = await request.post('/api/auth/login', {
      data: { username: RL_USER1.username, password: 'wrong' },
    });
    expect(blocked.status()).toBe(429);
    const body = await blocked.json();
    expect(body.message || body.statusMessage).toContain('登录尝试次数过多');
  });

  test('rate limit blocks even correct password after lockout', async ({ request }) => {
    await request.post('/api/_test/reset');
    await request.post('/api/_test/seed-user', { data: RL_USER2 });

    // Trigger lockout
    for (let i = 0; i < 5; i++) {
      await request.post('/api/auth/login', {
        data: { username: RL_USER2.username, password: 'wrong' },
      });
    }

    // Correct password should also be blocked
    const res = await request.post('/api/auth/login', { data: RL_USER2 });
    expect(res.status()).toBe(429);
  });

  test('successful login resets attempt counter', async ({ request }) => {
    await request.post('/api/_test/reset');
    await request.post('/api/_test/seed-user', { data: RL_USER3 });

    // Make 3 failed attempts (under threshold)
    for (let i = 0; i < 3; i++) {
      await request.post('/api/auth/login', {
        data: { username: RL_USER3.username, password: 'wrong' },
      });
    }

    // Login successfully — should reset counter
    const success = await request.post('/api/auth/login', { data: RL_USER3 });
    expect(success.status()).toBe(200);

    // Should be able to fail again without being blocked (counter was reset)
    for (let i = 0; i < 4; i++) {
      const res = await request.post('/api/auth/login', {
        data: { username: RL_USER3.username, password: 'wrong' },
      });
      expect(res.status()).toBe(401);
    }
  });
});

// ═══════════════════════════════════════
// 2. Path Traversal Protection
// ═══════════════════════════════════════

test.describe('Path Traversal Protection', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('rejects non-numeric projectId in upload GET', async ({ request }) => {
    const token = await getAuthToken(request);
    const api = authFetch(request, token);

    // Use a string projectId that wouldn't match /^\d+$/
    const res = await api.get('/api/project-tracker/uploads/abc/test.jpg');
    expect(res.status()).toBe(400);
  });

  test('rejects path traversal in projectId for upload POST', async ({ request }) => {
    const token = await getAuthToken(request);

    // Use non-numeric projectId
    const res = await request.post(
      '/api/project-tracker/uploads/image?projectId=abc',
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          file: {
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-data'),
          },
        },
      },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message || body.statusMessage).toContain('projectId');
  });
});

// ═══════════════════════════════════════
// 3. Security Headers
// ═══════════════════════════════════════

test.describe('Security Headers', () => {
  test('API responses include security headers', async ({ request }) => {
    // Use an unauthenticated request — headers should still be set
    const res = await request.get('/api/auth/login');

    const headers = res.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toBeTruthy();
    // CSP may be set by our middleware or Nuxt's built-in — verify it exists and has script-src
    expect(headers['content-security-policy']).toContain("'self'");
  });
});

// ═══════════════════════════════════════
// 4. JWT Security
// ═══════════════════════════════════════

test.describe('JWT Security', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('rejects tokens with alg:none', async ({ request }) => {
    const res = await request.get('/api/habits', {
      headers: { Authorization: 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdCJ9.' },
    });
    expect(res.status()).toBe(401);
  });

  test('valid token contains tokenVersion and 30d expiry', async ({ request }) => {
    const token = await getAuthToken(request);
    expect(token).toBeTruthy();

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
    expect(payload.userId).toBeDefined();
    expect(payload.username).toBe(TEST_USER.username);
    expect(payload.tokenVersion).toBeDefined();
    expect(typeof payload.tokenVersion).toBe('number');

    // Verify 30-day expiry
    const expiryDays = (payload.exp - payload.iat) / 86400;
    expect(expiryDays).toBe(30);

    // Verify token works
    const api = authFetch(request, token);
    const res = await api.get('/api/habits');
    expect(res.status()).toBe(200);
  });
});

// ═══════════════════════════════════════
// 5. Test Endpoint Guard
// ═══════════════════════════════════════

test.describe('Test Endpoint Guard', () => {
  test('test endpoints are accessible in dev mode', async ({ request }) => {
    const res = await request.post('/api/_test/reset');
    // Should succeed (not 403) since we're in dev mode
    expect(res.status()).not.toBe(403);
  });
});

// ═══════════════════════════════════════
// 6. SSRF Protection
// ═══════════════════════════════════════

test.describe('SSRF Protection', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('blocks localhost URLs in article fetch', async ({ request }) => {
    const token = await getAuthToken(request);
    const api = authFetch(request, token);

    const urls = [
      'http://localhost/admin',
      'http://127.0.0.1/admin',
      'http://0.0.0.0/admin',
    ];

    for (const url of urls) {
      const res = await api.post('/api/articles/fetch', { url });
      expect(res.status()).toBe(400);
    }
  });

  test('blocks private IP addresses', async ({ request }) => {
    const token = await getAuthToken(request);
    const api = authFetch(request, token);

    const urls = [
      'http://10.0.0.1/admin',
      'http://192.168.1.1/admin',
      'http://172.16.0.1/admin',
      'http://169.254.169.254/latest/meta-data/',
    ];

    for (const url of urls) {
      const res = await api.post('/api/articles/fetch', { url });
      expect(res.status()).toBe(400);
    }
  });

  test('blocks non-HTTP protocols', async ({ request }) => {
    const token = await getAuthToken(request);
    const api = authFetch(request, token);

    const urls = [
      'ftp://example.com/file',
      'file:///etc/passwd',
    ];

    for (const url of urls) {
      const res = await api.post('/api/articles/fetch', { url });
      expect(res.status()).toBe(400);
    }
  });
});

// ═══════════════════════════════════════
// 7. API Key Encryption
// ═══════════════════════════════════════

test.describe('API Key Security', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('API key is masked in responses', async ({ request }) => {
    const token = await getAuthToken(request);
    const api = authFetch(request, token);

    // Create a provider with an API key
    const createRes = await api.post('/api/llm/providers', {
      provider: 'gemini',
      name: 'Test Gemini',
      modelName: 'gemini-2.0-flash',
      apiKey: 'super-secret-key-12345678',
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // API key should be masked — last 4 chars of original key
    expect(created.apiKey).not.toContain('super-secret');
    expect(created.apiKey).toBe('****5678');

    // Verify in list too — decrypted and re-masked
    const listRes = await api.get('/api/llm/providers');
    const providers = await listRes.json();
    const provider = providers.find((p: { name: string }) => p.name === 'Test Gemini');
    expect(provider).toBeTruthy();
    expect(provider.apiKey).toBe('****5678');
  });

  test('updated API key is re-encrypted', async ({ request }) => {
    const token = await getAuthToken(request);
    const api = authFetch(request, token);

    // Create provider
    const createRes = await api.post('/api/llm/providers', {
      provider: 'gemini',
      name: 'Round Trip Test',
      modelName: 'gemini-2.0-flash',
      apiKey: 'my-test-key-abc',
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Update with new key
    const updateRes = await api.put(`/api/llm/providers/${created.id}`, {
      apiKey: 'updated-key-xyz',
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.apiKey).toBe('****-xyz');

    // Cleanup
    await api.delete(`/api/llm/providers/${created.id}`);
  });
});

// ═══════════════════════════════════════
// 8. Auth Edge Cases
// ═══════════════════════════════════════

test.describe('Auth Edge Cases', () => {
  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
  });

  test('request without Bearer prefix is rejected', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await request.get('/api/habits', {
      headers: { Authorization: token },
    });
    expect(res.status()).toBe(401);
  });

  test('empty Authorization header is rejected', async ({ request }) => {
    const res = await request.get('/api/habits', {
      headers: { Authorization: '' },
    });
    expect(res.status()).toBe(401);
  });

  test('Bearer with empty token is rejected', async ({ request }) => {
    const res = await request.get('/api/habits', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status()).toBe(401);
  });
});
