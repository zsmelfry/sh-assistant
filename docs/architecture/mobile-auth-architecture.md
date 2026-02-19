# 架构设计文档：认证系统 + 移动端适配

> 版本：v1.0
> 日期：2026-02-19
> 作者：小M（架构师）
> 对应需求文档：docs/requirements/mobile-auth.md

---

## 1. 架构总览

### 1.1 变更范围

本次变更涉及两个正交的架构改造：

| Phase | 领域 | 影响层 | 新增文件 | 修改文件 |
|-------|------|--------|----------|----------|
| Phase 1 | 认证系统 | 全栈 | 7 | 5 |
| Phase 2 | 移动端适配 | 前端 | 1 | 15+ |

### 1.2 技术选型决策

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 认证方式 | JWT (Bearer Token) | 单用户 LAN 场景，无状态，无需服务端 session 表 |
| 密码哈希 | bcryptjs (纯 JS) | 无需 native 编译，跨平台部署友好 |
| JWT 库 | jsonwebtoken | Node.js 生态标准库 |
| Token 存储 | localStorage | SPA 模式，无 CSRF 风险（不使用 Cookie） |
| Token 有效期 | 365 天 | 个人工具场景，减少重复登录 |
| 响应式断点 | 单断点 768px | 桌面端为默认，移动端为 override，避免过度设计 |
| 移动端导航 | 底部 Tab Bar | 手机端标准交互模式，拇指可达 |

---

## 2. Phase 1：认证系统架构

### 2.1 数据流

```
┌─────────────────────────────────────────────────────┐
│  Frontend (SPA)                                      │
│                                                      │
│  login.vue ──→ useAuth.login() ──→ $fetch POST      │
│                      │              /api/auth/login   │
│                      ▼                               │
│  auth.global.ts ◄── token stored in localStorage     │
│    (route guard)                                     │
│                                                      │
│  plugins/auth.client.ts                              │
│    ├─ init(): load token from localStorage           │
│    ├─ onRequest: attach Authorization header         │
│    └─ onResponseError(401): clearToken → /login      │
└──────────────────────┬───────────────────────────────┘
                       │ Authorization: Bearer <jwt>
                       ▼
┌─────────────────────────────────────────────────────┐
│  Server (Nitro)                                      │
│                                                      │
│  Middleware Chain:                                    │
│    01.log.ts → 02.auth.ts → 03.test-guard.ts        │
│                    │                                 │
│                    ├─ Whitelist check (bypass)        │
│                    ├─ Extract Bearer token            │
│                    ├─ jwt.verify(token, JWT_SECRET)   │
│                    └─ event.context.auth = payload    │
│                                                      │
│  API Routes:                                         │
│    /api/auth/login.post.ts                           │
│      └─ bcrypt.compare → jwt.sign → { token }       │
└─────────────────────────────────────────────────────┘
```

### 2.2 新增数据库 Schema

```
server/database/schemas/auth.ts

users 表：
┌──────────────┬──────────┬─────────────────────────────┐
│ Column       │ Type     │ Constraints                 │
├──────────────┼──────────┼─────────────────────────────┤
│ id           │ integer  │ PK, auto-increment          │
│ username     │ text     │ NOT NULL, UNIQUE INDEX       │
│ password_hash│ text     │ NOT NULL                    │
│ created_at   │ integer  │ NOT NULL (Unix ms)          │
└──────────────┴──────────┴─────────────────────────────┘
```

**设计决策**：
- 无 sessions 表：JWT 无状态验证，不需要服务端 session 存储
- 无 roles/permissions：单用户场景，无需权限模型
- ID 使用自增整数：与 vocab/srs/planner 系列表一致

### 2.3 Server Middleware 设计

文件命名使用数字前缀确保执行顺序：

| 顺序 | 文件 | 职责 |
|------|------|------|
| 01 | `01.log.ts` | 请求日志（所有请求） |
| 02 | `02.auth.ts` | JWT 校验（API 请求） |
| 03 | `03.test-guard.ts` | 禁止生产环境测试端点 |

**白名单策略**（`02.auth.ts`）：

```
放行条件（任一满足即跳过认证）：
1. 非 /api/ 路径       → 静态资源、SPA HTML
2. /api/_test/ 路径    → 测试端点（已有 test-guard 保护）
3. POST /api/auth/login → 登录接口本身
```

**安全设计**：
- 统一 401 响应消息 "Unauthorized"，不泄露具体原因
- 登录失败不区分"用户不存在"和"密码错误"
- JWT payload 仅含 `{ userId, username }`，不含敏感信息
- JWT_SECRET 仅存在 `.env.production.local`（已在 .gitignore）

### 2.4 前端认证架构

```
composables/useAuth.ts
├─ authState: reactive({ token, initialized })  -- 全局单例
├─ init(): localStorage → authState              -- 启动时调用
├─ login(username, password): $fetch → store     -- 登录
├─ logout(): clear → navigateTo(/login)          -- 登出
├─ getToken(): string | null                     -- 给拦截器用
└─ clearToken(): clear without redirect          -- 给 401 处理用

plugins/auth.client.ts
├─ 调用 init() 初始化 token
└─ 创建 $fetch 拦截器
    ├─ onRequest: 自动附加 Authorization header
    └─ onResponseError(401): clearToken → /login

middleware/auth.global.ts
├─ /login 且已认证 → 重定向首页
└─ 其他页面且未认证 → 重定向 /login

layouts/auth.vue    -- 登录页独立布局（居中卡片）
pages/login.vue     -- 登录表单（使用 auth layout）
```

### 2.5 Seed 脚本

```
scripts/seed-user.ts
- 交互式或 CLI 参数传入 username/password
- bcrypt hash (cost factor 10)
- 使用独立 DB 连接（不依赖 Nuxt runtime）
- 命令：npm run db:seed-user [-- username password]
```

### 2.6 新增依赖

| 包 | 版本 | 类型 | 大小影响 |
|-----|------|------|----------|
| bcryptjs | ^3.0.3 | runtime | ~25KB (纯 JS) |
| jsonwebtoken | ^9.0.3 | runtime | ~12KB |
| @types/bcryptjs | ^2.4.6 | dev | 类型定义 |
| @types/jsonwebtoken | ^9.0.10 | dev | 类型定义 |

---

## 3. Phase 2：移动端适配架构

### 3.1 响应式策略

**核心原则**：桌面端为默认样式，移动端通过 `@media (max-width: 768px)` override。

```
                        768px
                          │
  ◄──── 移动端 ────►     │     ◄──── 桌面端（不变）────►
                          │
  底部 Tab Bar            │     左侧 Sidebar
  单列堆叠布局            │     多列 Flex 布局
  触控优化 (44px min)     │     鼠标 + hover 交互
  padding: md             │     padding: lg
```

### 3.2 CSS 变量扩展

在 `assets/css/variables.css` 的 `:root` 中新增：

```css
/* 移动端 */
--bottom-nav-height: 56px;     /* 底部导航栏高度 */
--touch-target-min: 44px;      /* Apple HIG 最小触控区 */
```

### 3.3 导航系统重构

```
桌面端（不变）：
┌────────┬──────────────────────────────┐
│ Sidebar│        Main Content          │
│ 200px  │                              │
│        │                              │
│ 工具箱  │                              │
│ ——————  │                              │
│ 日历打卡│                              │
│ 法语词汇│                              │
│ 年度计划│                              │
│        │                              │
│ ——————  │                              │
│ 模型设置│                              │
│ 登出    │                              │
└────────┴──────────────────────────────┘

移动端：
┌──────────────────────────────────────┐
│            Main Content              │
│        (padding-bottom: 56+16px)     │
│                                      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│  日历打卡  法语词汇  年度计划  更多…  │  ← 底部 Tab Bar (56px)
└──────────────────────────────────────┘
          ┌──────────┐
          │ 模型设置  │  ← "更多" 弹出菜单
          │ 登出     │
          └──────────┘
```

**组件职责分离**：

| 组件 | 桌面端 | 移动端 |
|------|--------|--------|
| `AppSidebar.vue` | 左侧侧边栏 | `display: none` |
| `MobileBottomNav.vue` | `display: none` | 固定底部导航 |
| `layouts/default.vue` | flex row | flex row + bottom padding |

### 3.4 各工具页移动端适配方案

#### 3.4.1 日历打卡 (habit-tracker)

```
桌面端：
┌──────────┬────────────────────────────────────────┐
│ HabitList │  StatsBar                              │
│ (220px)  │  ┌─────────────┬───────────────────────┐│
│          │  │ Calendar    │ TrendChart / Heatmap  ││
│          │  │ (340px)     │ (flex: 1)             ││
│          │  └─────────────┴───────────────────────┘│
└──────────┴────────────────────────────────────────┘

移动端：
┌──────────────────────────┐
│ HabitList (水平滚动 pills)│
├──────────────────────────┤
│ StatsBar                 │
├──────────────────────────┤
│ Calendar (100% width)    │
├──────────────────────────┤
│ TrendChart (100% width)  │
├──────────────────────────┤
│ HeatmapChart (横滑)      │
└──────────────────────────┘
```

**关键改动**：
- `HabitTracker.vue`：`.habitTracker` → `flex-direction: column`
- `HabitList.vue`：侧边列 → 水平滚动条（pill buttons, `overflow-x: auto`）
- `.contentColumns`：→ `flex-direction: column`
- `.calendarColumn`：`width: 340px` → `width: 100%`
- `CalendarDay.vue`：`min-width/height: 44px` 触控区

#### 3.4.2 词汇学习 (vocab-tracker)

```
桌面端：
┌──────────────────────────────────┐
│  max-width: 900px, 居中          │
│  Tab (词汇 | 学习 | 统计)        │
│  FilterBar (行内搜索+筛选)       │
│  VocabList (表格式)              │
│  或 StudyView (FlashCard 420px)  │
└──────────────────────────────────┘

移动端：
┌──────────────────────────┐
│ max-width: 100%          │
│ Tab (三等分 flex)         │
│ 搜索框 (全宽)            │
│ [筛选] 按钮 (可折叠)     │
│ VocabList (卡片式, 单列)  │
│ 或 FlashCard (全屏)      │
│ 评分按钮 (固定底部, 44px) │
└──────────────────────────┘
```

**关键改动**：
- `VocabTracker.vue`：`max-width: 100%; padding: md`
- Tab 栏：`inline-flex` → `flex` 三等分
- `VocabList.vue` + `VocabItem.vue`：表格行 → 卡片
- `FilterBar.vue`：搜索全宽 + 筛选折叠
- `FlashCard.vue`：移动端全屏化
- `StudyView.vue`：评分按钮固定底部

#### 3.4.3 年度计划 (annual-planner)

```
桌面端：
┌──────────────────────────────────┐
│  ViewNav (标签导航)               │
│  OverviewPage:                   │
│    DomainGrid (auto-fill 280px)  │
│  DomainDetailPage:               │
│    GoalCard → CheckitemList      │
└──────────────────────────────────┘

移动端：
┌──────────────────────────┐
│ ViewNav (全宽, 44px高度)  │
│ DomainGrid → 单列 1fr    │
│ GoalCard → 全宽           │
│ Checkitem → checkbox 44px │
│ 拖拽 → 禁用              │
└──────────────────────────┘
```

**关键改动**：
- `OverviewPage.vue`：grid `minmax(280px, 1fr)` → `1fr`
- `GoalCard.vue` / `DomainCard.vue`：全宽
- `CheckitemList.vue`：checkbox 触控区 44px
- `ViewNav.vue`：按钮触控区增大
- 拖拽排序：移动端禁用（触控冲突）

### 3.5 全局触控优化

在 `variables.css` 添加全局规则：

```css
@media (max-width: 768px) {
  button, a, [role="button"], input[type="checkbox"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```

---

## 4. 文件变更清单

### 4.1 Phase 1 — 已完成 ✅

| 文件 | 状态 | 说明 |
|------|------|------|
| `server/database/schemas/auth.ts` | ✅ 新增 | users 表 schema |
| `server/database/migrations/0005_cute_miek.sql` | ✅ 新增 | users 表迁移 |
| `server/database/schema.ts` | ✅ 修改 | 添加 auth re-export |
| `server/api/auth/login.post.ts` | ✅ 新增 | 登录 API |
| `server/middleware/02.auth.ts` | ✅ 新增 | JWT 校验中间件 |
| `server/middleware/01.log.ts` | ✅ 重命名 | 数字前缀排序 |
| `server/middleware/03.test-guard.ts` | ✅ 重命名 | 数字前缀排序 |
| `pages/login.vue` | ✅ 新增 | 登录页面 |
| `layouts/auth.vue` | ✅ 新增 | 登录页独立布局 |
| `composables/useAuth.ts` | ✅ 新增 | 认证状态管理 |
| `middleware/auth.global.ts` | ✅ 新增 | 前端路由守卫 |
| `plugins/auth.client.ts` | ✅ 新增 | $fetch 拦截器 |
| `scripts/seed-user.ts` | ✅ 新增 | 用户 seed 脚本 |
| `server/api/_test/reset.post.ts` | ✅ 修改 | 添加 users 表清理 |
| `nuxt.config.ts` | ✅ 修改 | devServer.host + viewport |
| `ecosystem.config.cjs` | ✅ 修改 | HOST: '0.0.0.0' |
| `package.json` | ✅ 修改 | 新增依赖 + seed 脚本 |
| `.env` | ✅ 修改 | 添加 JWT_SECRET |

### 4.2 Phase 2 — 基础设施已完成 ✅，工具页适配待做

| 文件 | 状态 | 说明 |
|------|------|------|
| `nuxt.config.ts` | ✅ 已改 | viewport meta |
| `assets/css/variables.css` | ✅ 已改 | --bottom-nav-height, --touch-target-min |
| `components/MobileBottomNav.vue` | ✅ 新增 | 底部导航栏 |
| `components/AppSidebar.vue` | ✅ 已改 | 登出按钮 + 移动端 display:none |
| `layouts/default.vue` | ✅ 已改 | MobileBottomNav + padding-bottom |
| `tools/habit-tracker/HabitTracker.vue` | ⏳ 待做 | 布局方向适配 |
| `tools/habit-tracker/components/HabitList.vue` | ⏳ 待做 | 列变水平滚动 |
| `tools/habit-tracker/components/CalendarDay.vue` | ⏳ 待做 | 触控区增大 |
| `tools/habit-tracker/components/Calendar.vue` | ⏳ 待做 | 格子自适应 |
| `tools/vocab-tracker/VocabTracker.vue` | ⏳ 待做 | 容器宽度适配 |
| `tools/vocab-tracker/components/VocabList.vue` | ⏳ 待做 | 列表→卡片 |
| `tools/vocab-tracker/components/VocabItem.vue` | ⏳ 待做 | 行→卡片 |
| `tools/vocab-tracker/components/FilterBar.vue` | ⏳ 待做 | 折叠适配 |
| `tools/vocab-tracker/components/FlashCard.vue` | ⏳ 待做 | 全屏化 |
| `tools/vocab-tracker/components/StudyView.vue` | ⏳ 待做 | 学习模式布局 |
| `tools/annual-planner/components/OverviewPage.vue` | ⏳ 待做 | grid 改单列 |
| `tools/annual-planner/components/GoalCard.vue` | ⏳ 待做 | 全宽+触控 |
| `tools/annual-planner/components/DomainCard.vue` | ⏳ 待做 | 全宽+触控 |
| `tools/annual-planner/components/DomainDetailPage.vue` | ⏳ 待做 | 适配 |
| `tools/annual-planner/components/ViewNav.vue` | ⏳ 待做 | 适配 |
| `tools/annual-planner/components/CheckitemList.vue` | ⏳ 待做 | checkbox 增大 |

---

## 5. 架构审查发现

### 5.1 已实现代码的架构评估

**认证系统 — 评分：优秀**

| 维度 | 评估 |
|------|------|
| 安全性 | ✅ 统一错误消息、bcrypt 哈希、JWT_SECRET 环境变量 |
| 一致性 | ✅ 遵循项目 API 模式（校验→查询→返回） |
| Middleware 排序 | ✅ 数字前缀 01/02/03 确保顺序 |
| 白名单设计 | ✅ 精确匹配 POST /api/auth/login + 路径前缀 |
| Token 拦截 | ✅ $fetch.create 全局拦截，Header 类型兼容处理完善 |
| 路由守卫 | ✅ SSR 防护 (import.meta.server check) |
| Seed 脚本 | ✅ 支持交互式+CLI 参数，密码长度校验 |

**移动端基础设施 — 评分：良好**

| 维度 | 评估 |
|------|------|
| 响应式策略 | ✅ 单断点 768px，桌面端零影响 |
| 底部导航 | ✅ 固定定位、触控区 44px、弹出菜单 |
| CSS 变量 | ✅ 新增移动端变量，复用设计系统 |
| 内容区 padding | ✅ padding-bottom 避免被导航遮挡 |

### 5.2 待关注的架构风险

| # | 风险 | 严重度 | 建议 |
|---|------|--------|------|
| 1 | `event.context.auth` 无 TypeScript 类型声明 | 低 | 添加 `server/types/h3.d.ts` 扩展 H3EventContext |
| 2 | 测试端点绕过认证（`/api/_test/` 在白名单中）| 低 | 已有 `03.test-guard.ts` 在生产环境阻止，双层防护 |
| 3 | JWT 无吊销机制 | 低 | 个人工具场景可接受，如需要可在 DB 添加 token 黑名单 |
| 4 | 无登录速率限制 | 中 | LAN 场景风险低，但建议后续考虑简单的内存计数器 |
| 5 | 移动端拖拽禁用逻辑需在年度计划中实现 | 中 | 需要检测 touch 事件，建议用 `@media (pointer: coarse)` |
| 6 | VocabItem 表格→卡片改动较大 | 中 | 建议使用 CSS-only 方案（CSS Grid + @media），避免 v-if 分支 |

---

## 6. 工具页移动端适配的实现指南

### 6.1 通用模式

所有移动端适配应遵循以下模式，确保一致性：

```css
/* 在每个组件的 <style scoped> 中追加 */
@media (max-width: 768px) {
  /* 移动端覆写样式 */
}
```

**不要**：
- 使用 `v-if` 判断屏幕宽度来切换组件
- 在 JS 中检测 `window.innerWidth`
- 创建独立的 Mobile 版组件

**要**：
- 纯 CSS `@media` 覆写
- 使用 CSS Grid/Flex 的响应式能力
- 引用 CSS 变量 (`--touch-target-min`, `--bottom-nav-height`)

### 6.2 触控区增大模板

```css
@media (max-width: 768px) {
  .interactive-element {
    min-height: var(--touch-target-min);
    min-width: var(--touch-target-min);
  }
}
```

### 6.3 水平滚动列表模板（HabitList 用）

```css
@media (max-width: 768px) {
  .list-container {
    flex-direction: row;
    overflow-x: auto;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;  /* Firefox */
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
  }

  .list-container::-webkit-scrollbar {
    display: none;  /* Chrome/Safari */
  }

  .list-item {
    flex-shrink: 0;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 9999px;  /* pill shape */
  }
}
```

### 6.4 禁用拖拽模板（年度计划用）

```css
@media (pointer: coarse) {
  .draggable-handle {
    display: none;
  }
}
```

---

## 7. 与现有架构的兼容性

### 7.1 工具插件系统

认证系统作为横切关注点，不影响工具注册/加载机制：
- 工具仍通过 `registerTool()` 注册
- 路由仍通过 `[...slug].vue` 解析
- 认证拦截在 server middleware 层和前端 route middleware 层，对工具透明

### 7.2 数据库

- `users` 表独立于工具表，无 FK 依赖
- 迁移 0005 兼容现有 0001-0004
- `_test/reset` 已更新包含 users 表清理

### 7.3 部署

- `ecosystem.config.cjs` 已添加 `HOST: '0.0.0.0'`
- `.env.production.local` 需添加 `JWT_SECRET`
- 部署流程不变：`npm run deploy` 自动 build → migrate → restart
