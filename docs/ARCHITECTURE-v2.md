# 技术架构文档 v2.0 - 可扩展日常助手工具

> 版本: v2.0
> 日期: 2026-02-18
> 作者: 小M (架构师)
> 状态: 待评审
> 前置版本: ARCHITECTURE v1.0 (React + Vite + IndexedDB)
> 需求依据: PRD-v2.md (REQ-1, REQ-2, REQ-3)

---

## 1. 架构总览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                     浏览器 (Vue 3 SPA)                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Pages    │  │ Layouts  │  │ Tools (插件化)         │   │
│  │ index    │  │ default  │  │ ├─ habit-tracker/     │   │
│  └──────────┘  └──────────┘  │ │  ├─ components/    │   │
│                               │ │  └─ types.ts      │   │
│  ┌──────────────────────┐    │ └─ (future tools)    │   │
│  │ Pinia Stores         │    └──────────────────────┘   │
│  │ ├─ habit.ts          │                                │
│  │ └─ tool-registry.ts  │    ┌──────────────────────┐   │
│  └──────────────────────┘    │ Composables          │   │
│                               │ ├─ useApi.ts         │   │
│                               │ └─ useToolRegistry   │   │
│                               └──────────────────────┘   │
│                          │                                │
│                   $fetch (HTTP)                           │
│                          │                                │
├──────────────────────────┼───────────────────────────────┤
│                     Nitro Server                          │
│                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐   │
│  │ server/api/           │    │ server/middleware/    │   │
│  │ ├─ habits/           │    │ └─ log.ts            │   │
│  │ └─ checkins/         │    └──────────────────────┘   │
│  └──────────────────────┘                                │
│              │                                            │
│  ┌──────────────────────┐                                │
│  │ server/database/      │                                │
│  │ ├─ index.ts (连接)    │                                │
│  │ ├─ schema.ts (表定义) │                                │
│  │ └─ repositories/     │                                │
│  └──────────────────────┘                                │
│              │                                            │
│  ┌──────────────────────┐                                │
│  │   SQLite (.db 文件)   │                                │
│  └──────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
```

### 1.2 技术栈对比

| 类别 | v1.x (React) | v2.0 (Nuxt 3) | 迁移理由 |
|------|-------------|---------------|---------|
| 全栈框架 | 无 | **Nuxt 3.16** | 内置 Nitro 服务端，前后端一体化 |
| 前端框架 | React 19 | **Vue 3** (Nuxt 内置) | Nuxt 依赖 Vue 3；组合式 API 与 React Hooks 概念相通 |
| 状态管理 | Zustand 5 | **Pinia 3** | Nuxt 官方推荐，Vue devtools 集成 |
| 路由 | React Router 7 | **Nuxt 文件系统路由** | 零配置，约定优于配置 |
| 数据存储 | Dexie.js (IndexedDB) | **SQLite + Drizzle ORM** | 服务端持久化，跨浏览器/设备 |
| 构建工具 | Vite 6 | **Nuxt (内置 Vite)** | Nuxt 内部使用 Vite，无额外配置 |
| 样式方案 | CSS Modules | **Scoped CSS + CSS Variables** | Vue SFC 原生 `<style scoped>` 更简洁 |
| 日期处理 | date-fns 4 | **date-fns 4** | 保留不变，tree-shakable |
| 图表渲染 | 无 | **纯 CSS Grid + SVG** | 需求简单，不引入图表库 |
| TypeScript | 5.7 | **5.7** | 保留不变 |

### 1.3 不选什么，为什么

| 不选 | 理由 |
|------|------|
| Prisma ORM | schema 编译慢，SQLite 支持不如 Drizzle 原生；包体积大 |
| TypeORM | 维护不积极，TypeScript 支持不如 Drizzle |
| better-sqlite3 裸用 | 无类型安全，迁移管理需手写 |
| PostgreSQL / MySQL | 个人工具不需要独立数据库服务，SQLite 零配置即可 |
| ECharts / Chart.js | 只需热力图+折线图，纯 CSS Grid + SVG 即可，减少依赖 |
| Tailwind CSS | 黑白设计系统颜色固定，Scoped CSS + 变量更轻量 |
| SSR 模式 | 个人工具无 SEO 需求，SPA 模式启动更快 |
| Vuex | 已被 Pinia 取代，Nuxt 官方不再推荐 |

---

## 2. 项目目录结构

```
personal-assistant-v2/
├── nuxt.config.ts                    # Nuxt 配置（SPA 模式、模块注册等）
├── app.vue                           # 根组件（NuxtLayout + NuxtPage）
├── package.json
├── tsconfig.json
├── drizzle.config.ts                 # Drizzle ORM 配置
├── .env                              # 环境变量（DATABASE_PATH 等）
├── .gitignore                        # 排除 data/*.db, node_modules 等
│
├── assets/                           # 静态资源
│   └── css/
│       └── variables.css             # 全局 CSS 变量（色板 + 图表变量）
│
├── public/                           # 静态文件（favicon 等）
│
├── layouts/                          # 布局组件
│   └── default.vue                   # 主布局：侧边栏 + 主内容区
│
├── pages/                            # 文件系统路由
│   ├── index.vue                     # / → 重定向到第一个工具
│   └── [...slug].vue                 # 动态捕获路由（/habit-tracker 等）
│
├── components/                       # 全局共享组件（Nuxt 自动导入）
│   ├── AppSidebar.vue                # 侧边栏（工具导航）
│   ├── BaseButton.vue                # 按钮（primary / ghost 变体）
│   ├── BaseModal.vue                 # 模态框
│   └── ConfirmDialog.vue             # 确认对话框
│
├── composables/                      # 组合式函数（Nuxt 自动导入）
│   ├── useApi.ts                     # API 调用封装（$fetch wrapper）
│   └── useToolRegistry.ts            # 工具注册表 composable
│
├── stores/                           # Pinia stores
│   └── habit.ts                      # 习惯打卡 store
│
├── tools/                            # 工具模块目录（插件化架构）
│   ├── index.ts                      # 工具注册清单（导入所有工具）
│   └── habit-tracker/                # 习惯打卡工具
│       ├── index.ts                  # ToolDefinition 定义 + 导出
│       ├── HabitTracker.vue          # 工具根组件
│       ├── components/               # 工具内部组件
│       │   ├── HabitList.vue         # 习惯列表
│       │   ├── HabitForm.vue         # 创建/编辑表单
│       │   ├── Calendar.vue          # 月历视图
│       │   ├── CalendarDay.vue       # 单日格子
│       │   ├── CalendarNav.vue       # 月份切换
│       │   ├── StatsBar.vue          # 统计栏
│       │   ├── EmptyState.vue        # 空状态
│       │   ├── HistoryPanel.vue      # 图表面板（折叠/展开）
│       │   ├── HeatmapChart.vue      # 年度热力图
│       │   ├── TrendChart.vue        # 月度趋势折线图
│       │   └── ChartTooltip.vue      # 图表 tooltip
│       └── types.ts                  # 工具类型定义
│
├── types/                            # 全局类型定义
│   ├── index.ts                      # ToolDefinition、BaseEntity 等
│   └── api.ts                        # API 请求/响应类型
│
├── server/                           # Nitro 后端
│   ├── api/                          # API 路由
│   │   ├── habits/
│   │   │   ├── index.get.ts          # GET    /api/habits
│   │   │   ├── index.post.ts         # POST   /api/habits
│   │   │   ├── [id].put.ts           # PUT    /api/habits/:id
│   │   │   └── [id].delete.ts        # DELETE /api/habits/:id
│   │   └── checkins/
│   │       ├── index.get.ts          # GET    /api/checkins?habitId=&month=
│   │       ├── toggle.post.ts        # POST   /api/checkins/toggle
│   │       ├── stats.get.ts          # GET    /api/checkins/stats?habitId=
│   │       ├── heatmap.get.ts        # GET    /api/checkins/heatmap?habitId=&year=
│   │       └── trend.get.ts          # GET    /api/checkins/trend?habitId=&months=
│   ├── database/                     # 数据库层
│   │   ├── index.ts                  # DB 初始化 + 单例连接
│   │   ├── schema.ts                 # Drizzle 表定义
│   │   └── migrations/               # 数据库迁移
│   │       └── 0001_initial.sql      # 初始建表
│   ├── utils/                        # 服务端工具函数
│   │   └── db.ts                     # 获取 DB 实例的工具函数
│   └── middleware/
│       └── log.ts                    # 请求日志
│
├── data/                             # 数据库文件（gitignored）
│   └── assistant.db                  # SQLite 数据库文件
│
├── docs/                             # 文档
│   ├── PRD.md
│   ├── PRD-v2.md
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE-v2.md            # 本文件
│   ├── DECISIONS.md
│   └── tuandui.md
│
└── e2e/                              # E2E 测试（Playwright）
    └── ...
```

### 2.1 目录职责说明

| 目录 | 职责 | Nuxt 自动处理 |
|------|------|--------------|
| `pages/` | 文件系统路由，每个 `.vue` 文件 = 一个路由 | ✅ 自动注册路由 |
| `layouts/` | 页面布局组件，通过 `<NuxtLayout>` 使用 | ✅ 自动识别 |
| `components/` | 共享 UI 组件 | ✅ 自动导入，无需手动 import |
| `composables/` | 组合式函数（等价于 React Hooks） | ✅ 自动导入 |
| `stores/` | Pinia 状态管理 | 需手动导入（通过 `useHabitStore()`）|
| `tools/` | 工具插件模块（**自定义目录**，非 Nuxt 约定） | ❌ 需手动注册 |
| `server/api/` | API 路由（Nitro 引擎） | ✅ 自动注册，文件名 = 路径 |
| `server/database/` | 数据库层（schema、连接、迁移） | ❌ 自定义 |
| `assets/css/` | 全局样式 | 需在 `nuxt.config.ts` 中引用 |

---

## 3. 数据库设计

### 3.1 技术选型：SQLite + Drizzle ORM

**SQLite 选型理由**：
- 零配置：数据库就是一个 `.db` 文件，随应用启动
- 读性能极高：适合个人工具读多写少场景
- 备份简单：复制文件即可
- 部署零依赖：不需要额外的数据库服务
- 10 年数据量预估 < 10MB，远在 SQLite 能力范围内

**Drizzle ORM 选型理由**：
- TypeScript-first：schema 即类型，从表定义自动推导 TS 类型
- 轻量：无 schema 编译步骤（vs Prisma），零运行时生成
- SQLite 原生支持：通过 `better-sqlite3` 驱动
- 迁移工具：`drizzle-kit` 提供 generate + migrate 命令
- 未来兼容：Drizzle 支持 SQLite → PostgreSQL 无缝切换

### 3.2 Drizzle Schema 定义

```typescript
// server/database/schema.ts
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),                                    // UUID
  name: text('name').notNull(),                                   // 习惯名称
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly'] })
    .notNull()
    .default('daily'),                                            // 打卡频率
  archived: integer('archived', { mode: 'boolean' })
    .notNull()
    .default(false),                                              // 软删除
  createdAt: integer('created_at', { mode: 'number' }).notNull(), // Unix ms
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(), // Unix ms
}, (table) => [
  index('idx_habits_archived').on(table.archived),
]);

export const checkins = sqliteTable('checkins', {
  id: text('id').primaryKey(),                                    // UUID
  habitId: text('habit_id').notNull()
    .references(() => habits.id, { onDelete: 'cascade' }),        // 级联删除
  date: text('date').notNull(),                                   // YYYY-MM-DD
  createdAt: integer('created_at', { mode: 'number' }).notNull(), // Unix ms
}, (table) => [
  uniqueIndex('idx_checkins_habit_date').on(table.habitId, table.date),
  index('idx_checkins_habit_id').on(table.habitId),
]);

// 类型推导
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type CheckIn = typeof checkins.$inferSelect;
export type NewCheckIn = typeof checkins.$inferInsert;
```

### 3.3 数据库初始化

```typescript
// server/database/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

export function useDB() {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH || './data/assistant.db';
    const sqlite = new Database(dbPath);

    // 启用 WAL 模式，提升并发读性能
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    _db = drizzle(sqlite, { schema });
  }
  return _db;
}
```

### 3.4 迁移策略

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/assistant.db',
  },
});
```

**迁移命令**：
```bash
npx drizzle-kit generate    # 根据 schema 变更生成 SQL 迁移文件
npx drizzle-kit migrate     # 应用迁移
npx drizzle-kit studio      # 可视化数据库浏览器（开发用）
```

### 3.5 数据库文件管理

| 环境 | 路径 | 说明 |
|------|------|------|
| 开发 | `./data/assistant.db` | 项目根目录下 |
| 生产 | `$DATABASE_PATH` | 环境变量配置 |
| 测试 | `:memory:` | 内存数据库，每次测试隔离 |

`.gitignore` 中排除 `data/*.db`。

---

## 4. API 设计

### 4.1 API 路由总览

所有 API 遵循 RESTful 风格，前缀 `/api/`。

#### 习惯管理

| 方法 | 路径 | 处理函数 | 说明 |
|------|------|---------|------|
| GET | `/api/habits` | `server/api/habits/index.get.ts` | 获取所有未归档习惯 |
| POST | `/api/habits` | `server/api/habits/index.post.ts` | 创建习惯 |
| PUT | `/api/habits/:id` | `server/api/habits/[id].put.ts` | 更新习惯 |
| DELETE | `/api/habits/:id` | `server/api/habits/[id].delete.ts` | 删除习惯（级联删除打卡） |

#### 打卡操作

| 方法 | 路径 | 处理函数 | 说明 |
|------|------|---------|------|
| GET | `/api/checkins` | `server/api/checkins/index.get.ts` | 按习惯+月份查询打卡记录 |
| POST | `/api/checkins/toggle` | `server/api/checkins/toggle.post.ts` | 切换打卡状态（幂等） |
| GET | `/api/checkins/stats` | `server/api/checkins/stats.get.ts` | 获取统计数据（连续数+完成率） |
| GET | `/api/checkins/heatmap` | `server/api/checkins/heatmap.get.ts` | 年度热力图数据 |
| GET | `/api/checkins/trend` | `server/api/checkins/trend.get.ts` | 月度趋势数据 |

### 4.2 API 详细设计

#### GET /api/habits

```typescript
// 响应
type Response = Habit[]

// 示例
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "跑步",
    "frequency": "daily",
    "archived": false,
    "createdAt": 1708300000000,
    "updatedAt": 1708300000000
  }
]
```

#### POST /api/habits

```typescript
// 请求体
type Request = { name: string; frequency?: 'daily' | 'weekly' | 'monthly' }

// 响应: 201 Created
type Response = Habit
```

#### PUT /api/habits/:id

```typescript
// 请求体
type Request = { name?: string; frequency?: 'daily' | 'weekly' | 'monthly' }

// 响应: 200 OK
type Response = Habit

// 错误: 404 Not Found
type ErrorResponse = { error: string }
```

#### DELETE /api/habits/:id

```typescript
// 响应: 200 OK
type Response = { success: true }

// 效果: 级联删除所有关联 checkins（由数据库外键约束处理）
```

#### GET /api/checkins

```typescript
// 查询参数
type Query = {
  habitId: string;       // 必填
  month?: string;        // YYYY-MM 格式，默认当前月
  frequency?: string;    // 用于 weekly 频率扩展查询范围
}

// 响应
type Response = CheckIn[]
```

**frequency=weekly 时的特殊处理**：查询范围扩展到完整自然周，即月初/月末如果落在某周中间，也返回该周的完整数据。

#### POST /api/checkins/toggle

```typescript
// 请求体
type Request = { habitId: string; date: string }  // date: YYYY-MM-DD

// 响应: 200 OK
type Response = { checked: boolean; checkin?: CheckIn }

// 幂等设计:
//   - 如果该日期无记录 → 创建 → { checked: true, checkin: {...} }
//   - 如果该日期已有记录 → 删除 → { checked: false }
```

#### GET /api/checkins/stats

```typescript
// 查询参数
type Query = { habitId: string }

// 响应
type Response = {
  streak: number;           // 连续完成数（天/周/月视频率而定）
  monthlyRate: number;      // 本月完成率 (0-100)
  allDates: string[];       // 所有打卡日期列表（用于前端连续计算）
}
```

#### GET /api/checkins/heatmap

```typescript
// 查询参数
type Query = { habitId: string; year: number }

// 响应
type Response = { dates: string[] }  // 该年所有已打卡日期

// 示例: { "dates": ["2026-01-03", "2026-01-05", ...] }
```

#### GET /api/checkins/trend

```typescript
// 查询参数
type Query = { habitId: string; months?: number }  // months 默认 12

// 响应
type Response = {
  months: Array<{
    month: string;      // "YYYY-MM"
    total: number;      // 总天数/总周数（视频率而定）
    completed: number;  // 已完成天数/周数
    rate: number;       // 完成率 (0-100)
  }>
}
```

### 4.3 API 通用规范

```typescript
// 成功响应
HTTP 200 OK | 201 Created
Content-Type: application/json
Body: <数据对象或数组>

// 客户端错误
HTTP 400 Bad Request
Body: { "error": "缺少必填参数: habitId" }

// 资源未找到
HTTP 404 Not Found
Body: { "error": "习惯不存在" }

// 服务端错误
HTTP 500 Internal Server Error
Body: { "error": "数据库操作失败" }
```

### 4.4 API 路由实现示例

```typescript
// server/api/habits/index.get.ts
import { eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';

export default defineEventHandler(async () => {
  const db = useDB();
  return db.select()
    .from(habits)
    .where(eq(habits.archived, false))
    .orderBy(habits.createdAt);
});

// server/api/habits/index.post.ts
import { useDB } from '~/server/database';
import { habits } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '习惯名称不能为空' });
  }

  const now = Date.now();
  const newHabit = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    frequency: body.frequency || 'daily',
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const db = useDB();
  await db.insert(habits).values(newHabit);
  return newHabit;
});

// server/api/checkins/toggle.post.ts
import { and, eq } from 'drizzle-orm';
import { useDB } from '~/server/database';
import { checkins } from '~/server/database/schema';

export default defineEventHandler(async (event) => {
  const { habitId, date } = await readBody(event);

  if (!habitId || !date) {
    throw createError({ statusCode: 400, message: '缺少 habitId 或 date' });
  }

  const db = useDB();
  const existing = await db.select()
    .from(checkins)
    .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)))
    .limit(1);

  if (existing.length > 0) {
    // 已存在 → 删除
    await db.delete(checkins)
      .where(and(eq(checkins.habitId, habitId), eq(checkins.date, date)));
    return { checked: false };
  } else {
    // 不存在 → 创建
    const newCheckin = {
      id: crypto.randomUUID(),
      habitId,
      date,
      createdAt: Date.now(),
    };
    await db.insert(checkins).values(newCheckin);
    return { checked: true, checkin: newCheckin };
  }
});
```

---

## 5. 前端架构

### 5.1 Nuxt 配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // SPA 模式（个人工具无 SEO 需求）
  ssr: false,

  // 全局 CSS
  css: ['~/assets/css/variables.css'],

  // Pinia 模块
  modules: ['@pinia/nuxt'],

  // TypeScript 严格模式
  typescript: {
    strict: true,
  },

  // 开发服务器配置
  devtools: { enabled: true },

  // 路由配置
  routeRules: {
    '/': { redirect: '/habit-tracker' },
  },
});
```

### 5.2 插件化工具架构（迁移设计）

#### 5.2.1 ToolDefinition 接口

```typescript
// types/index.ts
import type { Component } from 'vue';

export interface ToolDefinition {
  id: string;                              // URL 路径标识（如 'habit-tracker'）
  name: string;                            // 显示名称（如 '日历打卡'）
  icon: string;                            // 图标（emoji 或图标名）
  order: number;                           // 侧边栏排序
  component: () => Promise<Component>;     // 异步组件加载函数
  namespaces: string[];                    // 数据命名空间（文档用途）
}
```

#### 5.2.2 工具注册 Composable

```typescript
// composables/useToolRegistry.ts
import type { ToolDefinition } from '~/types';

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.id, tool);
}

export function useToolRegistry() {
  const getAll = (): ToolDefinition[] =>
    Array.from(tools.values()).sort((a, b) => a.order - b.order);

  const get = (id: string): ToolDefinition | undefined => tools.get(id);

  return { getAll, get, register: registerTool };
}
```

#### 5.2.3 工具注册示例

```typescript
// tools/habit-tracker/index.ts
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'habit-tracker',
  name: '日历打卡',
  icon: '📅',
  order: 1,
  component: () => import('./HabitTracker.vue'),
  namespaces: ['habits', 'checkins'],
});
```

```typescript
// tools/index.ts — 工具注册清单
import './habit-tracker';
// import './todo-list';     // 未来工具
// import './pomodoro';      // 未来工具
```

#### 5.2.4 Nuxt Plugin 触发注册

```typescript
// plugins/tools.client.ts — 确保工具在应用启动时注册
import '~/tools';

export default defineNuxtPlugin(() => {
  // 工具已通过 side-effect import 完成注册
});
```

#### 5.2.5 新增工具仍然只需三步

1. 创建 `tools/my-tool/` 目录 + 组件
2. 在 `tools/my-tool/index.ts` 中调用 `registerTool()`
3. 在 `tools/index.ts` 中 `import './my-tool'`

**无需修改 pages、layouts、components 等平台代码。**

### 5.3 动态路由 + 工具渲染

```vue
<!-- pages/[...slug].vue — 动态捕获所有工具路由 -->
<template>
  <component
    v-if="currentTool"
    :is="toolComponent"
  />
  <div v-else>
    工具未找到
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { get } = useToolRegistry();

const toolId = computed(() => {
  const slug = route.params.slug;
  return Array.isArray(slug) ? slug[0] : slug;
});

const currentTool = computed(() => get(toolId.value));
const toolComponent = computed(() =>
  currentTool.value
    ? defineAsyncComponent(currentTool.value.component)
    : null
);
</script>
```

### 5.4 布局组件

```vue
<!-- layouts/default.vue -->
<template>
  <div :class="$style.layout">
    <AppSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />
    <main :class="$style.main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const sidebarCollapsed = ref(false);
</script>

<style module>
.layout {
  display: flex;
  height: 100vh;
}
.main {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}
</style>
```

### 5.5 Pinia Store 设计

#### 5.5.1 从 Zustand 迁移到 Pinia

**映射关系**：

| Zustand 概念 | Pinia 等价 |
|-------------|-----------|
| `create<Store>((set, get) => {...})` | `defineStore('id', () => {...})` (Setup 语法) |
| `set({ key: value })` | 直接赋值 `state.key = value`（响应式） |
| `get().someAction()` | 直接调用，无需 `get()` |
| `useStore((s) => s.key)` | `storeToRefs(useStore()).key` 或直接 `store.key` |
| 派生状态（get() 中计算） | `computed()` |

#### 5.5.2 Habit Store

```typescript
// stores/habit.ts
import { defineStore } from 'pinia';
import type { Habit, CheckIn, HabitFrequency, YearMonth } from '~/types';

export const useHabitStore = defineStore('habit', () => {
  // ===== 状态 =====
  const habits = ref<Habit[]>([]);
  const selectedHabitId = ref<string | null>(null);
  const currentMonth = ref<YearMonth>(getCurrentMonth());
  const checkIns = ref<CheckIn[]>([]);
  const loading = ref(false);
  const allCheckInDates = ref<Set<string>>(new Set());

  // ===== 计算属性 =====
  const selectedHabit = computed(() =>
    habits.value.find(h => h.id === selectedHabitId.value)
  );

  const selectedFrequency = computed<HabitFrequency>(() =>
    selectedHabit.value?.frequency ?? 'daily'
  );

  // ===== 动作 =====
  async function loadHabits() {
    habits.value = await $fetch<Habit[]>('/api/habits');
  }

  async function selectHabit(id: string) {
    selectedHabitId.value = id;
    await loadCheckIns();
    await loadAllDates();
  }

  async function loadCheckIns() {
    if (!selectedHabitId.value) return;
    checkIns.value = await $fetch<CheckIn[]>('/api/checkins', {
      params: {
        habitId: selectedHabitId.value,
        month: currentMonth.value,
        frequency: selectedFrequency.value,
      },
    });
  }

  async function setMonth(month: YearMonth) {
    currentMonth.value = month;
    await loadCheckIns();
  }

  async function createHabit(name: string, frequency: HabitFrequency = 'daily') {
    const habit = await $fetch<Habit>('/api/habits', {
      method: 'POST',
      body: { name, frequency },
    });
    await loadHabits();
    await selectHabit(habit.id);
  }

  async function updateHabit(id: string, data: { name?: string; frequency?: HabitFrequency }) {
    await $fetch<Habit>(`/api/habits/${id}`, {
      method: 'PUT',
      body: data,
    });
    await loadHabits();
    if (id === selectedHabitId.value) {
      await loadCheckIns();
      await loadAllDates();
    }
  }

  async function deleteHabit(id: string) {
    await $fetch(`/api/habits/${id}`, { method: 'DELETE' });
    await loadHabits();
    if (id === selectedHabitId.value) {
      selectedHabitId.value = habits.value[0]?.id ?? null;
      if (selectedHabitId.value) await selectHabit(selectedHabitId.value);
    }
  }

  async function toggleCheckIn(date: string) {
    if (!selectedHabitId.value) return;

    // 乐观更新：先更新 UI
    const wasCheckedIn = checkIns.value.some(c => c.date === date);
    if (wasCheckedIn) {
      checkIns.value = checkIns.value.filter(c => c.date !== date);
      allCheckInDates.value.delete(date);
    } else {
      const optimistic: CheckIn = {
        id: 'temp-' + Date.now(),
        habitId: selectedHabitId.value,
        date,
        createdAt: Date.now(),
      };
      checkIns.value.push(optimistic);
      allCheckInDates.value.add(date);
    }

    try {
      await $fetch('/api/checkins/toggle', {
        method: 'POST',
        body: { habitId: selectedHabitId.value, date },
      });
      // 成功后重新加载确保数据一致
      await loadCheckIns();
      await loadAllDates();
    } catch {
      // 失败回滚：重新加载服务端数据
      await loadCheckIns();
      await loadAllDates();
    }
  }

  async function loadAllDates() {
    if (!selectedHabitId.value) return;
    const stats = await $fetch<{ allDates: string[] }>('/api/checkins/stats', {
      params: { habitId: selectedHabitId.value },
    });
    allCheckInDates.value = new Set(stats.allDates);
  }

  // ===== 派生计算 =====
  const streak = computed(() => {
    return calculateStreak(selectedFrequency.value, allCheckInDates.value);
  });

  const monthlyRate = computed(() => {
    return calculateMonthlyRate(
      selectedFrequency.value,
      currentMonth.value,
      allCheckInDates.value,
    );
  });

  return {
    // 状态
    habits, selectedHabitId, currentMonth, checkIns, loading,
    allCheckInDates,
    // 计算属性
    selectedHabit, selectedFrequency, streak, monthlyRate,
    // 动作
    loadHabits, selectHabit, setMonth,
    createHabit, updateHabit, deleteHabit, toggleCheckIn,
  };
});

// 辅助函数（与 v1.x 逻辑相同，从 habit-store.ts 迁移）
function getCurrentMonth(): YearMonth { /* ... */ }
function calculateStreak(freq: HabitFrequency, dates: Set<string>): number { /* ... */ }
function calculateMonthlyRate(freq: HabitFrequency, month: YearMonth, dates: Set<string>): number { /* ... */ }
```

### 5.6 API 调用封装

```typescript
// composables/useApi.ts
// 基于 Nuxt 内置的 $fetch（ofetch），无需额外依赖

export function useApi() {
  /**
   * 通用 API 调用，自动处理错误
   */
  async function api<T>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
    return $fetch<T>(url, {
      ...options,
      onResponseError({ response }) {
        const message = response._data?.error || '请求失败';
        console.error(`API Error [${response.status}]: ${message}`);
        // 可扩展：接入全局 toast 通知
      },
    });
  }

  return { api };
}
```

> **设计决策**：不保留 v1.x 的 DataStore 抽象接口。
>
> 原因：v1.x 的 `DataStore` 接口是为了前端 IndexedDB 和未来 API 之间的切换设计的。现在已经确定使用 API，前端直接用 `$fetch` 调用后端即可，不需要中间抽象层。Pinia store 直接调用 API，更简洁直接。
>
> **对小F建议的调整**：小F建议保留 DataStore 抽象，我评估后认为在 Nuxt 全栈架构下，前端不需要这层抽象（因为不再有切换实现的场景）。但后端的 repository 层承担了类似的抽象职责——如果未来要从 SQLite 迁移到 PostgreSQL，只需改 Drizzle 的 driver 配置，schema 和查询代码不变。

### 5.7 样式系统

#### 5.7.1 全局 CSS 变量

```css
/* assets/css/variables.css */
:root {
  /* 色板（保持 v1.x 黑白色调不变） */
  --color-bg-primary: #FFFFFF;
  --color-bg-sidebar: #FAFAFA;
  --color-bg-hover: #F5F5F5;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #666666;
  --color-text-disabled: #CCCCCC;
  --color-border: #E5E5E5;
  --color-accent: #000000;
  --color-accent-inverse: #FFFFFF;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;

  /* 动画 */
  --transition-fast: 150ms ease;

  /* 侧边栏 */
  --sidebar-width: 200px;
  --sidebar-width-collapsed: 56px;

  /* 图表 (REQ-3 新增) */
  --color-chart-fill: #1A1A1A;
  --color-chart-empty: #EAEAEA;
  --color-chart-bg: #F5F5F5;
  --color-chart-grid: #E5E5E5;
  --chart-cell-size: 10px;
  --chart-cell-gap: 2px;
}
```

#### 5.7.2 样式方案：Scoped CSS

从 CSS Modules 迁移到 Vue SFC 的 `<style scoped>`：

| CSS Modules (v1.x) | Scoped CSS (v2.0) |
|--------------------|--------------------|
| `import styles from './X.module.css'` | `<style scoped>` |
| `className={styles.day}` | `class="day"` |
| 需要 `.d.ts` 类型声明 | 无需额外配置 |
| 独立 CSS 文件 | 内联在 `.vue` SFC 中 |

**迁移理由**：Vue SFC 的 `<style scoped>` 是原生支持的样式隔离方案，无需额外配置，且样式与模板在同一文件中更易维护。

---

## 6. 组件迁移映射

### 6.1 React → Vue 3 组件映射表

| React 组件 | Vue 3 组件 | 关键变化 |
|-----------|-----------|---------|
| `App.tsx` | `app.vue` + `pages/[...slug].vue` | 路由从手动配置改为文件系统 |
| `AppLayout.tsx` | `layouts/default.vue` | Nuxt 布局约定 |
| `Sidebar.tsx` | `components/AppSidebar.vue` | 自动导入，无需手动 import |
| `Button.tsx` | `components/BaseButton.vue` | props 改用 `defineProps` |
| `Modal.tsx` | `components/BaseModal.vue` | slot 语法 `<slot>` 替代 `children` |
| `ConfirmDialog.tsx` | `components/ConfirmDialog.vue` | emit 替代 callback props |
| `HabitTracker.tsx` | `tools/habit-tracker/HabitTracker.vue` | `useHabitStore()` 改为 Pinia |
| `HabitList.tsx` | `tools/.../HabitList.vue` | `v-for` 替代 `.map()` |
| `HabitForm.tsx` | `tools/.../HabitForm.vue` | `v-model` 替代 `useState` |
| `Calendar.tsx` | `tools/.../Calendar.vue` | `computed` 替代 `useMemo` |
| `CalendarDay.tsx` | `tools/.../CalendarDay.vue` | `:class` 绑定替代 `className` |
| `CalendarNav.tsx` | `tools/.../CalendarNav.vue` | `@click` 替代 `onClick` |
| `StatsBar.tsx` | `tools/.../StatsBar.vue` | 直接读 Pinia getter |
| `EmptyState.tsx` | `tools/.../EmptyState.vue` | 基本不变 |

### 6.2 新增组件（REQ-3）

| 组件 | 职责 | 渲染方式 |
|------|------|---------|
| `HistoryPanel.vue` | 图表面板容器，折叠/展开控制 | 按频率选择显示哪些图表 |
| `HeatmapChart.vue` | 年度热力图 | CSS Grid（7行 × 53列） |
| `TrendChart.vue` | 月度趋势折线图 | SVG `<polyline>` + `<circle>` |
| `ChartTooltip.vue` | 共享 tooltip | absolute 定位 + 延迟显示 |

### 6.3 React → Vue 语法速查

| React | Vue 3 |
|-------|-------|
| `useState(initial)` | `ref(initial)` |
| `useMemo(() => expr, [deps])` | `computed(() => expr)` （自动追踪依赖）|
| `useEffect(() => {...}, [deps])` | `watch(deps, () => {...})` 或 `onMounted` |
| `{condition && <Comp />}` | `<Comp v-if="condition" />` |
| `{list.map(item => <Comp key={item.id} />)}` | `<Comp v-for="item in list" :key="item.id" />` |
| `<Comp onClick={handler} />` | `<Comp @click="handler" />` |
| `<Comp className={styles.foo} />` | `<Comp class="foo" />` (scoped) |
| `<Comp {...props} />` | `<Comp v-bind="props" />` |
| `children` | `<slot />` |
| `React.lazy(() => import(...))` | `defineAsyncComponent(() => import(...))` |

---

## 7. 图表架构（REQ-3）

### 7.1 设计决策：不引入图表库

**理由**（与 PRD 一致）：
- 只需两种图表：热力图（CSS Grid）+ 折线图（SVG）
- 黑白色调下无需复杂渐变或动画
- 减少依赖，前端包体积控制在 100KB gzipped 以内
- 自己实现更易定制（tooltip、响应式等）

### 7.2 热力图渲染方案

#### Daily 频率：7行 × 53列 CSS Grid

```vue
<!-- tools/habit-tracker/components/HeatmapChart.vue (daily) -->
<template>
  <div class="heatmap">
    <div class="year-nav">
      <button @click="prevYear">&lt;</button>
      <span>{{ year }}</span>
      <button @click="nextYear">&gt;</button>
    </div>
    <div class="weekday-labels">
      <span v-for="label in ['', '一', '', '三', '', '五', '']" :key="label">
        {{ label }}
      </span>
    </div>
    <div class="grid" :style="{ gridTemplateRows: 'repeat(7, var(--chart-cell-size))' }">
      <div
        v-for="day in gridDays"
        :key="day.date"
        class="cell"
        :class="{ filled: day.checked, outside: !day.inYear }"
        @mouseenter="showTooltip(day, $event)"
        @mouseleave="hideTooltip"
      />
    </div>
  </div>
</template>
```

**Grid 布局说明**：
- 列方向（column-first）填充，每列 = 一周（7天）
- 总共约 53 列 × 7 行 = 371 个格子
- 每个格子 `10px × 10px`，间距 `2px`

#### Weekly 频率：1行 × 52列

52 个格子排成一行，每格代表一周。

#### Monthly 频率：1行 × 12列

12 个格子排成一行，每格代表一月。

### 7.3 折线图渲染方案

```vue
<!-- tools/habit-tracker/components/TrendChart.vue -->
<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="trend-chart">
    <!-- 网格线 -->
    <line
      v-for="y in yGridLines"
      :key="y"
      :x1="padding.left" :y1="y"
      :x2="width - padding.right" :y2="y"
      class="grid-line"
    />

    <!-- 填充区域 -->
    <polygon :points="areaPoints" class="area-fill" />

    <!-- 折线 -->
    <polyline :points="linePoints" class="line" />

    <!-- 数据点 -->
    <circle
      v-for="point in dataPoints"
      :key="point.month"
      :cx="point.x" :cy="point.y" r="4"
      class="dot"
      @mouseenter="showTooltip(point, $event)"
      @mouseleave="hideTooltip"
    />

    <!-- X 轴标签 -->
    <text
      v-for="label in xLabels"
      :key="label.text"
      :x="label.x" :y="height - 4"
      class="axis-label"
    >
      {{ label.text }}
    </text>

    <!-- Y 轴标签 -->
    <text
      v-for="label in yLabels"
      :key="label.text"
      :x="4" :y="label.y"
      class="axis-label"
    >
      {{ label.text }}
    </text>
  </svg>
</template>
```

**SVG 优势**：
- 矢量渲染，任意缩放不模糊
- 原生支持事件绑定（tooltip）
- CSS 可控制样式（stroke、fill 等）

### 7.4 Tooltip 组件

```vue
<!-- tools/habit-tracker/components/ChartTooltip.vue -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="tooltip"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  text: string;
}>();
</script>

<style scoped>
.tooltip {
  position: fixed;
  background: var(--color-text-primary);
  color: var(--color-accent-inverse);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1000;
  transform: translate(-50%, -100%);
  margin-top: -8px;
}
</style>
```

### 7.5 图表数据流

```
HabitTracker.vue
  └─ HistoryPanel.vue（展开时加载数据）
       ├─ $fetch('/api/checkins/heatmap') → HeatmapChart.vue
       └─ $fetch('/api/checkins/trend')   → TrendChart.vue
```

- 图表数据在 `HistoryPanel` 展开时按需加载
- 切换习惯时重新加载
- 不存入 Pinia store（图表数据是局部 UI 状态，用组件内 `ref` 管理即可）

### 7.6 响应式适配

| 屏幕宽度 | 热力图 | 趋势图 |
|---------|--------|--------|
| >= 768px | 完整 52 周 | 12 个月 |
| < 768px | 容器水平滚动 `overflow-x: auto` | 显示最近 6 个月 |

---

## 8. Nuxt 配置详细

### 8.1 依赖清单

```json
{
  "dependencies": {
    "nuxt": "^3.16",
    "@pinia/nuxt": "^0.9",
    "pinia": "^3.0",
    "date-fns": "^4.0",
    "better-sqlite3": "^11.0",
    "drizzle-orm": "^0.40"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "drizzle-kit": "^0.31",
    "@types/better-sqlite3": "^7.0",
    "@playwright/test": "^1.58",
    "vue-tsc": "^2.0"
  }
}
```

### 8.2 TypeScript 配置

Nuxt 自动生成 `tsconfig.json`，我们只需在 `nuxt.config.ts` 中启用 `strict: true`。

### 8.3 环境变量

```bash
# .env
DATABASE_PATH=./data/assistant.db
```

---

## 9. 迁移计划

### 9.1 迁移策略：一次性重写

与 PRD 一致，选择一次性迁移而非渐进式：
- 项目体量小（~20 个源文件）
- React → Vue 需要完全重写组件
- IndexedDB → SQLite 不存在中间状态

### 9.2 实施步骤

| 步骤 | 负责人 | 内容 | 交付物 |
|------|--------|------|--------|
| 1 | 小I | 初始化 Nuxt 3 项目骨架 | `nuxt.config.ts`、目录结构、依赖安装 |
| 2 | 小I | 数据库层 | `server/database/`（schema + 迁移 + 初始化） |
| 3 | 小I | API 路由 | `server/api/`（全部 9 个 endpoint） |
| 4 | 小F | 平台层迁移 | `layouts/`、`components/`（全局共享组件）、`composables/` |
| 5 | 小F | 工具迁移 | `tools/habit-tracker/`（所有 Vue 组件 + Pinia store） |
| 6 | 小F | 图表组件 | `HistoryPanel`、`HeatmapChart`、`TrendChart`、`ChartTooltip` |
| 7 | 小Y | E2E 验收 | 功能映射验证 + 图表验收 |

**并行策略**：步骤 3（后端 API）和步骤 4-5（前端迁移）可并行进行。前端在 API 未就绪时可使用 mock 数据开发。

### 9.3 数据迁移

不提供 IndexedDB → SQLite 自动迁移。新版本启动时展示一次性提示，用户重新创建习惯。

---

## 10. 架构决策记录 (ADR)

### ADR-001: 选择 SPA 模式而非 SSR

- **决策**：Nuxt 配置 `ssr: false`
- **理由**：个人工具无 SEO 需求；SPA 模式客户端渲染更简单，避免水合问题
- **影响**：首屏依赖 JS 加载，但本地/局域网部署下影响可忽略

### ADR-002: Scoped CSS 替代 CSS Modules

- **决策**：使用 Vue SFC `<style scoped>` 替代独立 CSS Module 文件
- **理由**：Vue 原生支持，模板+脚本+样式在同一文件；Nuxt 生态约定
- **影响**：样式不再需要独立 `.module.css` 文件

### ADR-003: 前端不保留 DataStore 抽象

- **决策**：Pinia store 直接调用 `$fetch` API，不实现 ApiDataStore 中间层
- **理由**：v1.x 的 DataStore 是为了 IndexedDB ↔ API 切换而设计。现在已确定使用 API，不再有切换场景。如果未来需要，Pinia store 本身就是抽象层。
- **对小F建议的回应**：后端 repository 层 + Drizzle ORM 承担了数据抽象职责。前端多一层 DataStore 会增加不必要的复杂度。
- **影响**：前端代码更简洁，少一层间接调用

### ADR-004: SQLite + Drizzle ORM

- **决策**：采纳小I建议，使用 SQLite（better-sqlite3）+ Drizzle ORM
- **理由**：见 3.1 节
- **影响**：数据库为文件级存储，部署简单；Drizzle 提供类型安全

### ADR-005: 图表使用纯 CSS Grid + SVG

- **决策**：不引入第三方图表库
- **理由**：见 7.1 节
- **影响**：需要手写热力图和折线图组件，但复杂度可控

### ADR-006: 图表数据不存入 Pinia

- **决策**：热力图和趋势图数据使用组件内 `ref` 管理，不存入全局 store
- **理由**：图表数据是 HistoryPanel 的局部 UI 状态，无需全局共享
- **影响**：每次展开面板重新加载，但数据量小（<1KB），延迟可忽略

### ADR-007: 乐观更新 + 失败回滚

- **决策**：打卡操作采用乐观更新，API 失败时回滚 UI
- **理由**：满足 PRD 要求的 < 300ms 操作反馈
- **影响**：代码需要处理回滚逻辑（见 5.5.2 toggleCheckIn）

---

## 11. 安全考量

| 场景 | 措施 |
|------|------|
| API 输入校验 | 每个 API handler 校验必填参数和类型 |
| SQL 注入 | Drizzle ORM 自动参数化查询，不拼接 SQL |
| 日期校验 | 打卡日期不允许未来日期（服务端校验） |
| CORS | Nuxt SPA 模式同源，无 CORS 问题 |
| 认证 | MVP 不实现认证（单用户场景），未来可加 middleware |
| 数据备份 | 用户可复制 `.db` 文件备份 |

---

## 12. 性能目标

| 指标 | 目标 | 实现手段 |
|------|------|---------|
| 首屏加载 | < 1.5s | SPA 模式 + 工具懒加载 |
| 工具切换 | < 200ms | defineAsyncComponent + API 并行加载 |
| 打卡操作 | < 300ms 感知 | 乐观更新 |
| API 响应 | < 100ms | SQLite 本地文件读写 + 索引优化 |
| 热力图渲染 | < 100ms | CSS Grid，365 个 div |
| 趋势图渲染 | < 50ms | SVG，12 个数据点 |
| 前端包体积 | < 100KB gzipped | 无图表库，工具分片 |

---

## 13. 未来扩展

| 方向 | 当前设计如何支持 |
|------|----------------|
| 新增工具 | 三步注册，零平台改动 |
| SQLite → PostgreSQL | 改 Drizzle driver 配置，schema 不变 |
| 多用户 | 添加 users 表 + auth middleware + 数据隔离 |
| 暗色主题 | 修改 CSS 变量值即可 |
| 数据导入/导出 | 新增 API endpoint，导出 JSON |
| 移动端 App | API 已是 HTTP 标准接口，直接对接 |
