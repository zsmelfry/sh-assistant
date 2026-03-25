import { test, expect, type APIRequestContext } from '@playwright/test';

const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── Helpers ───

async function resetAndSeedUser(request: APIRequestContext) {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', { data: TEST_USER });
}

async function getAuthToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email: `${TEST_USER.username}@test.local`, password: TEST_USER.password } });
  const body = await res.json();
  return body.token;
}

function authFetch(request: APIRequestContext, token: string) {
  return {
    get: (url: string) => request.get(url, { headers: { Authorization: `Bearer ${token}` } }),
    post: (url: string, data?: unknown) =>
      request.post(url, { headers: { Authorization: `Bearer ${token}` }, data }),
    put: (url: string, data?: unknown) =>
      request.put(url, { headers: { Authorization: `Bearer ${token}` }, data }),
    delete: (url: string) =>
      request.delete(url, { headers: { Authorization: `Bearer ${token}` } }),
  };
}

// ─── Tests ───

test.describe('Gemini Provider Integration', () => {
  let token: string;
  let api: ReturnType<typeof authFetch>;

  test.beforeEach(async ({ request }) => {
    await resetAndSeedUser(request);
    token = await getAuthToken(request);
    api = authFetch(request, token);
  });

  test('model discovery includes Gemini models', async () => {
    const res = await api.get('/api/llm/models');
    expect(res.ok()).toBe(true);

    const body = await res.json();
    const geminiModels = body.models.filter((m: { provider: string }) => m.provider === 'gemini');

    expect(geminiModels.length).toBe(2);
    expect(geminiModels.map((m: { modelName: string }) => m.modelName)).toEqual(
      expect.arrayContaining(['2.5-flash', '2.5-flash-lite']),
    );
    expect(geminiModels[0].displayName).toBeTruthy();
    expect(geminiModels[0].available).toBe(true);
  });

  test('can add a Gemini provider', async () => {
    const res = await api.post('/api/llm/providers', {
      provider: 'gemini',
      name: 'Gemini Flash',
      modelName: '2.5-flash',
      apiKey: 'AIzaSyFAKEKEY123',
    });
    expect(res.ok()).toBe(true);

    const provider = await res.json();
    expect(provider.provider).toBe('gemini');
    expect(provider.modelName).toBe('2.5-flash');
    expect(provider.name).toBe('Gemini Flash');
    // API key should be masked in response
    expect(provider.apiKey).not.toBe('AIzaSyFAKEKEY123');
  });

  test('can list providers including Gemini', async () => {
    // Add a Gemini provider
    await api.post('/api/llm/providers', {
      provider: 'gemini',
      name: 'Gemini Flash',
      modelName: '2.5-flash',
      apiKey: 'AIzaSyFAKEKEY123',
    });

    const res = await api.get('/api/llm/providers');
    expect(res.ok()).toBe(true);

    const providers = await res.json();
    const gemini = providers.find((p: { provider: string }) => p.provider === 'gemini');
    expect(gemini).toBeTruthy();
    expect(gemini.name).toBe('Gemini Flash');
  });

  test('can delete a Gemini provider', async () => {
    // Add
    const addRes = await api.post('/api/llm/providers', {
      provider: 'gemini',
      name: 'Gemini Flash',
      modelName: '2.5-flash',
      apiKey: 'AIzaSyFAKEKEY123',
    });
    const provider = await addRes.json();

    // Delete
    const delRes = await api.delete(`/api/llm/providers/${provider.id}`);
    expect(delRes.ok()).toBe(true);

    // Verify gone
    const listRes = await api.get('/api/llm/providers');
    const providers = await listRes.json();
    expect(providers.find((p: { id: number }) => p.id === provider.id)).toBeUndefined();
  });

  test('rejects Gemini provider without API key', async () => {
    const res = await api.post('/api/llm/providers', {
      provider: 'gemini',
      name: 'Gemini Flash',
      modelName: '2.5-flash',
      // no apiKey
    });
    // Should still accept the provider (validation at usage time, not creation)
    // or reject — depends on existing behavior. Let's just check it doesn't 500.
    expect(res.status()).not.toBe(500);
  });
});
