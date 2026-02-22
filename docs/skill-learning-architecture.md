# Skill Learning 架构分析与技术方案

## 1. 现有架构分析

### 1.1 组件关系总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 前端 (Client)                                                                │
│                                                                              │
│  plugins/tools.client.ts                                                     │
│       │ import '~/tools'                                                     │
│       ▼                                                                      │
│  tools/index.ts (side-effect imports)                                        │
│       │ import './startup-map'                                               │
│       ▼                                                                      │
│  tools/startup-map/index.ts ── registerTool() ──▶ composables/useToolRegistry│
│       │                              ▲                 (module-level Map)    │
│       ▼                              │                                       │
│  StartupMap.vue ── provide(SKILL_STORE_KEY, store)                           │
│       │                                                                      │
│       ├──▶ stores/startup-map.ts                                             │
│       │       ├── useStartupMapSkillStore = createSkillLearningStore('...')   │
│       │       └── useStartupMapProductStore (独立 Pinia store)               │
│       │                                                                      │
│       └──▶ components/skill-learning/ (22 个共享组件)                        │
│               └── inject(SKILL_STORE_KEY) 获取 store                         │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ 后端 (Server)                                                                │
│                                                                              │
│  server/plugins/skill-learning.ts                                            │
│       │ import '~/server/lib/skill-learning/skills/startup-map'              │
│       ▼                                                                      │
│  server/lib/skill-learning/                                                  │
│       ├── index.ts (公开 API 聚合)                                           │
│       ├── registry.ts (Map<string, SkillConfig> + register/get/require)      │
│       ├── types.ts (SkillConfig 类型定义)                                    │
│       ├── init.ts (ensureSkillsRegistered 动态 import 兜底)                  │
│       ├── db-helpers.ts (resolveSkill + requirePointForSkill)                │
│       └── skills/                                                            │
│           └── startup-map.ts (registerSkill({...}) 调用)                     │
│                                                                              │
│  server/api/skills/[skillId]/ (29 个 API 路由)                               │
│       └── 全部调用 resolveSkill(event) → 返回 { skillId, config }            │
│                                                                              │
│  server/api/startup-map/products/ (6 个产品专属路由)                          │
│                                                                              │
│  server/database/schemas/startup-map.ts (13 个表)                            │
│  server/database/seeds/startup-map.ts (种子数据定义)                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 现有注册流程（详细代码追踪）

#### 后端技能注册

1. **Nitro 插件启动** — `server/plugins/skill-learning.ts:4`
   ```ts
   import '~/server/lib/skill-learning/skills/startup-map';
   ```
   这是纯 side-effect import，触发模块求值。

2. **技能配置注册** — `server/lib/skill-learning/skills/startup-map.ts:21`
   ```ts
   registerSkill({ id: 'startup-map', name: '创业地图', ... });
   ```
   调用 `registry.ts:5` 的 `registerSkill()`，将 `SkillConfig` 存入 module-level `Map`。

3. **运行时兜底** — `server/lib/skill-learning/init.ts:6-17`
   ```ts
   export async function ensureSkillsRegistered(): Promise<void> {
     if (initialized) return;
     initialized = true;
     const mod = await import('./skills/startup-map');
   }
   ```
   防止 Nitro tree-shaking 导致 side-effect import 被移除。

4. **API 请求解析** — `server/lib/skill-learning/db-helpers.ts:10-18`
   ```ts
   export async function resolveSkill(event) {
     await ensureSkillsRegistered();  // 确保注册完成
     const skillId = getRouterParam(event, 'skillId');
     const config = requireSkill(skillId);  // 从 Map 中查找
     return { skillId, config };
   }
   ```

**关键问题**: 每个 API handler 都通过 `resolveSkill()` 获取 `config`，然后使用 `config.buildTeachingPrompt()` / `config.buildChatSystemMessage()` / `config.buildTaskPrompt()` 构建 AI 提示。这些函数目前是 TypeScript 代码，无法在 DB 中存储。

#### 前端工具注册

1. **Nuxt 插件启动** — `plugins/tools.client.ts:1`
   ```ts
   import '~/tools';  // → tools/index.ts
   ```

2. **Side-effect 注册** — `tools/index.ts`
   ```ts
   import './startup-map';  // → tools/startup-map/index.ts
   ```

3. **工具定义** — `tools/startup-map/index.ts:4-11`
   ```ts
   registerTool({
     id: 'startup-map', name: '创业地图',
     icon: Map,  // Lucide 图标组件
     order: 5,
     component: () => import('./StartupMap.vue'),
     namespaces: ['startup-map'],
   });
   ```
   存入 `composables/useToolRegistry.ts:3` 的 module-level `Map<string, ToolDefinition>`。

4. **路由渲染** — `pages/[...slug].vue:21-24`
   ```ts
   const currentTool = computed(() => get(toolId.value));
   const toolComponent = computed(() =>
     currentTool.value ? defineAsyncComponent(currentTool.value.component) : null
   );
   ```

**关键问题**: `ToolDefinition.icon` 是 Vue 组件引用，`component` 是 lazy import 函数。动态工具需要在运行时构建这些。

### 1.3 数据流分析

#### AI 教学内容生成流程

```
Client                          Server
  │                               │
  │ POST /api/skills/{id}/        │
  │   points/{id}/teaching        │
  │──────────────────────────────▶│
  │                               ├─ resolveSkill(event)
  │                               │   ├─ ensureSkillsRegistered()
  │                               │   └─ requireSkill(skillId) → config
  │                               │
  │                               ├─ requirePointForSkill(db, id, skillId)
  │                               │   └─ 验证 point→topic→domain.skillId 链
  │                               │
  │                               ├─ config.resolveExtraContext?.(db, ctx)
  │                               │   └─ startup-map: 查询 active product
  │                               │
  │                               ├─ config.buildTeachingPrompt(ctx)
  │                               │   └─ 构建 system + user messages
  │                               │
  │                               ├─ provider.chatStream(messages, opts)
  │  SSE: { type:'chunk', ... }   │   │
  │◀──────────────────────────────│   │ 逐块返回
  │  SSE: { type:'done', ... }    │   │
  │◀──────────────────────────────│   └─ 保存到 sm_teachings 表
```

#### 数据隔离机制

- `sm_domains.skillId` 和 `sm_stages.skillId` — 根表级别隔离
- `sm_activities.skillId` — 活动记录隔离
- 子表 (topics, points, teachings, chats, tasks, notes) 通过 FK 级联隔离
- `requirePointForSkill()` 在每次请求时验证 point→topic→domain.skillId 链

### 1.4 SkillConfig 接口分析

当前 `SkillConfig` (`server/lib/skill-learning/types.ts:19-43`) 包含:

| 字段 | 类型 | 可模板化 | 说明 |
|------|------|---------|------|
| `id` | string | DB字段 | URL slug |
| `name` | string | DB字段 | 显示名称 |
| `buildTeachingPrompt` | function | **需模板化** | 构建教学 AI 提示 |
| `buildChatSystemMessage` | function | **需模板化** | 构建聊天 AI 系统消息 |
| `buildTaskPrompt` | function | **需模板化** | 构建任务生成 AI 提示 |
| `teachingSections` | TeachingSection[] | **通用默认** | 5 个固定 section |
| `statusLabels` | Record | **通用默认** | 4 个状态标签 |
| `activityTypeLabels` | Record | **通用默认** | 5 个活动类型标签 |
| `resolveExtraContext` | function? | **移除** | 仅 startup-map 使用（查产品） |
| `seedData` | object | **运行时传入** | 种子数据 |

**核心发现**: 3 个 prompt builder 函数是迁移的核心挑战。它们需要从代码函数转为 DB 存储的模板字符串。

---

## 2. 目标架构设计

### 2.1 架构变更概览

```
当前: 代码定义 SkillConfig → Map 注册 → API handler 调用
目标: DB 存储 skill_configs → 模板引擎渲染 → API handler 调用

当前: 静态 tool import → registerTool()
目标: 静态工具 + 动态 fetch skill_configs → registerTool()
```

### 2.2 新增 `skill_configs` 表 Schema

```
skill_configs:
  id              INTEGER PK autoIncrement
  skillId         TEXT UNIQUE NOT NULL     -- URL slug
  name            TEXT NOT NULL            -- 显示名称
  description     TEXT                     -- 技能描述
  icon            TEXT DEFAULT 'BookOpen'  -- Lucide 图标名
  teachingSystemPrompt  TEXT NOT NULL      -- {{variable}} 模板
  teachingUserPrompt    TEXT NOT NULL
  chatSystemPrompt      TEXT NOT NULL
  taskSystemPrompt      TEXT NOT NULL
  taskUserPrompt        TEXT NOT NULL
  sortOrder       INTEGER DEFAULT 100
  isActive        BOOLEAN DEFAULT true
  createdAt       INTEGER NOT NULL
  updatedAt       INTEGER NOT NULL
```

#### Schema 评审意见

**推荐采纳的设计**:
- `skillId` 使用 `UNIQUE` 约束作为业务键，`id` 作为自增 PK — 正确。所有 `sm_*` 表的 `skillId` 列引用的是这个 TEXT 值，不需要 FK 关联（轻量级）
- prompt 字段分为 5 个独立列而非 JSON — 正确，便于单独编辑和验证
- `isActive` 控制是否在前端显示 — 允许"软删除"或暂时隐藏

**需要关注的点**:
1. `icon` 存储 Lucide 图标名（字符串），前端需要一个 `iconName → Component` 的映射表。建议在前端维护一个包含 ~30 个精选图标的 Map
2. `sortOrder` 控制前端侧栏排序，需要与现有静态工具的 `order` 协调（静态工具 order 1-4，技能工具默认 100 起）
3. 不需要 `teachingSections` / `statusLabels` / `activityTypeLabels` 列 — 这些是通用默认值，所有技能共享

---

## 3. 迁移方案（从代码定义到 DB 驱动）

### 3.1 Phase 1: DB Schema + 模板引擎

#### Step 1.1: 创建 `skill_configs` 表

**文件**: `server/database/schemas/skill-configs.ts` (新建)

```ts
export const skillConfigs = sqliteTable('skill_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: text('skill_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').notNull().default('BookOpen'),
  teachingSystemPrompt: text('teaching_system_prompt').notNull(),
  teachingUserPrompt: text('teaching_user_prompt').notNull(),
  chatSystemPrompt: text('chat_system_prompt').notNull(),
  taskSystemPrompt: text('task_system_prompt').notNull(),
  taskUserPrompt: text('task_user_prompt').notNull(),
  sortOrder: integer('sort_order').notNull().default(100),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});
```

**修改**: `server/database/schema.ts` — 添加 `export * from './schemas/skill-configs';`

**执行**: `npm run db:generate && npm run db:migrate`

#### Step 1.2: 实现模板渲染引擎

**文件**: `server/lib/skill-learning/template.ts` (新建)

```ts
/**
 * 简单的 {{path.to.var}} 模板引擎。
 * 变量范围:
 *   skill.name, skill.description
 *   domain.name, topic.name
 *   point.name, point.description
 *   teachingSummary (仅 chat 模板)
 */
export function renderTemplate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], vars);
    return value != null ? String(value) : '';
  });
}
```

**技术要点**:
- 仅支持点号分隔路径，不支持条件/循环（复杂度控制）
- 未定义变量渲染为空字符串（安全默认行为）
- 无需 XSS 防护（模板输出直接送 LLM，不渲染为 HTML）

**与现有 startup-map prompt 的对比**:

当前 `skills/startup-map.ts:32-53` 的 teaching prompt 使用字符串插值:
```ts
content: `...${ctx.domain.name}...${ctx.topic.name}...${ctx.point.name}...`
```

转为模板后:
```
...{{domain.name}}...{{topic.name}}...{{point.name}}...
```

**需要特殊处理的变量**:
- `resolveExtraContext` 中的 `product` 数据 — 这是 startup-map 专有的。在通用系统中移除此机制。startup-map 迁移后，产品相关信息从 prompt 模板中移除（产品功能不在通用技能系统中）

#### Step 1.3: 重写 `resolveSkill()` 使用 DB 查询

**文件**: `server/lib/skill-learning/db-helpers.ts` (修改)

当前 `resolveSkill()` 流程:
```ts
// 当前 (db-helpers.ts:10-18)
await ensureSkillsRegistered();          // 确保 Map 已注册
const config = requireSkill(skillId);     // 从 Map 查找
```

改为:
```ts
// 目标
const db = useDB();
const [row] = await db.select().from(skillConfigs)
  .where(eq(skillConfigs.skillId, skillId))
  .limit(1);
if (!row) throw createError({ statusCode: 404, message: `技能 '${skillId}' 不存在` });
const config = buildSkillConfigFromDb(row);
return { skillId, config };
```

新增 `buildSkillConfigFromDb()` 函数:
```ts
function buildSkillConfigFromDb(row: typeof skillConfigs.$inferSelect): SkillConfig {
  return {
    id: row.skillId,
    name: row.name,
    buildTeachingPrompt(ctx) {
      const vars = { skill: { name: row.name, description: row.description },
                     domain: ctx.domain, topic: ctx.topic, point: ctx.point };
      return [
        { role: 'system', content: renderTemplate(row.teachingSystemPrompt, vars) },
        { role: 'user', content: renderTemplate(row.teachingUserPrompt, vars) },
      ];
    },
    buildChatSystemMessage(ctx) {
      const vars = { ...上述, teachingSummary: ctx.teachingSummary };
      return { role: 'system', content: renderTemplate(row.chatSystemPrompt, vars) };
    },
    buildTaskPrompt(ctx) {
      const vars = { ...同上 };
      return [
        { role: 'system', content: renderTemplate(row.taskSystemPrompt, vars) },
        { role: 'user', content: renderTemplate(row.taskUserPrompt, vars) },
      ];
    },
    teachingSections: DEFAULT_TEACHING_SECTIONS,
    statusLabels: DEFAULT_STATUS_LABELS,
    activityTypeLabels: DEFAULT_ACTIVITY_LABELS,
    seedData: { domains: [], stages: [] },  // 不再从代码提供
  };
}
```

**影响范围**: 所有 29 个 API handler 调用 `resolveSkill(event)` 返回的 `config` 接口不变，因此 **下游无需修改**。这是迁移的关键设计优势。

**性能考虑**: 每次 API 请求都查 DB 一次（select by unique index），SQLite WAL 模式下 < 1ms，可接受。如需优化可添加内存缓存（LRU，TTL 1分钟）。

#### Step 1.4: Startup-map seed 脚本

**文件**: `server/database/seeds/startup-map-config.ts` (新建)

从 `server/lib/skill-learning/skills/startup-map.ts` 提取 prompt 模板，将字符串插值 `${ctx.xxx}` 替换为 `{{xxx}}`。

**注意**: 当前 startup-map 的 prompt 包含产品上下文逻辑（条件判断）:
```ts
// startup-map.ts:46
`4. **我的应用 (Apply)** — ${product ? '结合学习者的产品，' : ''}提出引导思考问题`
```

迁移方案: 模板中移除产品条件分支，使用通用文案:
```
4. **我的应用 (Apply)** — 提出 2-3 个引导思考问题
```

这是合理的简化。产品上下文是 startup-map 的特殊功能，通用系统不需要。

#### Step 1.5: 删除代码定义的 skill 系统

**删除文件清单**:

| 文件 | 当前作用 | 删除原因 |
|------|---------|---------|
| `server/lib/skill-learning/skills/startup-map.ts` | `registerSkill()` 代码注册 | 迁移到 DB |
| `server/lib/skill-learning/registry.ts` | `Map<string, SkillConfig>` + CRUD | 被 DB 查询取代 |
| `server/lib/skill-learning/init.ts` | `ensureSkillsRegistered()` | 不再需要 |
| `server/plugins/skill-learning.ts` | side-effect import 保障 | 不再需要 |

**修改文件**:

| 文件 | 修改内容 |
|------|---------|
| `server/lib/skill-learning/index.ts` | 移除 registry exports，只导出 DB helpers |
| `server/lib/skill-learning/types.ts` | `SkillConfig` 可保留（供 `buildSkillConfigFromDb` 返回值类型用），但移除 `seedData`、`resolveExtraContext` 字段 |

### 3.2 Phase 2: API Endpoints

#### 2.1: Skill Config CRUD API

**路由设计**:

| 方法 | 路由 | 文件 | 说明 |
|------|------|------|------|
| GET | `/api/skill-configs` | `index.get.ts` | 列表（返回所有 active 配置） |
| POST | `/api/skill-configs` | `index.post.ts` | 创建新技能 |
| GET | `/api/skill-configs/[id]` | `[id].get.ts` | 获取单个（by id） |
| PUT | `/api/skill-configs/[id]` | `[id].put.ts` | 更新配置 |
| DELETE | `/api/skill-configs/[id]` | `[id].delete.ts` | 删除（级联清理 sm_* 数据） |
| POST | `/api/skill-configs/seed` | `seed.post.ts` | 内置配置种子数据 |

**DELETE 级联清理逻辑**:
```ts
// 需要清理的表（通过 skillId 关联）:
// 1. sm_domains WHERE skillId = ? → 级联删除 topics, points, teachings, chats, tasks, notes, point_articles
// 2. sm_stages WHERE skillId = ? → 级联删除 stage_points
// 3. sm_activities WHERE skillId = ?
// 4. skill_configs WHERE id = ?
```

**验证规则**:
- `skillId`: 必须是有效 URL slug (`/^[a-z0-9-]+$/`)，且唯一
- `name`: 非空
- prompt 字段: 非空
- 创建时检查 `skillId` 不与现有 skill 冲突

#### 2.2: AI 知识树生成 API

**路由**: `POST /api/skill-configs/generate-tree`

**输入**: `{ name: string, description: string }`

**输出**: `{ domains: SeedDomain[], stages: SeedStage[] }`

**实现**: 调用 LLM 生成结构化 JSON，prompt 要求输出与 `SeedDomain[]` / `SeedStage[]` 匹配的格式。

#### 2.3: 修改 seed 端点支持 body 数据

**文件**: `server/api/skills/[skillId]/seed.post.ts` (修改)

当前 `seed.post.ts:16`:
```ts
const { domains: seedDomains, stages: seedStages } = config.seedData;
```

修改为:
```ts
const body = await readBody(event);
const seedDomains = body?.domains;
const seedStages = body?.stages;
if (!seedDomains || !seedStages) {
  throw createError({ statusCode: 400, message: '请提供 domains 和 stages 数据' });
}
```

这样 wizard 创建技能时可以 POST 知识树数据。

### 3.3 Phase 3: 前端 — 通用组件 + 动态注册

#### 3.1: GenericSkillTool.vue

**文件**: `tools/skill-learning/GenericSkillTool.vue` (新建)

```vue
<script setup lang="ts">
const props = defineProps<{ skillId: string }>();
const store = createSkillLearningStore(props.skillId)();
provide(SKILL_STORE_KEY, store);
onMounted(() => store.loadDomains());
</script>

<template>
  <div class="skillTool">
    <nav class="breadcrumb">...</nav>
    <GlobalView v-if="store.currentView === 'global'" />
    <DomainDetail v-else-if="store.currentView === 'domain'" />
    <PointPage v-else-if="store.currentView === 'point'" />
  </div>
</template>
```

**与现有 StartupMap.vue 的差异**:
- 移除产品相关功能（ProductSwitcher, ProductProfile, productStore）
- 移除 `currentView === 'product'` 分支
- PointPage 不再传 `product-id` prop

**对共享组件的影响**: 22 个 `components/skill-learning/*.vue` 组件通过 `inject(SKILL_STORE_KEY)` 获取 store，**无需修改**。这是现有架构的最大优势。

#### 3.2: 动态工具注册

**文件**: `plugins/tools.client.ts` (修改)

```ts
import '~/tools';  // 静态工具（habit-tracker, vocab-tracker, etc.）

export default defineNuxtPlugin(async () => {
  // 登录后动态注册技能工具
  await registerSkillTools();
});

async function registerSkillTools() {
  const token = localStorage.getItem('auth_token');
  if (!token) return;

  const configs = await $fetch('/api/skill-configs', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { registerTool } = useToolRegistry();
  for (const config of configs) {
    registerTool({
      id: config.skillId,
      name: config.name,
      icon: resolveIcon(config.icon),  // Lucide 名称 → 组件
      order: config.sortOrder,
      component: () => import('~/tools/skill-learning/GenericSkillTool.vue'),
      namespaces: [config.skillId],
      // 传入 skillId 作为 props
      props: { skillId: config.skillId },
    });
  }
}
```

**需要修改 `ToolDefinition` 类型** (`types/index.ts`):
```ts
export interface ToolDefinition {
  id: string;
  name: string;
  icon: Component;
  order: number;
  component: () => Promise<Component>;
  namespaces: string[];
  props?: Record<string, any>;  // ← 新增
}
```

**需要修改 `pages/[...slug].vue`** 传递 props:
```ts
const toolComponent = computed(() =>
  currentTool.value
    ? defineAsyncComponent(currentTool.value.component)
    : null
);
// 需要将 currentTool.value.props 传入 <component :is="..." v-bind="currentTool.props" />
```

**图标映射**: 维护 `utils/icon-map.ts`:
```ts
import { BookOpen, Map, Code, Music, ... } from 'lucide-vue-next';
const ICON_MAP: Record<string, Component> = { BookOpen, Map, Code, ... };
export function resolveIcon(name: string): Component { return ICON_MAP[name] || BookOpen; }
```

#### 3.3: 删除 startup-map 前端文件

**删除清单**:

| 文件/目录 | 原因 |
|----------|------|
| `tools/startup-map/` (整个目录) | 被 GenericSkillTool 取代 |
| `stores/startup-map.ts` | 产品 store 不再需要 |
| `server/api/startup-map/` (整个目录, 6 文件) | 产品 API 移除 |

**修改清单**:

| 文件 | 修改 |
|------|------|
| `tools/index.ts` | 移除 `import './startup-map'`，添加 `import './skill-manager'` |

### 3.4 Phase 4: 技能管理 UI

#### 4.1: SkillManager 工具

**新建目录**: `tools/skill-manager/`

```
tools/skill-manager/
  ├── index.ts              (registerTool, 静态注册)
  ├── SkillManager.vue      (根组件: 列表 + 创建入口)
  └── components/
      ├── SkillList.vue     (技能网格, 编辑/删除)
      ├── SkillWizard.vue   (3 步创建向导)
      ├── TreeEditor.vue    (知识树编辑器)
      ├── PromptEditor.vue  (模板编辑器, {{variable}} chips)
      └── IconPicker.vue    (图标选择器)
```

#### 4.2: 向导流程

```
Step 1: 基础信息        Step 2: 知识树          Step 3: 提示词模板
┌─────────────────┐   ┌─────────────────┐    ┌─────────────────┐
│ 名称: ____      │   │ [AI生成知识树]  │    │ 教学系统提示:   │
│ 描述: ____      │   │                 │    │ ┌─────────────┐ │
│ 图标: [选择]    │   │ ▸ 领域1         │    │ │ {{domain}}  │ │
│                 │   │   ▸ 主题1.1     │    │ │ ...模板...  │ │
│ [AI 生成知识树] │   │     · 知识点    │    │ └─────────────┘ │
│                 │   │   ▸ 主题1.2     │    │                 │
│                 │   │ ▸ 领域2         │    │ [变量芯片]      │
│                 │   │ ---阶段---      │    │ {{point.name}}  │
│                 │   │ 阶段1: [知识点] │    │ {{domain.name}} │
└────────[下一步]─┘   └────────[下一步]─┘    └────────[保存]───┘
```

---

## 4. 模板引擎技术方案

### 4.1 模板语法

```
{{variable}}              简单变量替换
{{path.to.variable}}      嵌套路径
```

### 4.2 可用变量

| 变量 | 类型 | 适用模板 | 说明 |
|------|------|---------|------|
| `skill.name` | string | 全部 | 技能名称 |
| `skill.description` | string | 全部 | 技能描述 |
| `domain.name` | string | 全部 | 所属领域名称 |
| `topic.name` | string | 全部 | 所属主题名称 |
| `point.name` | string | 全部 | 知识点名称 |
| `point.description` | string | 全部 | 知识点描述 |
| `teachingSummary` | string | 仅 chatSystemPrompt | 教学内容摘要 |

### 4.3 模板示例（startup-map 迁移）

**teachingSystemPrompt** (从 `skills/startup-map.ts:32-54` 提取):
```
你是一位资深的{{skill.name}}导师和教育专家。你正在为一个学习平台生成教学内容。

你需要为以下知识点生成教学内容：
- 所属领域：{{domain.name}}
- 所属主题：{{topic.name}}
- 知识点：{{point.name}}
- 简介：{{point.description}}

请按以下 5 个板块生成内容，每个板块使用 Markdown 格式。板块之间必须用 "---SECTION_BREAK---" 分隔（单独一行）：

1. **是什么 (What)** — 概念定义，重要性
2. **怎么做 (How)** — 通用方法论、执行步骤、框架和工具
3. **案例 (Example)** — 1-2 个真实案例
4. **我的应用 (Apply)** — 提出 2-3 个引导思考问题
5. **推荐资源 (Resources)** — 推荐书籍、网站、工具、课程

要求：
- 内容深入实用，不要泛泛而谈
- 每个板块 300-800 字
- 直接输出内容，不要重复板块标题
```

**teachingUserPrompt**:
```
请为"{{point.name}}"生成教学内容。
```

### 4.4 实现注意事项

1. **SECTION_BREAK 协议**: `---SECTION_BREAK---` 是固定协议，写死在 `teachingSystemPrompt` 模板中而非代码中。新技能的模板也必须包含这个分隔符，否则 SSE 解析会失败。
   - **建议**: 在 API 创建/更新时验证 `teachingSystemPrompt` 包含 `SECTION_BREAK` 关键字
   - **替代方案**: 在 prompt 中注入 SECTION_BREAK 指令（代码自动追加），模板只定义内容部分

2. **模板验证**: 创建/更新 skill config 时，检查模板中的 `{{xxx}}` 变量名是否在已知变量列表中。未知变量发出警告但不阻止保存。

---

## 5. 动态工具注册机制

### 5.1 注册时机

```
页面加载
  │
  ├─ plugins/tools.client.ts
  │    ├─ import '~/tools' (静态工具注册: habit-tracker, vocab-tracker, etc.)
  │    └─ registerSkillTools()
  │         ├─ 检查 auth_token
  │         ├─ fetch GET /api/skill-configs
  │         └─ 遍历 configs → registerTool(...)
  │
  └─ 登录成功后 (composables/useAuth.ts)
       └─ 重新调用 registerSkillTools() 刷新工具列表
```

### 5.2 工具刷新策略

- **初始加载**: 已登录用户直接获取并注册
- **登录后**: 登录成功回调中调用注册
- **创建新技能后**: SkillWizard 保存成功后调用注册，刷新侧栏
- **删除技能后**: 从 registry Map 中移除 + 导航到其他工具

### 5.3 需要对 `useToolRegistry` 做的修改

当前 `composables/useToolRegistry.ts` 只有 `register`，需要添加 `unregister`:

```ts
function unregister(id: string): boolean {
  return tools.delete(id);
}
```

并且 sidebar (`AppSidebar.vue`) 需要对工具列表响应式更新。当前 `getAll()` 每次调用都从 Map 生成新数组，如果 sidebar 在 `onMounted` 时缓存了列表，新注册的工具不会出现。需要确认 sidebar 实现是否响应式。

---

## 6. API 设计评审

### 6.1 现有 skill API (保留)

29 个路由在 `server/api/skills/[skillId]/` 下，全部通过 `resolveSkill(event)` 获取 config。迁移后 `resolveSkill()` 改为 DB 查询，**接口完全兼容，无需修改**。

### 6.2 新增 skill-configs API

| 方法 | 路由 | 请求体 | 响应 |
|------|------|--------|------|
| GET | `/api/skill-configs` | - | `SkillConfigRow[]` |
| POST | `/api/skill-configs` | `{ skillId, name, description?, icon?, ...prompts, sortOrder? }` | `SkillConfigRow` |
| GET | `/api/skill-configs/[id]` | - | `SkillConfigRow` |
| PUT | `/api/skill-configs/[id]` | partial fields | `SkillConfigRow` |
| DELETE | `/api/skill-configs/[id]` | - | `{ success: true }` |
| POST | `/api/skill-configs/seed` | - | `{ success, created: string[] }` |
| POST | `/api/skill-configs/generate-tree` | `{ name, description }` | `{ domains, stages }` |

### 6.3 seed.post.ts 修改评审

当前 `seed.post.ts` 从 `config.seedData` 读取数据。改为从 request body 读取后:

- 向导创建技能: POST body 包含 AI 生成的 domains/stages
- "导入知识树" 按钮: 前端需要知道种子数据 → 两种方案:
  1. 内置种子数据存在前端（不推荐，数据量大）
  2. **推荐**: seed 端点保留对内置数据的支持 — 如果 body 为空则查 `skill_configs` 表关联的种子文件
  3. 或者: 创建技能时直接写入 `sm_*` 表，"导入知识树" 按钮不再需要（简化）

**推荐方案**: seed 端点接受 body 数据（wizard 使用），startup-map 的初始种子通过 `POST /api/skill-configs/seed` 自动完成。

---

## 7. 风险点与缓解措施

### 7.1 高风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| **resolveSkill() 重写导致所有 API 失败** | 所有 29 个 skill API 不可用 | 保持返回类型不变；写好测试后再切换；可保留旧 registry 作为 fallback |
| **SECTION_BREAK 协议与模板解耦** | 教学内容 SSE 解析失败 | 在代码中强制注入 SECTION_BREAK 指令，或在 API 验证时检查 |
| **startup-map 产品功能丢失** | 用户已有的产品数据不可用 | 产品功能是 startup-map 专有的，迁移后需明确告知用户；保留 sm_products 表和数据，只是 UI 入口移除 |

### 7.2 中等风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| **前端动态注册时机** | 工具列表闪烁或空白 | fetch 在 plugin 阶段同步完成（await），确保渲染前就绑有工具 |
| **模板变量拼写错误** | AI prompt 中出现 `{{undefined}}` | 模板编辑器提供变量 chips（点击插入），减少手动输入 |
| **Lucide 图标映射不全** | 显示空白图标 | 提供 fallback 图标 (BookOpen)；IconPicker 只展示已映射的图标 |

### 7.3 低风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| **DB 查询性能** | 每次 API 调用多一次 SELECT | SQLite unique index 查询 < 1ms，可忽略 |
| **种子数据冲突** | 重复创建技能配置 | `skillId` 的 UNIQUE 约束 + 幂等 seed 逻辑 |

---

## 8. 与现有代码的兼容性分析

### 8.1 完全兼容（无需修改）

| 组件 | 原因 |
|------|------|
| `components/skill-learning/` (22 个组件) | 通过 `inject(SKILL_STORE_KEY)` 获取 store，不依赖具体 skill 实现 |
| `composables/skill-learning/useSkillLearningStore.ts` | 纯 factory 函数，参数只需 `skillId` 字符串 |
| `composables/skill-learning/types.ts` | 纯类型定义，不依赖后端实现 |
| `server/api/skills/[skillId]/*` (29 个 API) | 只依赖 `resolveSkill()` 的返回类型，不关心实现 |
| `server/database/schemas/startup-map.ts` | 数据表不变 |

### 8.2 需要修改

| 文件 | 修改内容 | 复杂度 |
|------|---------|--------|
| `server/lib/skill-learning/db-helpers.ts` | 重写 `resolveSkill()` | 中 |
| `server/lib/skill-learning/index.ts` | 移除旧 registry exports | 低 |
| `server/lib/skill-learning/types.ts` | 简化 `SkillConfig`（移除 seedData, resolveExtraContext） | 低 |
| `server/api/skills/[skillId]/seed.post.ts` | 从 body 读取种子数据 | 低 |
| `plugins/tools.client.ts` | 添加动态注册逻辑 | 中 |
| `tools/index.ts` | 移除 startup-map，添加 skill-manager | 低 |
| `types/index.ts` | `ToolDefinition` 添加 `props` 字段 | 低 |
| `pages/[...slug].vue` | 传递 tool props 到组件 | 低 |
| `server/database/schema.ts` | 添加 skill-configs export | 低 |

### 8.3 需要删除

| 文件/目录 | 行数 | 影响 |
|----------|------|------|
| `server/lib/skill-learning/registry.ts` | 23 行 | 被 DB 查询取代 |
| `server/lib/skill-learning/init.ts` | 17 行 | 不再需要 |
| `server/lib/skill-learning/skills/startup-map.ts` | 172 行 | 迁移到 DB |
| `server/plugins/skill-learning.ts` | 8 行 | 不再需要 |
| `tools/startup-map/` | ~200 行 Vue + 12 行 TS | 被 GenericSkillTool 取代 |
| `stores/startup-map.ts` | 87 行 | 产品 store 移除 |
| `server/api/startup-map/products/` | ~6 个文件 | 产品 API 移除 |

### 8.4 E2E 测试影响

现有 `e2e/startup-map.spec.ts`（如果存在）需要更新路径和流程。新增测试:
- Skill config CRUD API 测试
- AI 知识树生成 API 测试
- 动态工具注册 E2E 测试
- 技能管理 UI 测试

---

## 9. 实施顺序建议

```
Phase 1 (后端核心)
  1.1 创建 skill_configs 表 ← 无依赖
  1.2 实现模板引擎 ← 无依赖
  1.3 重写 resolveSkill() ← 依赖 1.1 + 1.2
  1.4 startup-map seed 脚本 ← 依赖 1.1
  1.5 删除代码定义系统 ← 依赖 1.3 + 1.4

Phase 2 (API 扩展)
  2.1 Skill config CRUD ← 依赖 1.1
  2.2 AI 知识树生成 ← 依赖 1.1
  2.3 修改 seed 端点 ← 依赖 1.3

Phase 3 (前端核心)
  3.1 GenericSkillTool.vue ← 依赖 1.5
  3.2 动态工具注册 ← 依赖 2.1 + 3.1
  3.3 删除 startup-map 前端 ← 依赖 3.1 + 3.2

Phase 4 (管理 UI)
  4.1 SkillManager + SkillList ← 依赖 2.1 + 3.1
  4.2 SkillWizard ← 依赖 2.2 + 4.1
```

**关键里程碑**:
- Phase 1.3 完成后: startup-map 通过 DB 驱动运行（回归测试点）
- Phase 3.2 完成后: startup-map 通过 GenericSkillTool 渲染（回归测试点）
- Phase 4.2 完成后: 可通过 UI 创建新技能（功能完整）
