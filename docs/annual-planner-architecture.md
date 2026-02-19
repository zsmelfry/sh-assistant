# 年度计划工具 — 架构设计

## 1. 数据库设计

### 1.1 ID 策略

本项目存在两种 ID 策略：
- **UUID（text PK）**：习惯打卡模块（habits, checkins）使用，由应用层 `crypto.randomUUID()` 生成
- **自增整数（integer PK）**：词汇模块所有表使用 `autoIncrement: true`

**年度计划采用自增整数 ID**。理由：
1. 年度计划数据量有限（几十个领域/目标），无需 UUID 的分布式优势
2. 与项目中数量更多的表（vocab 系列、srs 系列、llm）保持一致
3. 排序更新时整数 ID 更易调试

### 1.2 表定义

所有表定义在 `server/database/schemas/planner.ts`，并在 `server/database/schema.ts` 中 re-export。

#### `planner_domains`（领域）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | integer | PK, autoIncrement | |
| `name` | text | NOT NULL | 领域名称（如事业、财务） |
| `sort_order` | integer | NOT NULL, default 0 | 排序权重，值越小越靠前 |
| `created_at` | integer | NOT NULL | Unix ms 时间戳 |
| `updated_at` | integer | NOT NULL | Unix ms 时间戳 |

索引：
- `idx_planner_domains_sort` on (`sort_order`)

```ts
export const plannerDomains = sqliteTable('planner_domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_planner_domains_sort').on(table.sortOrder),
]);
```

#### `planner_goals`（目标）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | integer | PK, autoIncrement | |
| `domain_id` | integer | NOT NULL, FK → planner_domains.id ON DELETE CASCADE | 所属领域 |
| `title` | text | NOT NULL | 目标标题 |
| `description` | text | default '' | 目标描述（选填） |
| `priority` | text | NOT NULL, default 'medium' | 枚举：'high' / 'medium' / 'low' |
| `sort_order` | integer | NOT NULL, default 0 | 领域内排序权重 |
| `created_at` | integer | NOT NULL | Unix ms 时间戳 |
| `updated_at` | integer | NOT NULL | Unix ms 时间戳 |

索引：
- `idx_planner_goals_domain` on (`domain_id`)
- `idx_planner_goals_sort` on (`domain_id`, `sort_order`)

```ts
export const plannerGoals = sqliteTable('planner_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull()
    .references(() => plannerDomains.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority', { enum: ['high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_planner_goals_domain').on(table.domainId),
  index('idx_planner_goals_sort').on(table.domainId, table.sortOrder),
]);
```

#### `planner_checkitems`（检查项）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | integer | PK, autoIncrement | |
| `goal_id` | integer | NOT NULL, FK → planner_goals.id ON DELETE CASCADE | 所属目标 |
| `content` | text | NOT NULL | 检查项内容 |
| `is_completed` | integer(boolean) | NOT NULL, default false | 是否完成 |
| `completed_at` | integer | nullable | 完成时间（Unix ms），取消勾选时置 NULL |
| `sort_order` | integer | NOT NULL, default 0 | 目标内排序权重 |
| `created_at` | integer | NOT NULL | Unix ms 时间戳 |
| `updated_at` | integer | NOT NULL | Unix ms 时间戳 |

索引：
- `idx_planner_checkitems_goal` on (`goal_id`)
- `idx_planner_checkitems_sort` on (`goal_id`, `sort_order`)
- `idx_planner_checkitems_completed_at` on (`completed_at`) — 用于停滞检测查询

```ts
export const plannerCheckitems = sqliteTable('planner_checkitems', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goal_id').notNull()
    .references(() => plannerGoals.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: integer('completed_at', { mode: 'number' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_planner_checkitems_goal').on(table.goalId),
  index('idx_planner_checkitems_sort').on(table.goalId, table.sortOrder),
  index('idx_planner_checkitems_completed_at').on(table.completedAt),
]);
```

#### `planner_tags`（标签）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | integer | PK, autoIncrement | |
| `name` | text | NOT NULL, UNIQUE | 标签名称（如法语、管理） |
| `created_at` | integer | NOT NULL | Unix ms 时间戳 |

索引：
- `idx_planner_tags_name` unique on (`name`)

```ts
export const plannerTags = sqliteTable('planner_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_planner_tags_name').on(table.name),
]);
```

#### `planner_goal_tags`（目标-标签关联）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `goal_id` | integer | NOT NULL, FK → planner_goals.id ON DELETE CASCADE | |
| `tag_id` | integer | NOT NULL, FK → planner_tags.id ON DELETE CASCADE | |

索引：
- `idx_planner_goal_tags_pk` unique on (`goal_id`, `tag_id`) — 复合主键替代
- `idx_planner_goal_tags_tag` on (`tag_id`) — 支持"按标签查目标"查询

```ts
export const plannerGoalTags = sqliteTable('planner_goal_tags', {
  goalId: integer('goal_id').notNull()
    .references(() => plannerGoals.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull()
    .references(() => plannerTags.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_planner_goal_tags_pk').on(table.goalId, table.tagId),
  index('idx_planner_goal_tags_tag').on(table.tagId),
]);
```

### 1.3 级联删除策略

- 删除 `domain` → 级联删除其下所有 `goals` → 级联删除 `checkitems` 和 `goal_tags`
- 删除 `goal` → 级联删除其下所有 `checkitems` 和 `goal_tags`
- 删除 `tag` → 级联删除 `goal_tags` 中的关联行（不影响目标本身）

均由数据库外键 `ON DELETE CASCADE` 处理，无需应用层手动级联。

### 1.4 类型导出

```ts
// 类型推导
export type PlannerDomain = typeof plannerDomains.$inferSelect;
export type NewPlannerDomain = typeof plannerDomains.$inferInsert;
export type PlannerGoal = typeof plannerGoals.$inferSelect;
export type NewPlannerGoal = typeof plannerGoals.$inferInsert;
export type PlannerCheckitem = typeof plannerCheckitems.$inferSelect;
export type NewPlannerCheckitem = typeof plannerCheckitems.$inferInsert;
export type PlannerTag = typeof plannerTags.$inferSelect;
export type NewPlannerTag = typeof plannerTags.$inferInsert;
export type PlannerGoalTag = typeof plannerGoalTags.$inferSelect;
```

### 1.5 `_test/reset` 更新

需在 `server/api/_test/reset.post.ts` 中追加清理（注意顺序，先子表后父表）：

```
planner_goal_tags → planner_checkitems → planner_goals → planner_domains → planner_tags
```

---

## 2. API 路由设计

所有路由位于 `server/api/planner/`，遵循 Nuxt file-based routing 命名规范（`method` 后缀）。

### 2.1 领域 `/api/planner/domains`

| 文件 | 方法 | 路径 | 功能 |
|------|------|------|------|
| `domains/index.get.ts` | GET | `/api/planner/domains` | 获取所有领域（含目标数量和完成率统计） |
| `domains/index.post.ts` | POST | `/api/planner/domains` | 创建领域 |
| `domains/[id].put.ts` | PUT | `/api/planner/domains/:id` | 更新领域（重命名） |
| `domains/[id].delete.ts` | DELETE | `/api/planner/domains/:id` | 删除领域（级联删除目标） |
| `domains/reorder.put.ts` | PUT | `/api/planner/domains/reorder` | 批量更新领域排序 |

**GET `/api/planner/domains` 响应结构：**
```ts
interface DomainWithStats {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  goalCount: number;        // 目标数量
  totalCheckitems: number;  // 总检查项数
  completedCheckitems: number; // 已完成检查项数
  completionRate: number;   // 完成率 (0-100)
}
```

**PUT `/api/planner/domains/reorder` 请求体：**
```ts
{ items: { id: number; sortOrder: number }[] }
```

### 2.2 目标 `/api/planner/goals`

| 文件 | 方法 | 路径 | 功能 |
|------|------|------|------|
| `goals/index.get.ts` | GET | `/api/planner/goals?domainId=` | 获取领域下的目标（含检查项和标签） |
| `goals/index.post.ts` | POST | `/api/planner/goals` | 创建目标（可同时关联标签） |
| `goals/[id].get.ts` | GET | `/api/planner/goals/:id` | 获取单个目标详情 |
| `goals/[id].put.ts` | PUT | `/api/planner/goals/:id` | 更新目标（标题/描述/优先级/标签） |
| `goals/[id].delete.ts` | DELETE | `/api/planner/goals/:id` | 删除目标 |
| `goals/reorder.put.ts` | PUT | `/api/planner/goals/reorder` | 批量更新目标排序（同一领域内） |

**GET `/api/planner/goals?domainId=` 响应结构：**
```ts
interface GoalWithDetails {
  id: number;
  domainId: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  tags: { id: number; name: string }[];
  checkitems: Checkitem[];
  totalCheckitems: number;
  completedCheckitems: number;
  isStagnant: boolean;     // 最近14天无勾选变动
}
```

**POST `/api/planner/goals` 请求体：**
```ts
{
  domainId: number;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  tagIds?: number[];
}
```

**PUT `/api/planner/goals/:id` 请求体：**
```ts
{
  title?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  tagIds?: number[];  // 全量替换标签关联
}
```

### 2.3 检查项 `/api/planner/checkitems`

| 文件 | 方法 | 路径 | 功能 |
|------|------|------|------|
| `checkitems/index.post.ts` | POST | `/api/planner/checkitems` | 创建检查项 |
| `checkitems/[id].put.ts` | PUT | `/api/planner/checkitems/:id` | 编辑检查项内容 |
| `checkitems/[id].delete.ts` | DELETE | `/api/planner/checkitems/:id` | 删除检查项 |
| `checkitems/toggle.post.ts` | POST | `/api/planner/checkitems/toggle` | 勾选/取消勾选 |
| `checkitems/reorder.put.ts` | PUT | `/api/planner/checkitems/reorder` | 批量更新检查项排序 |

**POST `/api/planner/checkitems/toggle` 请求体与响应：**
```ts
// 请求
{ id: number }

// 响应
{ id: number; isCompleted: boolean; completedAt: number | null }
```

### 2.4 标签 `/api/planner/tags`

| 文件 | 方法 | 路径 | 功能 |
|------|------|------|------|
| `tags/index.get.ts` | GET | `/api/planner/tags` | 获取所有标签 |
| `tags/index.post.ts` | POST | `/api/planner/tags` | 创建标签 |
| `tags/[id].put.ts` | PUT | `/api/planner/tags/:id` | 编辑标签名称 |
| `tags/[id].delete.ts` | DELETE | `/api/planner/tags/:id` | 删除标签 |

### 2.5 统计聚合 `/api/planner/stats`

| 文件 | 方法 | 路径 | 功能 |
|------|------|------|------|
| `stats/overview.get.ts` | GET | `/api/planner/stats/overview` | 全局总览统计 |
| `stats/by-tag.get.ts` | GET | `/api/planner/stats/by-tag` | 标签聚合统计 |

**GET `/api/planner/stats/overview` 响应：**
```ts
interface OverviewStats {
  totalGoals: number;
  totalCheckitems: number;
  completedCheckitems: number;
  globalCompletionRate: number;  // 0-100
  stagnantGoalCount: number;
  domains: DomainWithStats[];
}
```

**GET `/api/planner/stats/by-tag` 响应：**
```ts
interface TagStats {
  id: number;
  name: string;
  goalCount: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;  // 0-100
  goals: { id: number; title: string; domainName: string; completionRate: number }[];
}[]
```

### 2.6 停滞检测逻辑

停滞判定在服务端计算：某目标下所有检查项的 `completed_at` 均 < 14天前（即最近14天内没有任何 completed_at 的变动）且尚未100%完成。

```sql
-- 伪代码：最近14天内没有新勾选的未完成目标
SELECT goal_id FROM planner_checkitems
GROUP BY goal_id
HAVING MAX(completed_at) < :fourteenDaysAgo OR MAX(completed_at) IS NULL
```

对于已 100% 完成的目标不标记为停滞。

---

## 3. 前端架构

### 3.1 工具注册

**文件：** `tools/annual-planner/index.ts`

```ts
import { Target } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'annual-planner',
  name: '年度计划',
  icon: Target,
  order: 3,
  component: () => import('./AnnualPlanner.vue'),
  namespaces: ['planner'],
});
```

并在 `tools/index.ts` 中追加 `import './annual-planner';`。

路由自动生效：访问 `/annual-planner` 即可渲染该工具。

### 3.2 视图切换

需求包含三个视图：**总览页**、**领域详情页**、**标签聚合视图**。

由于 tool plugin 系统使用 `pages/[...slug].vue` 仅根据 `slug[0]` 定位工具，**视图切换在工具组件内部管理**，不引入新的路由规则：

```ts
type PlannerView =
  | { type: 'overview' }
  | { type: 'domain'; domainId: number }
  | { type: 'tags' };
```

在 store 中维护 `currentView` 状态，工具根组件根据 `currentView.type` 条件渲染对应视图。

### 3.3 组件树

```
tools/annual-planner/
├── index.ts                          # 工具注册
├── types.ts                          # 前端类型定义
├── AnnualPlanner.vue                 # 根组件（视图切换容器）
└── components/
    ├── ViewNav.vue                   # 视图导航栏（总览 / 标签）
    ├── EmptyState.vue                # 空状态引导
    │
    ├── OverviewPage.vue              # 总览页
    ├── DomainCard.vue                # 领域卡片（名称、目标数、进度条）
    ├── GlobalProgress.vue            # 全局完成率
    │
    ├── DomainDetailPage.vue          # 领域详情页
    ├── GoalCard.vue                  # 目标卡片
    ├── CheckitemList.vue             # 检查项列表（含复选框）
    ├── TagBadge.vue                  # 标签徽章
    ├── PriorityBadge.vue             # 优先级标记
    ├── StagnantBadge.vue             # 停滞标记
    │
    ├── TagsPage.vue                  # 标签聚合视图
    ├── TagGroupCard.vue              # 标签分组卡片
    │
    ├── DomainForm.vue                # 领域新建/编辑表单（dialog）
    ├── GoalForm.vue                  # 目标新建/编辑表单（dialog）
    ├── CheckitemInput.vue            # 检查项内联编辑/新建输入
    └── TagManager.vue                # 标签管理（创建/删除，目标关联选择）
```

### 3.4 Pinia Store 设计

**文件：** `stores/planner.ts`

```ts
export const usePlannerStore = defineStore('planner', () => {
  // ===== 状态 =====
  const domains = ref<DomainWithStats[]>([]);
  const currentView = ref<PlannerView>({ type: 'overview' });
  const goals = ref<GoalWithDetails[]>([]);       // 当前领域的目标列表
  const tags = ref<PlannerTag[]>([]);
  const overviewStats = ref<OverviewStats | null>(null);
  const tagStats = ref<TagStats[]>([]);

  // ===== 计算属性 =====
  const currentDomain = computed(() => { ... });   // 当前视图对应的领域
  const globalCompletionRate = computed(() => { ... });

  // ===== 导航 =====
  function navigateTo(view: PlannerView) { ... }

  // ===== 领域操作 =====
  async function loadDomains() { ... }
  async function createDomain(name: string) { ... }
  async function updateDomain(id: number, name: string) { ... }
  async function deleteDomain(id: number) { ... }
  async function reorderDomains(items: { id: number; sortOrder: number }[]) { ... }

  // ===== 目标操作 =====
  async function loadGoals(domainId: number) { ... }
  async function createGoal(data: CreateGoalData) { ... }
  async function updateGoal(id: number, data: UpdateGoalData) { ... }
  async function deleteGoal(id: number) { ... }
  async function reorderGoals(items: { id: number; sortOrder: number }[]) { ... }

  // ===== 检查项操作 =====
  async function createCheckitem(goalId: number, content: string) { ... }
  async function updateCheckitem(id: number, content: string) { ... }
  async function deleteCheckitem(id: number) { ... }
  async function toggleCheckitem(id: number) { ... }  // 乐观更新
  async function reorderCheckitems(items: { id: number; sortOrder: number }[]) { ... }

  // ===== 标签操作 =====
  async function loadTags() { ... }
  async function createTag(name: string) { ... }
  async function updateTag(id: number, name: string) { ... }
  async function deleteTag(id: number) { ... }

  // ===== 统计 =====
  async function loadOverview() { ... }
  async function loadTagStats() { ... }

  return { ... };
});
```

### 3.5 乐观更新

检查项勾选采用与习惯打卡相同的乐观更新模式：
1. 立即切换 `isCompleted` 和 `completedAt`
2. 重算本地完成率
3. 发送 POST `/api/planner/checkitems/toggle`
4. 失败时回滚（重新加载服务端数据）

### 3.6 拖拽排序

拖拽排序不引入新依赖。使用 HTML5 原生 `draggable` API：
- 拖拽结束后计算新的 `sortOrder` 值
- 调用对应的 `reorder` API 批量更新
- 乐观更新本地顺序

### 3.7 前端类型定义

**文件：** `tools/annual-planner/types.ts`

```ts
// ===== 年度计划领域类型 =====

export type Priority = 'high' | 'medium' | 'low';

export type PlannerView =
  | { type: 'overview' }
  | { type: 'domain'; domainId: number }
  | { type: 'tags' };

export interface PlannerDomain {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface DomainWithStats extends PlannerDomain {
  goalCount: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
}

export interface PlannerGoal {
  id: number;
  domainId: number;
  title: string;
  description: string;
  priority: Priority;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalWithDetails extends PlannerGoal {
  tags: PlannerTag[];
  checkitems: PlannerCheckitem[];
  totalCheckitems: number;
  completedCheckitems: number;
  isStagnant: boolean;
}

export interface PlannerCheckitem {
  id: number;
  goalId: number;
  content: string;
  isCompleted: boolean;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlannerTag {
  id: number;
  name: string;
  createdAt: number;
}

export interface OverviewStats {
  totalGoals: number;
  totalCheckitems: number;
  completedCheckitems: number;
  globalCompletionRate: number;
  stagnantGoalCount: number;
  domains: DomainWithStats[];
}

export interface TagStats {
  id: number;
  name: string;
  goalCount: number;
  totalCheckitems: number;
  completedCheckitems: number;
  completionRate: number;
  goals: { id: number; title: string; domainName: string; completionRate: number }[];
}

// ===== 表单数据 =====

export interface CreateGoalData {
  domainId: number;
  title: string;
  description?: string;
  priority?: Priority;
  tagIds?: number[];
}

export interface UpdateGoalData {
  title?: string;
  description?: string;
  priority?: Priority;
  tagIds?: number[];
}

// ===== 常量映射 =====

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const DEFAULT_DOMAINS = ['事业', '财务', '健康', '兴趣'];

export const STAGNANT_THRESHOLD_DAYS = 14;
```

---

## 4. 文件清单汇总

### 新增文件

| 类别 | 文件路径 |
|------|----------|
| **Schema** | `server/database/schemas/planner.ts` |
| **Migration** | `server/database/migrations/XXXX_planner.sql`（由 drizzle-kit generate） |
| **API - domains** | `server/api/planner/domains/index.get.ts` |
| | `server/api/planner/domains/index.post.ts` |
| | `server/api/planner/domains/[id].put.ts` |
| | `server/api/planner/domains/[id].delete.ts` |
| | `server/api/planner/domains/reorder.put.ts` |
| **API - goals** | `server/api/planner/goals/index.get.ts` |
| | `server/api/planner/goals/index.post.ts` |
| | `server/api/planner/goals/[id].get.ts` |
| | `server/api/planner/goals/[id].put.ts` |
| | `server/api/planner/goals/[id].delete.ts` |
| | `server/api/planner/goals/reorder.put.ts` |
| **API - checkitems** | `server/api/planner/checkitems/index.post.ts` |
| | `server/api/planner/checkitems/[id].put.ts` |
| | `server/api/planner/checkitems/[id].delete.ts` |
| | `server/api/planner/checkitems/toggle.post.ts` |
| | `server/api/planner/checkitems/reorder.put.ts` |
| **API - tags** | `server/api/planner/tags/index.get.ts` |
| | `server/api/planner/tags/index.post.ts` |
| | `server/api/planner/tags/[id].put.ts` |
| | `server/api/planner/tags/[id].delete.ts` |
| **API - stats** | `server/api/planner/stats/overview.get.ts` |
| | `server/api/planner/stats/by-tag.get.ts` |
| **Store** | `stores/planner.ts` |
| **Tool** | `tools/annual-planner/index.ts` |
| | `tools/annual-planner/types.ts` |
| | `tools/annual-planner/AnnualPlanner.vue` |
| | `tools/annual-planner/components/ViewNav.vue` |
| | `tools/annual-planner/components/EmptyState.vue` |
| | `tools/annual-planner/components/OverviewPage.vue` |
| | `tools/annual-planner/components/DomainCard.vue` |
| | `tools/annual-planner/components/GlobalProgress.vue` |
| | `tools/annual-planner/components/DomainDetailPage.vue` |
| | `tools/annual-planner/components/GoalCard.vue` |
| | `tools/annual-planner/components/CheckitemList.vue` |
| | `tools/annual-planner/components/TagBadge.vue` |
| | `tools/annual-planner/components/PriorityBadge.vue` |
| | `tools/annual-planner/components/StagnantBadge.vue` |
| | `tools/annual-planner/components/TagsPage.vue` |
| | `tools/annual-planner/components/TagGroupCard.vue` |
| | `tools/annual-planner/components/DomainForm.vue` |
| | `tools/annual-planner/components/GoalForm.vue` |
| | `tools/annual-planner/components/CheckitemInput.vue` |
| | `tools/annual-planner/components/TagManager.vue` |

### 需修改的现有文件

| 文件 | 修改内容 |
|------|----------|
| `server/database/schema.ts` | 追加 `export * from './schemas/planner';` |
| `server/api/_test/reset.post.ts` | 追加清理 planner 表（先子表后父表） |
| `tools/index.ts` | 追加 `import './annual-planner';` |
