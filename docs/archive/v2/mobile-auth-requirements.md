# 功能需求文档：局域网认证 + 移动端适配

> 文档版本：v1.0
> 日期：2026-02-19
> 作者：小Y（产品经理）

---

## 1. 背景与目标

个人助手（personal-assistant-v2）当前仅在 localhost 上运行，且无认证机制。为支持在局域网内通过手机访问（如在家中使用手机查看打卡和词汇学习），需要：

1. **Phase 1**：开放局域网访问并增加简单认证，保护数据安全
2. **Phase 2**：适配移动端屏幕，在不影响桌面端体验的前提下提升手机端可用性

**核心原则**：这是单用户个人工具，认证方案以"简单实用"为主，不需要注册/多用户/权限管理。

---

## 2. 现状分析

### 2.1 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Nuxt 3（SPA 模式，`ssr: false`） |
| 数据库 | SQLite + better-sqlite3 + Drizzle ORM |
| 状态管理 | Pinia（Composition API） |
| 部署 | PM2 (`ecosystem.config.cjs`) |
| 样式 | CSS Variables（`assets/css/variables.css`），scoped CSS |
| 图标 | lucide-vue-next |

### 2.2 现有布局结构

- `layouts/default.vue`：flex 水平布局（侧边栏 + 主内容）
- `components/AppSidebar.vue`：左侧侧边栏，宽度 200px / 折叠 56px
- 三个工具模块：日历打卡、法语词汇、年度计划
- 无 viewport meta 标签配置
- 无任何 `@media` 响应式断点

### 2.3 现有中间件

- `server/middleware/log.ts`：请求日志
- `server/middleware/test-guard.ts`：生产环境禁用测试端点

### 2.4 现有数据库 Schema

- `habits` + `checkins`（习惯打卡）
- `vocab` 系列表（词汇学习）
- `llm` 系列表（LLM 提供商/定义缓存）
- `srs` 系列表（间隔重复）
- `planner` 系列表（年度计划）
- 无 `users` 表

---

## 3. Phase 1：局域网 + 认证

### 3.1 Host 绑定

**需求**：使 Nuxt/Nitro 进程监听所有网络接口，允许局域网设备访问。

**实现要点**：
- 在 `nuxt.config.ts` 中添加 `devServer.host: '0.0.0.0'`（开发环境）
- 在 `ecosystem.config.cjs` 的 env 中添加 `HOST: '0.0.0.0'`，或在 `.env.production.local` 中设置 `HOST=0.0.0.0`（Nitro 生产环境自动读取）
- 不改变端口（默认 3000），可通过 `PORT` 环境变量自定义

**验收标准**：
- [x] 开发环境下同一局域网设备可通过 `http://<host-ip>:3000` 访问
- [x] 生产环境下 PM2 启动后同样可通过局域网 IP 访问

---

### 3.2 Users 表

**需求**：新增 `users` 表存储认证用户信息。

**Schema 设计**：

```typescript
// server/database/schemas/auth.ts
export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  username:     text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    integer('created_at', { mode: 'number' }).notNull(),
});
```

**约定**：
- ID 使用自增整数（与 vocab/srs 系列一致）
- `createdAt` 使用 Unix 毫秒时间戳（项目约定）
- 密码使用 bcrypt 哈希（需安装 `bcrypt` 或纯 JS 的 `bcryptjs` 依赖）
- Schema 在 `server/database/schema.ts` 中 re-export

**迁移**：
- 运行 `npm run db:generate` 生成迁移文件
- 运行 `npm run db:migrate` 应用迁移

**验收标准**：
- [x] `users` 表成功创建，字段类型正确
- [x] `username` 有唯一约束
- [x] 迁移脚本可重复运行（幂等）

---

### 3.3 初始用户 Seed

**需求**：提供 CLI 命令创建第一个管理员用户。

**实现要点**：
- 新增脚本 `scripts/seed-user.ts`
- 在 `package.json` 添加 `"db:seed-user": "npx tsx scripts/seed-user.ts"`
- 脚本行为：
  - 交互式提示输入用户名和密码（使用 Node.js `readline`）
  - 密码通过 bcrypt 哈希（cost factor 10）
  - 插入 `users` 表
  - 如用户名已存在，提示错误并退出
- 示例运行：
  ```bash
  npm run db:seed-user
  # > 输入用户名: admin
  # > 输入密码: ****
  # > 用户创建成功！
  ```

**验收标准**：
- [x] 运行脚本可创建用户
- [x] 密码以 bcrypt hash 存储，不存储明文
- [x] 重复用户名报错处理

---

### 3.4 登录 API

**需求**：`POST /api/auth/login`，验证用户名密码，返回 JWT。

**请求/响应**：

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "secret"
}

// 成功 200
{
  "token": "<jwt-string>"
}

// 失败 401
{
  "statusCode": 401,
  "message": "用户名或密码错误"
}
```

**实现要点**：
- API 路由文件：`server/api/auth/login.post.ts`
- 验证流程：查询用户 → bcrypt.compare → 生成 JWT
- JWT payload：`{ userId: number, username: string }`
- JWT 签名密钥：从环境变量 `JWT_SECRET` 读取，未配置时抛错
- JWT 有效期：365 天（个人工具场景，长效 token 足够）
- JWT 库：使用 `jsonwebtoken`（需安装依赖）
- 遵循项目 API 错误模式：`createError({ statusCode: 401, message: '用户名或密码错误' })`
- 不区分"用户不存在"和"密码错误"（安全最佳实践）

**验收标准**：
- [x] 正确凭据返回有效 JWT
- [x] 错误凭据返回 401
- [x] JWT 包含 userId 和 username
- [x] 无 `JWT_SECRET` 环境变量时服务端报错

---

### 3.5 Server Middleware（认证拦截）

**需求**：Nitro server middleware 拦截所有 API 请求，校验 JWT。

**实现要点**：
- 文件：`server/middleware/auth.ts`
- 中间件执行顺序：Nitro 按文件名排序执行，命名为 `auth.ts` 即可（在 `log.ts` 之后）
- 拦截逻辑：
  1. 获取请求路径
  2. 检查白名单（见下方），匹配则直接 return
  3. 读取 `Authorization: Bearer <token>` header
  4. 验证 JWT，失败则抛出 `401`
  5. 将解码后的用户信息挂载到 `event.context.user`

**白名单路径**（不需要认证）：

| 路径 | 说明 |
|------|------|
| `POST /api/auth/login` | 登录接口 |
| 非 `/api/` 开头的路径 | 静态资源、SPA HTML |
| `POST /api/_test/reset` | 测试端点（已有 test-guard 保护） |

**验收标准**：
- [x] 无 token 请求 API 返回 401
- [x] 无效/过期 token 返回 401
- [x] 有效 token 正常通过
- [x] 白名单路径不受影响
- [x] `event.context.user` 包含用户信息

---

### 3.6 前端登录页

**需求**：提供登录表单，管理 token 生命周期。

#### 3.6.1 登录页面

- 路由：`pages/login.vue`（不使用 default layout，独立全屏页）
- 页面元素：
  - 应用标题「个人助手」
  - 用户名输入框
  - 密码输入框
  - 登录按钮
  - 错误提示
- 样式：居中卡片式，沿用项目 CSS 变量，黑白色调

#### 3.6.2 Token 管理

- 存储：`localStorage.setItem('auth_token', token)`
- Composable：`composables/useAuth.ts`
  - `token: Ref<string | null>` — 响应式 token
  - `isAuthenticated: ComputedRef<boolean>` — 是否已登录
  - `login(username, password): Promise<void>` — 调用登录 API 并保存 token
  - `logout(): void` — 清除 token 并跳转登录页

#### 3.6.3 API 请求拦截

- 所有 `$fetch` / `useFetch` 请求自动携带 `Authorization: Bearer <token>`
- 方案：使用 Nuxt 的 `$fetch` 全局 interceptor 或自定义 `useApiFetch` composable
- 若收到 401 响应，自动清除 token 并重定向到 `/login`

#### 3.6.4 路由守卫

- Nuxt middleware（前端）：`middleware/auth.global.ts`
- 逻辑：
  - 访问 `/login` 且已认证 → 重定向到首页
  - 访问其他页面且未认证 → 重定向到 `/login`

**验收标准**：
- [x] 未登录访问任何页面均跳转登录页
- [x] 登录成功后跳转首页，后续 API 请求自动携带 token
- [x] 登录失败显示错误提示
- [x] 401 响应自动退出并跳转登录页
- [x] 刷新页面后 token 仍有效（localStorage 持久化）

---

### 3.7 环境变量

新增环境变量（添加到 `.env.production.local`）：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | 随机 32+ 字符字符串 |
| `HOST` | 监听地址 | `0.0.0.0` |

---

### 3.8 新增依赖

| 包 | 用途 | 位置 |
|-----|------|------|
| `bcryptjs` | 密码哈希（纯 JS，无需编译） | dependencies |
| `jsonwebtoken` | JWT 生成与验证 | dependencies |
| `@types/jsonwebtoken` | TypeScript 类型 | devDependencies |

---

## 4. Phase 2：移动端适配

### 4.1 核心原则

- **桌面端零影响**：所有移动端样式改动包裹在 `@media (max-width: 768px)` 内
- **CSS 变量优先**：复用现有 CSS 变量体系，必要时新增移动端变量
- **渐进增强**：桌面端为默认样式，移动端为 override

### 4.2 CSS 断点

| 名称 | 断点值 | 说明 |
|------|--------|------|
| `mobile` | `max-width: 768px` | 手机竖屏 + 小平板 |

只需一个断点。所有移动端适配均使用 `@media (max-width: 768px) { ... }`。

---

### 4.3 Viewport Meta

**需求**：在 `nuxt.config.ts` 的 `app.head` 中添加 viewport meta 标签。

```typescript
app: {
  head: {
    meta: [
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' }
    ]
  }
}
```

**说明**：`maximum-scale=1, user-scalable=no` 防止双击缩放干扰触控操作。

---

### 4.4 侧边栏 → 底部导航栏

**当前状态**：左侧垂直侧边栏（`AppSidebar.vue`），宽 200px，可折叠。

**移动端改动**：

| 维度 | 桌面端（不变） | 移动端 |
|------|----------------|--------|
| 位置 | 左侧垂直 | 底部水平固定 |
| 宽/高 | 200px / 56px 宽 | 100% 宽 × 56px 高 |
| 内容 | 图标 + 文字标签 | 图标 + 文字标签（紧凑） |
| 折叠 | 支持 | 不支持（始终展开） |
| 设置按钮 | 侧边栏底部 | 导航栏最右侧 |

**布局变化**（`layouts/default.vue`）：

```
桌面端：flex 水平 → [sidebar | main]
移动端：flex 垂直 → [main（flex: 1, padding-bottom: 56px）]
                    [bottom-nav（fixed bottom）]
```

**涉及文件**：
- `layouts/default.vue`：布局方向切换
- `components/AppSidebar.vue`：样式适配
- `assets/css/variables.css`：可能新增 `--bottom-nav-height: 56px`

**验收标准**：
- [x] 768px 以下侧边栏变为底部导航
- [x] 导航图标和文字正确显示
- [x] 当前选中项有高亮
- [x] 设置入口保留
- [x] 桌面端布局无任何变化

---

### 4.5 主内容区适配

**需求**：移动端下主内容区全宽显示，调整间距。

```css
@media (max-width: 768px) {
  .main {
    padding: var(--spacing-md);  /* 从 lg 降为 md */
  }
}
```

---

### 4.6 日历打卡适配

**当前布局**：`HabitTracker.vue` — 水平 flex：
```
[习惯列表(220px)] [主内容 [StatsBar] [日历(340px) | 图表(flex)]]
```

**移动端改动**：

| 组件 | 当前 | 移动端 |
|------|------|--------|
| `.habitTracker` | `display: flex` 水平 | `flex-direction: column` |
| `HabitList` | 固定 220px 宽侧边列 | 全宽水平滚动列表 或 下拉选择器 |
| `.contentColumns` | `flex` 水平双列 | `flex-direction: column` |
| `.calendarColumn` | 固定 340px 宽 | `width: 100%` |
| 日历格子 | 7列 grid | 保持 7列，单元格自适应 |
| 打卡按钮（CalendarDay） | 默认大小 | `min-height: 44px; min-width: 44px` |
| 热力图 | 水平滚动 | 保持 `overflow-x: auto`（已有） |
| 趋势图 | SVG viewBox 自适应 | 容器全宽，SVG 保持 `width: 100%`（已有） |

**习惯列表移动端方案**：
- 从侧边固定列变为顶部水平滑动条
- 习惯项显示为水平排列的药丸按钮（pill buttons）
- `overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch`
- "新建" 按钮保留在滑动条末尾

**涉及文件**：
- `tools/habit-tracker/HabitTracker.vue`：布局方向
- `tools/habit-tracker/components/HabitList.vue`：列变行
- `tools/habit-tracker/components/CalendarDay.vue`：触控区增大
- `tools/habit-tracker/components/Calendar.vue`：格子自适应
- `tools/habit-tracker/components/HeatmapChart.vue`：确保横滑正常
- `tools/habit-tracker/components/TrendChart.vue`：确保全宽自适应

**验收标准**：
- [x] 习惯列表水平滑动
- [x] 日历/图表纵向堆叠
- [x] 打卡日历格子触控区 >= 44px
- [x] 热力图可水平滑动
- [x] 趋势图全宽自适应

---

### 4.7 词汇学习适配

**当前布局**：`VocabTracker.vue` — 垂直 flex，max-width 900px 居中。

**移动端改动**：

| 组件 | 当前 | 移动端 |
|------|------|--------|
| `.vocabTracker` | `max-width: 900px; padding: lg` | `max-width: 100%; padding: md` |
| Tab 栏 | `inline-flex` | 全宽 `flex`，三等分 |
| `VocabList` | 表格式列表 | 卡片式布局（单列） |
| `FilterBar` | 行内搜索+筛选 | 全宽搜索 + 可折叠筛选 |
| `FlashCard` | max-width 420px 居中 | 全宽（padding: md） |
| 评分按钮 | 4列 grid | 保持 4列，按钮 `min-height: 44px` |
| `StatsPanel` | 现有布局 | 自适应全宽 |
| `ProgressChart` | 现有布局 | 全宽 |

**闪卡全屏化**（学习模式）：
- 移动端学习模式下闪卡区域占满可视区域
- 评分按钮固定在底部，易于触达

**筛选栏折叠**：
- 移动端默认只显示搜索框
- 筛选按钮收缩为可展开/折叠的区域
- 可通过一个"筛选"按钮切换显示

**涉及文件**：
- `tools/vocab-tracker/VocabTracker.vue`：容器宽度
- `tools/vocab-tracker/components/VocabList.vue`：列表 → 卡片
- `tools/vocab-tracker/components/VocabItem.vue`：行 → 卡片
- `tools/vocab-tracker/components/FilterBar.vue`：折叠适配
- `tools/vocab-tracker/components/FlashCard.vue`：全屏
- `tools/vocab-tracker/components/StudyView.vue`：学习模式布局

**验收标准**：
- [x] 词汇列表以卡片形式展示
- [x] 筛选栏可折叠
- [x] 闪卡模式全屏显示
- [x] 评分按钮触控区 >= 44px
- [x] Tab 栏三等分显示

---

### 4.8 年度计划适配

**当前布局**：
- `OverviewPage.vue`：domain grid `repeat(auto-fill, minmax(280px, 1fr))`
- `DomainDetailPage.vue`：目标卡片列表
- `GoalCard.vue`：卡片带检查项

**移动端改动**：

| 组件 | 当前 | 移动端 |
|------|------|--------|
| `.domainGrid` | `auto-fill, minmax(280px)` | 单列 `1fr` |
| `GoalCard` | 默认宽度 | 全宽，检查项的 checkbox 触控区增大 |
| `DomainDetailPage` | 默认 | 返回按钮触控区增大 |
| `ViewNav` | 标签导航 | 全宽，按钮触控区增大 |
| `TagsPage` | 默认 | 标签卡片单列 |
| 拖拽排序 | 支持 | 移动端禁用拖拽（触控冲突） |

**涉及文件**：
- `tools/annual-planner/components/OverviewPage.vue`：grid 改单列
- `tools/annual-planner/components/GoalCard.vue`：全宽 + 触控
- `tools/annual-planner/components/DomainCard.vue`：全宽
- `tools/annual-planner/components/DomainDetailPage.vue`：适配
- `tools/annual-planner/components/ViewNav.vue`：适配
- `tools/annual-planner/components/CheckitemList.vue`：checkbox 增大
- `tools/annual-planner/components/TagGroupCard.vue`：单列

**验收标准**：
- [x] 领域卡片单列堆叠
- [x] 目标卡片全宽
- [x] 所有可点击元素触控区 >= 44px
- [x] 移动端拖拽禁用
- [x] 桌面端拖拽不受影响

---

### 4.9 全局触控优化

**需求**：所有可交互元素在移动端满足 44px 最小触控区。

**通用规则**（在 `assets/css/variables.css` 中添加）：

```css
@media (max-width: 768px) {
  /* 全局触控区优化 */
  button, a, [role="button"], input[type="checkbox"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```

**特别注意的组件**：
- CalendarDay 打卡格子
- FlashCard 评分按钮
- Checkbox（习惯列表、检查项）
- 导航链接
- 工具栏按钮

---

### 4.10 新增 CSS 变量

在 `assets/css/variables.css` 的 `:root` 中新增：

```css
/* 移动端 */
--bottom-nav-height: 56px;
--touch-target-min: 44px;
```

---

## 5. 文件变更清单

### Phase 1 新增文件

| 文件 | 说明 |
|------|------|
| `server/database/schemas/auth.ts` | users 表 Schema |
| `server/api/auth/login.post.ts` | 登录 API |
| `server/middleware/auth.ts` | JWT 校验中间件 |
| `pages/login.vue` | 登录页面 |
| `composables/useAuth.ts` | 认证状态管理 |
| `middleware/auth.global.ts` | 前端路由守卫 |
| `scripts/seed-user.ts` | 用户初始化脚本 |

### Phase 1 修改文件

| 文件 | 改动 |
|------|------|
| `nuxt.config.ts` | 添加 `devServer.host` |
| `ecosystem.config.cjs` | 添加 `HOST` 环境变量 |
| `server/database/schema.ts` | 添加 `export * from './schemas/auth'` |
| `package.json` | 添加依赖和 `db:seed-user` 脚本 |

### Phase 2 修改文件

| 文件 | 改动 |
|------|------|
| `nuxt.config.ts` | 添加 viewport meta |
| `assets/css/variables.css` | 新增移动端变量 + 全局触控规则 |
| `layouts/default.vue` | 移动端布局方向切换 |
| `components/AppSidebar.vue` | 侧边栏 → 底部导航 |
| `tools/habit-tracker/HabitTracker.vue` | 布局方向适配 |
| `tools/habit-tracker/components/HabitList.vue` | 列变水平滚动 |
| `tools/habit-tracker/components/CalendarDay.vue` | 触控区增大 |
| `tools/habit-tracker/components/Calendar.vue` | 格子自适应 |
| `tools/vocab-tracker/VocabTracker.vue` | 容器宽度适配 |
| `tools/vocab-tracker/components/VocabList.vue` | 列表 → 卡片 |
| `tools/vocab-tracker/components/FilterBar.vue` | 折叠适配 |
| `tools/vocab-tracker/components/FlashCard.vue` | 全屏化 |
| `tools/vocab-tracker/components/StudyView.vue` | 学习模式布局 |
| `tools/annual-planner/components/OverviewPage.vue` | grid 改单列 |
| `tools/annual-planner/components/GoalCard.vue` | 全宽 + 触控 |
| `tools/annual-planner/components/DomainCard.vue` | 全宽 + 触控 |
| `tools/annual-planner/components/DomainDetailPage.vue` | 适配 |
| `tools/annual-planner/components/ViewNav.vue` | 适配 |
| `tools/annual-planner/components/CheckitemList.vue` | checkbox 增大 |

---

## 6. E2E 测试计划

### Phase 1 测试用例

| 测试场景 | 描述 |
|----------|------|
| 未认证重定向 | 未登录访问首页，应重定向到 `/login` |
| 登录成功 | 正确凭据登录，跳转首页 |
| 登录失败 | 错误密码，显示错误提示 |
| API 拦截 | 无 token 调用 API，返回 401 |
| Token 持久化 | 登录后刷新页面，仍保持登录状态 |
| 退出登录 | 退出后跳转登录页，API 请求被拦截 |

### Phase 2 测试用例

| 测试场景 | 描述 |
|----------|------|
| 底部导航栏 | 768px 以下显示底部导航，点击切换工具 |
| 习惯列表 | 移动端水平滚动，可选择习惯 |
| 日历触控 | 打卡格子可点击且触控区足够 |
| 词汇卡片 | 列表以卡片形式展示 |
| 闪卡全屏 | 学习模式闪卡全屏显示 |
| 年度计划 | 领域卡片单列堆叠 |

---

## 7. 实现优先级与依赖

```
Phase 1（前置，阻塞 Phase 2 的测试）：
  1. Host 绑定
  2. Users 表 + 迁移
  3. Seed 脚本
  4. 登录 API
  5. Server Middleware
  6. 前端登录页 + Token 管理 + 路由守卫

Phase 2（可并行开发，互不依赖）：
  1. Viewport Meta + CSS 变量
  2. 底部导航栏（布局核心）
  3. 日历打卡适配
  4. 词汇学习适配
  5. 年度计划适配
  6. 全局触控优化
```

---

## 8. 风险与注意事项

| 风险 | 缓解措施 |
|------|----------|
| JWT_SECRET 泄露 | 仅存在 `.env.production.local`（已在 .gitignore） |
| bcrypt 编译问题 | 使用 `bcryptjs`（纯 JS）替代 `bcrypt`（需要 native 编译） |
| 移动端触控与拖拽冲突 | 年度计划移动端禁用 drag 事件 |
| 热力图手机屏幕太窄 | 保持水平滚动，已有 `overflow-x: auto` |
| 闪卡翻转动画性能 | CSS `transform: rotateY()` 已用 GPU 加速 |
| 日历单元格太小 | 移动端增大到 44px minimum |
