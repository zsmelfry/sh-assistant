# 技术架构文档

> 版本: v3.0 | 最后更新: 2026-03-24

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器 (Vue 3 SPA)                        │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐    │
│  │ Pages    │  │ Layouts  │  │ Tools (插件化, 9 个静态)  │    │
│  │ index    │  │ default  │  │ + 动态 Skill Learning    │    │
│  │ login    │  │          │  │   工具 (按 skillId 注册)  │    │
│  │ [...slug]│  │          │  └─────────────────────────┘    │
│  └──────────┘  └──────────┘                                  │
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────────┐    │
│  │ Pinia Stores (8个)    │    │ Composables (自动导入)    │    │
│  └──────────────────────┘    └──────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 小爽助手 (全局浮层, 任意页面可呼出)                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │ $fetch (HTTP)                       │
├──────────────────────────┼───────────────────────────────────┤
│                     Nitro Server                               │
│                                                               │
│  Middleware: SecurityHeaders → Log → Auth → TestGuard         │
│             → ModuleGuard                                     │
│  150+ API Routes (file-based routing)                         │
│  LLM Providers (Claude CLI/API, Gemini, Ollama)               │
│  Skill Learning Core (通用学习引擎)                             │
├───────────────────────────────────────────────────────────────┤
│              多用户 SQLite (WAL mode)                          │
│  Admin DB (data/admin.db) ← 用户 + 模块权限                   │
│  User DBs (data/users/{username}.db) ← 各用户功能数据          │
│  13 Schema 文件 · Drizzle ORM · 自动迁移                      │
└───────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 全栈框架 | Nuxt 3 (SPA 模式, ssr: false) |
| 前端框架 | Vue 3 Composition API |
| 状态管理 | Pinia (Composition API 风格) |
| 数据库 | SQLite (better-sqlite3) + Drizzle ORM |
| 认证 | JWT (365 天有效期) |
| AI | 插件式 LLM 接入 (Claude CLI / Claude API / Gemini / Ollama) |
| 部署 | PM2 进程管理 + 自动备份 |

---

## 2. 项目目录结构

```
personal-assistant/
├── nuxt.config.ts                    # Nuxt 配置（SPA 模式）
├── app.vue                           # 根组件
├── assets/css/variables.css          # 全局 CSS 变量（黑白色板）
├── layouts/default.vue               # 主布局：侧边栏 + 主内容区
│
├── pages/
│   ├── index.vue                     # / → 重定向到第一个工具
│   ├── login.vue                     # 登录页
│   └── [...slug].vue                 # 动态捕获路由 → 渲染对应工具
│
├── components/                       # 全局共享组件（Nuxt 自动导入）
│   ├── AppSidebar.vue                # 侧边栏导航
│   ├── BaseButton.vue / BaseModal.vue / BaseChatPanel.vue
│   ├── ConfirmDialog.vue
│   ├── LlmSettings.vue              # LLM 设置弹窗
│   ├── MobileBottomNav.vue           # 移动端底部导航
│   └── XiaoshuangChat.vue            # 小爽助手全局浮层
│
├── composables/                      # 组合式函数（自动导入）
│   ├── useAuth.ts                    # JWT 认证
│   ├── useToolRegistry.ts            # 工具注册/检索
│   ├── useLlm.ts                     # LLM 调用
│   ├── useTts.ts                     # 语音合成 (法语优先)
│   ├── useIsMobile.ts                # 响应式断点 (768px)
│   ├── useModulePermissions.ts       # 模块权限控制
│   ├── useMarkdown.ts                # Markdown 工具
│   ├── useAbilitySkillOptions.ts     # 能力画像技能选项
│   └── skill-learning/               # 技能学习 Store 工厂 + 共享类型
│
├── stores/                           # Pinia stores
│   ├── habit.ts / vocab.ts / planner.ts / article-reader.ts
│   ├── ability.ts / project-tracker.ts / dashboard.ts
│   ├── study.ts                      # 技能学习通用 store
│   └── xiaoshuang.ts                 # 小爽助手全局状态
│
├── tools/                            # 工具模块（插件化架构）
│   ├── index.ts                      # 工具注册清单（side-effect imports）
│   ├── dashboard/                    # 今日面板
│   ├── ability-profile/              # 能力画像
│   ├── vocab-tracker/                # 法语词汇
│   ├── annual-planner/               # 年度计划
│   ├── project-tracker/              # 事项追踪
│   ├── article-reader/               # 文章阅读
│   ├── skill-manager/                # 技能管理
│   ├── admin/                        # 用户管理
│   └── skill-learning/               # 技能学习通用组件 + GenericSkillTool.vue
│
├── server/
│   ├── api/                          # API 路由 (Nitro file-based routing)
│   ├── middleware/                    # 中间件链 (编号控制执行顺序)
│   ├── database/
│   │   ├── index.ts                  # DB 连接管理 (useDB / useAdminDB / useUserDB)
│   │   ├── schema.ts                 # 用户 DB schema 聚合
│   │   ├── admin-schema.ts           # Admin DB schema
│   │   ├── schemas/                  # 13 个 schema 文件
│   │   ├── migrations/               # 用户 DB 迁移 (27+)
│   │   └── admin-migrations/         # Admin DB 迁移
│   ├── lib/llm/                      # LLM Provider 抽象层
│   ├── lib/skill-learning/           # 技能学习引擎
│   ├── utils/module-ids.ts           # 模块 ID 与 API 命名空间映射
│   └── plugins/skill-learning.ts     # 技能注册启动插件
│
├── data/                             # 数据库文件 (gitignored)
│   ├── admin.db                      # 用户 + 模块权限
│   └── users/{username}.db           # 各用户功能数据
│
└── e2e/                              # Playwright E2E 测试 (15+ 文件)
```

---

## 3. 多用户数据库架构

### 双 DB 设计

| DB | 路径 | 用途 | 访问方式 |
|----|------|------|----------|
| Admin DB | `data/admin.db` | 用户表 + 模块权限表 | `useAdminDB()` |
| User DB | `data/users/{username}.db` | 所有功能数据（按用户隔离） | `useDB(event)` 或 `useUserDB(username)` |

- User DB 连接使用 LRU 缓存 (max=20, ttl=5min)
- 所有 DB 启用 WAL 模式 + 外键约束
- Legacy 单用户 DB (`data/assistant.db`) 仍有兼容支持，将在后续移除

### Admin DB 表

- `users` — username, passwordHash, role ('admin'|'user'), tokenVersion
- `userModules` — userId, moduleId, enabled (模块权限开关)

### User DB Schema 文件 (13 个)

habits, vocab, srs, planner, articles, llm, ability, dashboard, project-tracker, skill-configs, startup-map, music-ear, auth (legacy)

---

## 4. 工具插件系统

### 注册机制

每个工具是 `tools/<id>/` 目录下的自包含模块：
- `index.ts` — 调用 `registerTool()` 注册元信息 (id, name, icon, order, namespaces)
- 根 `.vue` 组件 — 通过 `() => import('./Tool.vue')` 延迟加载
- `components/` — 工具内部子组件

注册流程：`plugins/tools.client.ts` → `tools/index.ts` (side-effect imports) → 各工具 `registerTool()` → 存入模块级 `Map`。

路由自动解析：`pages/[...slug].vue` 将 URL path 映射为工具 ID。

### 已注册工具

| 工具 ID | 名称 | Order | 图标 |
|---------|------|-------|------|
| dashboard | 今日 | 0 | Home |
| ability-profile | 能力画像 | 1 | Radar |
| vocab-tracker | 法语词汇 | 2 | BookOpen |
| annual-planner | 年度计划 | 3 | Target |
| project-tracker | 事项追踪 | 4 | ClipboardList |
| article-reader | 文章阅读 | 5 | FileText |
| skill-manager | 技能管理 | Infinity | Settings |
| admin | 用户管理 | 100 | Users |
| (动态) | Skill 工具 | — | 按配置 |

### Skill Learning Core

通用结构化学习引擎，所有技能工具共享同一套 DB 表（按 `skillId` 隔离）、API 路由和 UI 组件。

添加新技能工具 (~4 文件)：
1. 定义种子数据
2. 注册技能配置（含 AI 提示词）+ 在 `server/plugins/skill-learning.ts` 添加导入
3. 注册工具 `tools/<id>/index.ts`
4. 创建根组件，使用 `createSkillLearningStore(skillId)` + `provide(SKILL_STORE_KEY, store)`

---

## 5. 服务端架构

### 中间件链

| 序号 | 文件 | 职责 |
|------|------|------|
| 00 | cache-control.ts | 静态资源缓存头 |
| 00 | security-headers.ts | CSP, X-Frame-Options, X-Content-Type-Options 等安全头 |
| 01 | log.ts | 请求日志 |
| 02 | auth.ts | JWT 验证 + 角色/模块缓存 (60s TTL) |
| 03 | test-guard.ts | 生产环境禁止访问测试端点 |
| 04 | module-guard.ts | 模块权限守卫 (namespace → moduleId 反向查找) |

### 模块权限系统

`server/utils/module-ids.ts` 定义了所有模块 ID 及其 API 命名空间映射：

| 模块 ID | API 命名空间 |
|---------|-------------|
| dashboard | dashboard, badges |
| ability-profile | ability-skills, ability-categories, ability-stats, skill-templates |
| habit-tracker | habits, checkins |
| annual-planner | planner |
| vocab-tracker | vocab |
| article-reader | articles, bookmarks, article-tags |
| project-tracker | project-tracker |
| skill-manager | skill-configs, skills |
| xiaoshuang | xiaoshuang |

免检路径：`/api/admin/`, `/api/auth/`, `/api/_test/`, `/api/llm/`, `/api/songs/`

### API 路由组

| 命名空间 | 端点前缀 | 功能 |
|-----------|----------|------|
| 认证 | `/api/auth` | 登录 (JWT, 365天) |
| 管理 | `/api/admin` | 用户 CRUD + 模块权限 |
| 习惯 | `/api/habits`, `/api/checkins` | 习惯 CRUD、打卡、统计 |
| 词汇 | `/api/vocab` | 词汇导入、SRS、释义 |
| 计划 | `/api/planner` | 领域、目标、检查项、标签、统计 |
| 能力 | `/api/ability-skills`, `/api/ability-categories`, `/api/ability-stats`, `/api/skill-templates` | 能力画像 |
| 文章 | `/api/articles`, `/api/bookmarks`, `/api/article-tags` | 文章抓取、翻译、书签 |
| 项目 | `/api/project-tracker` | 项目管理 |
| 面板 | `/api/dashboard`, `/api/badges` | 每日摘要、徽章 |
| 小爽 | `/api/xiaoshuang` | AI 教练聊天 |
| 技能学习 | `/api/skills/[skillId]` | 通用学习引擎 (30+ 端点) |
| 技能配置 | `/api/skill-configs` | 技能定义管理 |
| 歌曲 | `/api/songs` | Music Ear 技能工具 |
| LLM | `/api/llm` | Provider 管理、模型发现、聊天、翻译 |
| 测试 | `/api/_test` | 数据重置 (生产环境禁用) |

---

## 6. 前端架构

### 路由

- `pages/index.vue` — 重定向到第一个工具
- `pages/[...slug].vue` — 解析 slug 为工具 ID，渲染对应组件
- `pages/login.vue` — 登录页

### 认证

- `composables/useAuth.ts` 管理 JWT（localStorage）
- `plugins/auth.client.ts` 自动附加 token 到所有 `$fetch` 请求，401 时重定向到 `/login`

### 状态管理

Pinia stores 使用 Composition API 风格 (`defineStore('id', () => { ... })`)。

### 样式系统

- CSS 变量定义在 `assets/css/variables.css`
- 黑白极简色板，`--color-accent: #000000`
- 所有组件使用 `<style scoped>`，颜色/间距/圆角全部引用 CSS 变量

---

## 7. LLM 集成

详见 [LLM-ARCHITECTURE.md](./LLM-ARCHITECTURE.md)。

| Provider | 接入方式 | 状态 |
|----------|----------|------|
| Claude CLI | `child_process.spawn` 调用本地 `claude` CLI | ✅ |
| Claude API | REST API (需 API key) | ✅ |
| Gemini | REST API (免费层, gemini-2.5-flash/flash-lite) | ✅ |
| Ollama | REST API `http://localhost:11434` | ✅ |

---

## 8. 部署

PM2 进程管理，配置在 `ecosystem.config.cjs`。

### 部署流程 (`scripts/deploy.sh`)

1. 停止开发服务器
2. `npm run build` 构建到 `.output/`
3. Legacy 迁移检查 (单用户 → 多用户)
4. 数据库备份 (`data/backups/`, 保留最近 5 份)
5. 迁移 Admin DB
6. 迁移所有 User DB
7. PM2 重启

### 环境变量

| 变量 | 说明 |
|------|------|
| DATA_DIR | 数据目录 (默认 `./data`, 开发可设为 `./data-dev`) |
| JWT_SECRET | JWT 签名密钥 |
| DATABASE_PATH | Legacy 单用户 DB 路径 |

---

## 9. 关键约定

- **DB 访问**: API handler 内调用 `useDB(event)`，不在模块顶层调用。Lib 函数接收 `db` 参数。
- **API 错误**: 验证输入 → 检查存在性 (404) → 执行变更。用 `createError({ statusCode, message })`
- **时间戳**: Unix 毫秒 (integer)；日期: `YYYY-MM-DD` 字符串
- **ID**: UUID (习惯/打卡)，自增整数 (其他模块)
- **乐观更新**: 习惯打卡 UI 立即反映，后台异步同步
- **响应式**: `Set<number>` 状态需整体替换以触发 Vue 响应
- **批量 DB**: 同步事务 + 500 行分块
- **CSS**: 所有颜色/间距引用 CSS 变量，无硬编码值
- **语言**: UI 文字中文，代码（变量、注释）英文
