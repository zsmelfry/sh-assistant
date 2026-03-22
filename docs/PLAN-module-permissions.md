# 实施计划：多用户 + 模块权限 + 数据隔离

> 创建日期: 2026-03-22
> 更新日期: 2026-03-22 (Phase 0-5 已完成)

## 需求

1. 支持多用户，每个用户数据完全隔离（物理隔离，每人独立 SQLite 文件）
2. 超级管理员角色，可管理所有用户及其模块权限
3. 所有模块（含 Dashboard、小爽 AI）均可按用户启用/禁用
4. 跨模块依赖优雅降级
5. 面向商业化：安全、可靠、可收费
6. 不做共享数据——所有功能数据归用户私有，未来再考虑共享机制

## 核心架构：每用户独立 SQLite 文件

### 文件结构

```
data/
├── admin.db              ← 仅用户认证 + 模块权限
├── users/
│   ├── shuang.db         ← 用户 shuang 的全部数据（所有功能表）
│   ├── alice.db          ← 用户 alice 的全部数据
│   └── bob.db            ← 用户 bob 的全部数据
```

### 数据库职责划分

**`admin.db`（仅认证和权限管理）**

| 表 | 用途 |
|---|---|
| `users` | 用户认证（含 `role` 列：`admin` / `user`） |
| `user_modules` | 模块权限：`userId` + `moduleId` + `enabled` |

**`{username}.db`（用户全部数据，Schema 与现有 assistant.db 完全一致）**

每个用户 DB 包含当前 `assistant.db` 的所有表，用户自主管理所有功能数据：

| 分类 | 包含的表 |
|------|---------|
| LLM 配置 | `llm_providers` |
| 习惯打卡 | `habits`, `checkins` |
| 年度计划 | `planner_domains`, `planner_goals`, `planner_checkitems`, `planner_tags`, `planner_goal_tags` |
| 法语词汇 | `vocab_words`, `vocab_progress`, `vocab_settings`, `vocab_status_history` |
| SRS 学习 | `srs_cards`, `review_logs`, `study_sessions`, `definitions` |
| 文章阅读 | `articles`, `article_bookmarks`, `article_translations`, `article_tags`, `article_tag_map`, `article_chats` |
| 能力画像 | `ability_categories`, `skills`, `milestones`, `milestone_completions`, `skill_current_state`, `skill_snapshots`, `activity_logs`, `badges`, `badge_awards`, `skill_templates` |
| 事项追踪 | `pt_projects`, `pt_categories`, `pt_tags`, `pt_project_tags`, `pt_milestones`, `pt_checklist_items`, `pt_checklist_attachments`, `pt_notes`, `pt_attachments`, `pt_diagrams`, `pt_chats`, `pt_notifications` |
| 技能学习 | `sm_domains`, `sm_topics`, `sm_points`, `sm_teachings`, `sm_chats`, `sm_stages`, `sm_stage_points`, `sm_tasks`, `sm_notes`, `sm_point_articles`, `sm_point_songs`, `sm_activities`, `sm_quizzes`, `sm_quiz_attempts`, `sm_products` |
| 技能配置 | `skill_configs` |
| 歌曲 | `songs`, `sm_point_songs` |
| Dashboard | `coach_daily_insights` |

## 所有可管理模块

| 模块 ID | 名称 | API 命名空间 |
|---------|------|-------------|
| `dashboard` | 今日 | `dashboard`, `badges` |
| `ability-profile` | 能力画像 | `ability-skills`, `ability-categories`, `ability-stats`, `skill-templates` |
| `habit-tracker` | 日历打卡 | `habits`, `checkins` |
| `annual-planner` | 年度计划 | `planner` |
| `vocab-tracker` | 法语词汇 | `vocab` |
| `article-reader` | 文章阅读 | `articles`, `bookmarks`, `article-tags` |
| `project-tracker` | 事项追踪 | `project-tracker` |
| `skill-manager` | 技能管理 | `skill-configs`, `skills` |
| `xiaoshuang` | 小爽 AI | `xiaoshuang` |

## 模块依赖关系图

```
                    ┌─────────────┐
                    │  Dashboard  │ ◄── 聚合已启用模块（只读）
                    └──────┬──────┘
                           │ reads from enabled modules only
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
   │ 习惯打卡  │    │  年度计划    │    │  事项追踪   │
   └────┬─────┘    └──────┬──────┘    └─────────────┘
        │ optional        │ optional
        └────────┬────────┘
           ┌─────▼──────┐
           │ 能力画像    │  ◄── 技能链接中心
           └────────────┘

   ┌────────────┐          ┌──────────────┐
   │ 法语词汇    │          │  文章阅读     │
   │ (含SRS学习) │          └──────┬───────┘
   └────────────┘                 │ optional
                           ┌──────▼───────┐
                           │ 技能学习工具   │
                           └──────────────┘

   ┌────────────┐
   │  小爽 AI    │ ◄── 读取已启用模块数据作为上下文
   └────────────┘
```

---

## Phase 0: 前置修复（安全审计发现的必修项）

> 不做这些，后续 Phase 会崩溃或引入安全漏洞。

### Step 0.1: 用户名校验规则 ✅ 已完成

**新建**: `server/utils/username-validation.ts` — 共享校验函数 `validateUsername()`，强制匹配 `/^[a-z0-9_-]{3,30}$/`
**修改**: `server/api/_test/seed-user.post.ts` — 调用 `validateUsername()` 校验用户名

- `useUserDB()` 中二次路径校验将在 Phase 1 Step 2 创建 `useUserDB()` 时实现

### Step 0.2: 重构 4 个 lib 函数为接收 db 参数 ✅ 已完成

这些函数内部直接调用 `useDB()`，已改为接收 `db` 参数：

| 文件 | 函数 | 改为 | 调用方更新数 |
|------|------|------|------------|
| `server/lib/ability/log-activity.ts` | `logActivity()` | `logActivity(db, params)` | 15 处（11 个文件） |
| `server/lib/ability/self-management.ts` | `ensureSelfManagementSkills()` | `ensureSelfManagementSkills(db)` | 1 处 |
| `server/lib/ability/verify.ts` | `verifyPlatformAuto()` | `verifyPlatformAuto(db, config)` | 2 处（2 个文件） |
| `server/lib/skill-learning/db-helpers.ts` | `resolveSkill()` | `resolveSkill(db, event)` | 36 处（36 个文件） |

所有调用方已同步修改。这 4 个函数的 `import { useDB }` 已改为 `import type { useDB }` 以确保不再直接调用。

### Step 0.3: 重构 2 个 handler 工厂 ✅ 已完成

| 文件 | 函数 | 修改 |
|------|------|------|
| `server/utils/handler-helpers.ts` | `createDeleteHandler()` | 闭包内 `useDB()` → `useDB(event)` |
| `server/utils/reorder-handler.ts` | `createReorderHandler()` | 闭包内 `useDB()` → `useDB(event)` |

同时 `server/database/index.ts` 的 `useDB()` 已添加可选 `_event` 参数以兼容新调用方式，Phase 1 将改为实际使用该参数进行用户路由。

### Step 0.4: 删除后台定时任务和通知系统 ✅ 已完成

项目中唯一的后台定时任务。在多用户架构下无法工作（无用户上下文），且使用 macOS `osascript` 不适合生产部署。

**已删除的文件（3 个）：**
- `server/plugins/pt-notifications.ts` — 后台定时任务插件（setInterval 每小时 + setTimeout 启动 10s）
- `server/lib/project-tracker/notifications.ts` — 通知检查逻辑（`checkAndSendNotifications()`、`sendMacNotification()`）
- `server/api/project-tracker/notifications/check.post.ts` — 手动触发 API

**已删除的数据库表（1 个）：**
- `ptNotifications` 从 `server/database/schemas/project-tracker.ts` 中移除 — 仅用于通知去重记录

**已更新的文档（1 个）：**
- `docs/MODULE-RULES-AND-RELATIONSHIPS.md` — 更新提醒系统描述

**保留不动的部分：**
- `reminderAt` 字段保留在 `ptProjects`、`ptChecklistItems`、`ptMilestones` schema 中（纯数据字段，无害）
- 前端提醒时间输入/显示 UI 保留（用户仍可设置提醒时间，未来可用 Web Push 等机制替代）
- 3 个 PUT API handler 中 `reminderAt` 的读写逻辑保留

### Step 0.5: 测试基础设施适配（从 Phase 7 前移）✅ 已在 Phase 1 中完成

- `_test/reset.post.ts` — 改为清理 admin.db + 删除 `data/users/*.db`
- `_test/seed-user.post.ts` — 改用 `useAdminDB()` 写入用户 + 调用 `initUserDB()` 创建用户 DB + 启用全部模块

---

## Phase 1: 数据库分离基础设施

### Step 1: 创建 admin schema ✅ 已完成

**新建**: `server/database/admin-schema.ts` — `users`（含 `role` 列）+ `userModules` 表
**修改**: `server/database/schema.ts` — 移除 `users` 表导出
**修改**: `server/database/schemas/auth.ts` — 清空（users 已移至 admin-schema）
**新建**: `drizzle-admin.config.ts` — admin schema 的 drizzle-kit 配置
**生成**: `server/database/admin-migrations/0000_thick_lady_vermin.sql`

### Step 2: 改造 `useDB()` 为多数据库路由 ✅ 已完成

**改造**: `server/database/index.ts`
- `useAdminDB()`: admin.db 全局单例
- `useUserDB(username)`: LRU 缓存（max=20, ttl=5min），按 username 路由到 `data/users/{username}.db`
- `useDB(event?)`: 有 auth context 时路由到用户 DB，否则回退到 legacy 单例（Phase 2 完成后移除回退）
- 进程退出清理所有连接
- 安装了 `lru-cache` 依赖

### Step 3: 用户 DB 自动初始化 ✅ 已完成

**新建**: `server/utils/user-db-init.ts`
- `initUserDB(username)`: 创建 `data/users/{username}.db`，用 drizzle migrate 执行全部 user schema 迁移
- 含用户名校验 + 路径安全校验

### Step 4: 迁移现有数据 ✅ 已完成

**新建**: `scripts/migrate-to-multi-user.ts` — 幂等迁移脚本
- 备份 → 创建 admin.db → 复制用户 → 创建用户 DB → DROP users 表 → 清理 vocab_users → 写状态文件
- `npm run db:migrate-to-multi-user` 执行

### Step 5: 改造迁移脚本 ✅ 已完成

**新建**: `scripts/migrate-all.ts` — `npm run db:migrate` 入口，先 admin 再遍历 user DBs
**新建**: `scripts/migrate-user-dbs.ts` — 遍历 `data/users/*.db` 逐个执行 user schema 迁移
**新增 npm scripts**: `db:migrate:admin`, `db:migrate:users`, `db:migrate:legacy`, `db:migrate-to-multi-user`

**同步完成的关联修改：**
- `server/api/auth/login.post.ts` → 改用 `useAdminDB()` + 返回 `role` 和 `enabledModules`
- `server/api/_test/reset.post.ts` → 清理 admin.db + 删除用户 DB 文件
- `server/api/_test/seed-user.post.ts` → 改用 `useAdminDB()` + `initUserDB()`
- `scripts/seed-user.ts` → 改用 admin.db + 创建用户 DB + 启用全部模块

---

## Phase 2: 后端适配

### Step 6: API handler 适配 useDB(event) ✅ 已完成

190 个 API handler 文件已替换 `useDB()` → `useDB(event)`。
17 个原 `async () =>` 签名的 handler 已添加 `event` 参数。

### Step 7: 认证相关 API 改用 useAdminDB ✅ 已在 Phase 1 中完成

### Step 8: 清理 vocabUsers 系统 ✅ 已完成

**已删除**: `server/api/vocab/users.get.ts`, `users.post.ts`, `users/[id].delete.ts`, `server/utils/vocab-progress.ts`
**已修改**: `words-import.post.ts`, `progress/batch.post.ts`, `progress/chart.get.ts`, `progress/status.post.ts` — 移除 userId 接收和过滤
**保留**: `vocabUsers` schema 定义及 `userId` 列（drizzle 迁移兼容性）
**待做**: 前端 `stores/vocab.ts` vocabUser 逻辑清理（Phase 4）

### Step 9: Auth 中间件增强 ✅ 已完成

`server/middleware/02.auth.ts` — JWT 验证后从 admin.db 查询 role + enabledModules（60s 缓存）
导出 `clearAuthCache(username)` 用于权限变更时清除缓存

### Step 10: 模块 ID 常量映射 ✅ 已完成

`server/utils/module-ids.ts` — `ALL_MODULE_IDS`, `ModuleId` 类型, `MODULE_NAMESPACE_MAP`

### Step 11: 模块守卫中间件 ✅ 已完成

`server/middleware/04.module-guard.ts` — API 命名空间 → 模块权限校验，admin 路径要求管理员角色

### Step 12: 更新登录 API ✅ 已在 Phase 1 中完成

---

## Phase 3: 超管 API

### Step 13: 用户管理 CRUD ✅ 已完成

**新建**: `server/api/admin/users/`（全部使用 `useAdminDB()`，受 `04.module-guard.ts` admin 角色保护）
- `index.get.ts` — 用户列表（含角色、启用模块列表、DB 文件大小）
- `index.post.ts` — 创建用户：校验用户名 + admin.db + initUserDB() + 模块权限
- `[id]/modules.put.ts` — 更新模块权限 + clearAuthCache()
- `[id].delete.ts` — 删除用户（归档 DB 到 `data/archived/`，禁删最后一个 admin）
- `[id]/reset-password.post.ts` — 重置密码

---

## Phase 4: 前端权限系统

### Step 14: 权限 composable ✅ 已完成

`composables/useModulePermissions.ts` — `isModuleEnabled()`, `isAdmin()`, `setPermissions()`, localStorage 持久化

### Step 15: 更新 useAuth ✅ 已完成

登录时 `setPermissions(res.enabledModules, res.role)`，logout 时清除

### Step 16: 工具过滤 ✅ 已完成

`useCurrentTool.ts` — 按 `isModuleEnabled` 过滤工具列表，admin 工具仅管理员可见

### Step 17: UI 组件适配 ✅ 已完成

- `AppSidebar.vue` — 小爽按钮 `v-if="isModuleEnabled('xiaoshuang')"`
- `MobileBottomNav.vue` — 同上
- `layouts/default.vue` — XiaoshuangChat 条件加 `isModuleEnabled('xiaoshuang')`

### Step 18: 路由守卫 ✅ 已完成

- `pages/[...slug].vue` — 模块未启用 → 重定向到第一个启用的工具
- `pages/index.vue` — 默认重定向到第一个已启用的工具

---

## Phase 5: 跨模块降级处理

### Step 19: Dashboard 上下文过滤 ✅ 已完成

- `context-builder.ts` — `collectFullSummary` + `collectRelevantContext` 新增 `enabledModules` 参数，按模块过滤数据源
- `dashboard/summary.get.ts` + `insight.get.ts` — 传入 `event.context.auth.enabledModules`

### Step 20: 小爽 AI 上下文过滤 ✅ 已完成

- `xiaoshuang/chat.post.ts` — 传入 `enabledModules` 给 `collectRelevantContext`

### Step 21: 可选链接降级 ✅ 已完成

- `useAbilitySkillOptions.ts` — `ability-profile` 未启用时返回空数组
- `LinkedArticles.vue` — `article-reader` 未启用时隐藏关联文章区域

---

## Phase 6: 超管 UI

### Step 22: 注册 admin 工具

**新建**: `tools/admin/index.ts`
- `registerTool({ id: 'admin', name: '用户管理', order: 100, icon: Users, namespaces: ['admin'] })`

**修改**: `tools/index.ts`
- 添加 `import './admin'`

### Step 23: Admin 主面板

**新建**: `tools/admin/Admin.vue`
- 用户列表表格：用户名、角色、创建时间、DB 文件大小、操作按钮
- 「添加用户」按钮

### Step 24: Admin 子组件

**新建**: `tools/admin/components/`
- `UserList.vue` — 用户表格 + 编辑/删除操作
- `UserForm.vue` — 创建/编辑用户模态框（用户名、密码、角色选择）
- `ModuleToggles.vue` — 模块开关网格（点击用户行展开，显示所有模块的 toggle 开关）

---

## Phase 7: 测试 + 部署

### Step 25: E2E 测试

**新建**: `e2e/admin.spec.ts`
- admin 可见用户管理工具，普通用户不可见
- admin 创建新用户 → 验证用户 DB 文件已创建
- admin 切换模块权限 → 用户侧边栏相应变化
- 普通用户访问禁用模块 API → 403
- 两个用户数据完全隔离（用户 A 的习惯，用户 B 看不到）
- Dashboard 禁用后侧边栏不显示、路由重定向

### Step 26: 部署脚本更新

**修改**: `scripts/deploy.sh`
- 备份策略：`admin.db` + `users/*.db` 全部备份
- 迁移：先 admin.db，再遍历 `users/*.db`
- 首次部署：运行 `migrate-to-multi-user.ts` 从 `assistant.db` 拆分

---

## 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| 用户名路径穿越攻击 | 已修复 | Phase 0 Step 0.1：正则校验 + resolve 路径验证 |
| lib 函数内部调 useDB() 致运行时崩溃 | 已修复 | Phase 0 Step 0.2：5 个函数改为接收 db 参数 |
| handler 工厂内部调 useDB() | 已修复 | Phase 0 Step 0.3：2 个工厂改为 useDB(event) |
| 后台定时任务无用户上下文 | ✅ 已删除 | Phase 0 Step 0.4：删除通知插件 + 逻辑 + API + DB 表 |
| 测试基础设施崩溃 | 已修复 | Phase 0 Step 0.5：提前适配测试代码 |
| JWT role 365 天不过期致降权无效 | 已修复 | Step 9：role 从 admin.db 实时查询，不信任 JWT |
| DB 连接泄漏 | 已修复 | Step 2：使用 lru-cache 库 + dispose 回调 + exit handler |
| 迁移脚本复制 DB 含密码哈希 | 已修复 | Step 4：复制后 DROP users 表 |
| `useDB()` 签名变更影响 ~180 个文件 | 中 | 机械替换；TypeScript 编译器捕获遗漏 |
| 迁移脚本需遍历所有用户 DB | 低 | 用户数少（<100），循环执行即可 |
| 新工具忘记更新命名空间映射 | 低 | CLAUDE.md 中记录规则，未映射默认放行 |

---

## 实施顺序

```
Phase 0 (前置修复)   → 用户名校验、lib 函数重构、删定时任务、测试适配
Phase 1 (DB 分离)    → schema 拆分、useDB 路由（lru-cache）、用户 DB 初始化、数据迁移
Phase 2 (后端适配)   → ~180 handler 机械替换、auth 增强、模块守卫
Phase 3 (超管 API)   → 用户 CRUD + 模块权限管理
Phase 4 (前端权限)   → UI 过滤、路由守卫
Phase 5 (跨模块降级) → Dashboard/小爽/可选链接优雅降级
Phase 6 (超管 UI)    → 管理面板工具
Phase 7 (测试部署)   → E2E 测试、部署脚本
```

每个 Phase 可独立验证。Phase 0 是安全和稳定性基础，必须最先完成。

---

## 关键设计原则

1. **admin.db 极简**：仅存认证和权限，不存任何功能数据
2. **物理隔离**：每用户独立 DB 文件，安全不依赖代码纪律
3. **零 Schema 变更**：用户 DB 保留现有全部表结构，业务代码只改 `useDB()` 调用签名
4. **用户数据自治**：每个用户独立拥有词库、LLM 配置、歌曲等所有数据，自由配置
5. **后端强制执行**：模块权限在 API 中间件层校验，前端只做体验优化
6. **不信任 JWT**：role 和 enabledModules 均从 admin.db 实时查询（带缓存），JWT 仅辅助前端初始化
7. **向后兼容**：迁移脚本处理现有数据，现有用户自动成为 admin 并启用所有模块
