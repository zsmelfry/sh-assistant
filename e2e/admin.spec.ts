import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── Test constants ───
const ADMIN_USER = { username: 'testadmin', password: 'adminpass123' };
const NORMAL_USER = { username: 'testuser', password: 'userpass123' };

// ─── Helpers ───

async function resetDB(request: APIRequestContext) {
  await request.post('/api/_test/reset');
}

async function seedUser(request: APIRequestContext, user: { username: string; password: string }) {
  await request.post('/api/_test/seed-user', { data: user });
}

async function getAuthToken(request: APIRequestContext, user: { username: string; password: string }): Promise<string> {
  const res = await request.post('/api/auth/login', { data: user });
  const body = await res.json();
  return body.token;
}

function authFetch(request: APIRequestContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request.get(url, { headers }),
    post: (url: string, data?: any) => request.post(url, { headers, data }),
    put: (url: string, data?: any) => request.put(url, { headers, data }),
    delete: (url: string) => request.delete(url, { headers }),
  };
}

// ═══════════════════════════════════════
// Admin API Tests
// ═══════════════════════════════════════

test.describe('Admin User Management API', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_USER);
  });

  test('admin can list users', async ({ request }) => {
    const api = authFetch(request, adminToken);
    const res = await api.get('/api/admin/users');
    expect(res.status()).toBe(200);
    const users = await res.json();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe(ADMIN_USER.username);
    expect(users[0].role).toBe('admin');
    expect(users[0].modules).toBeDefined();
  });

  test('admin can create a new user', async ({ request }) => {
    const api = authFetch(request, adminToken);
    const res = await api.post('/api/admin/users', {
      username: 'newuser',
      password: 'pass1234',
      role: 'user',
    });
    expect(res.status()).toBe(200);
    const created = await res.json();
    expect(created.username).toBe('newuser');
    expect(created.role).toBe('user');

    // Verify user appears in list
    const listRes = await api.get('/api/admin/users');
    const users = await listRes.json();
    expect(users).toHaveLength(2);
  });

  test('admin can update module permissions', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a user first
    const createRes = await api.post('/api/admin/users', {
      username: 'moduser',
      password: 'pass1234',
      role: 'user',
      enabledModules: ['dashboard', 'habit-tracker'],
    });
    const created = await createRes.json();

    // Disable habit-tracker
    const updateRes = await api.put(`/api/admin/users/${created.id}/modules`, {
      modules: [{ moduleId: 'habit-tracker', enabled: false }],
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    const habitMod = updated.modules.find((m: any) => m.moduleId === 'habit-tracker');
    expect(habitMod.enabled).toBe(false);
  });

  test('admin can reset user password', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const createRes = await api.post('/api/admin/users', {
      username: 'pwduser',
      password: 'oldpass123',
      role: 'user',
    });
    const created = await createRes.json();

    const resetRes = await api.post(`/api/admin/users/${created.id}/reset-password`, {
      password: 'newpass456',
    });
    expect(resetRes.status()).toBe(200);

    // Verify new password works
    const loginRes = await request.post('/api/auth/login', {
      data: { username: 'pwduser', password: 'newpass456' },
    });
    expect(loginRes.status()).toBe(200);
  });

  test('admin can delete a non-admin user', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const createRes = await api.post('/api/admin/users', {
      username: 'deluser',
      password: 'pass1234',
      role: 'user',
    });
    const created = await createRes.json();

    const deleteRes = await api.delete(`/api/admin/users/${created.id}`);
    expect(deleteRes.status()).toBe(200);

    // Verify user is gone
    const listRes = await api.get('/api/admin/users');
    const users = await listRes.json();
    expect(users.find((u: any) => u.username === 'deluser')).toBeUndefined();
  });

  test('cannot delete the last admin', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Get admin user ID
    const listRes = await api.get('/api/admin/users');
    const users = await listRes.json();
    const adminUser = users.find((u: any) => u.username === ADMIN_USER.username);

    const deleteRes = await api.delete(`/api/admin/users/${adminUser.id}`);
    expect(deleteRes.status()).toBe(400);
  });
});

// ═══════════════════════════════════════
// Module Permission Enforcement Tests
// ═══════════════════════════════════════

test.describe('Module Permission Enforcement', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_USER);
  });

  test('disabled module API returns 403', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create user with only dashboard enabled
    await api.post('/api/admin/users', {
      username: 'limited',
      password: 'pass1234',
      role: 'user',
      enabledModules: ['dashboard'],
    });

    const userToken = await getAuthToken(request, { username: 'limited', password: 'pass1234' });
    const userApi = authFetch(request, userToken);

    // Accessing habits (habit-tracker module) should be 403
    const habitsRes = await userApi.get('/api/habits');
    expect(habitsRes.status()).toBe(403);

    // Accessing dashboard should be 200
    const dashRes = await userApi.get('/api/dashboard/summary');
    expect(dashRes.status()).toBe(200);
  });

  test('normal user cannot access admin API', async ({ request }) => {
    const api = authFetch(request, adminToken);

    await api.post('/api/admin/users', {
      username: 'normie',
      password: 'pass1234',
      role: 'user',
    });

    const userToken = await getAuthToken(request, { username: 'normie', password: 'pass1234' });
    const userApi = authFetch(request, userToken);

    const res = await userApi.get('/api/admin/users');
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════
// Data Isolation Tests
// ═══════════════════════════════════════

test.describe('Data Isolation', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_USER);
  });

  test('users have isolated data', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create two users with habit-tracker enabled
    await api.post('/api/admin/users', {
      username: 'alice',
      password: 'pass1234',
      role: 'user',
    });
    await api.post('/api/admin/users', {
      username: 'bobuser',
      password: 'pass1234',
      role: 'user',
    });

    const aliceToken = await getAuthToken(request, { username: 'alice', password: 'pass1234' });
    const bobToken = await getAuthToken(request, { username: 'bobuser', password: 'pass1234' });

    const aliceApi = authFetch(request, aliceToken);
    const bobApi = authFetch(request, bobToken);

    // Alice creates a habit
    const createRes = await aliceApi.post('/api/habits', {
      name: 'Alice running',
      frequency: 'daily',
      color: '#000000',
    });
    expect(createRes.status()).toBe(200);

    // Alice can see her habit
    const aliceHabits = await (await aliceApi.get('/api/habits')).json();
    expect(aliceHabits).toHaveLength(1);
    expect(aliceHabits[0].name).toBe('Alice running');

    // Bob sees no habits (isolated DB)
    const bobHabits = await (await bobApi.get('/api/habits')).json();
    expect(bobHabits).toHaveLength(0);
  });

  test('login returns role and enabledModules', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: ADMIN_USER });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBe('admin');
    expect(body.enabledModules).toBeDefined();
    expect(Array.isArray(body.enabledModules)).toBe(true);
    expect(body.enabledModules.length).toBeGreaterThan(0);
  });
});
