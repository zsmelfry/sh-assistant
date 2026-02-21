# 创业地图 (Startup Map) — 技术架构设计文档

## 目录

1. [数据库设计](#1-数据库设计)
2. [API 路由设计](#2-api-路由设计)
3. [前端组件树](#3-前端组件树)
4. [Pinia Store](#4-pinia-store)
5. [LLM 集成方案](#5-llm-集成方案)
6. [种子数据方案](#6-种子数据方案)
7. [与文章阅读工具的集成](#7-与文章阅读工具的集成)

---

## 1. 数据库设计

### 1.1 Schema 文件

新建 `server/database/schemas/startup-map.ts`，在 `server/database/schema.ts` 中添加 `export * from './schemas/startup-map'`。

遵循项目约定：整数自增 ID、Unix 毫秒时间戳（`integer` + `mode: 'number'`）、cascade 删除外键、表名前缀 `sm_`。

### 1.2 表结构定义

```typescript
import {
  sqliteTable, text, integer, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/sqlite-core';
import { llmProviders } from './llm';
import { articles } from './articles';

// ===== 领域 =====
export const smDomains = sqliteTable('sm_domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_domains_sort').on(table.sortOrder),
]);

// ===== 主题 =====
export const smTopics = sqliteTable('sm_topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull()
    .references(() => smDomains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_sm_topics_domain').on(table.domainId),
  index('idx_sm_topics_sort').on(table.domainId, table.sortOrder),
]);

// ===== 学习阶段 =====
export const smStages = sqliteTable('sm_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  goal: text('goal').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_sm_stages_sort').on(table.sortOrder),
]);

// ===== 知识点 =====
export const smPoints = sqliteTable('sm_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: integer('topic_id').notNull()
    .references(() => smTopics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', {
    enum: ['not_started', 'learning', 'understood', 'practiced'],
  }).notNull().default('not_started'),
  stageId: integer('stage_id')
    .references(() => smStages.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  statusChangedAt: integer('status_changed_at', { mode: 'number' }),
}, (table) => [
  index('idx_sm_points_topic').on(table.topicId),
  index('idx_sm_points_sort').on(table.topicId, table.sortOrder),
  index('idx_sm_points_status').on(table.status),
  index('idx_sm_points_stage').on(table.stageId),
  index('idx_sm_points_status_changed').on(table.statusChangedAt),
]);

// ===== AI 生成的教学内容 =====
export const smPointContent = sqliteTable('sm_point_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  what: text('what').notNull().default(''),
  how: text('how').notNull().default(''),
  example: text('example').notNull().default(''),
  apply: text('apply').notNull().default(''),
  resources: text('resources').notNull().default(''),
  providerId: integer('provider_id')
    .references(() => llmProviders.id, { onDelete: 'set null' }),
  generatedAt: integer('generated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_sm_point_content_point').on(table.pointId),
]);

// ===== 知识点 AI 对话 =====
export const smPointChats = sqliteTable('sm_point_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),           // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_point_chats_point').on(table.pointId),
  index('idx_sm_point_chats_created').on(table.createdAt),
]);

// ===== 知识点笔记 =====
export const smPointNotes = sqliteTable('sm_point_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  uniqueIndex('idx_sm_point_notes_point').on(table.pointId),
]);

// ===== 实践任务 =====
export const smPracticeTasks = sqliteTable('sm_practice_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  expectedOutput: text('expected_output').notNull().default(''),
  hint: text('hint').notNull().default(''),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  completedNote: text('completed_note'),
  completedAt: integer('completed_at', { mode: 'number' }),
}, (table) => [
  index('idx_sm_practice_tasks_point').on(table.pointId),
  index('idx_sm_practice_tasks_completed').on(table.isCompleted),
]);

// ===== 产品档案 =====
export const smProductProfiles = sqliteTable('sm_product_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  targetMarket: text('target_market').notNull().default(''),
  targetCustomer: text('target_customer').notNull().default(''),
  productionSource: text('production_source').notNull().default(''),
  currentStage: text('current_stage', {
    enum: ['ideation', 'researching', 'preparing', 'launched'],
  }).notNull().default('ideation'),
  additionalInfo: text('additional_info').notNull().default(''),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_product_profiles_active').on(table.isActive),
]);

// ===== 学习记录 =====
export const smLearningLogs = sqliteTable('sm_learning_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pointId: integer('point_id')
    .references(() => smPoints.id, { onDelete: 'set null' }),
  actionType: text('action_type', {
    enum: ['view', 'chat', 'note', 'task', 'status_change'],
  }).notNull(),
  detail: text('detail').notNull().default(''),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (table) => [
  index('idx_sm_learning_logs_point').on(table.pointId),
  index('idx_sm_learning_logs_created').on(table.createdAt),
  index('idx_sm_learning_logs_action').on(table.actionType),
]);

// ===== 知识点-文章关联（junction table）=====
export const smPointArticles = sqliteTable('sm_point_articles', {
  pointId: integer('point_id').notNull()
    .references(() => smPoints.id, { onDelete: 'cascade' }),
  articleId: integer('article_id').notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.pointId, table.articleId] }),
  index('idx_sm_point_articles_article').on(table.articleId),
]);
```

### 1.3 类型导出

在 schema 文件末尾导出推导类型，供 API handler 使用：

```typescript
// 类型推导
export type SmDomain = typeof smDomains.$inferSelect;
export type NewSmDomain = typeof smDomains.$inferInsert;
export type SmTopic = typeof smTopics.$inferSelect;
export type NewSmTopic = typeof smTopics.$inferInsert;
export type SmStage = typeof smStages.$inferSelect;
export type NewSmStage = typeof smStages.$inferInsert;
export type SmPoint = typeof smPoints.$inferSelect;
export type NewSmPoint = typeof smPoints.$inferInsert;
export type SmPointContent = typeof smPointContent.$inferSelect;
export type NewSmPointContent = typeof smPointContent.$inferInsert;
export type SmPointChat = typeof smPointChats.$inferSelect;
export type NewSmPointChat = typeof smPointChats.$inferInsert;
export type SmPointNote = typeof smPointNotes.$inferSelect;
export type NewSmPointNote = typeof smPointNotes.$inferInsert;
export type SmPracticeTask = typeof smPracticeTasks.$inferSelect;
export type NewSmPracticeTask = typeof smPracticeTasks.$inferInsert;
export type SmProductProfile = typeof smProductProfiles.$inferSelect;
export type NewSmProductProfile = typeof smProductProfiles.$inferInsert;
export type SmLearningLog = typeof smLearningLogs.$inferSelect;
export type NewSmLearningLog = typeof smLearningLogs.$inferInsert;
export type SmPointArticle = typeof smPointArticles.$inferSelect;
export type NewSmPointArticle = typeof smPointArticles.$inferInsert;
```

### 1.4 索引策略总结

| 表 | 索引 | 用途 |
|---|---|---|
| `sm_domains` | `sort_order` | 领域排序 |
| `sm_topics` | `domain_id`; `(domain_id, sort_order)` | 按领域查询、按领域内排序 |
| `sm_stages` | `sort_order` | 阶段排序 |
| `sm_points` | `topic_id`; `(topic_id, sort_order)`; `status`; `stage_id`; `status_changed_at` | 按主题查询排序、按状态筛选、按阶段筛选、统计时间范围 |
| `sm_point_content` | `point_id` UNIQUE | 一对一关系，按知识点查内容 |
| `sm_point_chats` | `point_id`; `created_at` | 按知识点查对话、按时间排序 |
| `sm_point_notes` | `point_id` UNIQUE | 一对一关系，按知识点查笔记 |
| `sm_practice_tasks` | `point_id`; `is_completed` | 按知识点查任务、按完成状态筛选 |
| `sm_product_profiles` | `is_active` | 查询当前激活产品 |
| `sm_learning_logs` | `point_id`; `created_at`; `action_type` | 按知识点/时间/类型查记录（热力图） |
| `sm_point_articles` | `(point_id, article_id)` PK; `article_id` | 联合主键 + 反向查询 |

### 1.5 ER 关系图

```
smDomains 1──N smTopics 1──N smPoints
                                │
                    ┌───────────┼───────────────┬──────────────┐
                    │           │               │              │
              smPointContent  smPointChats  smPointNotes  smPracticeTasks
              (1:1 unique)    (1:N)         (1:1 unique)   (1:N)
                    │
                    └── llmProviders (FK nullable)

smStages 1──N smPoints (FK nullable, set null on delete)

smPoints N──M articles (via smPointArticles junction table)

smProductProfiles (独立表，isActive 标记当前产品)

smLearningLogs ──> smPoints (FK nullable, set null on delete)
```

---

## 2. API 路由设计

路由前缀 `/api/startup-map/`，遵循 Nuxt 文件路由约定（方法后缀：`.get.ts`、`.post.ts`、`.put.ts`、`.delete.ts`）。

### 2.1 文件结构

```
server/api/startup-map/
├── domains/
│   ├── index.get.ts            GET    /api/startup-map/domains
│   └── [id].get.ts             GET    /api/startup-map/domains/:id
├── points/
│   ├── [id].get.ts             GET    /api/startup-map/points/:id
│   ├── [id]/
│   │   ├── status.put.ts       PUT    /api/startup-map/points/:id/status
│   │   ├── content.post.ts     POST   /api/startup-map/points/:id/content
│   │   ├── content-regenerate.post.ts  POST   /api/startup-map/points/:id/content-regenerate
│   │   ├── chat.post.ts        POST   /api/startup-map/points/:id/chat
│   │   ├── chats.get.ts        GET    /api/startup-map/points/:id/chats
│   │   ├── chats.delete.ts     DELETE /api/startup-map/points/:id/chats
│   │   ├── notes.put.ts        PUT    /api/startup-map/points/:id/notes
│   │   ├── tasks.get.ts        GET    /api/startup-map/points/:id/tasks
│   │   ├── tasks/
│   │   │   └── [taskId]/
│   │   │       └── complete.post.ts  POST  /api/startup-map/points/:id/tasks/:taskId/complete
│   │   └── articles.put.ts     PUT    /api/startup-map/points/:id/articles
├── stages/
│   ├── index.get.ts            GET    /api/startup-map/stages
│   └── [id].get.ts             GET    /api/startup-map/stages/:id
├── profiles/
│   ├── index.get.ts            GET    /api/startup-map/profiles
│   ├── index.post.ts           POST   /api/startup-map/profiles
│   ├── [id].put.ts             PUT    /api/startup-map/profiles/:id
│   ├── [id].delete.ts          DELETE /api/startup-map/profiles/:id
│   └── [id]/
│       └── activate.post.ts    POST   /api/startup-map/profiles/:id/activate
├── stats/
│   ├── overview.get.ts         GET    /api/startup-map/stats/overview
│   └── heatmap.get.ts          GET    /api/startup-map/stats/heatmap
└── seed.post.ts                POST   /api/startup-map/seed
```

### 2.2 各端点详细说明

#### 领域 (Domains)

**`GET /api/startup-map/domains`** -- 获取所有领域及统计

返回类型：

```typescript
interface DomainListItem {
  id: number;
  name: string;
  description: string;
  sortOrder: number;
  topicCount: number;        // 该领域下的主题数
  pointCount: number;        // 该领域下的知识点总数
  completedCount: number;    // 状态为 understood 或 practiced 的知识点数
}
// Response: DomainListItem[]
```

实现要点：通过 JOIN `smTopics` 和 `smPoints` 聚合统计，按 `sortOrder` 排序。使用子查询避免 N+1。

**`GET /api/startup-map/domains/:id`** -- 领域详情（含主题和知识点）

返回类型：

```typescript
interface DomainDetail {
  id: number;
  name: string;
  description: string;
  topics: Array<{
    id: number;
    name: string;
    description: string;
    sortOrder: number;
    points: Array<{
      id: number;
      name: string;
      status: PointStatus;
      articleCount: number;
    }>;
  }>;
  stats: {
    pointCount: number;
    completedCount: number;
  };
}
```

实现要点：一次查询获取领域，再查该领域下的 topics + points（带 LEFT JOIN `smPointArticles` 计算关联文章数），在内存中组装层级结构。

#### 知识点 (Points)

**`GET /api/startup-map/points/:id`** -- 知识点完整详情

返回类型：

```typescript
interface PointDetail {
  id: number;
  name: string;
  description: string;
  status: PointStatus;
  stageId: number | null;
  // 上下文导航
  topic: { id: number; name: string };
  domain: { id: number; name: string };
  // 教学内容
  content: SmPointContent | null;
  // 笔记
  notes: { content: string; updatedAt: number } | null;
  // 实践任务
  tasks: SmPracticeTask[];
  // 最近对话（最后 5 条，用于预览）
  recentChats: SmPointChat[];
  // 关联文章
  articles: Array<{
    id: number;
    title: string;
    url: string;
    siteName: string | null;
  }>;
}
```

实现要点：一次请求返回所有子资源，减少前端请求数。对话仅返回最后 5 条用于预览，完整历史通过 `chats.get.ts` 单独获取。同时记录一条 `view` 类型学习日志。

**`PUT /api/startup-map/points/:id/status`** -- 更新学习状态

请求体：`{ status: 'not_started' | 'learning' | 'understood' | 'practiced' }`

更新 `status`、`statusChangedAt`、`updatedAt`。同时写入一条 `status_change` 类型学习日志，`detail` 记录旧状态和新状态。

**`POST /api/startup-map/points/:id/content`** -- AI 生成教学内容（流式 SSE）

请求体：`{ providerId?: number }`

前置检查：如果 `smPointContent` 中已存在该知识点的内容，直接返回缓存（与 `translate-stream.post.ts` 同一模式）。如不存在，调用 LLM 流式生成。

SSE 事件格式：

```
data: { "type": "chunk", "section": "what", "content": "..." }
data: { "type": "chunk", "section": "how", "content": "..." }
...
data: { "type": "tasks", "tasks": [...] }
data: { "type": "done" }
data: { "type": "error", "message": "..." }
```

生成完毕后保存到 `smPointContent` 和 `smPracticeTasks`。

**`POST /api/startup-map/points/:id/content-regenerate`** -- 重新生成教学内容

请求体：`{ providerId?: number }`

删除旧的 `smPointContent` 和 `smPracticeTasks`（不删除笔记和对话），使用与 `content.post.ts` 相同的生成逻辑强制重新生成。

**`POST /api/startup-map/points/:id/chat`** -- AI 对话（流式 SSE）

请求体：`{ message: string, providerId?: number }`

构建消息链：系统 prompt（含知识点上下文 + 产品档案）+ 历史对话记录 + 用户新消息。流式 SSE 输出，完毕后保存 user + assistant 消息到 `smPointChats`。写入 `chat` 类型学习日志。

SSE 事件格式：

```
data: { "type": "chunk", "content": "..." }
data: { "type": "done", "userMessage": {...}, "assistantMessage": {...} }
data: { "type": "error", "message": "..." }
```

**`GET /api/startup-map/points/:id/chats`** -- 获取对话历史

返回该知识点下所有对话消息，按 `createdAt` ASC 排序。

**`DELETE /api/startup-map/points/:id/chats`** -- 清空对话

删除该知识点下所有 `smPointChats` 记录。

**`PUT /api/startup-map/points/:id/notes`** -- 保存笔记

请求体：`{ content: string }`

UPSERT 逻辑：如果不存在则 INSERT，存在则 UPDATE content 和 updatedAt。写入 `note` 类型学习日志。

**`GET /api/startup-map/points/:id/tasks`** -- 获取实践任务

返回该知识点下所有任务。

**`POST /api/startup-map/points/:id/tasks/:taskId/complete`** -- 完成任务

请求体：`{ completedNote?: string }`

更新 `isCompleted = true`、`completedNote`、`completedAt`。写入 `task` 类型学习日志。

**`PUT /api/startup-map/points/:id/articles`** -- 更新关联文章

请求体：`{ articleIds: number[] }`

全量替换策略：先删除该知识点的所有关联，再批量插入新关联。返回更新后的关联文章列表。

#### 学习阶段 (Stages)

**`GET /api/startup-map/stages`** -- 获取所有阶段（含进度）

```typescript
interface StageListItem {
  id: number;
  name: string;
  description: string;
  goal: string;
  sortOrder: number;
  pointCount: number;       // 该阶段包含的知识点数
  completedCount: number;   // 已完成的知识点数
  isCompleted: boolean;     // 所有知识点是否都 >= understood
}
```

**`GET /api/startup-map/stages/:id`** -- 阶段详情（含知识点列表）

```typescript
interface StageDetail {
  id: number;
  name: string;
  description: string;
  goal: string;
  points: Array<{
    id: number;
    name: string;
    status: PointStatus;
    topic: { id: number; name: string };
    domain: { id: number; name: string };
  }>;
}
```

#### 产品档案 (Profiles)

**`GET /api/startup-map/profiles`** -- 获取所有产品档案

返回 `SmProductProfile[]`，按 `createdAt` DESC 排序。

**`POST /api/startup-map/profiles`** -- 创建产品档案

请求体：

```typescript
{
  name: string;
  description?: string;
  targetMarket?: string;
  targetCustomer?: string;
  productionSource?: string;
  currentStage?: 'ideation' | 'researching' | 'preparing' | 'launched';
  additionalInfo?: string;
}
```

如果是第一个产品档案，自动设置 `isActive = true`。

**`PUT /api/startup-map/profiles/:id`** -- 更新产品档案

请求体与创建相同（部分字段可选）。

**`DELETE /api/startup-map/profiles/:id`** -- 删除产品档案

如果删除的是 active 产品，自动将最早创建的其他产品设为 active。

**`POST /api/startup-map/profiles/:id/activate`** -- 设为当前产品

事务操作：先将所有产品 `isActive = false`，再将目标产品 `isActive = true`。

#### 统计 (Stats)

**`GET /api/startup-map/stats/overview`** -- 全局统计

```typescript
interface OverviewStats {
  totalPoints: number;
  statusCounts: {
    not_started: number;
    learning: number;
    understood: number;
    practiced: number;
  };
  completionRate: number;           // (understood + practiced) / total
  currentStageId: number | null;    // 最早未完成的阶段 ID
  currentStageName: string | null;
  streakDays: number;               // 连续学习天数
  suggestedPoints: Array<{          // 建议下一步学习的知识点（1-3 个）
    id: number;
    name: string;
    domain: string;
    topic: string;
  }>;
}
```

连续天数计算：从今天往前查 `smLearningLogs`，按日期去重计算连续天数。

建议逻辑：取当前阶段中 `status = 'not_started'` 的知识点，按 `sortOrder` 取前 3 个。如果当前阶段全部完成，推荐下一阶段的前 3 个。

**`GET /api/startup-map/stats/heatmap`** -- 学习热力图数据

查询参数：`?year=2026`（默认当前年）

```typescript
interface HeatmapData {
  year: number;
  days: Array<{
    date: string;       // 'YYYY-MM-DD'
    count: number;      // 当天学习行为总数
  }>;
  totalActions: number;
  activeDays: number;
}
```

实现要点：查询 `smLearningLogs`，按 `createdAt` 的日期分组聚合 COUNT。将 Unix 毫秒转为日期字符串进行分组（SQLite 中用 `date(created_at / 1000, 'unixepoch', 'localtime')`）。

#### 种子数据 (Seed)

**`POST /api/startup-map/seed`** -- 种子数据初始化

仅在非生产环境可用（或检查数据是否已存在，避免重复初始化）。读取 `server/data/startup-map-seed.json`，在事务中批量写入领域、主题、知识点、阶段数据。返回写入统计：`{ domains: number, topics: number, points: number, stages: number }`。

### 2.3 通用 API 模式

所有 handler 遵循项目既有模式：

```typescript
export default defineEventHandler(async (event) => {
  // 1. 参数校验
  const id = Number(getRouterParam(event, 'id'));
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的 ID' });
  }

  // 2. 在 handler 内获取 DB（不在模块级别）
  const db = useDB();

  // 3. 查询/校验存在性
  const [point] = await db.select().from(smPoints).where(eq(smPoints.id, id)).limit(1);
  if (!point) {
    throw createError({ statusCode: 404, message: '知识点不存在' });
  }

  // 4. 执行业务逻辑
  // ...

  // 5. 返回结果
  return result;
});
```

### 2.4 学习日志写入工具函数

提取公共的日志写入函数，避免每个 handler 重复逻辑：

```typescript
// server/utils/startup-map-log.ts
import { useDB } from '~/server/database';
import { smLearningLogs } from '~/server/database/schema';

type ActionType = 'view' | 'chat' | 'note' | 'task' | 'status_change';

export async function logLearningAction(
  pointId: number | null,
  actionType: ActionType,
  detail: string = '',
) {
  const db = useDB();
  await db.insert(smLearningLogs).values({
    pointId,
    actionType,
    detail,
    createdAt: Date.now(),
  });
}
```

---

## 3. 前端组件树

### 3.1 文件结构

```
tools/startup-map/
├── index.ts                  工具注册入口
├── types.ts                  所有前端类型定义
├── StartupMap.vue            根组件（视图路由 + 顶部导航）
└── components/
    ├── GlobalView.vue        全局视图（领域卡片网格 + 统计 + 学习建议）
    ├── DomainCard.vue        领域卡片（进度条 + 统计摘要）
    ├── DomainDetail.vue      领域详情（主题分组 + 知识点列表）
    ├── PointPage.vue         知识点学习页（核心页面，组装各子面板）
    ├── PointContent.vue      教学内容展示（6 个可折叠板块）
    ├── PointChat.vue         AI 对话面板
    ├── PointNotes.vue        笔记编辑器（Markdown 编辑 + 实时预览）
    ├── PracticeTasks.vue     实践任务列表
    ├── StatusBadge.vue       学习状态标记（带颜色圆点 + 文字）
    ├── StageView.vue         阶段视图（时间线 + 阶段详情）
    ├── StageTimeline.vue     阶段时间线组件
    ├── HeatmapView.vue       学习热力图
    ├── ProfileManager.vue    产品档案管理（列表 + 表单）
    ├── ArticleLinker.vue     文章关联面板（搜索 + 选择 + 已关联列表）
    └── Breadcrumb.vue        面包屑导航
```

### 3.2 工具注册

```typescript
// tools/startup-map/index.ts
import { Map } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'startup-map',
  name: '创业地图',
  icon: Map,
  order: 5,
  component: () => import('./StartupMap.vue'),
  namespaces: ['startup-map'],
});
```

在 `tools/index.ts` 中添加：

```typescript
import './startup-map';
```

### 3.3 核心组件设计

#### StartupMap.vue -- 根组件

```
┌──────────────────────────────────────────┐
│  [全局] [阶段] [热力图] [产品档案]        │  <-- 顶部 Tab 导航
│  Breadcrumb: 全局视图 > 市场研究 > ...    │  <-- 面包屑（仅 domain/point 视图显示）
├──────────────────────────────────────────┤
│                                          │
│    <component :is="currentViewComponent">│  <-- 动态组件切换
│                                          │
└──────────────────────────────────────────┘
```

根据 Store 中的 `currentView` 状态动态渲染对应视图组件。顶部 Tab 控制一级视图切换（global / stages / heatmap / profiles）。面包屑仅在 domain 和 point 视图中显示，支持点击回退。

#### PointPage.vue -- 知识点学习页（核心）

```
┌──────────────────────────────────────────────────────┐
│  Breadcrumb: 全局视图 > 市场研究 > 竞品分析 > 竞品识别 │
│  StatusBadge: [学习中 ▼]                              │  <-- 可切换状态
├─────────────────────────┬────────────────────────────┤
│                         │                            │
│   PointContent          │   PointChat                │  <-- 桌面端左右并排
│   (6 个折叠板块)         │   (AI 对话面板)             │
│                         │                            │
│   PracticeTasks         │                            │
│   (实践任务列表)         │                            │
│                         │                            │
│   PointNotes            │                            │
│   (Markdown 笔记)       │                            │
│                         │                            │
│   ArticleLinker         │                            │
│   (关联文章)             │                            │
│                         │                            │
└─────────────────────────┴────────────────────────────┘
```

- 桌面端：左侧 60% 为内容区（教学内容 + 任务 + 笔记 + 文章），右侧 40% 为 AI 对话。
- 移动端：上下排列，内容区在上，对话区在下（通过 `useIsMobile` composable 判断）。
- 首次进入自动触发教学内容生成（如果 `content` 为 null）。

#### PointContent.vue -- 教学内容展示

- 6 个可折叠板块：是什么 (What)、怎么做 (How)、案例 (Example)、我的应用 (Apply)、推荐资源 (Resources)、我的笔记 (Notes)。
- 内容以 Markdown 渲染。
- "重新生成"按钮放在顶部，操作后保留笔记不变。
- 生成中状态：显示流式文本 + loading 动画。

#### PointChat.vue -- AI 对话面板

- 与 `article-reader` 中的 chat 组件模式一致。
- 消息列表 + 底部输入框。
- 支持流式输出（SSE 逐字显示）。
- 头部显示"清空对话"按钮。
- 空状态引导文案：「问我任何关于"[知识点名称]"的问题，我会结合你的产品来回答。」

#### PointNotes.vue -- 笔记编辑器

- Markdown 编辑器 + 实时预览（左右并排或 Tab 切换）。
- 自动保存：输入停止 1 秒后自动调用 `saveNotes`。
- 显示"已保存"/"保存中"状态提示。

#### ProfileManager.vue -- 产品档案管理

- 产品列表 + 表单编辑。
- 当前激活产品高亮标识。
- 切换产品时显示确认提示。

### 3.4 类型定义

```typescript
// tools/startup-map/types.ts

// ===== 核心类型 =====

export type PointStatus = 'not_started' | 'learning' | 'understood' | 'practiced';

export type ProfileStage = 'ideation' | 'researching' | 'preparing' | 'launched';

export type ActionType = 'view' | 'chat' | 'note' | 'task' | 'status_change';

export type ViewType = 'global' | 'domain' | 'point' | 'stages' | 'heatmap' | 'profiles';

// ===== 领域 =====

export interface DomainListItem {
  id: number;
  name: string;
  description: string;
  sortOrder: number;
  topicCount: number;
  pointCount: number;
  completedCount: number;
}

export interface DomainDetail {
  id: number;
  name: string;
  description: string;
  topics: TopicWithPoints[];
  stats: {
    pointCount: number;
    completedCount: number;
  };
}

export interface TopicWithPoints {
  id: number;
  name: string;
  description: string;
  sortOrder: number;
  points: PointListItem[];
}

export interface PointListItem {
  id: number;
  name: string;
  status: PointStatus;
  articleCount: number;
}

// ===== 知识点 =====

export interface PointDetail {
  id: number;
  name: string;
  description: string;
  status: PointStatus;
  stageId: number | null;
  topic: { id: number; name: string };
  domain: { id: number; name: string };
  content: PointContent | null;
  notes: { content: string; updatedAt: number } | null;
  tasks: PracticeTask[];
  recentChats: ChatMessage[];
  articles: LinkedArticle[];
}

export interface PointContent {
  id: number;
  pointId: number;
  what: string;
  how: string;
  example: string;
  apply: string;
  resources: string;
  providerId: number | null;
  generatedAt: number;
}

export interface PracticeTask {
  id: number;
  pointId: number;
  description: string;
  expectedOutput: string;
  hint: string;
  isCompleted: boolean;
  completedNote: string | null;
  completedAt: number | null;
}

export interface ChatMessage {
  id: number;
  pointId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface LinkedArticle {
  id: number;
  title: string;
  url: string;
  siteName: string | null;
}

// ===== 学习阶段 =====

export interface StageListItem {
  id: number;
  name: string;
  description: string;
  goal: string;
  sortOrder: number;
  pointCount: number;
  completedCount: number;
  isCompleted: boolean;
}

export interface StageDetail {
  id: number;
  name: string;
  description: string;
  goal: string;
  points: Array<{
    id: number;
    name: string;
    status: PointStatus;
    topic: { id: number; name: string };
    domain: { id: number; name: string };
  }>;
}

// ===== 产品档案 =====

export interface ProductProfile {
  id: number;
  name: string;
  description: string;
  targetMarket: string;
  targetCustomer: string;
  productionSource: string;
  currentStage: ProfileStage;
  additionalInfo: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProfileRequest {
  name: string;
  description?: string;
  targetMarket?: string;
  targetCustomer?: string;
  productionSource?: string;
  currentStage?: ProfileStage;
  additionalInfo?: string;
}

// ===== 统计 =====

export interface OverviewStats {
  totalPoints: number;
  statusCounts: Record<PointStatus, number>;
  completionRate: number;
  currentStageId: number | null;
  currentStageName: string | null;
  streakDays: number;
  suggestedPoints: Array<{
    id: number;
    name: string;
    domain: string;
    topic: string;
  }>;
}

export interface HeatmapData {
  year: number;
  days: Array<{ date: string; count: number }>;
  totalActions: number;
  activeDays: number;
}

// ===== SSE 事件类型 =====

export type ContentSSEEvent =
  | { type: 'chunk'; section: string; content: string }
  | { type: 'tasks'; tasks: PracticeTask[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ChatSSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; userMessage: ChatMessage; assistantMessage: ChatMessage }
  | { type: 'error'; message: string };
```

---

## 4. Pinia Store

### 4.1 文件位置

`stores/startup-map.ts`，Composition API 风格（`defineStore('startup-map', () => { ... })`）。

### 4.2 完整结构

```typescript
// stores/startup-map.ts
import { defineStore } from 'pinia';
import type {
  ViewType,
  DomainListItem,
  DomainDetail,
  PointDetail,
  PointContent,
  ChatMessage,
  PracticeTask,
  StageListItem,
  StageDetail,
  ProductProfile,
  CreateProfileRequest,
  OverviewStats,
  HeatmapData,
  PointStatus,
  ContentSSEEvent,
  ChatSSEEvent,
} from '~/tools/startup-map/types';

export const useStartupMapStore = defineStore('startup-map', () => {

  // ========== 导航状态 ==========

  const currentView = ref<ViewType>('global');
  const currentDomainId = ref<number | null>(null);
  const currentPointId = ref<number | null>(null);

  // ========== 知识树数据 ==========

  const domains = ref<DomainListItem[]>([]);
  const domainsLoading = ref(false);

  const currentDomainDetail = ref<DomainDetail | null>(null);
  const domainDetailLoading = ref(false);

  const currentPoint = ref<PointDetail | null>(null);
  const pointLoading = ref(false);

  // ========== 教学内容 ==========

  const contentGenerating = ref(false);
  const contentStreamText = ref<Record<string, string>>({});  // section -> accumulated text

  // ========== AI 对话 ==========

  const pointChats = ref<ChatMessage[]>([]);
  const chatLoading = ref(false);
  const chatError = ref<string | null>(null);
  const chatStreamText = ref('');  // 流式输出累积文本

  // ========== 笔记 ==========

  const notesSaving = ref(false);

  // ========== 实践任务 ==========

  const practiceTasks = ref<PracticeTask[]>([]);

  // ========== 学习阶段 ==========

  const stages = ref<StageListItem[]>([]);
  const stagesLoading = ref(false);
  const currentStageDetail = ref<StageDetail | null>(null);

  // ========== 产品档案 ==========

  const profiles = ref<ProductProfile[]>([]);
  const profilesLoading = ref(false);
  const activeProfile = computed(() => profiles.value.find(p => p.isActive));

  // ========== 统计 ==========

  const globalStats = ref<OverviewStats | null>(null);
  const heatmapData = ref<HeatmapData | null>(null);

  // ========== 导航 Actions ==========

  function navigateTo(view: ViewType, params?: { domainId?: number; pointId?: number }) {
    currentView.value = view;
    if (params?.domainId !== undefined) currentDomainId.value = params.domainId;
    if (params?.pointId !== undefined) currentPointId.value = params.pointId;
  }

  function goToGlobal() {
    navigateTo('global');
    currentDomainId.value = null;
    currentPointId.value = null;
  }

  function goToDomain(domainId: number) {
    navigateTo('domain', { domainId });
    currentPointId.value = null;
    loadDomainDetail(domainId);
  }

  function goToPoint(pointId: number) {
    navigateTo('point', { pointId });
    loadPoint(pointId);
  }

  // ========== 数据加载 Actions ==========

  async function loadDomains() {
    domainsLoading.value = true;
    try {
      domains.value = await $fetch<DomainListItem[]>('/api/startup-map/domains');
    } finally {
      domainsLoading.value = false;
    }
  }

  async function loadDomainDetail(domainId: number) {
    domainDetailLoading.value = true;
    try {
      currentDomainDetail.value = await $fetch<DomainDetail>(
        `/api/startup-map/domains/${domainId}`,
      );
    } finally {
      domainDetailLoading.value = false;
    }
  }

  async function loadPoint(pointId: number) {
    pointLoading.value = true;
    try {
      currentPoint.value = await $fetch<PointDetail>(
        `/api/startup-map/points/${pointId}`,
      );
      // 同步子状态
      practiceTasks.value = currentPoint.value?.tasks ?? [];
      pointChats.value = currentPoint.value?.recentChats ?? [];
    } finally {
      pointLoading.value = false;
    }
  }

  // ========== 教学内容 Actions ==========

  async function generateContent(pointId: number, regenerate = false) {
    contentGenerating.value = true;
    contentStreamText.value = {};

    const endpoint = regenerate
      ? `/api/startup-map/points/${pointId}/content-regenerate`
      : `/api/startup-map/points/${pointId}/content`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event: ContentSSEEvent = JSON.parse(line.slice(6));

          if (event.type === 'chunk') {
            contentStreamText.value = {
              ...contentStreamText.value,
              [event.section]: (contentStreamText.value[event.section] || '') + event.content,
            };
          } else if (event.type === 'tasks') {
            practiceTasks.value = event.tasks;
          } else if (event.type === 'done') {
            // 重新加载完整的知识点数据
            await loadPoint(pointId);
          }
        }
      }
    } finally {
      contentGenerating.value = false;
    }
  }

  // ========== AI 对话 Actions ==========

  async function loadChatHistory(pointId: number) {
    try {
      pointChats.value = await $fetch<ChatMessage[]>(
        `/api/startup-map/points/${pointId}/chats`,
      );
    } catch {
      pointChats.value = [];
    }
  }

  async function sendChat(pointId: number, message: string) {
    if (!message.trim()) return;
    chatLoading.value = true;
    chatError.value = null;
    chatStreamText.value = '';

    // 乐观添加用户消息
    const tempUserMsg: ChatMessage = {
      id: -Date.now(),
      pointId,
      role: 'user',
      content: message.trim(),
      createdAt: Date.now(),
    };
    pointChats.value = [...pointChats.value, tempUserMsg];

    try {
      const response = await fetch(`/api/startup-map/points/${pointId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      // 添加流式 assistant 消息占位
      const tempAssistantMsg: ChatMessage = {
        id: -(Date.now() + 1),
        pointId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };
      pointChats.value = [...pointChats.value, tempAssistantMsg];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event: ChatSSEEvent = JSON.parse(line.slice(6));

          if (event.type === 'chunk') {
            chatStreamText.value += event.content;
            // 更新流式消息内容
            const lastMsg = pointChats.value[pointChats.value.length - 1];
            if (lastMsg && lastMsg.id === tempAssistantMsg.id) {
              pointChats.value = pointChats.value.map(m =>
                m.id === tempAssistantMsg.id
                  ? { ...m, content: chatStreamText.value }
                  : m,
              );
            }
          } else if (event.type === 'done') {
            // 替换临时消息为真实消息
            pointChats.value = pointChats.value
              .filter(m => m.id !== tempUserMsg.id && m.id !== tempAssistantMsg.id)
              .concat([event.userMessage, event.assistantMessage]);
          }
        }
      }
    } catch (e: any) {
      // 移除临时消息
      pointChats.value = pointChats.value.filter(m => m.id !== tempUserMsg.id);
      chatError.value = e?.data?.message || e?.message || 'AI 回复失败';
    } finally {
      chatLoading.value = false;
      chatStreamText.value = '';
    }
  }

  async function clearChat(pointId: number) {
    try {
      await $fetch(`/api/startup-map/points/${pointId}/chats`, { method: 'DELETE' });
      pointChats.value = [];
    } catch {
      // Silently fail
    }
  }

  // ========== 笔记 Actions ==========

  async function saveNotes(pointId: number, content: string) {
    notesSaving.value = true;
    try {
      await $fetch(`/api/startup-map/points/${pointId}/notes`, {
        method: 'PUT',
        body: { content },
      });
      if (currentPoint.value && currentPoint.value.id === pointId) {
        currentPoint.value = {
          ...currentPoint.value,
          notes: { content, updatedAt: Date.now() },
        };
      }
    } finally {
      notesSaving.value = false;
    }
  }

  // ========== 状态变更 Actions ==========

  async function updatePointStatus(pointId: number, status: PointStatus) {
    await $fetch(`/api/startup-map/points/${pointId}/status`, {
      method: 'PUT',
      body: { status },
    });
    // 更新本地状态
    if (currentPoint.value && currentPoint.value.id === pointId) {
      currentPoint.value = { ...currentPoint.value, status };
    }
    // 如果在领域详情视图，也更新列表中的状态
    if (currentDomainDetail.value) {
      for (const topic of currentDomainDetail.value.topics) {
        const pt = topic.points.find(p => p.id === pointId);
        if (pt) {
          pt.status = status;
          break;
        }
      }
    }
  }

  // ========== 实践任务 Actions ==========

  async function completeTask(pointId: number, taskId: number, completedNote?: string) {
    await $fetch(`/api/startup-map/points/${pointId}/tasks/${taskId}/complete`, {
      method: 'POST',
      body: { completedNote },
    });
    practiceTasks.value = practiceTasks.value.map(t =>
      t.id === taskId
        ? { ...t, isCompleted: true, completedNote: completedNote || null, completedAt: Date.now() }
        : t,
    );
  }

  // ========== 文章关联 Actions ==========

  async function updateLinkedArticles(pointId: number, articleIds: number[]) {
    const articles = await $fetch<any[]>(`/api/startup-map/points/${pointId}/articles`, {
      method: 'PUT',
      body: { articleIds },
    });
    if (currentPoint.value && currentPoint.value.id === pointId) {
      currentPoint.value = { ...currentPoint.value, articles };
    }
  }

  // ========== 学习阶段 Actions ==========

  async function loadStages() {
    stagesLoading.value = true;
    try {
      stages.value = await $fetch<StageListItem[]>('/api/startup-map/stages');
    } finally {
      stagesLoading.value = false;
    }
  }

  async function loadStageDetail(stageId: number) {
    currentStageDetail.value = await $fetch<StageDetail>(
      `/api/startup-map/stages/${stageId}`,
    );
  }

  // ========== 产品档案 Actions ==========

  async function loadProfiles() {
    profilesLoading.value = true;
    try {
      profiles.value = await $fetch<ProductProfile[]>('/api/startup-map/profiles');
    } finally {
      profilesLoading.value = false;
    }
  }

  async function createProfile(data: CreateProfileRequest) {
    const profile = await $fetch<ProductProfile>('/api/startup-map/profiles', {
      method: 'POST',
      body: data,
    });
    await loadProfiles();
    return profile;
  }

  async function updateProfile(id: number, data: Partial<CreateProfileRequest>) {
    const profile = await $fetch<ProductProfile>(`/api/startup-map/profiles/${id}`, {
      method: 'PUT',
      body: data,
    });
    await loadProfiles();
    return profile;
  }

  async function deleteProfile(id: number) {
    await $fetch(`/api/startup-map/profiles/${id}`, { method: 'DELETE' });
    await loadProfiles();
  }

  async function activateProfile(id: number) {
    await $fetch(`/api/startup-map/profiles/${id}/activate`, { method: 'POST' });
    await loadProfiles();
  }

  // ========== 统计 Actions ==========

  async function loadStats() {
    globalStats.value = await $fetch<OverviewStats>('/api/startup-map/stats/overview');
  }

  async function loadHeatmap(year?: number) {
    const params = year ? { year } : {};
    heatmapData.value = await $fetch<HeatmapData>('/api/startup-map/stats/heatmap', {
      params,
    });
  }

  // ========== 导出 ==========

  return {
    // 导航状态
    currentView, currentDomainId, currentPointId,
    // 知识树数据
    domains, domainsLoading,
    currentDomainDetail, domainDetailLoading,
    currentPoint, pointLoading,
    // 教学内容
    contentGenerating, contentStreamText,
    // AI 对话
    pointChats, chatLoading, chatError, chatStreamText,
    // 笔记
    notesSaving,
    // 实践任务
    practiceTasks,
    // 学习阶段
    stages, stagesLoading, currentStageDetail,
    // 产品档案
    profiles, profilesLoading, activeProfile,
    // 统计
    globalStats, heatmapData,
    // 导航 Actions
    navigateTo, goToGlobal, goToDomain, goToPoint,
    // 数据加载 Actions
    loadDomains, loadDomainDetail, loadPoint,
    // 教学内容 Actions
    generateContent,
    // AI 对话 Actions
    loadChatHistory, sendChat, clearChat,
    // 笔记 Actions
    saveNotes,
    // 状态变更 Actions
    updatePointStatus,
    // 实践任务 Actions
    completeTask,
    // 文章关联 Actions
    updateLinkedArticles,
    // 学习阶段 Actions
    loadStages, loadStageDetail,
    // 产品档案 Actions
    loadProfiles, createProfile, updateProfile, deleteProfile, activateProfile,
    // 统计 Actions
    loadStats, loadHeatmap,
  };
});
```

---

## 5. LLM 集成方案

### 5.1 教学内容生成

**触发时机：** 用户首次进入知识点页面且 `smPointContent` 无记录时自动触发。

**系统 Prompt：**

```
你是一位经验丰富的创业导师，正在教授一位准备创业的学生。

## 学生背景
- 产品名称：{profile.name}
- 产品描述：{profile.description}
- 目标市场：{profile.targetMarket}
- 目标客户：{profile.targetCustomer}
- 生产来源：{profile.productionSource}
- 当前阶段：{profile.currentStage}
- 补充信息：{profile.additionalInfo}

## 当前学习内容
- 领域：{domain.name}
- 主题：{topic.name}
- 知识点：{point.name}
- 知识点描述：{point.description}

## 输出要求

请严格按以下 6 个板块输出教学内容，每个板块以对应的标记开头：

### [WHAT]
概念定义，为什么这个知识点重要，在整个创业流程中处于什么位置。

### [HOW]
通用方法论、执行步骤、常用框架和工具。给出具体可操作的步骤指南。

### [EXAMPLE]
1-2 个真实品牌案例，展示这个知识如何在实际商业中被运用。优先选择与学生产品领域相关的案例。

### [APPLY]
针对学生的具体产品（{profile.name}），提出 2-3 个引导问题，帮助学生思考如何应用这个知识。

### [RESOURCES]
推荐 3-5 个学习资源（书籍、网站、工具、课程等），标注资源类型和简要说明。

### [TASKS]
生成 1-3 个实践任务，每个任务包含：
- description: 任务描述
- expectedOutput: 预期产出
- hint: 参考提示

任务必须具体、可执行，针对学生的产品场景。以 JSON 数组格式输出：
[{"description": "...", "expectedOutput": "...", "hint": "..."}]
```

**解析策略：**

服务端在流式输出中按 `[WHAT]`、`[HOW]`、`[EXAMPLE]`、`[APPLY]`、`[RESOURCES]`、`[TASKS]` 标记分割内容，将每个板块映射到 `smPointContent` 的对应字段。`[TASKS]` 板块的 JSON 数据解析后写入 `smPracticeTasks` 表。

**流式输出流程：**

1. 收到 LLM 流式 token
2. 检测当前处于哪个 section（通过标记识别）
3. 发送 SSE 事件：`{ type: 'chunk', section: 'what', content: '...' }`
4. 遇到 `[TASKS]` 标记后，累积 JSON 直到解析完毕
5. 发送 `{ type: 'tasks', tasks: [...] }`
6. 全部完成后发送 `{ type: 'done' }`
7. 在 `done` 之前，将完整内容写入数据库

**无产品档案时的降级处理：**

如果用户尚未创建产品档案，系统 prompt 中省略"学生背景"部分，`[APPLY]` 板块改为通用引导问题，`[TASKS]` 任务也改为通用实践任务。内容生成后，如果用户后续创建了产品档案，可通过"重新生成"按钮基于产品背景重新生成。

### 5.2 AI 对话

**系统 Prompt：**

```
你是一位经验丰富的创业导师。你正在与一位创业学生讨论具体的知识点。

## 学生的产品背景
{与教学内容生成相同的产品档案信息}

## 当前讨论的知识点
- 领域：{domain.name} > 主题：{topic.name} > 知识点：{point.name}
- 教学内容摘要：
  - 概念：{content.what 的前 200 字}
  - 方法：{content.how 的前 200 字}

## 你的角色
- 作为创业导师，你不仅回答问题，还会主动引导学生思考
- 如果学生的理解有偏差，温和地纠正
- 结合学生的产品场景给出具体建议
- 在适当时候建议下一步行动
- 如果问题涉及其他知识点，指出关联并建议学生去了解
- 回复使用中文，保持专业但亲切的语气
```

**消息构建：** `[系统 prompt] + [历史对话记录] + [用户新消息]`

**流式输出：** 与教学内容生成使用相同的 SSE 模式，参考 `translate-stream.post.ts` 的 ReadableStream 实现。区别在于对话完成后需保存用户消息和助手回复两条记录到 `smPointChats`。

### 5.3 LLM 调用参数

| 场景 | temperature | maxTokens | timeout |
|------|------------|-----------|---------|
| 教学内容生成 | 0.7 | 8000 | 120s |
| 教学内容重新生成 | 0.7 | 8000 | 120s |
| AI 对话 | 0.8 | 4000 | 60s |

### 5.4 Provider 复用

使用现有的 `server/utils/llm-provider.ts` 中的 `resolveProvider` 函数解析 LLM provider。创业地图的所有 LLM 调用都支持 `providerId` 参数，不传时使用默认 provider。

---

## 6. 种子数据方案

### 6.1 数据文件

创建 `server/data/startup-map-seed.json`，包含完整的知识树和学习阶段。

**数据结构：**

```json
{
  "stages": [
    {
      "name": "全貌认知",
      "description": "理解创业运营的完整图景",
      "goal": "理解创业运营的完整流程，每个领域是什么、为什么重要",
      "sortOrder": 1,
      "pointNames": ["市场规模评估", "竞品识别与分类", "目标客户画像", ...]
    },
    ...
  ],
  "domains": [
    {
      "name": "市场研究",
      "description": "了解市场环境、竞争格局和目标客户，为创业决策提供数据支撑",
      "sortOrder": 1,
      "topics": [
        {
          "name": "行业分析",
          "description": "评估目标行业的规模、趋势和机会",
          "sortOrder": 1,
          "points": [
            { "name": "市场规模评估", "description": "如何估算目标市场的总规模（TAM/SAM/SOM）", "sortOrder": 1 },
            ...
          ]
        },
        ...
      ]
    },
    ...
  ]
}
```

**完整阶段定义：**

| 阶段 | 名称 | 目标 | 包含知识点示例 |
|------|------|------|-------------|
| 1 | 全貌认知 | 理解创业运营的完整流程，每个领域是什么、为什么重要 | 市场规模评估、品牌定位方法论、产品需求定义、寻找工厂、贸易术语、法国公司类型、独立站搭建、社交媒体营销、启动资金估算、售后服务体系等 |
| 2 | 市场验证 | 确认市场机会存在，了解竞争格局和目标客户 | 行业趋势分析、市场细分、竞品产品对比、竞品营销策略分析、消费者需求洞察、购买决策流程、消费者调研方法 |
| 3 | 合规准备 | 掌握法律、进出口、税务等必须遵守的规则 | 注册流程、EU 纺织品法规、产品安全标准、商标注册、GDPR、出口流程、进口流程、关税与 HS 编码、增值税 (TVA) 等 |
| 4 | 产品与供应链 | 从产品设计到找工厂到质检的完整链路 | 材料与工艺选择、尺码体系、产品打样、功能测试、验厂与评估、供应商谈判、生产排期、质量控制、库存策略等 |
| 5 | 品牌建设 | 建立品牌定位、视觉识别和品牌故事 | 品牌命名、品牌故事、视觉识别系统、包装设计、品牌调性与语言、品牌资产管理 |
| 6 | 渠道搭建 | 建立线上/线下销售渠道，准备上线 | 电商平台入驻、平台运营、药房/医疗用品店、批发与分销、渠道选择与优先级、国际运输方式、物流服务商等 |
| 7 | 营销推广 | 获取第一批客户，建立营销体系 | SEO、付费广告、邮件营销、内容策略、KOL/KOC 合作、品牌上市策划、公关与媒体、成本结构分析、定价策略等 |
| 8 | 运营优化 | 客户服务、财务管理、持续改进 | 退换货处理、客户投诉处理、CAC、LTV、忠诚度计划、关键指标体系、A/B 测试、记账与发票、现金流管理等 |

**完整知识树包含 10 个领域、31 个主题、95 个知识点。**

具体内容参见 PRD 文档中"八、预置知识树"章节。

### 6.2 Seed API 实现方案

`POST /api/startup-map/seed` handler 逻辑：

1. 检查 `smDomains` 表是否已有数据，有则返回 `{ skipped: true, message: '数据已存在' }`。
2. 读取 `startup-map-seed.json`。
3. 在一个事务中：
   a. 插入所有阶段（`smStages`）。
   b. 遍历领域数组，依次插入 domain -> topic -> point。
   c. 插入时记录知识点名称到 ID 的映射（`Map<string, number>`）。
   d. 遍历阶段的 `pointNames`，通过名称映射将 `stageId` 更新到对应的 `smPoints` 记录。
4. 返回统计：`{ domains: 10, topics: 31, points: 95, stages: 8 }`。

### 6.3 知识点数量统计

| 领域 | 主题数 | 知识点数 |
|------|--------|---------|
| 市场研究 | 3 | 10 |
| 品牌策略 | 3 | 8 |
| 产品开发 | 3 | 9 |
| 供应链 | 3 | 9 |
| 进出口与物流 | 3 | 9 |
| 法律合规 | 4 | 13 |
| 销售渠道 | 3 | 9 |
| 营销推广 | 3 | 10 |
| 财务管理 | 3 | 9 |
| 客户运营 | 3 | 9 |
| **合计** | **31** | **95** |

---

## 7. 与文章阅读工具的集成

### 7.1 关联机制

通过 `smPointArticles` junction table 实现多对多关联。知识点可关联多篇文章，一篇文章也可被多个知识点关联。

### 7.2 创业地图侧（本期实现）

**ArticleLinker.vue 组件：**

- 显示当前知识点已关联的文章列表（标题、来源、笔记摘要）。
- "添加关联"按钮打开文章选择弹窗。
- 弹窗中调用 `GET /api/bookmarks` 获取已收藏文章，支持搜索和标签筛选。
- 选择完毕后调用 `PUT /api/startup-map/points/:id/articles` 更新关联。
- 点击已关联文章跳转到文章阅读工具（通过路由切换）。

**API 端点：**

`PUT /api/startup-map/points/:id/articles` 接收 `{ articleIds: number[] }`，执行全量替换：

```typescript
// 事务内
await db.delete(smPointArticles).where(eq(smPointArticles.pointId, pointId));
if (articleIds.length > 0) {
  await db.insert(smPointArticles).values(
    articleIds.map(articleId => ({ pointId, articleId })),
  );
}
```

### 7.3 文章阅读侧（P2 阶段后续实现）

在文章阅读工具中添加反向关联显示：

- 在 `ArticleReader` 的收藏详情区域，查询 `smPointArticles` 获取该文章关联的知识点。
- 显示知识点名称（含领域/主题层级路径）。
- 点击跳转到创业地图对应知识点页面。

这部分在 P2 阶段实现，需要新增一个 API 端点：

```
GET /api/articles/:id/linked-points
```

返回该文章关联的所有知识点信息（含领域和主题名称）。

### 7.4 跨工具跳转

跳转方案：通过修改 URL 的路由 slug 实现工具间切换。

- 从创业地图跳到文章阅读：`navigateTo('/article-reader')` + 设置 article-reader store 的状态。
- 从文章阅读跳到创业地图：`navigateTo('/startup-map')` + 设置 startup-map store 的状态。

具体实现可以通过 URL query 参数传递目标状态（如 `?pointId=123` 或 `?articleId=456`），在目标工具组件的 `onMounted` 中读取并执行跳转。
