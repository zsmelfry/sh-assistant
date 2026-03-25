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
  const res = await request.post('/api/auth/login', { data: { email: `${TEST_USER.username}@test.local`, password: TEST_USER.password } });
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

/** 创建技能配置的标准测试数据 */
function makeSkillConfigData(overrides: Record<string, unknown> = {}) {
  return {
    skillId: 'test-skill',
    name: '测试技能',
    description: '一个测试用的技能配置',
    icon: 'BookOpen',
    teachingSystemPrompt: '你是{{skill.name}}导师。知识点：{{point.name}}',
    teachingUserPrompt: '请为"{{point.name}}"生成教学内容。',
    chatSystemPrompt: '你是导师。知识点：{{point.name}} — {{point.description}}',
    taskSystemPrompt: '请为{{point.name}}生成实践任务。',
    taskUserPrompt: '请为"{{point.name}}"生成任务。',
    sortOrder: 10,
    ...overrides,
  };
}

/** 通过 API 创建一个技能配置 */
async function apiCreateConfig(
  request: APIRequestContext,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await authFetch(request, token, 'POST', '/api/skill-configs', makeSkillConfigData(overrides));
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// ─── Skill Config CRUD ───

test.describe('Skill Configs - 列表', () => {
  test('GET /api/skill-configs — 初始为空数组', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skill-configs');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBe(0);
  });

  test('GET /api/skill-configs — 创建后返回配置列表', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateConfig(request, token, { skillId: 'skill-a', name: '技能A', sortOrder: 2 });
    await apiCreateConfig(request, token, { skillId: 'skill-b', name: '技能B', sortOrder: 1 });

    const res = await authFetch(request, token, 'GET', '/api/skill-configs');
    const body = await res.json();
    expect(body.length).toBe(2);
    // 按 sortOrder 升序排列
    expect(body[0].skillId).toBe('skill-b');
    expect(body[1].skillId).toBe('skill-a');
  });
});

test.describe('Skill Configs - 创建', () => {
  test('POST /api/skill-configs — 创建新配置', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    expect(created.id).toBeDefined();
    expect(created.skillId).toBe('test-skill');
    expect(created.name).toBe('测试技能');
    expect(created.description).toBe('一个测试用的技能配置');
    expect(created.icon).toBe('BookOpen');
    expect(created.teachingSystemPrompt).toContain('{{skill.name}}');
    expect(created.isActive).toBe(true);
    expect(created.createdAt).toBeGreaterThan(0);
    expect(created.updatedAt).toBeGreaterThan(0);
  });

  test('POST /api/skill-configs — 重复 skillId 返回 409', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'POST', '/api/skill-configs', makeSkillConfigData());
    expect(res.status()).toBe(409);
  });

  test('POST /api/skill-configs — 无效 skillId 格式返回 400', async ({ request }) => {
    const token = await getAuthToken(request);

    // 包含大写字母
    const res1 = await authFetch(request, token, 'POST', '/api/skill-configs', makeSkillConfigData({ skillId: 'InvalidId' }));
    expect(res1.status()).toBe(400);

    // 包含空格
    const res2 = await authFetch(request, token, 'POST', '/api/skill-configs', makeSkillConfigData({ skillId: 'has space' }));
    expect(res2.status()).toBe(400);

    // 包含下划线
    const res3 = await authFetch(request, token, 'POST', '/api/skill-configs', makeSkillConfigData({ skillId: 'has_underscore' }));
    expect(res3.status()).toBe(400);
  });

  test('POST /api/skill-configs — 缺少必填字段返回 400', async ({ request }) => {
    const token = await getAuthToken(request);

    // 缺少 name
    const res1 = await authFetch(request, token, 'POST', '/api/skill-configs', { skillId: 'test' });
    expect(res1.status()).toBe(400);

    // 缺少 prompt
    const res2 = await authFetch(request, token, 'POST', '/api/skill-configs', {
      skillId: 'test', name: '测试',
    });
    expect(res2.status()).toBe(400);
  });
});

test.describe('Skill Configs - 获取单个', () => {
  test('GET /api/skill-configs/[id] — 获取已存在的配置', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'GET', `/api/skill-configs/${created.id}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.skillId).toBe('test-skill');
    expect(body.name).toBe('测试技能');
  });

  test('GET /api/skill-configs/[id] — 不存在的 id 返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skill-configs/99999');
    expect(res.status()).toBe(404);
  });

  test('GET /api/skill-configs/[id] — 无效 id 返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'GET', '/api/skill-configs/abc');
    expect(res.status()).toBe(400);
  });
});

test.describe('Skill Configs - 更新', () => {
  test('PUT /api/skill-configs/[id] — 更新名称和描述', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'PUT', `/api/skill-configs/${created.id}`, {
      name: '更新后的名称',
      description: '更新后的描述',
    });
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.name).toBe('更新后的名称');
    expect(updated.description).toBe('更新后的描述');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  test('PUT /api/skill-configs/[id] — 空字符串 name 被拒绝', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'PUT', `/api/skill-configs/${created.id}`, {
      name: '',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/skill-configs/[id] — 空字符串 prompt 被拒绝', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'PUT', `/api/skill-configs/${created.id}`, {
      teachingSystemPrompt: '   ',
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/skill-configs/[id] — 更新可选字段（icon, sortOrder, isActive）', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'PUT', `/api/skill-configs/${created.id}`, {
      icon: 'Map',
      sortOrder: 50,
      isActive: false,
    });
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.icon).toBe('Map');
    expect(updated.sortOrder).toBe(50);
    expect(updated.isActive).toBe(false);
  });

  test('PUT /api/skill-configs/[id] — 不存在的 id 返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'PUT', '/api/skill-configs/99999', { name: 'foo' });
    expect(res.status()).toBe(404);
  });
});

test.describe('Skill Configs - 删除', () => {
  test('DELETE /api/skill-configs/[id] — 删除配置', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'DELETE', `/api/skill-configs/${created.id}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    // 确认已删除
    const getRes = await authFetch(request, token, 'GET', `/api/skill-configs/${created.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('DELETE /api/skill-configs/[id] — 不存在的 id 返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'DELETE', '/api/skill-configs/99999');
    expect(res.status()).toBe(404);
  });

  test('DELETE /api/skill-configs/[id] — 级联删除关联知识树数据', async ({ request }) => {
    const token = await getAuthToken(request);
    const created = await apiCreateConfig(request, token);

    // 先 seed 知识树
    const seedRes = await authFetch(request, token, 'POST', `/api/skills/${created.skillId}/seed`, {
      domains: [
        {
          name: '测试领域',
          description: '测试用',
          topics: [
            {
              name: '测试主题',
              description: '测试用',
              points: [
                { name: '测试知识点', description: '测试用' },
              ],
            },
          ],
        },
      ],
      stages: [
        { name: '第一阶段', description: '测试', objective: '测试', pointNames: ['测试知识点'] },
      ],
    });
    expect(seedRes.ok()).toBeTruthy();

    // 确认知识树存在
    const domainsRes = await authFetch(request, token, 'GET', `/api/skills/${created.skillId}/domains`);
    expect(domainsRes.ok()).toBeTruthy();
    const domains = await domainsRes.json();
    expect(domains.length).toBe(1);

    // 删除配置
    const delRes = await authFetch(request, token, 'DELETE', `/api/skill-configs/${created.id}`);
    expect(delRes.ok()).toBeTruthy();

    // 配置不存在了
    const getRes = await authFetch(request, token, 'GET', `/api/skill-configs/${created.id}`);
    expect(getRes.status()).toBe(404);
  });
});

test.describe('Skill Configs - Seed 端点', () => {
  test('POST /api/skill-configs/seed — 导入 startup-map 种子配置', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'POST', '/api/skill-configs/seed');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toContain('startup-map');

    // 验证 startup-map 配置已创建
    const listRes = await authFetch(request, token, 'GET', '/api/skill-configs');
    const configs = await listRes.json();
    const smConfig = configs.find((c: any) => c.skillId === 'startup-map');
    expect(smConfig).toBeDefined();
    expect(smConfig.name).toBe('创业地图');
    expect(smConfig.icon).toBe('Map');
  });

  test('POST /api/skill-configs/seed — 幂等性：重复调用不报错', async ({ request }) => {
    const token = await getAuthToken(request);

    // 第一次调用
    const res1 = await authFetch(request, token, 'POST', '/api/skill-configs/seed');
    expect(res1.ok()).toBeTruthy();
    const body1 = await res1.json();
    expect(body1.created.length).toBeGreaterThan(0);

    // 第二次调用 — 不报错，created 为空
    const res2 = await authFetch(request, token, 'POST', '/api/skill-configs/seed');
    expect(res2.ok()).toBeTruthy();
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.created.length).toBe(0);
  });
});

test.describe('Knowledge Tree Seed - 知识树种子数据', () => {
  test('POST /api/skills/[skillId]/seed — 使用 body 数据创建知识树', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateConfig(request, token);

    const seedData = {
      domains: [
        {
          name: '基础概念',
          description: '入门知识',
          topics: [
            {
              name: '核心概念',
              description: '最基本的概念',
              points: [
                { name: '概念A', description: '第一个概念' },
                { name: '概念B', description: '第二个概念' },
              ],
            },
          ],
        },
        {
          name: '进阶技巧',
          description: '高级知识',
          topics: [
            {
              name: '技巧一',
              description: '进阶技巧',
              points: [
                { name: '技巧A', description: '第一个技巧' },
              ],
            },
          ],
        },
      ],
      stages: [
        { name: '入门阶段', description: '学习基础', objective: '理解基本概念', pointNames: ['概念A', '概念B'] },
        { name: '进阶阶段', description: '深入学习', objective: '掌握进阶技巧', pointNames: ['技巧A'] },
      ],
    };

    const res = await authFetch(request, token, 'POST', '/api/skills/test-skill/seed', seedData);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.counts.domains).toBe(2);
    expect(body.counts.topics).toBe(2);
    expect(body.counts.points).toBe(3);
    expect(body.counts.stages).toBe(2);
  });

  test('POST /api/skills/[skillId]/seed — 幂等性：已有数据时跳过', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateConfig(request, token);

    const seedData = {
      domains: [
        {
          name: '领域',
          description: '测试',
          topics: [
            {
              name: '主题',
              description: '测试',
              points: [{ name: '知识点', description: '测试' }],
            },
          ],
        },
      ],
      stages: [],
    };

    // 第一次
    const res1 = await authFetch(request, token, 'POST', '/api/skills/test-skill/seed', seedData);
    expect(res1.ok()).toBeTruthy();
    const body1 = await res1.json();
    expect(body1.counts).toBeDefined();

    // 第二次 — 跳过
    const res2 = await authFetch(request, token, 'POST', '/api/skills/test-skill/seed', seedData);
    expect(res2.ok()).toBeTruthy();
    const body2 = await res2.json();
    expect(body2.skipped).toBe(true);
  });

  test('POST /api/skills/[skillId]/seed — 不存在的 skillId 返回 404', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await authFetch(request, token, 'POST', '/api/skills/nonexistent/seed', {
      domains: [{ name: 'x', description: 'x', topics: [] }],
      stages: [],
    });
    expect(res.status()).toBe(404);
  });

  test('POST /api/skills/[skillId]/seed — 缺少 body 数据返回 400', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateConfig(request, token);

    const res = await authFetch(request, token, 'POST', '/api/skills/test-skill/seed', {});
    expect(res.status()).toBe(400);
  });

  test('POST /api/skills/[skillId]/seed — 知识树可通过 domains API 查询', async ({ request }) => {
    const token = await getAuthToken(request);
    await apiCreateConfig(request, token);

    await authFetch(request, token, 'POST', '/api/skills/test-skill/seed', {
      domains: [
        {
          name: '测试领域',
          description: '用于验证',
          topics: [
            {
              name: '测试主题',
              description: '验证主题',
              points: [
                { name: '知识点1', description: '描述1' },
                { name: '知识点2', description: '描述2' },
              ],
            },
          ],
        },
      ],
      stages: [
        { name: '阶段1', description: '测试', objective: '测试', pointNames: ['知识点1'] },
      ],
    });

    // 查询 domains
    const domainsRes = await authFetch(request, token, 'GET', '/api/skills/test-skill/domains');
    expect(domainsRes.ok()).toBeTruthy();
    const domains = await domainsRes.json();
    expect(domains.length).toBe(1);
    expect(domains[0].name).toBe('测试领域');

    // 查询 stages
    const stagesRes = await authFetch(request, token, 'GET', '/api/skills/test-skill/stages');
    expect(stagesRes.ok()).toBeTruthy();
    const stages = await stagesRes.json();
    expect(stages.length).toBe(1);
    expect(stages[0].name).toBe('阶段1');
  });
});
