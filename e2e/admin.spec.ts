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

async function getAuthToken(request: APIRequestContext, user: { username: string; password: string; email?: string }): Promise<string> {
  const email = user.email || `${user.username}@test.local`;
  const res = await request.post('/api/auth/login', { data: { email, password: user.password } });
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
      email: 'newuser@example.com',
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
      email: 'moduser@example.com',
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
      email: 'pwduser@example.com',
    });
    const created = await createRes.json();

    const resetRes = await api.post(`/api/admin/users/${created.id}/reset-password`, {
      password: 'newpass456',
    });
    expect(resetRes.status()).toBe(200);

    // Verify new password works (login uses email)
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'pwduser@example.com', password: 'newpass456' },
    });
    expect(loginRes.status()).toBe(200);
  });

  test('admin can delete a non-admin user', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const createRes = await api.post('/api/admin/users', {
      username: 'deluser',
      password: 'pass1234',
      role: 'user',
      email: 'deluser@example.com',
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

  // ─── Email field tests ───

  test('create user with email returns email in response', async ({ request }) => {
    const api = authFetch(request, adminToken);
    const res = await api.post('/api/admin/users', {
      username: 'emailuser',
      password: 'pass1234',
      role: 'user',
      email: 'emailuser@example.com',
    });
    expect(res.status()).toBe(200);
    const created = await res.json();
    expect(created.email).toBe('emailuser@example.com');
  });

  test('create user rejects missing email', async ({ request }) => {
    const api = authFetch(request, adminToken);
    const res = await api.post('/api/admin/users', {
      username: 'noemail',
      password: 'pass1234',
      role: 'user',
    });
    expect(res.status()).toBe(400);
  });

  test('create user rejects invalid email format', async ({ request }) => {
    const api = authFetch(request, adminToken);
    const res = await api.post('/api/admin/users', {
      username: 'bademail',
      password: 'pass1234',
      role: 'user',
      email: 'not-an-email',
    });
    expect(res.status()).toBe(400);
  });

  test('create user rejects duplicate email', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create first user with email
    const res1 = await api.post('/api/admin/users', {
      username: 'dupuser1',
      password: 'pass1234',
      role: 'user',
      email: 'duplicate@example.com',
    });
    expect(res1.status()).toBe(200);

    // Create second user with same email
    const res2 = await api.post('/api/admin/users', {
      username: 'dupuser2',
      password: 'pass1234',
      role: 'user',
      email: 'duplicate@example.com',
    });
    expect(res2.status()).toBe(409);
  });

  test('user list includes email field', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a user with email
    await api.post('/api/admin/users', {
      username: 'listuser',
      password: 'pass1234',
      role: 'user',
      email: 'listuser@example.com',
    });

    const listRes = await api.get('/api/admin/users');
    expect(listRes.status()).toBe(200);
    const users = await listRes.json();
    const listUser = users.find((u: any) => u.username === 'listuser');
    expect(listUser.email).toBe('listuser@example.com');
  });

  test('update user email succeeds with valid email', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a user
    const createRes = await api.post('/api/admin/users', {
      username: 'updateemail',
      password: 'pass1234',
      role: 'user',
      email: 'old@example.com',
    });
    const created = await createRes.json();

    // Update email
    const updateRes = await api.put(`/api/admin/users/${created.id}/email`, {
      email: 'new@example.com',
    });
    expect(updateRes.status()).toBe(200);

    // Verify via user list
    const listRes = await api.get('/api/admin/users');
    const users = await listRes.json();
    const updated = users.find((u: any) => u.username === 'updateemail');
    expect(updated.email).toBe('new@example.com');
  });

  test('update email rejects invalid format', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const createRes = await api.post('/api/admin/users', {
      username: 'badupdateemail',
      password: 'pass1234',
      role: 'user',
      email: 'valid@example.com',
    });
    const created = await createRes.json();

    const updateRes = await api.put(`/api/admin/users/${created.id}/email`, {
      email: 'not-valid',
    });
    expect(updateRes.status()).toBe(400);
  });

  test('update email rejects duplicate email', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create two users
    const res1 = await api.post('/api/admin/users', {
      username: 'emaildup1',
      password: 'pass1234',
      role: 'user',
      email: 'taken@example.com',
    });
    const user1 = await res1.json();

    const res2 = await api.post('/api/admin/users', {
      username: 'emaildup2',
      password: 'pass1234',
      role: 'user',
      email: 'other@example.com',
    });
    const user2 = await res2.json();

    // Try to update user2's email to user1's email
    const updateRes = await api.put(`/api/admin/users/${user2.id}/email`, {
      email: 'taken@example.com',
    });
    expect(updateRes.status()).toBe(409);
  });

  test('seeded users have auto-generated email', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const listRes = await api.get('/api/admin/users');
    const users = await listRes.json();
    const seededAdmin = users.find((u: any) => u.username === ADMIN_USER.username);
    expect(seededAdmin.email).toBe(`${ADMIN_USER.username}@test.local`);
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
      email: 'limited@example.com',
      enabledModules: ['dashboard'],
    });

    const userToken = await getAuthToken(request, { username: 'limited', password: 'pass1234', email: 'limited@example.com' });
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
      email: 'normie@example.com',
    });

    const userToken = await getAuthToken(request, { username: 'normie', password: 'pass1234', email: 'normie@example.com' });
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
      email: 'alice@example.com',
      enabledModules: ['habit-tracker'],
    });
    await api.post('/api/admin/users', {
      username: 'bobuser',
      password: 'pass1234',
      role: 'user',
      email: 'bobuser@example.com',
      enabledModules: ['habit-tracker'],
    });

    const aliceToken = await getAuthToken(request, { username: 'alice', password: 'pass1234', email: 'alice@example.com' });
    const bobToken = await getAuthToken(request, { username: 'bobuser', password: 'pass1234', email: 'bobuser@example.com' });

    const aliceApi = authFetch(request, aliceToken);
    const bobApi = authFetch(request, bobToken);

    // Alice creates a habit
    const createRes = await aliceApi.post('/api/habits', {
      name: 'Alice running',
      frequency: 'daily',
      color: '#000000',
    });
    expect(createRes.status()).toBe(201);

    // Alice can see her habit
    const aliceHabits = await (await aliceApi.get('/api/habits')).json();
    expect(aliceHabits).toHaveLength(1);
    expect(aliceHabits[0].name).toBe('Alice running');

    // Bob sees no habits (isolated DB)
    const bobHabits = await (await bobApi.get('/api/habits')).json();
    expect(bobHabits).toHaveLength(0);
  });

  test('login returns role and enabledModules', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { email: `${ADMIN_USER.username}@test.local`, password: ADMIN_USER.password } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBe('admin');
    expect(body.enabledModules).toBeDefined();
    expect(Array.isArray(body.enabledModules)).toBe(true);
    expect(body.enabledModules.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════
// Login Logs API Tests
// ═══════════════════════════════════════

test.describe('Login Logs API', () => {
  let adminToken: string;

  test.beforeEach(async ({ request }) => {
    await resetDB(request);
    await seedUser(request, ADMIN_USER);
    adminToken = await getAuthToken(request, ADMIN_USER);
  });

  test('password login creates a log entry', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // getAuthToken already called POST /api/auth/login for ADMIN_USER
    // Fetch login logs for the admin user
    const usersRes = await api.get('/api/admin/users');
    const users = await usersRes.json();
    const adminUser = users.find((u: any) => u.username === ADMIN_USER.username);

    const logsRes = await api.get(`/api/admin/login-logs?userId=${adminUser.id}`);
    expect(logsRes.status()).toBe(200);
    const logs = await logsRes.json();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const passwordLog = logs.find((l: any) => l.method === 'password');
    expect(passwordLog).toBeDefined();
  });

  test('login logs have expected fields', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const logsRes = await api.get('/api/admin/login-logs');
    expect(logsRes.status()).toBe(200);
    const logs = await logsRes.json();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const log = logs[0];
    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('userId');
    expect(log).toHaveProperty('username');
    expect(log).toHaveProperty('method');
    expect(log).toHaveProperty('ip');
    expect(log).toHaveProperty('createdAt');
  });

  test('login logs filtered by userId', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a second user and login with them
    await api.post('/api/admin/users', {
      username: 'loguser2',
      password: 'pass1234',
      role: 'user',
      email: 'loguser2@test.com',
    });
    await getAuthToken(request, { username: 'loguser2', password: 'pass1234', email: 'loguser2@test.com' });

    // Get user IDs
    const usersRes = await api.get('/api/admin/users');
    const users = await usersRes.json();
    const adminUser = users.find((u: any) => u.username === ADMIN_USER.username);
    const otherUser = users.find((u: any) => u.username === 'loguser2');

    // Query logs for the second user only
    const logsRes = await api.get(`/api/admin/login-logs?userId=${otherUser.id}`);
    const logs = await logsRes.json();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    // All returned logs should belong to the queried user
    for (const log of logs) {
      expect(log.userId).toBe(otherUser.id);
    }

    // Verify admin logs exist separately
    const adminLogsRes = await api.get(`/api/admin/login-logs?userId=${adminUser.id}`);
    const adminLogs = await adminLogsRes.json();
    expect(adminLogs.length).toBeGreaterThanOrEqual(1);
    for (const log of adminLogs) {
      expect(log.userId).toBe(adminUser.id);
    }
  });

  test('login logs ordered by time descending', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a second user and login to generate multiple log entries
    await api.post('/api/admin/users', {
      username: 'logorder',
      password: 'pass1234',
      role: 'user',
      email: 'logorder@test.com',
    });
    await getAuthToken(request, { username: 'logorder', password: 'pass1234', email: 'logorder@test.com' });

    // Fetch all logs (multiple logins happened: admin in beforeEach + logorder)
    const logsRes = await api.get('/api/admin/login-logs');
    const logs = await logsRes.json();

    expect(logs.length).toBeGreaterThanOrEqual(2);
    // First result should have the highest (most recent) createdAt
    for (let i = 0; i < logs.length - 1; i++) {
      expect(logs[i].createdAt).toBeGreaterThanOrEqual(logs[i + 1].createdAt);
    }
  });

  test('login logs respect limit param', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create another user and login to ensure at least 2 log entries
    await api.post('/api/admin/users', {
      username: 'limituser',
      password: 'pass1234',
      role: 'user',
      email: 'limituser@test.com',
    });
    await getAuthToken(request, { username: 'limituser', password: 'pass1234', email: 'limituser@test.com' });

    const logsRes = await api.get('/api/admin/login-logs?limit=1');
    expect(logsRes.status()).toBe(200);
    const logs = await logsRes.json();
    expect(logs).toHaveLength(1);
  });

  test('login logs reject invalid userId', async ({ request }) => {
    const api = authFetch(request, adminToken);

    const logsRes = await api.get('/api/admin/login-logs?userId=abc');
    expect(logsRes.status()).toBe(400);
  });

  test('session-start creates token log', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Call session-start endpoint with admin token
    const sessionRes = await api.post('/api/auth/session-start');
    expect(sessionRes.status()).toBe(200);

    // Fetch login logs and find a 'token' method entry
    const logsRes = await api.get('/api/admin/login-logs');
    const logs = await logsRes.json();
    const tokenLog = logs.find((l: any) => l.method === 'token');
    expect(tokenLog).toBeDefined();
    expect(tokenLog.username).toBe(ADMIN_USER.username);
  });

  test('non-admin cannot access login logs', async ({ request }) => {
    const api = authFetch(request, adminToken);

    // Create a normal user
    await api.post('/api/admin/users', {
      username: 'nonadmin',
      password: 'pass1234',
      role: 'user',
      email: 'nonadmin@test.com',
    });

    const userToken = await getAuthToken(request, { username: 'nonadmin', password: 'pass1234', email: 'nonadmin@test.com' });
    const userApi = authFetch(request, userToken);

    const logsRes = await userApi.get('/api/admin/login-logs');
    expect(logsRes.status()).toBe(403);
  });
});
