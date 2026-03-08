# PRD: 技能学习核心层抽取 (Skill Learning Core)

> 从创业地图 (startup-map) 中提取通用技能学习引擎，使新技能工具只需 ~4 个文件即可创建。

## 1. 项目概述

### 1.1 目标

将 `startup-map` 中与"创业"无关的通用学习引擎逻辑抽取为核心层 (`skill-learning`)，实现：

- **复用性**：核心学习功能（知识树、AI 教学、聊天、任务、笔记、统计等）一次实现，多技能共享
- **可扩展性**：新技能工具（如"编程技能"）仅需定义种子数据 + AI 提示词 + 注册调用
- **数据隔离**：多技能共用同一套表，通过 `skill_id` 列实现数据隔离
- **向后兼容**：现有 startup-map 功能完整保留，产品管理仍为其专属功能

### 1.2 成功标准

- startup-map 所有现有功能正常运行（含产品管理）
- 创建新技能工具只需 4 个文件（种子数据 + 技能配置 + 工具注册 + 根组件）
- E2E 测试全部通过
- 无跨技能数据泄露

### 1.3 非目标（Out of Scope）

- 创建第二个技能工具（本期仅抽取核心层 + 改造 startup-map）
- 修改 DB 引擎（仍为 SQLite + Drizzle）
- 修改 LLM 集成架构（仍为现有 provider 模式）
- 修改认证系统

---

## 2. 功能范围

### 2.1 核心层 (Skill Learning Core) — 通用复用

| 功能模块 | 描述 | 涉及层 |
|---------|------|-------|
| 知识树导航 | 领域 → 主题 → 知识点三级结构 | DB + API + Store + 组件 |
| 学习状态追踪 | not_started → learning → understood → practiced | DB + API + Store + 组件 |
| AI 教学生成 | SSE 流式生成 5 板块教学内容 | API + Store + 组件 |
| AI 聊天辅导 | 上下文感知的对话式辅导 | API + Store + 组件 |
| 实践任务 | AI 生成 + 手动完成标记 | API + Store + 组件 |
| 知识点笔记 | Markdown 编辑/保存 | API + Store + 组件 |
| 学习阶段 | 阶段定义 + 阶段-知识点映射 + 进度追踪 | DB + API + Store + 组件 |
| 学习推荐 | 基于当前阶段推荐下一步 | API + Store + 组件 |
| 统计分析 | 全局概览 + 按领域统计 | API + Store + 组件 |
| 热力图 + 连续天数 | 基于活动记录的可视化 | API + Store + 组件 |
| 学习活动记录 | 行为记录（带小时级去重） | API + Store + 组件 |
| 文章双向关联 | 知识点 ↔ 文章链接 | API + Store + 组件 |
| 种子数据导入 | 幂等批量导入领域/主题/知识点/阶段 | API |

### 2.2 Startup-Map 专有层 — 保留不动

| 功能 | 描述 | 涉及文件 |
|------|------|---------|
| 产品管理 CRUD | 多产品创建/编辑/删除/激活 | `sm_products` 表、`products/` 6 个 API、store 中 ~70 行 |
| 产品上下文注入 | AI prompt 中注入 activeProduct 信息 | 通过 `resolveExtraContext` hook 实现 |
| 产品切换 UI | ProductSwitcher + ProductList + ProductProfile | 3 个组件 |
| 笔记/教学的 productId | `sm_teachings.product_id`、`sm_notes.product_id` | 保留列（nullable），核心层传 null |

---

## 3. 数据模型变更

### 3.1 Schema 变更 (`server/database/schemas/startup-map.ts`)

仅修改 3 张根表，添加 `skill_id` 列 + 索引：

| 表名 | 变更 | 默认值 | 原因 |
|------|------|--------|------|
| `sm_domains` | + `skillId TEXT NOT NULL DEFAULT 'startup-map'` + 索引 | `'startup-map'` | 根节点，子表通过 FK 级联 |
| `sm_stages` | + `skillId TEXT NOT NULL DEFAULT 'startup-map'` + 索引 | `'startup-map'` | 独立根节点 |
| `sm_activities` | + `skillId TEXT NOT NULL DEFAULT 'startup-map'` + 索引 | `'startup-map'` | `pointId` 为弱关联（`onDelete: 'set null'`） |

**不需要修改的表（通过 FK 级联获得技能归属）**：
- `sm_topics` → 通过 `domain_id` FK → `sm_domains`
- `sm_points` → 通过 `topic_id` FK → `sm_topics`
- `sm_teachings` / `sm_chats` / `sm_tasks` / `sm_notes` / `sm_point_articles` → 通过 `point_id` FK → `sm_points`
- `sm_stage_points` → 通过 `stage_id` FK → `sm_stages`

**迁移 SQL**：

```sql
ALTER TABLE sm_domains ADD COLUMN skill_id TEXT NOT NULL DEFAULT 'startup-map';
ALTER TABLE sm_stages ADD COLUMN skill_id TEXT NOT NULL DEFAULT 'startup-map';
ALTER TABLE sm_activities ADD COLUMN skill_id TEXT NOT NULL DEFAULT 'startup-map';

CREATE INDEX idx_sm_domains_skill ON sm_domains(skill_id);
CREATE INDEX idx_sm_stages_skill ON sm_stages(skill_id);
CREATE INDEX idx_sm_activities_skill ON sm_activities(skill_id);
```

### 3.2 Drizzle Schema 代码变更

```typescript
// sm_domains 表新增列
skillId: text('skill_id').notNull().default('startup-map'),
// index:
index('idx_sm_domains_skill').on(table.skillId),

// sm_stages 表新增列
skillId: text('skill_id').notNull().default('startup-map'),

// sm_activities 表新增列
skillId: text('skill_id').notNull().default('startup-map'),
```

### 3.3 数据安全约束

- 所有 API 查询根表时 **必须** 添加 `WHERE skill_id = ?` 过滤
- 使用 `requirePointForSkill()` 辅助函数验证知识点归属
- 子表查询通过 JOIN 根表实现隔离（不需要每张子表都加 `skill_id`）

---

## 4. API 变更清单

### 4.1 路由迁移总览

**旧路由格式**：`/api/startup-map/<resource>`
**新路由格式**：`/api/skills/[skillId]/<resource>`

startup-map 访问时 `skillId = 'startup-map'`，未来新技能使用不同的 `skillId`。

### 4.2 完整路由映射表（28 个核心端点）

| # | 旧路由 | 新路由 | 方法 | 变更说明 |
|---|--------|--------|------|---------|
| 1 | `/api/startup-map/domains` | `/api/skills/[skillId]/domains` | GET | + `WHERE skillId` 过滤 |
| 2 | `/api/startup-map/domains/:id` | `/api/skills/[skillId]/domains/[id]` | GET | + `requirePointForSkill` 验证 |
| 3 | `/api/startup-map/points/:id` | `/api/skills/[skillId]/points/[id]` | GET | + 知识点归属验证 |
| 4 | `/api/startup-map/points/:id/status` | `/api/skills/[skillId]/points/[id]/status` | PATCH | + 知识点归属验证 |
| 5 | `/api/startup-map/points/:id/teaching` | `/api/skills/[skillId]/points/[id]/teaching` | POST | + 使用 `config.buildTeachingPrompt()` |
| 6 | `/api/startup-map/points/:id/chat` | `/api/skills/[skillId]/points/[id]/chat` | POST | + 使用 `config.buildChatSystemMessage()` |
| 7 | `/api/startup-map/points/:id/chats` | `/api/skills/[skillId]/points/[id]/chats` | GET | + 知识点归属验证 |
| 8 | `/api/startup-map/points/:id/chats` | `/api/skills/[skillId]/points/[id]/chats` | DELETE | + 知识点归属验证 |
| 9 | `/api/startup-map/points/:id/tasks` | `/api/skills/[skillId]/points/[id]/tasks` | GET | + 知识点归属验证 |
| 10 | `/api/startup-map/points/:id/tasks/generate` | `/api/skills/[skillId]/points/[id]/tasks/generate` | POST | + 使用 `config.buildTaskPrompt()` |
| 11 | `/api/startup-map/points/:id/notes` | `/api/skills/[skillId]/points/[id]/notes` | GET | + 知识点归属验证 |
| 12 | `/api/startup-map/points/:id/notes` | `/api/skills/[skillId]/points/[id]/notes` | PUT | + 知识点归属验证 |
| 13 | `/api/startup-map/points/:id/articles` | `/api/skills/[skillId]/points/[id]/articles` | GET | + 知识点归属验证 |
| 14 | `/api/startup-map/points/:id/articles` | `/api/skills/[skillId]/points/[id]/articles` | POST | + 知识点归属验证 |
| 15 | `/api/startup-map/points/:id/articles/:articleId` | `/api/skills/[skillId]/points/[id]/articles/[articleId]` | DELETE | + 知识点归属验证 |
| 16 | `/api/startup-map/tasks/:id` | `/api/skills/[skillId]/tasks/[id]` | PATCH | + skillId 验证 |
| 17 | `/api/startup-map/stages` | `/api/skills/[skillId]/stages` | GET | + `WHERE skillId` 过滤 |
| 18 | `/api/startup-map/stages/:id` | `/api/skills/[skillId]/stages/[id]` | GET | + `WHERE skillId` 过滤 |
| 19 | `/api/startup-map/stats/overview` | `/api/skills/[skillId]/stats/overview` | GET | + `WHERE skillId` 过滤 |
| 20 | `/api/startup-map/stats/by-domain` | `/api/skills/[skillId]/stats/by-domain` | GET | + `WHERE skillId` 过滤 |
| 21 | `/api/startup-map/stats/heatmap` | `/api/skills/[skillId]/stats/heatmap` | GET | + `WHERE skillId` 过滤 |
| 22 | `/api/startup-map/stats/streak` | `/api/skills/[skillId]/stats/streak` | GET | + `WHERE skillId` 过滤 |
| 23 | `/api/startup-map/activities` | `/api/skills/[skillId]/activities` | GET | + `WHERE skillId` 过滤 |
| 24 | `/api/startup-map/activities` | `/api/skills/[skillId]/activities` | POST | + 记录 `skillId` |
| 25 | `/api/startup-map/articles/:articleId/points` | `/api/skills/[skillId]/articles/[articleId]/points` | GET | + `WHERE skillId` 过滤 |
| 26 | `/api/startup-map/articles/:articleId/points` | `/api/skills/[skillId]/articles/[articleId]/points` | POST | + 知识点归属验证 |
| 27 | `/api/startup-map/recommendations` | `/api/skills/[skillId]/recommendations` | GET | + `WHERE skillId` 过滤 |
| 28 | `/api/startup-map/seed` | `/api/skills/[skillId]/seed` | POST | + 从 `config.seedData` 读取 |

### 4.3 保留不迁移的路由（6 个，startup-map 专有）

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/startup-map/products` | GET | 产品列表 |
| `/api/startup-map/products` | POST | 创建产品 |
| `/api/startup-map/products/active` | GET | 获取活跃产品 |
| `/api/startup-map/products/:id` | PUT | 更新产品 |
| `/api/startup-map/products/:id` | DELETE | 删除产品 |
| `/api/startup-map/products/:id/activate` | PATCH | 激活产品 |

### 4.4 现有 articles API 中与 startup-map 关联的路由

注意：`/api/startup-map/articles/[articleId]/points.get.ts` 和 `points.post.ts` 以及 `points/[pointId].delete.ts` 这 3 个路由目前在 `server/api/startup-map/articles/` 下，也需迁移。

### 4.5 每个 Handler 的标准变更模式

```typescript
// 变更前
export default defineEventHandler(async (event) => {
  const db = useDB();
  const rows = await db.select().from(smDomains).orderBy(...);
  return rows;
});

// 变更后
export default defineEventHandler(async (event) => {
  const { skillId, config } = resolveSkill(event);  // 新增：验证 skillId
  const db = useDB();
  const rows = await db.select().from(smDomains)
    .where(eq(smDomains.skillId, skillId))           // 新增：数据隔离
    .orderBy(...);
  return rows;
});
```

**AI 生成类 Handler 的变更**（teaching/chat/task）：

```typescript
// 变更前：硬编码 prompt
const messages = buildTeachingPrompt(point, topic, domain, activeProduct);

// 变更后：从技能配置读取
const extra = config.resolveExtraContext ? await config.resolveExtraContext(db) : {};
const ctx = { point, topic, domain, extra };
const messages = config.buildTeachingPrompt(ctx);
```

---

## 5. 服务端技能配置系统

### 5.1 新建文件清单

| 文件 | 用途 | 行数估算 |
|------|------|---------|
| `server/lib/skill-learning/types.ts` | `SkillConfig` 接口 + `SkillTeachingContext` 类型 | ~50 |
| `server/lib/skill-learning/registry.ts` | `registerSkill()` / `getSkill()` / `requireSkill()` | ~20 |
| `server/lib/skill-learning/db-helpers.ts` | `resolveSkill()` / `requirePointForSkill()` | ~50 |
| `server/lib/skill-learning/index.ts` | 入口，side-effect import 所有技能 | ~5 |
| `server/lib/skill-learning/skills/startup-map.ts` | startup-map 技能配置（提示词 + 标签 + 种子数据） | ~120 |

### 5.2 SkillConfig 接口定义

```typescript
interface SkillTeachingContext {
  point: { name: string; description: string | null };
  topic: { name: string };
  domain: { name: string };
  extra?: Record<string, any>;  // 技能特有上下文
}

interface SkillConfig {
  id: string;                   // URL 标识符，如 'startup-map'
  name: string;                 // 显示名称，如 '创业地图'

  // AI 提示词构建器
  buildTeachingPrompt: (ctx: SkillTeachingContext) => ChatMessage[];
  buildChatSystemMessage: (ctx: SkillTeachingContext & { teachingSummary: string }) => ChatMessage;
  buildTaskPrompt: (ctx: SkillTeachingContext) => ChatMessage[];

  // 可配置标签
  teachingSections: { key: string; label: string }[];
  statusLabels: Record<string, string>;
  activityTypeLabels: Record<string, string>;

  // 可选 hook：AI 调用前注入额外上下文
  resolveExtraContext?: (db: any) => Promise<Record<string, any>>;

  // 种子数据
  seedData: { domains: SeedDomain[]; stages: SeedStage[] };
}
```

### 5.3 startup-map 配置要点

- **提示词提取**：从现有 3 个 handler（`teaching.post.ts`、`chat.post.ts`、`tasks/generate.post.ts`）中提取硬编码的提示词到 `skills/startup-map.ts`
- **产品上下文**：通过 `resolveExtraContext` hook 查询 `sm_products` 中的 `isActive` 产品，注入到 `ctx.extra.product`
- **种子数据**：从 `server/database/seeds/startup-map.ts` 引入现有 `SEED_DOMAINS` 和 `SEED_STAGES`

### 5.4 DB 辅助函数

| 函数 | 用途 | 调用场景 |
|------|------|---------|
| `resolveSkill(event)` | 从路由参数提取 `skillId` + 验证技能存在 + 返回配置 | 每个 handler 的第一行 |
| `requirePointForSkill(db, pointId, skillId)` | 验证知识点 → 主题 → 领域链路属于指定技能 | 所有 `points/[id]/*` handler |

---

## 6. 前端组件清单

### 6.1 迁移到 `components/skill-learning/` 的组件（22 个）

按功能分组：

**视图组件（3 个）**：
| 组件 | 当前位置 | 职责 | Store 耦合 |
|------|---------|------|-----------|
| `GlobalView.vue` | tools/startup-map/components/ | 全局视图（领域列表/阶段/热力图 Tab） | 直接调用 `useStartupMapStore()` |
| `DomainDetail.vue` | tools/startup-map/components/ | 领域详情（主题+知识点树） | 直接调用 `useStartupMapStore()` |
| `PointPage.vue` | tools/startup-map/components/ | 知识点页面（教学/聊天/任务/笔记/文章） | 直接调用 `useStartupMapStore()` |

**教学 & 聊天（2 个）**：
| 组件 | 职责 | Store 耦合 |
|------|------|-----------|
| `TeachingContent.vue` | AI 教学内容展示/流式渲染 | Props 传入（低耦合） |
| `ChatPanel.vue` | AI 聊天面板 | 直接调用 `useStartupMapStore()` |

**任务 & 笔记（3 个）**：
| 组件 | 职责 | Store 耦合 |
|------|------|-----------|
| `PracticeTasks.vue` | 任务列表容器 | 直接调用 `useStartupMapStore()` |
| `TaskItem.vue` | 单个任务项 | Props 传入（低耦合） |
| `NoteEditor.vue` | Markdown 笔记编辑器 | 直接调用 `useStartupMapStore()` |

**文章关联（1 个）**：
| 组件 | 职责 | Store 耦合 |
|------|------|-----------|
| `LinkedArticles.vue` | 已关联文章列表 + 关联/取消操作 | 直接调用 `useStartupMapStore()` |
| `ArticlePicker.vue` | 文章选择弹窗 | Props + emit（低耦合） |

**状态 & 进度（3 个）**：
| 组件 | 职责 |
|------|------|
| `StatusSelector.vue` | 学习状态选择器下拉 |
| `StatusBadge.vue` | 状态标签展示 |
| `SegmentedProgress.vue` | 分段进度条 |

**阶段系统（5 个）**：
| 组件 | 职责 |
|------|------|
| `StageView.vue` | 阶段视图容器 |
| `StageTimeline.vue` | 阶段时间线 |
| `StageNode.vue` | 阶段节点 |
| `StagePointList.vue` | 阶段下的知识点列表 |
| `DomainCard.vue` | 领域卡片 |

**热力图 & 记录（3 个）**：
| 组件 | 职责 |
|------|------|
| `LearningHeatmap.vue` | 热力图容器 |
| `HeatmapGrid.vue` | 热力图网格 |
| `LearningLogList.vue` | 学习活动日志 |

**推荐（1 个）**：
| 组件 | 职责 |
|------|------|
| `LearningRecommendation.vue` | 学习推荐列表 |

### 6.2 保留在 `tools/startup-map/components/` 的组件（3 个）

| 组件 | 职责 | 保留原因 |
|------|------|---------|
| `ProductProfile.vue` | 产品档案编辑/展示 | startup-map 专属 |
| `ProductList.vue` | 产品列表管理 | startup-map 专属 |
| `ProductSwitcher.vue` | 顶部产品切换器 | startup-map 专属 |

### 6.3 组件解耦方案：provide/inject

**问题**：当前 22 个组件中，大约 10 个直接调用 `useStartupMapStore()`，迁移为共享组件后不能再硬编码 store。

**解决方案**：

```typescript
// composables/skill-learning/types.ts
import type { InjectionKey } from 'vue';
export const SKILL_STORE_KEY: InjectionKey<ReturnType<ReturnType<typeof createSkillLearningStore>>>
  = Symbol('skillStore');

// 工具根组件中 provide
const store = useStartupMapStore();
provide(SKILL_STORE_KEY, store);

// 共享组件中 inject
const store = inject(SKILL_STORE_KEY)!;
```

**需要改动的组件列表**（将 `useStartupMapStore()` 改为 `inject(SKILL_STORE_KEY)`）：

1. `GlobalView.vue` — 使用了 store 的 globalStats, enhancedStats, domains, stages 等
2. `DomainDetail.vue` — 使用了 store 的 currentDomain, domainLoading
3. `PointPage.vue` — 使用了 store 的 currentPoint, teaching, generating 等
4. `ChatPanel.vue` — 使用了 store 的 chats, chatSending, chatError
5. `PracticeTasks.vue` — 使用了 store 的 tasks, tasksLoading
6. `NoteEditor.vue` — 使用了 store 的 note, noteSaving
7. `LinkedArticles.vue` — 使用了 store 的 linkedArticles, linkedArticlesLoading
8. `LearningHeatmap.vue` — 使用了 store 的 heatmapData, heatmapYear
9. `LearningLogList.vue` — 使用了 store 的 activities, activitiesLoading
10. `LearningRecommendation.vue` — 使用了 store 的 recommendations

---

## 7. Store 变更说明

### 7.1 Store 工厂函数

**新建**：`composables/skill-learning/useSkillLearningStore.ts`

从现有 `stores/startup-map.ts`（723 行）中提取 ~650 行通用逻辑到工厂函数：

```typescript
export function createSkillLearningStore(skillId: string) {
  return defineStore(`skill-${skillId}`, () => {
    const baseUrl = `/api/skills/${skillId}`;
    // ... 所有通用 state + actions，API 路径使用 baseUrl
  });
}
```

**提取的内容**（约 650 行）：
- 视图状态（currentView, globalTab, currentDomainId, currentPointId）
- 领域数据（domains, domainsLoading）+ loadDomains/loadDomain
- 知识点数据 + loadPoint/updatePointStatus
- 教学内容 + generateTeaching (SSE 流式)
- 聊天 + loadChats/sendChat/clearChats
- 阶段 + loadStages/loadStage
- 任务 + loadTasks/generateTasks/updateTask
- 笔记 + loadNote/saveNote
- 推荐 + loadRecommendations
- 统计 + loadEnhancedStats/loadDomainStats
- 热力图/连续天数 + loadHeatmap/loadStreak
- 活动记录 + logActivity/loadActivities
- 文章关联 + loadPointArticles/linkArticles/unlinkArticle
- 种子数据 + seedData
- 导航函数 + 面包屑 computed
- globalStats computed

**不提取的内容**（约 70 行，保留在 startup-map store）：
- `activeProduct`, `productLoading`, `productSaving`
- `products`, `productsLoading`
- `loadActiveProduct()`, `createProduct()`, `updateProduct()`
- `loadProducts()`, `deleteProduct()`, `activateProduct()`
- `navigateToProduct()`

### 7.2 重构后的 startup-map store

```typescript
// stores/startup-map.ts
export const useStartupMapStore = defineStore('startup-map', () => {
  const base = createSkillLearningStore('startup-map')();

  // startup-map 专有：产品管理
  const activeProduct = ref<SmProduct | null>(null);
  // ... 产品相关 state + actions

  return {
    ...base,           // 展开核心层
    activeProduct, productLoading, productSaving,
    products, productsLoading,
    loadActiveProduct, createProduct, updateProduct,
    loadProducts, deleteProduct, activateProduct,
    navigateToProduct,
  };
});
```

### 7.3 Store 展开的 Reactivity 注意事项

- **风险**：`...base` 展开可能导致 ref 解包行为不一致
- **缓解**：使用 `storeToRefs(base)` 获取 ref 引用后再展开；action 函数直接展开（无 reactivity 问题）
- **替代方案**：如果展开有问题，可以让组件通过 `base.xxx` 访问核心属性

---

## 8. 前端类型变更

### 8.1 共享类型 (`composables/skill-learning/types.ts`)

从 `tools/startup-map/types.ts` 提取以下类型：

**实体类型**：`PointStatus`, `SmDomain`, `SmTopic`, `SmPoint`, `SmTeaching`, `SmChat`, `SmStage`, `SmTask`, `SmNote`, `SmActivity`

**API 响应类型**：`DomainWithStats`, `TopicWithPoints`, `DomainDetail`, `PointDetail`, `GlobalStats`, `EnhancedGlobalStats`, `DomainStatItem`, `StageWithStats`, `StagePointItem`, `StageDetail`, `RecommendedPoint`, `ActivityType`, `ActivityWithPointName`, `ActivitiesPage`, `LinkedArticle`, `LinkedPoint`, `ChatResponse`

**常量**：`POINT_STATUS_LABELS`, `ACTIVITY_TYPE_LABELS`, `TEACHING_SECTIONS`, `TEACHING_SECTION_LABELS`

**视图类型**：`SkillLearningView` (= `'global' | 'domain' | 'point'`)，不含 `'product'`

**注入 Key**：`SKILL_STORE_KEY`

### 8.2 startup-map 保留类型 (`tools/startup-map/types.ts`)

保留并从共享类型 re-export：

```typescript
export * from '~/composables/skill-learning/types';

// startup-map 专有
export type StartupMapView = SkillLearningView | 'product';
export type ProductStage = 'ideation' | 'researching' | 'preparing' | 'launched';
export interface SmProduct { ... }
export interface ProductFormData { ... }
export const PRODUCT_STAGE_LABELS: Record<ProductStage, string> = { ... };
```

---

## 9. 根组件变更

### 9.1 StartupMap.vue 变更

```vue
<template>
  <div class="startupMap">
    <div class="topBar">
      <!-- 面包屑改为使用共享组件 or 保持内联 -->
      <nav class="breadcrumb">...</nav>
      <div class="topBarRight">
        <ProductSwitcher />          <!-- startup-map 专有 -->
        <button @click="store.navigateToProduct()">...</button>
      </div>
    </div>

    <GlobalView v-if="currentView === 'global'" />        <!-- 从 components/skill-learning/ 导入 -->
    <DomainDetail v-else-if="currentView === 'domain'" />  <!-- 从 components/skill-learning/ 导入 -->
    <PointPage v-else-if="currentView === 'point'" />      <!-- 从 components/skill-learning/ 导入 -->
    <ProductProfile v-else-if="currentView === 'product'" /> <!-- 本地组件 -->
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

### 9.2 工具注册变更

```typescript
// tools/startup-map/index.ts — 不变
registerTool({
  id: 'startup-map',
  name: '创业地图',
  icon: Map,
  order: 5,
  component: () => import('./StartupMap.vue'),
  namespaces: ['startup-map'],  // 保留 startup-map namespace（产品路由仍在此）
});
```

---

## 10. 文件变更总览

### 10.1 新建文件（~58 个）

| 类别 | 文件数 | 具体文件 |
|------|--------|---------|
| 服务端技能系统 | 5 | `server/lib/skill-learning/{types,registry,db-helpers,index}.ts` + `skills/startup-map.ts` |
| 统一 API 路由 | 28 | `server/api/skills/[skillId]/` 下全部文件 |
| 前端共享类型 | 1 | `composables/skill-learning/types.ts` |
| Store 工厂 | 1 | `composables/skill-learning/useSkillLearningStore.ts` |
| 共享组件 | 22 | `components/skill-learning/` 下 22 个 Vue 文件 |
| 入口 | 1 | `composables/skill-learning/index.ts`（barrel export） |

### 10.2 修改文件（~6 个）

| 文件 | 变更说明 |
|------|---------|
| `server/database/schemas/startup-map.ts` | 3 张表加 `skillId` 列 + 索引 |
| `stores/startup-map.ts` | 重构为 factory 扩展模式（~723 → ~80 行） |
| `tools/startup-map/types.ts` | re-export 共享类型 + 保留专有类型 |
| `tools/startup-map/StartupMap.vue` | provide store + 改 import 路径 |
| `e2e/startup-map.spec.ts` | API URL 更新 `/api/startup-map/` → `/api/skills/startup-map/` |
| `server/lib/skill-learning/index.ts` | side-effect import startup-map 配置 |

### 10.3 删除文件（~47 个）

| 类别 | 文件数 | 原因 |
|------|--------|------|
| 旧 API 路由（products/ 除外） | 25 | 迁移到 `/api/skills/[skillId]/` |
| 旧组件（product 组件除外） | 22 | 迁移到 `components/skill-learning/` |

### 10.4 净变化

- **净增文件**：~11 个（58 创建 - 47 删除）
- **大部分"创建"实为文件移动**，核心新增代码约 250 行（技能系统 + store 工厂 + 类型）

---

## 11. 验收标准

### 11.1 数据库层

- [ ] 迁移脚本执行成功，3 张表添加 `skill_id` 列
- [ ] 现有数据的 `skill_id` 默认值为 `'startup-map'`
- [ ] 索引创建成功

### 11.2 服务端技能系统

- [ ] `registerSkill('startup-map', ...)` 注册成功
- [ ] `requireSkill('startup-map')` 返回正确配置
- [ ] `requireSkill('nonexistent')` 抛出 404
- [ ] `resolveSkill(event)` 正确提取路由参数
- [ ] `requirePointForSkill()` 正确验证知识点归属
- [ ] `requirePointForSkill()` 对不属于该技能的知识点抛出 404

### 11.3 API 层

- [ ] 所有 28 个新路由响应正确
- [ ] 所有查询包含 `WHERE skill_id = ?` 过滤
- [ ] AI 教学生成使用 `config.buildTeachingPrompt()`（含 SSE 流式）
- [ ] AI 聊天使用 `config.buildChatSystemMessage()`
- [ ] AI 任务生成使用 `config.buildTaskPrompt()`
- [ ] startup-map 的 `resolveExtraContext` 正确注入产品上下文
- [ ] 种子数据导入使用 `config.seedData`
- [ ] 产品 API（6 个）仍在 `/api/startup-map/products/` 正常工作

### 11.4 Store 层

- [ ] `createSkillLearningStore('startup-map')` 返回功能完整的 store
- [ ] store 的所有 API 调用使用 `/api/skills/startup-map/...` 路径
- [ ] startup-map store 展开核心层后产品功能正常
- [ ] Reactivity 正常（ref 不丢失响应性）

### 11.5 组件层

- [ ] 22 个组件从 `components/skill-learning/` 正确导入
- [ ] provide/inject 模式工作正常
- [ ] 3 个产品组件从 `tools/startup-map/components/` 正确导入
- [ ] 所有组件渲染、交互功能不变

### 11.6 端到端

- [ ] startup-map 全部功能正常：领域浏览、知识点学习、AI 教学、AI 聊天、实践任务、笔记、文章关联、阶段、热力图、活动记录、统计、推荐、种子导入
- [ ] 产品管理全部功能正常：创建、编辑、切换、删除
- [ ] E2E 测试全部通过
- [ ] TypeScript 编译无错误
- [ ] 无控制台错误

---

## 12. 风险与缓解

| # | 风险 | 级别 | 影响 | 缓解措施 |
|---|------|------|------|---------|
| 1 | DB 迁移失败导致数据丢失 | 高 | 数据不可恢复 | 迁移前执行 `cp data/assistant.db data/assistant.db.bak`；Drizzle migration 自动回滚 |
| 2 | 跨技能数据泄露 | 高 | 安全问题 | 所有查询强制使用 `resolveSkill()` + `requirePointForSkill()`；代码审查重点检查 |
| 3 | Store 展开导致 reactivity 丢失 | 中 | UI 不更新 | 使用 `storeToRefs()`；若有问题可回退到不展开方案 |
| 4 | 大量文件移动导致 import 断裂 | 低 | 编译失败 | TypeScript 编译检查 + IDE 全局搜索验证 |
| 5 | `smNotes` 唯一索引 `(pointId, productId)` 冲突 | 低 | 笔记创建失败 | 保留 `productId` 列不变；核心层传 null（不同 productId 不冲突） |
| 6 | SSE 流式教学在新路由下中断 | 中 | AI 教学不可用 | 重点测试流式响应；保留原始 ReadableStream 模式不变 |
| 7 | E2E 测试中 API URL 全部失效 | 低 | 测试不通过 | 统一替换 URL 前缀 |

---

## 13. 实施阶段建议

### Phase 1: 后端基础设施（无破坏性变更）

1. DB Schema 变更（加 `skill_id` 列）
2. 创建 `server/lib/skill-learning/` 技能系统
3. startup-map 技能配置
4. 生成并执行 Drizzle migration

### Phase 2: API 路由迁移

5. 创建 `server/api/skills/[skillId]/` 路由（与旧路由并存）
6. 逐个迁移 handler 逻辑
7. 验证所有新路由正常工作
8. 删除旧路由

### Phase 3: 前端迁移

9. 创建 `composables/skill-learning/` 共享类型 + store 工厂
10. 迁移组件到 `components/skill-learning/`
11. 改造组件：`useStartupMapStore()` → `inject(SKILL_STORE_KEY)`
12. 改造 `stores/startup-map.ts` 为扩展模式
13. 更新 `StartupMap.vue` 根组件

### Phase 4: 收尾

14. 更新 E2E 测试
15. TypeScript 编译检查
16. 端到端手动验证
17. 清理旧文件
