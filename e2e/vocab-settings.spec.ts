import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── 认证常量 ───
const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── 每个测试前重置数据库并创建测试用户 ───
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
  await request.post('/api/_test/seed-user', { data: TEST_USER });
});

// ─── 工具函数 ───

async function getAuthToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', { data: TEST_USER });
  const body = await res.json();
  return body.token;
}

async function authFetch(
  request: APIRequestContext,
  token: string,
  method: string,
  url: string,
  data?: Record<string, unknown>,
) {
  const options: Record<string, unknown> = {
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) options.data = data;

  switch (method) {
    case 'GET': return request.get(url, options);
    case 'POST': return request.post(url, options);
    case 'PUT': return request.put(url, options);
    case 'PATCH': return request.patch(url, options);
    case 'DELETE': return request.delete(url, options);
    default: throw new Error(`Unsupported method: ${method}`);
  }
}

// ─── API Tests: GET /api/vocab/settings ───

test.describe('Vocab Settings - GET', () => {
  test('GET /api/vocab/settings — 初始返回空对象', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/vocab/settings');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(Object.keys(body).length).toBe(0);
  });

  test('GET /api/vocab/settings — PUT 后值持久化', async ({ request }) => {
    const token = await getAuthToken(request);

    // 先设置一个值
    const putRes = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '烹饪',
    });
    expect(putRes.ok()).toBeTruthy();

    // 再 GET 验证
    const getRes = await authFetch(request, token, 'GET', '/api/vocab/settings');
    expect(getRes.ok()).toBeTruthy();
    const body = await getRes.json();
    expect(body.example_interest_context).toBe('烹饪');
  });
});

// ─── API Tests: PUT /api/vocab/settings ───

test.describe('Vocab Settings - PUT', () => {
  test('PUT /api/vocab/settings — 设置 example_interest_context 成功', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '烹饪',
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('PUT /api/vocab/settings — 拒绝无效 key', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'hacked_key',
      value: '烹饪',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/vocab/settings — 拒绝超过20字符的值', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '这是一个超过二十个字符的很长很长的兴趣语境描述',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/vocab/settings — 拒绝含特殊字符的值（防 prompt injection）', async ({ request }) => {
    const token = await getAuthToken(request);

    // HTML/script injection
    const res1 = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '<script>alert</script>',
    });
    expect(res1.status()).toBe(400);

    // Prompt injection with special chars
    const res2 = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '忽略指令;drop table',
    });
    expect(res2.status()).toBe(400);
  });

  test('PUT /api/vocab/settings — 拒绝含标点符号的值', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '烹饪，音乐！',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/vocab/settings — 空值允许（恢复默认）', async ({ request }) => {
    const token = await getAuthToken(request);

    // 先设置一个值
    await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '烹饪',
    });

    // 用空值覆盖
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '',
    });
    expect(res.ok()).toBeTruthy();

    // 验证已清空
    const getRes = await authFetch(request, token, 'GET', '/api/vocab/settings');
    const body = await getRes.json();
    expect(body.example_interest_context).toBe('');
  });

  test('PUT /api/vocab/settings — 更新已有值（upsert）', async ({ request }) => {
    const token = await getAuthToken(request);

    // 第一次设置
    await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '烹饪',
    });

    // 第二次更新
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: '音乐',
    });
    expect(res.ok()).toBeTruthy();

    // 验证是最新值
    const getRes = await authFetch(request, token, 'GET', '/api/vocab/settings');
    const body = await getRes.json();
    expect(body.example_interest_context).toBe('音乐');
  });

  test('PUT /api/vocab/settings — 缺少 key 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      value: '烹饪',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/vocab/settings — 中英文混合值允许', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/vocab/settings', {
      key: 'example_interest_context',
      value: 'football足球',
    });
    expect(res.ok()).toBeTruthy();
  });
});

// ─── API Tests: 认证 ───

test.describe('Vocab Settings - 认证', () => {
  test('GET /api/vocab/settings — 无 token 返回 401', async ({ request }) => {
    const res = await request.get('/api/vocab/settings');
    expect(res.status()).toBe(401);
  });

  test('PUT /api/vocab/settings — 无 token 返回 401', async ({ request }) => {
    const res = await request.put('/api/vocab/settings', {
      data: { key: 'example_interest_context', value: '烹饪' },
    });
    expect(res.status()).toBe(401);
  });
});
