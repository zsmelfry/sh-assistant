# 产品需求文档 (PRD) v2.0 - 可扩展日常助手工具

> 版本: v2.0
> 日期: 2026-02-18
> 作者: 小Y (产品经理)
> 状态: 待评审
> 前置版本: PRD v1.1（习惯打卡 + 多频率支持）

---

## 变更概述

v2.0 包含三个核心需求，目标是将应用从纯前端 SPA 升级为具备轻量级后端的全栈应用，并增强数据可视化能力：

| 编号 | 需求 | 核心价值 | 优先级 |
|------|------|---------|--------|
| REQ-1 | 重构到 Nuxt 3 | 统一前后端技术栈，获得轻量级后端能力 | P0 |
| REQ-2 | 服务器数据库 | 数据持久化到服务器，跨浏览器/设备访问 | P0 |
| REQ-3 | 习惯历史图表 | 直观展示长期打卡趋势，增强用户激励 | P1 |

**依赖关系**: REQ-1 → REQ-2 → REQ-3（REQ-2 依赖 REQ-1 提供的后端能力；REQ-3 依赖 REQ-2 提供的持久化数据）

---

## REQ-1: 重构到 Nuxt 3（轻量级后端）

### 1.1 背景与动机

当前应用使用 React + Vite + Dexie.js (IndexedDB) 的纯前端架构。虽然 MVP 阶段这个方案运行良好，但存在以下局限：

1. **无后端能力**: 无法实现服务端数据存储、API 接口等功能
2. **数据仅存本地**: 用户换浏览器/清缓存就会丢失所有打卡记录
3. **未来扩展受限**: 多用户、数据同步、通知推送等功能无法实现

选择 Nuxt 3 的理由：
- **Vue 3 生态**: 组合式 API + TypeScript 支持成熟
- **内置服务端**: Nitro 引擎提供轻量级 API 路由，无需额外搭建后端
- **文件系统路由**: 前后端路由约定式，开发效率高
- **SSR/SPA 灵活切换**: 个人工具可保持 SPA 模式，按需开启 SSR
- **打包部署简单**: 单一产物，可部署到 Node.js 服务器或 Vercel/Netlify

### 1.2 用户故事

| 编号 | 用户故事 | 优先级 |
|------|---------|--------|
| US-30 | 作为用户，我希望应用的使用体验和之前一样流畅（重构对我透明） | P0 |
| US-31 | 作为用户，我希望所有已有功能在重构后都能正常使用 | P0 |
| US-32 | 作为开发者，我希望新架构支持前后端一体化开发，降低维护成本 | P0 |

### 1.3 功能需求

#### 1.3.1 技术迁移范围

**前端框架迁移: React → Vue 3**

| 现有 (React) | 目标 (Vue 3 / Nuxt 3) | 说明 |
|-------------|----------------------|------|
| React 19 | Vue 3 (Nuxt 3 内置) | 组件框架 |
| React Router v7 | Nuxt 文件系统路由 | 路由管理 |
| Zustand | Pinia | 状态管理（Nuxt 官方推荐） |
| CSS Modules | CSS Modules 或 Scoped CSS | 样式隔离（两者均可，保持黑白色调设计系统不变） |
| React.lazy + Suspense | Nuxt 自动懒加载 | 组件懒加载 |
| Dexie.js (IndexedDB) | 服务端数据库（见 REQ-2）| 数据存储 |

**后端能力新增:**

| 能力 | Nuxt 3 方案 | 说明 |
|------|------------|------|
| API 路由 | `server/api/` 目录 | Nitro 引擎，自动注册 |
| 中间件 | `server/middleware/` | 请求拦截（日志、未来认证等） |
| 数据库访问 | server 端直接访问 | 无浏览器沙箱限制 |

#### 1.3.2 目录结构设计要求

```
personal-assistant/
├── nuxt.config.ts                # Nuxt 配置
├── app.vue                       # 根组件
├── pages/                        # 页面路由（文件系统路由）
│   └── index.vue                 # 默认重定向到第一个工具
├── layouts/                      # 布局
│   └── default.vue               # 主布局（侧边栏 + 主内容区）
├── components/                   # 共享组件
│   ├── AppSidebar.vue
│   ├── BaseButton.vue
│   ├── BaseModal.vue
│   └── ConfirmDialog.vue
├── composables/                  # 组合式函数（替代 React Hooks）
│   └── useDataStore.ts           # 数据层访问
├── stores/                       # Pinia stores
│   └── habit.ts                  # 习惯打卡 store
├── server/                       # 后端代码
│   ├── api/                      # API 路由
│   │   ├── habits/
│   │   │   ├── index.get.ts      # GET /api/habits
│   │   │   ├── index.post.ts     # POST /api/habits
│   │   │   ├── [id].put.ts       # PUT /api/habits/:id
│   │   │   └── [id].delete.ts    # DELETE /api/habits/:id
│   │   └── checkins/
│   │       ├── index.get.ts      # GET /api/checkins?habitId=&month=
│   │       ├── toggle.post.ts    # POST /api/checkins/toggle
│   │       └── stats.get.ts      # GET /api/checkins/stats?habitId=
│   ├── database/                 # 数据库层（见 REQ-2）
│   └── middleware/
│       └── log.ts                # 请求日志
├── tools/                        # 工具模块（保持插件化架构）
│   └── habit-tracker/
│       ├── index.ts              # 工具注册定义
│       ├── HabitTracker.vue      # 工具根组件
│       ├── components/
│       │   ├── HabitList.vue
│       │   ├── HabitForm.vue
│       │   ├── Calendar.vue
│       │   ├── CalendarDay.vue
│       │   ├── CalendarNav.vue
│       │   ├── StatsBar.vue
│       │   └── EmptyState.vue
│       └── types.ts
├── types/                        # 全局类型
│   └── index.ts
├── assets/                       # 静态资源
│   └── css/
│       └── variables.css         # 全局 CSS 变量（色板不变）
└── public/                       # 静态文件
```

#### 1.3.3 插件化工具架构保留

重构后必须保留现有的工具注册机制，使新增工具的接入方式不变：

```typescript
// tools/habit-tracker/index.ts（Nuxt 版）
import type { ToolDefinition } from '~/types'

export const habitTrackerTool: ToolDefinition = {
  id: 'habit-tracker',
  name: '日历打卡',
  icon: '📅',
  order: 1,
  // Nuxt 中通过 defineAsyncComponent 或 <component :is> 实现懒加载
  component: () => import('./HabitTracker.vue'),
  namespaces: ['habits', 'checkins'],
}
```

新增工具仍只需三步：创建工具目录 → 定义 ToolDefinition → 在注册表中 import。

#### 1.3.4 API 路由设计

**习惯管理 API:**

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|-------|------|
| GET | `/api/habits` | 获取所有习惯 | - | `Habit[]` |
| POST | `/api/habits` | 创建习惯 | `{ name, frequency }` | `Habit` |
| PUT | `/api/habits/:id` | 更新习惯 | `{ name?, frequency? }` | `Habit` |
| DELETE | `/api/habits/:id` | 删除习惯 | - | `{ success: true }` |

**打卡记录 API:**

| 方法 | 路径 | 说明 | 参数/请求体 | 响应 |
|------|------|------|-----------|------|
| GET | `/api/checkins` | 获取打卡记录 | `?habitId=&month=YYYY-MM` | `CheckIn[]` |
| POST | `/api/checkins/toggle` | 切换打卡状态 | `{ habitId, date }` | `{ checked: boolean }` |
| GET | `/api/checkins/stats` | 获取统计数据 | `?habitId=` | `{ streak, monthlyRate, allDates }` |

**API 通用规范:**
- 成功响应: HTTP 200，body 为数据对象
- 客户端错误: HTTP 400，body `{ error: string }`
- 未找到: HTTP 404，body `{ error: string }`
- 服务端错误: HTTP 500，body `{ error: string }`

#### 1.3.5 前端数据层适配

将现有的 `DataStore` 抽象接口从 IndexedDB 实现切换为 HTTP API 实现：

```typescript
// composables/useApi.ts
// 封装 $fetch（Nuxt 内置，基于 ofetch）调用后端 API
// 提供与原 DataStore 类似的接口，上层业务代码改动最小化
```

**Pinia Store 适配:**

```typescript
// stores/habit.ts
// 从 Zustand 迁移到 Pinia
// 核心状态和动作保持不变，仅改变：
// 1. 状态定义方式（Zustand → Pinia defineStore）
// 2. 数据获取方式（DataStore → $fetch API 调用）
// 3. 异步动作写法（保持 async/await）
```

### 1.4 功能映射验证清单

重构后，v1.1 的所有功能必须完整保留：

| 功能 | v1.1 实现 | v2.0 等价实现 | 验证标准 |
|------|----------|-------------|---------|
| 习惯创建（含频率选择）| HabitForm + Zustand | HabitForm.vue + Pinia | 可创建 daily/weekly/monthly 习惯 |
| 习惯编辑/删除 | HabitList + ConfirmDialog | HabitList.vue + ConfirmDialog.vue | 可编辑名称和频率，删除需二次确认 |
| 日历打卡/取消打卡 | Calendar + CalendarDay | Calendar.vue + CalendarDay.vue | 点击打卡，再点取消 |
| 月份切换 | CalendarNav | CalendarNav.vue | 可前后翻月 |
| 未来日期禁止打卡 | CalendarDay disabled | CalendarDay.vue disabled | 未来日期不可点击 |
| 补打卡 | CalendarDay 过去日期可点击 | 同上 | 过去日期可打卡 |
| 连续打卡天/周/月数 | StatsBar + getStreak | StatsBar.vue + Pinia getter | 数字准确 |
| 月完成率 | StatsBar + getMonthlyRate | StatsBar.vue + Pinia getter | 百分比准确 |
| 周期完成背景（weekly/monthly）| CalendarDay isPeriodCompleted | CalendarDay.vue 同逻辑 | 浅色背景正确显示 |
| 频率标签显示 | HabitList badge | HabitList.vue badge | 日/周/月标签正确 |
| 工具切换 | Sidebar + React Router | AppSidebar.vue + Nuxt Router | 侧边栏切换流畅 |
| 侧边栏折叠 | AppLayout | layouts/default.vue | 可折叠/展开 |
| 首次使用空状态 | EmptyState | EmptyState.vue | 提示创建第一个习惯 |
| 黑白色调主题 | CSS Variables | CSS Variables（不变） | 视觉一致 |

### 1.5 非功能需求

| 指标 | 要求 | 说明 |
|------|------|------|
| 首屏加载 | < 1.5s | SPA 模式，略宽松（增加了网络请求） |
| 页面切换 | < 200ms | 工具切换含 API 数据加载 |
| 打卡操作 | < 300ms | 乐观更新 + 后台同步 |
| API 响应 | < 100ms | 本地/局域网部署场景 |
| 构建产物 | 前端 < 100KB gzipped | 不含后端代码 |

### 1.6 迁移策略

**一次性迁移**（非渐进式），理由：
- 项目体量小（~20 个源文件），一次迁移成本可控
- React → Vue 组件需要完全重写，渐进式迁移反而增加复杂度
- 数据层从 IndexedDB 切换到服务端数据库，不存在中间状态

**迁移步骤:**
1. 搭建 Nuxt 3 项目骨架
2. 迁移平台层（布局、路由、工具注册）
3. 实现 API 路由（空壳，先返回 mock 数据）
4. 迁移习惯打卡工具（Vue 组件 + Pinia Store）
5. 接入真实数据库（REQ-2）
6. 端到端测试验证功能完整性

---

## REQ-2: 服务器数据库（跨浏览器）

### 2.1 背景与动机

当前数据存储在浏览器 IndexedDB 中，存在以下问题：

1. **数据孤岛**: 每个浏览器各自独立存储，换设备就看不到历史记录
2. **数据脆弱**: 清除浏览器数据、重装系统就会永久丢失
3. **无法共享**: 未来多用户场景无法实现

引入服务器数据库后：
- 数据安全持久化，不依赖浏览器
- 跨浏览器、跨设备访问同一份数据
- 为未来多用户、数据分析等功能打基础

### 2.2 用户故事

| 编号 | 用户故事 | 优先级 |
|------|---------|--------|
| US-40 | 作为用户，我在 Chrome 上打的卡，换到 Safari 也能看到 | P0 |
| US-41 | 作为用户，我在电脑上打的卡，用手机浏览器也能看到 | P0 |
| US-42 | 作为用户，我清除浏览器缓存后，打卡数据不会丢失 | P0 |
| US-43 | 作为用户，我不需要做任何额外操作（登录、同步按钮等），数据自动就在服务器上 | P0 |
| US-44 | 作为用户，我希望打卡操作仍然是即时反馈的，不因网络延迟而卡顿 | P1 |

### 2.3 功能需求

#### 2.3.1 数据库选型要求

| 要求 | 说明 |
|------|------|
| 轻量级 | 个人工具不需要 MySQL/PostgreSQL 那样的重量级数据库 |
| 嵌入式/零配置 | 无需额外安装数据库服务，随应用启动 |
| 文件级存储 | 数据存储在单个或少量文件中，便于备份和迁移 |
| SQL 支持 | 提供结构化查询能力，便于未来复杂查询 |
| Node.js 兼容 | 可在 Nuxt 3 的 Nitro 服务端直接使用 |

**推荐方案: SQLite**（通过 `better-sqlite3` 或 `drizzle-orm` + SQLite driver）

理由：
- 零配置，数据库就是一个 `.db` 文件
- 读性能极高，适合个人工具的读多写少场景
- 备份 = 复制文件
- 生态成熟，Drizzle ORM 提供类型安全的查询

#### 2.3.2 数据模型

**habits 表:**

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | 习惯名称 |
| frequency | TEXT | NOT NULL, DEFAULT 'daily' | 打卡频率: daily/weekly/monthly |
| archived | INTEGER | NOT NULL, DEFAULT 0 | 是否归档（0=否, 1=是） |
| created_at | INTEGER | NOT NULL | 创建时间（Unix 毫秒时间戳） |
| updated_at | INTEGER | NOT NULL | 更新时间（Unix 毫秒时间戳） |

**checkins 表:**

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| habit_id | TEXT | NOT NULL, REFERENCES habits(id) | 关联习惯 ID |
| date | TEXT | NOT NULL | 打卡日期 YYYY-MM-DD |
| created_at | INTEGER | NOT NULL | 创建时间（Unix 毫秒时间戳） |

**索引:**

| 索引 | 列 | 说明 |
|------|---|------|
| idx_checkins_habit_date | habit_id, date | 唯一约束，同一习惯同一天只能打卡一次 |
| idx_checkins_habit_id | habit_id | 加速按习惯查询 |
| idx_habits_archived | archived | 加速查询未归档习惯 |

#### 2.3.3 数据库访问层设计

```
server/database/
├── index.ts              # 数据库初始化 + 连接管理
├── schema.ts             # 表结构定义（Drizzle schema 或原生 SQL）
├── migrations/           # 数据库迁移
│   └── 001_initial.sql   # 初始建表
└── repositories/         # 数据访问对象
    ├── habit.repository.ts
    └── checkin.repository.ts
```

#### 2.3.4 数据库文件存储位置

- 开发环境: 项目根目录 `./data/assistant.db`
- 生产环境: 通过环境变量 `DATABASE_PATH` 配置
- `.gitignore` 中排除 `data/*.db`

#### 2.3.5 数据迁移（IndexedDB → SQLite）

由于这是个人工具且处于早期阶段，**不提供自动数据迁移**。用户需要在新版本上重新创建习惯。

在应用首页展示一次性提示：
> "应用已升级！数据现在安全存储在服务器上，不再依赖浏览器。请重新创建你的习惯。"

### 2.4 前端适配

#### 2.4.1 乐观更新策略

为保证打卡操作的即时反馈（US-44），前端采用**乐观更新**模式：

```
用户点击打卡
    │
    ├─→ 立即更新 UI（不等后端响应）
    │
    └─→ 异步发送 API 请求
         │
         ├─→ 成功：无操作（UI 已是最新）
         │
         └─→ 失败：回滚 UI + 显示错误提示
```

#### 2.4.2 错误处理

| 场景 | 处理方式 |
|------|---------|
| 网络断开 | 在页面底部显示"网络连接断开"横幅，打卡操作排队，恢复后自动重试 |
| API 返回错误 | 回滚乐观更新，显示 toast 提示"操作失败，请重试" |
| 服务器不可用 | 显示全屏错误页"服务器连接失败，请检查服务是否运行" |

**注意**: MVP 阶段不实现离线缓存。当无网络时打卡功能不可用，但已加载的数据仍可查看。

### 2.5 非功能需求

| 指标 | 要求 |
|------|------|
| 数据库文件大小 | 支持至少 10 年的单用户打卡数据（预估 < 10MB） |
| 并发 | 单用户使用，无并发要求 |
| 备份 | 用户可通过复制 `.db` 文件实现备份 |
| 数据库启动时间 | < 50ms（SQLite 打开文件） |

---

## REQ-3: 习惯历史图表（黑白色调）

### 3.1 背景与动机

当前统计展示仅有两个数字（连续打卡数 + 月完成率），用户无法直观感知长期趋势。引入历史图表后，用户可以：

1. 看到长时间维度的打卡趋势，获得持续动力
2. 发现自己的打卡规律（如周末容易中断）
3. 有更强的成就感和数据回顾体验

### 3.2 用户故事

| 编号 | 用户故事 | 优先级 |
|------|---------|--------|
| US-50 | 作为用户，我希望看到类似 GitHub 贡献图的年度打卡热力图，一眼看到全年的打卡分布 | P1 |
| US-51 | 作为用户，我希望看到最近 12 个月的月度完成率趋势图，了解自己是在进步还是退步 | P1 |
| US-52 | 作为用户，我希望图表保持黑白色调风格，和整体应用视觉一致 | P0 |
| US-53 | 作为用户，我希望不同频率（日/周/月）的习惯有对应的图表展示 | P1 |

### 3.3 功能需求

#### 3.3.1 图表入口

在习惯打卡工具的主界面中，StatsBar 下方新增**图表展示区域**，默认折叠，点击"查看历史 ▾"展开：

```
+--------------------------------------------------+
|  [习惯列表]  |  [统计栏: 连续28天 | 本月93%]       |
|              |  [查看历史 ▾]                       |  ← 新增入口
|              |  ┌──────────────────────────────┐   |
|              |  │    年度打卡热力图              │   |  ← 展开后显示
|              |  │    月度趋势图                  │   |
|              |  └──────────────────────────────┘   |
|              |  [日历视图]                         |
+--------------------------------------------------+
```

#### 3.3.2 年度打卡热力图

**适用频率: daily**

类似 GitHub 贡献图的格子视图，展示过去一年（52周 × 7天 = 364 天）的打卡情况：

```
      1月  2月  3月  4月  5月  ...  12月
周一   □ □ ■ □ ■ □ □ ■ ■ ■ □ ...  □ ■
周二   ■ □ ■ ■ □ □ ■ ■ □ ■ □ ...  ■ □
周三   □ ■ ■ ■ ■ □ ■ □ ■ □ □ ...  □ ■
周四   ■ ■ □ ■ □ ■ ■ ■ □ ■ □ ...  ■ ■
周五   □ □ ■ □ ■ ■ □ □ ■ ■ ■ ...  □ □
周六   ■ □ □ □ ■ □ ■ □ □ □ ■ ...  □ ■
周日   □ ■ □ ■ □ □ □ ■ □ ■ □ ...  ■ □
```

**色彩规范（黑白灰）:**

| 状态 | 颜色 | 说明 |
|------|------|------|
| 未打卡 | `#EAEAEA` | 浅灰色空格子 |
| 已打卡 | `#1A1A1A` | 深色实心格子 |
| 非当年范围 | `#F5F5F5` | 最浅灰色（年初/年末溢出部分） |

**交互:**
- 鼠标悬停格子 → 显示 tooltip: `2026-02-18 已打卡` 或 `2026-02-18 未打卡`
- 格子大小: 10px × 10px，间距 2px
- 年份导航: 可切换年份（`← 2025 | 2026 →`），但只能查看有数据的年份

**适用频率: weekly**

改为**周完成格子视图**，52 个格子排成一行，每个格子代表一周：

```
2026年周完成情况
[■][■][□][■][■][■][□][■]...[□][■]  (52个格子)
 1  2  3  4  5  6  7  8    51 52
```

- 已完成周: `#1A1A1A`
- 未完成周: `#EAEAEA`
- 鼠标悬停 → `第8周 (2/16-2/22) 已完成`

**适用频率: monthly**

改为**月完成格子视图**，12 个格子排成一行：

```
2026年月完成情况
[■][■][□][□][□][□][□][□][□][□][□][□]
 1   2   3   4   5   6   7   8   9  10  11  12
```

- 已完成月: `#1A1A1A`
- 未完成月: `#EAEAEA`
- 鼠标悬停 → `3月 未完成`

#### 3.3.3 月度完成率趋势图

**适用频率: daily**

折线图，展示最近 12 个月的月度完成率变化：

```
100% ┤                          ·
     │              ·    ·    ·   ·
 75% ┤        ·   ·   ·    ·       ·
     │      ·                        ·
 50% ┤    ·
     │  ·
 25% ┤·
     │
  0% ┼──────────────────────────────────
     3月 4月 5月 6月 7月 8月 9月 10月 11月 12月 1月 2月
```

**样式规范（黑白）:**

| 元素 | 样式 |
|------|------|
| 折线 | 2px 实线, `#1A1A1A` |
| 数据点 | 4px 实心圆, `#1A1A1A` |
| 网格线 | 1px 虚线, `#E5E5E5` |
| 坐标轴文字 | 12px, `#666666` |
| 背景填充 | 折线下方填充 `#F5F5F5`（可选，增加视觉层次） |

**交互:**
- 鼠标悬停数据点 → tooltip: `2026年2月: 93% (28/30天)`
- Y 轴固定 0-100%
- X 轴显示月份简称

**适用频率: weekly**

同样的折线图，但 Y 轴为"周完成率"：
- 每月有 4~5 周，完成率 = 已完成周数 / 总周数
- tooltip: `2026年2月: 75% (3/4周)`

**适用频率: monthly**

此频率下，月度趋势图意义不大（每月只有完成/未完成），**不显示趋势图**。
仅保留年度月完成格子视图。

#### 3.3.4 统计 API

新增后端 API 支持图表数据查询：

| 方法 | 路径 | 说明 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/api/checkins/heatmap` | 年度热力图数据 | `?habitId=&year=2026` | `{ dates: string[] }` (已打卡的日期列表) |
| GET | `/api/checkins/trend` | 月度趋势数据 | `?habitId=&months=12` | `{ months: [{month, total, completed, rate}] }` |

**dates 格式**: `["2026-01-03", "2026-01-05", ...]`

**months 格式**:
```json
{
  "months": [
    { "month": "2026-01", "total": 31, "completed": 28, "rate": 90 },
    { "month": "2026-02", "total": 18, "completed": 17, "rate": 94 }
  ]
}
```

对于 weekly 频率，`total` 和 `completed` 表示周数而非天数。

#### 3.3.5 图表渲染方案

**不引入图表库**。理由：
- 热力图和折线图复杂度低，可用纯 CSS Grid + SVG 实现
- 黑白色调下不需要复杂的颜色渐变或动画
- 减少依赖，保持轻量

**热力图**: CSS Grid（7行 × 53列的格子），每个格子是一个 `<div>`
**折线图**: SVG `<polyline>` + `<circle>` 数据点

### 3.4 组件设计

```
新增组件:
tools/habit-tracker/components/
├── HistoryPanel.vue          # 图表面板容器（折叠/展开）
├── HeatmapChart.vue          # 年度热力图
├── TrendChart.vue            # 月度趋势折线图
└── ChartTooltip.vue          # 共享 tooltip 组件
```

**HistoryPanel** 根据当前习惯频率自动选择显示哪些图表：

| 频率 | 热力图 | 趋势图 |
|------|--------|--------|
| daily | 年度打卡热力图（7×52）| 月度完成率折线图 |
| weekly | 年度周完成格子（1×52）| 月度周完成率折线图 |
| monthly | 年度月完成格子（1×12）| 不显示 |

### 3.5 UI 规范补充

#### 3.5.1 图表区域布局

```
┌─ 查看历史 ▾ ────────────────────────────┐
│                                          │
│  年度打卡热力图                 ← 2026 → │
│  [热力图内容]                             │
│                                          │
│  ─ ─ ─ ─ ─ ─ ─ 分割线 ─ ─ ─ ─ ─ ─ ─ ─  │
│                                          │
│  月度完成率趋势                           │
│  [折线图内容]                             │
│                                          │
└──────────────────────────────────────────┘
```

#### 3.5.2 新增 CSS 变量

```css
/* 图表相关 */
--color-chart-fill: #1A1A1A;         /* 已打卡格子/折线/数据点 */
--color-chart-empty: #EAEAEA;        /* 未打卡格子 */
--color-chart-bg: #F5F5F5;           /* 折线图填充区域 */
--color-chart-grid: #E5E5E5;         /* 网格线 */
--chart-cell-size: 10px;             /* 热力图格子大小 */
--chart-cell-gap: 2px;               /* 热力图格子间距 */
```

#### 3.5.3 响应式适配

| 屏幕宽度 | 热力图处理 | 趋势图处理 |
|---------|-----------|-----------|
| ≥ 768px | 完整显示 52 周 | 完整显示 12 月 |
| < 768px | 水平滚动 | 显示最近 6 个月 |

### 3.6 非功能需求

| 指标 | 要求 |
|------|------|
| 热力图渲染 | < 100ms (365 个格子) |
| 趋势图渲染 | < 50ms (12 个数据点) |
| 图表数据缓存 | 展开图表时加载一次，切换月份/习惯时重新加载 |
| tooltip 延迟 | hover 后 200ms 显示 |

---

## 实现优先级与里程碑

### Phase 1: Nuxt 3 重构 + 数据库（REQ-1 + REQ-2）

**目标**: 完成技术栈迁移，应用功能与 v1.1 完全等价，数据存储在服务端

**验收标准**:
1. 所有 v1.1 功能映射验证清单（1.4 节）通过
2. 在两个不同浏览器中操作，数据实时共享
3. 清除浏览器缓存后，数据不丢失
4. API 响应时间 < 100ms
5. 打卡操作采用乐观更新，操作反馈 < 300ms

### Phase 2: 历史图表（REQ-3）

**目标**: 为习惯打卡工具增加数据可视化能力

**验收标准**:
1. daily 习惯: 热力图 + 趋势图正确显示
2. weekly 习惯: 周完成格子 + 周趋势图正确显示
3. monthly 习惯: 月完成格子正确显示
4. 所有图表保持黑白色调
5. tooltip 交互正常
6. 响应式布局在 768px 断点正确适配

---

## 开发分工指引

### 小M（架构师）

- 设计 Nuxt 3 项目结构和技术方案
- 设计数据库 schema 和 ORM 选型
- 确定 API 路由的详细设计
- 规划前后端接口约定

### 小I（后端开发）

Phase 1:
- 搭建 Nuxt 3 项目骨架
- 实现 SQLite 数据库层（初始化、migration、repository）
- 实现所有 API 路由（habits CRUD + checkins 操作 + stats 查询）
- 实现乐观更新所需的幂等接口设计

Phase 2:
- 实现 `/api/checkins/heatmap` 和 `/api/checkins/trend` 接口
- 优化大范围时间查询的性能

### 小F（前端开发）

Phase 1:
- 迁移所有 React 组件到 Vue 3 SFC
- 迁移 Zustand store 到 Pinia
- 适配前端数据层（IndexedDB → API 调用）
- 实现乐观更新和错误处理 UI
- 保持黑白色调设计系统不变

Phase 2:
- 实现 HistoryPanel、HeatmapChart、TrendChart、ChartTooltip 组件
- 实现纯 CSS Grid + SVG 的图表渲染
- 实现 tooltip 交互
- 实现响应式布局适配

### 小Y（产品经理/我）

- Phase 1 完成后: 按功能映射清单做 E2E 验收
- Phase 2 完成后: 验收图表功能和视觉规范

---

## 附录

### 术语表（新增）

| 术语 | 说明 |
|------|------|
| Nuxt 3 | Vue 3 的全栈框架，内置服务端引擎 Nitro |
| Nitro | Nuxt 3 的服务端引擎，提供 API 路由、中间件等能力 |
| SQLite | 嵌入式关系数据库，数据存储在单个文件中 |
| Pinia | Vue 3 官方状态管理库，替代 Vuex |
| 乐观更新 | 先更新 UI 再等服务端响应的交互模式，提升操作流畅感 |
| 热力图 | 用颜色深浅表示数据密度的可视化方式 |
| SFC | Single File Component，Vue 的单文件组件格式 (.vue) |
| Drizzle ORM | TypeScript-first 的 ORM，支持 SQLite |

### 与 v1.1 的差异汇总

| 维度 | v1.1 | v2.0 |
|------|------|------|
| 前端框架 | React 19 | Vue 3 (Nuxt 3) |
| 状态管理 | Zustand | Pinia |
| 路由 | React Router v7 | Nuxt 文件系统路由 |
| 数据存储 | IndexedDB (Dexie.js) | SQLite (服务端) |
| 后端 | 无 | Nuxt Nitro |
| 构建工具 | Vite | Nuxt (内置 Vite) |
| 图表 | 无 | 热力图 + 趋势图 |
| 数据安全性 | 依赖浏览器 | 服务端持久化 |
