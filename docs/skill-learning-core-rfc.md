# RFC: 抽取技能学习核心层 (Skill Learning Core)

> 从创业地图 (startup-map) 中提取可复用的技能学习基础设施，使其可以快速创建新的技能学习工具（编程技能、公司管理等）。

## 1. 背景与动机

创业地图已经实现了一套完整的知识学习系统：

- 知识树导航（领域 → 主题 → 知识点）
- AI 教学内容生成（SSE 流式，5 个板块）
- AI 聊天辅导（上下文感知）
- 实践任务（AI 生成 + 手动完成）
- 笔记（支持 Markdown）
- 学习状态追踪（未开始 → 学习中 → 已理解 → 已实践）
- 学习阶段 + 推荐系统
- 活动记录 + 热力图 + 连续天数
- 文章双向链接
- 统计分析（全局 / 按领域）

这套系统的核心逻辑与"创业"本身无关——它是一个通用的**结构化知识学习引擎**。只要替换种子数据和 AI 提示词，就可以用于学习任何技能。

**目标**：抽取核心层后，创建一个新技能工具只需要：
1. 定义种子数据（领域/主题/知识点/阶段）
2. 编写 AI 提示词（教学/聊天/任务）
3. 注册工具（一个 `registerTool()` 调用）

## 2. 现有架构分析

### 2.1 数据库层 (12 张表)

```
sm_products        ← 产品档案（startup-map 专用，不进入核心）

sm_domains         ← 领域（根节点）
  └─ sm_topics     ← 主题
      └─ sm_points ← 知识点
          ├─ sm_teachings      ← AI 教学内容（1:1，含 productId）
          ├─ sm_chats          ← AI 对话记录
          ├─ sm_tasks          ← 实践任务
          ├─ sm_notes          ← 笔记（含 productId）
          └─ sm_point_articles ← 文章关联（M2M）

sm_stages          ← 学习阶段（独立根节点）
  └─ sm_stage_points ← 阶段-知识点映射（M2M）

sm_activities      ← 学习行为记录
```

**FK 级联关系**：`domains → topics → points → (teachings, chats, tasks, notes, point_articles)`，所有子表通过 FK `onDelete: cascade` 链接到 domains。

### 2.2 API 层 (~35 个端点)

所有路由在 `server/api/startup-map/` 下，按 Nuxt 文件路由约定组织：

| 路由组 | 端点数 | 功能 |
|--------|--------|------|
| `domains/` | 2 | 领域列表（含统计）、领域详情（含完整树） |
| `points/[id]/` | 13 | 知识点详情、状态更新、教学生成(SSE)、聊天、任务、笔记、文章 |
| `stages/` | 2 | 阶段列表、阶段详情 |
| `stats/` | 4 | 全局统计、按领域统计、热力图、连续天数 |
| `activities/` | 2 | 活动记录、活动日志 |
| `tasks/` | 1 | 任务状态更新 |
| `articles/` | 2 | 文章双向链接 |
| `recommendations` | 1 | 学习推荐 |
| `seed` | 1 | 种子数据导入 |
| `products/` | 6 | 产品管理（不进入核心） |

**AI 提示词硬编码在 3 个文件中**：
- `points/[id]/teaching.post.ts` — 创业导师角色，5 板块教学
- `points/[id]/chat.post.ts` — 创业导师角色，上下文聊天
- `points/[id]/tasks/generate.post.ts` — 创业导师角色，实践任务生成

### 2.3 Store 层 (723 行)

`stores/startup-map.ts` — Pinia Composition API store：
- 80+ 个 reactive state
- 50+ 个 action 方法
- 所有 API 调用硬编码 `/api/startup-map/...` 路径
- 产品相关占 ~10%（activeProduct, products, productLoading 等）

### 2.4 组件层 (28 个)

`tools/startup-map/components/` 下：
- 25 个通用学习组件（可复用）
- 3 个产品专用组件：ProductProfile, ProductList, ProductSwitcher

### 2.5 需要分离的 startup-map 专有部分

| 功能 | 涉及文件 | 处理方式 |
|------|----------|----------|
| 产品管理 CRUD | `sm_products` 表、`products/` 6 个 API、store 中 ~70 行 | 保留在 startup-map |
| 产品上下文注入 AI prompt | teaching/chat/task 3 个 handler 中查询 activeProduct | 通过 `resolveExtraContext` hook 隔离 |
| 产品切换 UI | ProductSwitcher, ProductList, ProductProfile | 保留在 startup-map |
| 笔记/教学的 productId | `sm_teachings.product_id`, `sm_notes.product_id` | 保留列（nullable），核心层忽略 |

## 3. 技术方案

### 3.1 数据隔离：共享表 + skillId

在根表上添加 `skill_id` 列来区分不同技能的数据：

```sql
-- 只需修改 3 张表（其他表通过 FK 级联获得技能归属）
ALTER TABLE sm_domains ADD COLUMN skill_id TEXT NOT NULL DEFAULT 'startup-map';
ALTER TABLE sm_stages ADD COLUMN skill_id TEXT NOT NULL DEFAULT 'startup-map';
ALTER TABLE sm_activities ADD COLUMN skill_id TEXT NOT NULL DEFAULT 'startup-map';

-- 添加索引
CREATE INDEX idx_sm_domains_skill ON sm_domains(skill_id);
CREATE INDEX idx_sm_stages_skill ON sm_stages(skill_id);
CREATE INDEX idx_sm_activities_skill ON sm_activities(skill_id);
```

**为什么只改 3 张表**：
- `sm_topics` 通过 `domain_id` FK 关联到 `sm_domains`
- `sm_points` 通过 `topic_id` FK 关联到 `sm_topics`
- `sm_teachings/chats/tasks/notes/point_articles` 通过 `point_id` FK 关联到 `sm_points`
- `sm_stage_points` 通过 `stage_id` FK 关联到 `sm_stages`
- 唯一的例外：`sm_activities` 的 `point_id` 是 `onDelete: 'set null'`（弱关联），需要自己的 `skill_id`

**数据安全**：所有查询必须在根表加 `WHERE skill_id = ?` 过滤，防止跨技能数据泄露。

### 3.2 API 路由：统一动态路由

**方案**：`/api/skills/[skillId]/...` — 一套路由文件服务所有技能。

```
server/api/skills/[skillId]/
├── domains/
│   ├── index.get.ts          # GET /api/skills/:skillId/domains
│   └── [id].get.ts           # GET /api/skills/:skillId/domains/:id
├── points/
│   └── [id]/
│       ├── index.get.ts      # GET /api/skills/:skillId/points/:id
│       ├── status.patch.ts
│       ├── teaching.post.ts  # SSE 流式教学生成
│       ├── chat.post.ts
│       ├── chats.get.ts
│       ├── chats.delete.ts
│       ├── tasks.get.ts
│       ├── tasks/
│       │   └── generate.post.ts
│       ├── notes.get.ts
│       ├── notes.put.ts
│       ├── articles.get.ts
│       ├── articles.post.ts
│       └── articles/
│           └── [articleId].delete.ts
├── tasks/
│   └── [id].patch.ts
├── stages/
│   ├── index.get.ts
│   └── [id].get.ts
├── stats/
│   ├── overview.get.ts
│   ├── by-domain.get.ts
│   ├── heatmap.get.ts
│   └── streak.get.ts
├── activities/
│   ├── index.get.ts
│   └── index.post.ts
├── articles/
│   └── [articleId]/
│       ├── points.get.ts
│       └── points.post.ts
├── recommendations.get.ts
└── seed.post.ts
```

**产品路由保留**在 `server/api/startup-map/products/`（不迁移）。

每个 handler 的标准模式：

```typescript
// server/api/skills/[skillId]/domains/index.get.ts
export default defineEventHandler(async (event) => {
  const { skillId, config } = resolveSkill(event);  // 验证 skillId，获取配置
  const db = useDB();

  const rows = await db
    .select({ /* ... */ })
    .from(smDomains)
    .leftJoin(smTopics, sql`${smTopics.domainId} = ${smDomains.id}`)
    .leftJoin(smPoints, sql`${smPoints.topicId} = ${smTopics.id}`)
    .where(eq(smDomains.skillId, skillId))  // ← 关键：按 skillId 过滤
    .groupBy(smDomains.id)
    .orderBy(smDomains.sortOrder);

  return rows.map(r => ({ ...r, completionRate: /* ... */ }));
});
```

### 3.3 服务端技能配置 & 注册表

```
server/lib/skill-learning/
├── types.ts           # SkillConfig 类型定义
├── registry.ts        # 技能注册表（Map + register/get/require）
├── db-helpers.ts      # 共享 DB 查询工具
├── index.ts           # 入口（side-effect import 注册所有技能）
└── skills/
    └── startup-map.ts # startup-map 技能配置
```

#### SkillConfig 接口

```typescript
// server/lib/skill-learning/types.ts

interface SkillTeachingContext {
  point: { name: string; description: string | null };
  topic: { name: string };
  domain: { name: string };
  extra?: Record<string, any>;  // 技能特有上下文（如 startup-map 的产品信息）
}

interface SkillConfig {
  id: string;                    // URL 标识符，如 'startup-map'
  name: string;                  // 显示名称，如 '创业地图'

  // AI 提示词构建器
  buildTeachingPrompt: (ctx: SkillTeachingContext) => ChatMessage[];
  buildChatSystemMessage: (ctx: SkillTeachingContext & { teachingSummary: string }) => ChatMessage;
  buildTaskPrompt: (ctx: SkillTeachingContext) => ChatMessage[];

  // 可配置的标签
  teachingSections: { key: string; label: string }[];
  statusLabels: Record<string, string>;
  activityTypeLabels: Record<string, string>;

  // 可选：AI 调用前注入额外上下文
  resolveExtraContext?: (db: any) => Promise<Record<string, any>>;

  // 种子数据
  seedData: { domains: SeedDomain[]; stages: SeedStage[] };
}
```

#### 技能注册表

```typescript
// server/lib/skill-learning/registry.ts

const skills = new Map<string, SkillConfig>();

export function registerSkill(config: SkillConfig): void {
  skills.set(config.id, config);
}

export function getSkill(id: string): SkillConfig | undefined {
  return skills.get(id);
}

export function requireSkill(id: string): SkillConfig {
  const skill = skills.get(id);
  if (!skill) throw createError({ statusCode: 404, message: `技能 '${id}' 不存在` });
  return skill;
}
```

#### startup-map 配置示例

```typescript
// server/lib/skill-learning/skills/startup-map.ts

registerSkill({
  id: 'startup-map',
  name: '创业地图',

  buildTeachingPrompt(ctx) {
    const product = ctx.extra?.product;
    let productContext = '';
    if (product) {
      productContext = `\n当前学习者的产品背景：\n- 产品名称：${product.name}\n...`;
    }
    return [
      {
        role: 'system',
        content: `你是一位资深的创业导师和商业教育专家。...${productContext}\n...`,
      },
      { role: 'user', content: `请为"${ctx.point.name}"生成教学内容。` },
    ];
  },

  buildChatSystemMessage(ctx) {
    return {
      role: 'system',
      content: `你是一位经验丰富的创业导师。用户正在学习以下创业知识点...`,
    };
  },

  buildTaskPrompt(ctx) { /* 类似 */ },

  teachingSections: [
    { key: 'what', label: '是什么' },
    { key: 'how', label: '怎么做' },
    { key: 'example', label: '案例' },
    { key: 'apply', label: '我的应用' },
    { key: 'resources', label: '推荐资源' },
  ],

  statusLabels: { not_started: '未开始', learning: '学习中', understood: '已理解', practiced: '已实践' },
  activityTypeLabels: { view: '查看知识点', chat: 'AI 对话', note: '编辑笔记', task: '完成任务', status_change: '状态变更' },

  // startup-map 特有：注入产品上下文
  async resolveExtraContext(db) {
    const [product] = await db.select().from(smProducts).where(eq(smProducts.isActive, true)).limit(1);
    return product ? { product } : {};
  },

  seedData: { domains: SEED_DOMAINS, stages: SEED_STAGES },
});
```

#### DB 查询辅助工具

```typescript
// server/lib/skill-learning/db-helpers.ts

/** 验证知识点属于指定技能（通过 point → topic → domain.skillId 链） */
export async function requirePointForSkill(
  db: ReturnType<typeof useDB>,
  pointId: number,
  skillId: string,
): Promise<{ point: SmPoint; topic: SmTopic; domain: SmDomain }> {
  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, pointId)).limit(1);
  if (!point) throw createError({ statusCode: 404, message: '知识点不存在' });

  const [topic] = await db.select().from(smTopics).where(eq(smTopics.id, point.topicId)).limit(1);
  const [domain] = topic
    ? await db.select().from(smDomains).where(eq(smDomains.id, topic.domainId)).limit(1)
    : [null];

  if (!topic || !domain) throw createError({ statusCode: 500, message: '数据不完整' });
  if (domain.skillId !== skillId) throw createError({ statusCode: 404, message: '知识点不存在' });

  return { point, topic, domain };
}

/** 从路由参数提取 skillId 并验证技能存在 */
export function resolveSkill(event: H3Event) {
  const skillId = getRouterParam(event, 'skillId');
  if (!skillId) throw createError({ statusCode: 400, message: '缺少 skillId' });
  const config = requireSkill(skillId);
  return { skillId, config };
}
```

### 3.4 Store 工厂

```typescript
// composables/skill-learning/useSkillLearningStore.ts

export function createSkillLearningStore(skillId: string) {
  return defineStore(`skill-${skillId}`, () => {
    const baseUrl = `/api/skills/${skillId}`;

    // ===== 视图状态 =====
    const currentView = ref<SkillLearningView>('global');
    const globalTab = ref<GlobalTab>('domains');
    const currentDomainId = ref<number | null>(null);
    const currentPointId = ref<number | null>(null);

    // ===== 领域数据 =====
    const domains = ref<DomainWithStats[]>([]);
    const domainsLoading = ref(false);
    // ... 其他所有 state（与 startup-map store 相同，除产品相关）

    // ===== API 操作 =====
    async function loadDomains() {
      domainsLoading.value = true;
      try {
        domains.value = await $fetch<DomainWithStats[]>(`${baseUrl}/domains`);
      } catch { /* ... */ }
      finally { domainsLoading.value = false; }
    }
    // ... 其他所有 actions（使用 baseUrl 替代硬编码路径）

    return { /* ... */ };
  });
}
```

**startup-map store 重构**：

```typescript
// stores/startup-map.ts

export const useStartupMapStore = defineStore('startup-map', () => {
  // 使用核心层 store
  const base = createSkillLearningStore('startup-map')();

  // startup-map 专有：产品管理
  const activeProduct = ref<SmProduct | null>(null);
  const productLoading = ref(false);
  // ... 产品相关 state + actions

  return {
    ...base,  // 展开核心层所有 state + actions
    // 产品扩展
    activeProduct, productLoading,
    loadActiveProduct, createProduct, updateProduct,
    // ...
  };
});
```

### 3.5 组件提取 & Store 注入

**注入方式**：provide/inject（避免组件与具体 store 耦合）

```typescript
// composables/skill-learning/types.ts
export const SKILL_STORE_KEY: InjectionKey<...> = Symbol('skillStore');

// 在工具根组件中 provide
provide(SKILL_STORE_KEY, store);

// 在共享组件中 inject
const store = inject(SKILL_STORE_KEY)!;
```

**组件迁移清单**：

| 迁移到 `components/skill-learning/` | 保留在 `tools/startup-map/components/` |
|------|------|
| GlobalView, DomainDetail, PointPage | ProductProfile |
| TeachingContent, ChatPanel | ProductList |
| PracticeTasks, TaskItem | ProductSwitcher |
| NoteEditor, LinkedArticles, ArticlePicker | |
| StatusSelector, StatusBadge, SegmentedProgress | |
| StageView, StageTimeline, StageNode, StagePointList | |
| LearningHeatmap, HeatmapGrid, LearningLogList | |
| LearningRecommendation | |

共 22 个组件迁移，3 个保留。

### 3.6 root 组件变更

```vue
<!-- tools/startup-map/StartupMap.vue -->
<template>
  <div class="startupMap">
    <div class="topBar">
      <SkillBreadcrumb />          <!-- 共享组件 -->
      <div class="topBarRight">
        <ProductSwitcher />         <!-- startup-map 专有 -->
        <button @click="store.navigateToProduct()">...</button>
      </div>
    </div>

    <GlobalView v-if="currentView === 'global'" />       <!-- 共享 -->
    <DomainDetail v-else-if="currentView === 'domain'" /> <!-- 共享 -->
    <PointPage v-else-if="currentView === 'point'" />     <!-- 共享 -->
    <ProductProfile v-else-if="currentView === 'product'" /> <!-- 专有 -->
  </div>
</template>

<script setup>
import { SKILL_STORE_KEY } from '~/composables/skill-learning/types';
// 共享组件从 ~/components/skill-learning/ import
// 专有组件从 ./components/ import

const store = useStartupMapStore();
provide(SKILL_STORE_KEY, store);  // 注入给共享组件
</script>
```

## 4. 创建新技能工具的步骤（未来）

完成核心抽取后，创建一个新技能工具（如"编程技能"）只需：

### 4.1 定义种子数据

```typescript
// server/database/seeds/programming.ts
export const SEED_DOMAINS: SeedDomain[] = [
  {
    name: '前端开发',
    description: '现代 Web 前端技术栈',
    topics: [
      {
        name: 'React',
        description: 'React 生态系统',
        points: [
          { name: 'JSX 与组件模型', description: '理解 JSX 语法和组件化思想' },
          { name: 'Hooks 深入', description: 'useState, useEffect, 自定义 Hooks' },
          // ...
        ],
      },
      // ...
    ],
  },
  { name: '后端开发', /* ... */ },
  { name: '系统设计', /* ... */ },
  { name: 'DevOps', /* ... */ },
];

export const SEED_STAGES: SeedStage[] = [
  { name: '基础语法', pointNames: ['JSX 与组件模型', ...] },
  { name: '核心概念', pointNames: ['Hooks 深入', ...] },
  // ...
];
```

### 4.2 编写技能配置

```typescript
// server/lib/skill-learning/skills/programming.ts
registerSkill({
  id: 'programming',
  name: '编程技能',
  buildTeachingPrompt(ctx) {
    return [{
      role: 'system',
      content: `你是一位资深的软件工程导师。请为以下编程知识点生成教学内容：
- 领域：${ctx.domain.name}
- 主题：${ctx.topic.name}
- 知识点：${ctx.point.name}
...（5 个板块）`,
    }, { role: 'user', content: `请为"${ctx.point.name}"生成教学内容。` }];
  },
  buildChatSystemMessage(ctx) {
    return { role: 'system', content: `你是一位编程导师，帮助用户理解 ${ctx.point.name}...` };
  },
  buildTaskPrompt(ctx) { /* 生成编码练习任务 */ },
  teachingSections: [
    { key: 'what', label: '概念' },
    { key: 'how', label: '实现方式' },
    { key: 'example', label: '代码示例' },
    { key: 'apply', label: '实战练习' },
    { key: 'resources', label: '学习资源' },
  ],
  // ...
  seedData: { domains: SEED_DOMAINS, stages: SEED_STAGES },
});
```

### 4.3 注册工具

```typescript
// tools/programming/index.ts
import { Code } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'programming',
  name: '编程技能',
  icon: Code,
  order: 6,
  component: () => import('./Programming.vue'),
  namespaces: ['skills'],
});
```

### 4.4 创建根组件

```vue
<!-- tools/programming/Programming.vue -->
<template>
  <SkillLearningRoot :skill-id="'programming'" />
</template>
```

或者如果需要自定义 UI，参考 startup-map 的 `StartupMap.vue` 模式。

### 4.5 注册 side-effect import

```typescript
// tools/index.ts
import './startup-map';
import './programming';  // 新增
```

```typescript
// server/lib/skill-learning/index.ts
import './skills/startup-map';
import './skills/programming';  // 新增
```

**总计**：新技能工具只需约 4 个文件（种子数据 + 技能配置 + 工具注册 + 根组件）。

## 5. 文件变更总览

### 新建

| 文件 | 用途 |
|------|------|
| `server/lib/skill-learning/types.ts` | SkillConfig 类型 |
| `server/lib/skill-learning/registry.ts` | 技能注册表 |
| `server/lib/skill-learning/db-helpers.ts` | DB 查询辅助 |
| `server/lib/skill-learning/index.ts` | 入口 |
| `server/lib/skill-learning/skills/startup-map.ts` | startup-map 配置 |
| `server/api/skills/[skillId]/...` | 28 个统一路由文件 |
| `composables/skill-learning/types.ts` | 共享前端类型 |
| `composables/skill-learning/useSkillLearningStore.ts` | Store 工厂 |
| `components/skill-learning/...` | 22 个共享组件 |

### 修改

| 文件 | 变更 |
|------|------|
| `server/database/schemas/startup-map.ts` | 3 张表加 `skillId` 列 |
| `stores/startup-map.ts` | 重构为 factory + 产品扩展 |
| `tools/startup-map/types.ts` | re-export 共享类型 |
| `tools/startup-map/StartupMap.vue` | provide store + import 共享组件 |
| `e2e/startup-map.spec.ts` | API URL 更新 |

### 删除

| 文件 | 原因 |
|------|------|
| `server/api/startup-map/` 下 ~25 个路由文件（products/ 除外） | 迁移到统一路由 |
| `tools/startup-map/components/` 下 22 个组件 | 迁移到共享目录 |

**净增**: ~11 个文件（58 创建 - 47 删除）。大部分"创建"实为文件移动。

## 6. 风险与缓解

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| DB 迁移失败 | 中 | 迁移前备份 `cp data/assistant.db data/assistant.db.bak` |
| 跨技能数据泄露 | 高 | 所有查询强制使用 `requirePointForSkill()` 等辅助函数 |
| Store 展开导致 reactivity 丢失 | 中 | 使用 `storeToRefs()` 或直接调用 base store |
| 大量文件重命名导致 import 断裂 | 低 | TypeScript 编译检查 + e2e 测试 |
| smNotes 唯一索引 `(pointId, productId)` 冲突 | 低 | 保留 productId 列不变，核心层传 null |
