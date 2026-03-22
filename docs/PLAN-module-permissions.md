# 实施计划：多用户 + 模块权限 + 数据隔离

> 创建日期: 2026-03-22
> 更新日期: 2026-03-22

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

### Step 0.1: 用户名校验规则

**修改**: 创建用户的所有入口（admin API、seed 脚本）
- 强制用户名匹配 `/^[a-z0-9_-]{3,30}$/`
- `useUserDB()` 中二次校验：`path.resolve()` 后确认路径在 `data/users/` 内
- 防止路径穿越攻击（如 `../../admin` 写入 admin.db）

### Step 0.2: 重构 5 个 lib 函数为接收 db 参数

这些函数内部直接调用 `useDB()`，改签名后无法获取 event 上下文，必须先改为接收 `db` 参数：

| 文件 | 函数 | 当前调用方式 | 改为 |
|------|------|-------------|------|
| `server/lib/ability/log-activity.ts:18` | `logActivity()` | `useDB()` 内部调用 | `logActivity(db, params)` |
| `server/lib/ability/self-management.ts:69` | `ensureSelfManagementSkills()` | `useDB()` 内部调用 | `ensureSelfManagementSkills(db)` |
| `server/lib/ability/verify.ts:30` | `verifyPlatformAuto()` | `useDB()` 内部调用 | `verifyPlatformAuto(db, config)` |
| `server/lib/skill-learning/db-helpers.ts:151` | `resolveSkill()` | `useDB()` 内部调用 | `resolveSkill(db, event)` |

同步修改所有调用方（API handler 中传入 `db`）。

### Step 0.3: 重构 2 个 handler 工厂

| 文件 | 函数 | 修改 |
|------|------|------|
| `server/utils/handler-helpers.ts:106` | `createDeleteHandler()` | 闭包内 `useDB()` → `useDB(event)` |
| `server/utils/reorder-handler.ts:29` | `createReorderHandler()` | 闭包内 `useDB()` → `useDB(event)` |

这两个在 `defineEventHandler` 闭包内，有 `event` 访问权限，修改简单。

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

### Step 0.5: 测试基础设施适配（从 Phase 7 前移）

**修改**: 在 Phase 2 之前完成，否则改完 `useDB()` 签名后所有测试立即崩溃
- `_test/reset.post.ts` — 改为清理 admin.db + 删除 `data/users/*.db`
- `_test/seed-user.post.ts` — 改用 `useAdminDB()` 写入用户 + 调用 `initUserDB()` 创建用户 DB

---

## Phase 1: 数据库分离基础设施

### Step 1: 创建 admin schema

**新建**: `server/database/admin-schema.ts`
- 仅包含两张表：`users`（新增 `role` 列）、`userModules`（新表）
- `users`: `id`, `username`, `passwordHash`, `role`(text, default 'user'), `createdAt`
- `userModules`: `id`, `userId`(FK→users, CASCADE), `moduleId`(text), `enabled`(integer boolean), `updatedAt`(timestamp)
- `(userId, moduleId)` 唯一索引

**修改**: `server/database/schema.ts`
- 保留所有现有表（用户 DB 的 schema 不变）
- `users` 表从用户 schema 中移除（认证表只在 admin.db）

### Step 2: 改造 `useDB()` 为多数据库路由

**改造**: `server/database/index.ts`

```typescript
import { LRUCache } from 'lru-cache';

// admin.db — 全局单例，仅认证 + 权限
let _adminDb = null;
export function useAdminDB() {
  if (!_adminDb) {
    const dbPath = process.env.ADMIN_DB_PATH || './data/admin.db';
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('busy_timeout = 5000');
    _adminDb = drizzle(sqlite, { schema: adminSchema });
  }
  return _adminDb;
}

// 用户 DB — LRU 缓存，按 username 路由
const userDbCache = new LRUCache<string, DrizzleDB>({
  max: 20,
  ttl: 5 * 60 * 1000,         // 空闲 5 分钟自动回收
  dispose: (db) => db.close(), // 回收时关闭连接
});

export function useUserDB(username: string) {
  // 校验用户名安全性（防路径穿越）
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    throw new Error('Invalid username');
  }
  const cached = userDbCache.get(username);
  if (cached) return cached;

  const dbPath = resolve('./data/users', `${username}.db`);
  // 二次校验：确保路径在 data/users/ 内
  if (!dbPath.startsWith(resolve('./data/users/'))) {
    throw new Error('Invalid DB path');
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  userDbCache.set(username, db);
  return db;
}

// 主入口：从 event.context 自动取 username
export function useDB(event: H3Event) {
  const username = event.context.auth?.username;
  if (!username) throw new Error('No authenticated user');
  return useUserDB(username);
}

// 进程退出时清理所有连接
process.on('exit', () => {
  userDbCache.clear(); // 触发 dispose 回调关闭连接
  if (_adminDb) _adminDb.close();
});
```

### Step 3: 用户 DB 自动初始化

**新建**: `server/utils/user-db-init.ts`
- `initUserDB(username: string)`: 创建 `data/users/{username}.db`，执行全部 user schema 迁移
- 新用户注册时自动调用
- 可选：从模板 DB 复制（预建一个空的 `data/template.db`，包含 seed 数据如 `ability_categories` 的 7 个维度、`badges` 定义等）

### Step 4: 迁移现有数据

**新建**: `scripts/migrate-to-multi-user.ts`
一次性迁移脚本（幂等，可重复运行）：
1. 检查 `admin.db` 是否已存在，存在则跳过（幂等）
2. 备份原始 `./data/assistant.db` → `./data/backups/`
3. 创建 `./data/admin.db`，建 `users` + `user_modules` 表
4. 从 `assistant.db` 复制用户记录到 `admin.db`，设 `role: 'admin'`，插入全部模块启用记录
5. 复制 `assistant.db` → `./data/users/{username}.db`（完整保留所有数据）
6. 从用户 DB 中 DROP `users` 表（防止密码哈希泄露）
7. 清理用户 DB 中的 `vocabUsers` 相关表和数据
8. 写入 `.migration-state` 文件记录完成状态

### Step 5: 改造迁移脚本

**修改**: `npm run db:migrate`
- admin.db 执行 admin schema 迁移
- 遍历 `data/users/*.db` 逐个执行 user schema 迁移
- 新增 `npm run db:migrate:admin` 和 `npm run db:migrate:users` 子命令

---

## Phase 2: 后端适配

### Step 6: API handler 适配 useDB(event)

**改造**: 所有用户数据 API handler（~180 个文件）
- `const db = useDB()` → `const db = useDB(event)`
- **机械替换**，业务逻辑不变，只加一个参数
- TypeScript 编译器会捕获所有遗漏（新签名要求 H3Event 参数）

### Step 7: 认证相关 API 改用 useAdminDB

**改造**: 仅需改动认证 API
- `server/api/auth/login.post.ts` → `useAdminDB()`
- 其余所有 API（包括 LLM、词库、歌曲、技能配置等）均操作用户自己的 DB

### Step 8: 清理 vocabUsers 系统

**删除**: `vocabUsers` 表及相关逻辑
- 删除 `server/api/vocab/users.get.ts`, `users.post.ts`, `users/[id].delete.ts`
- `vocab_progress`, `srs_cards`, `review_logs`, `study_sessions` 中的 `userId` 列可保留但不再有意义（每人独立 DB）
- 前端 `stores/vocab.ts` 中移除 vocabUser 选择逻辑
- **安全修复**：不再从 request body 接收 userId

### Step 9: Auth 中间件增强

**修改**: `server/middleware/02.auth.ts`
- JWT 验证后，从 `useAdminDB()` 查询用户角色和启用模块
- 附加到 `event.context.auth`：`{ userId, username, role, enabledModules }`
- `role` 和 `enabledModules` 均从 admin.db 实时查询（带 60s 内存缓存），不信任 JWT 中的值
- 缓存失效：模块权限变更时清除对应用户的缓存

### Step 10: 模块 ID 常量映射

**新建**: `server/utils/module-ids.ts`
- 导出 `MODULE_NAMESPACE_MAP`：模块 ID → API 命名空间数组的映射
- 导出 `ALL_MODULE_IDS` 数组
- 单一真相源

### Step 11: 模块守卫中间件

**新建**: `server/middleware/04.module-guard.ts`
- 匹配 `/api/{namespace}/...` → 查找所属模块 → 检查 `event.context.auth.enabledModules` 是否包含该模块
- 未启用 → 403 `'该模块未启用'`
- 跳过：`/api/admin/*`, `/api/auth/*`, `/api/_test/*`
- 未映射命名空间默认放行（CLAUDE.md 中记录：新工具必须更新映射）
- `/api/admin/*` 路径额外要求 `role === 'admin'`

### Step 12: 更新登录 API

**修改**: `server/api/auth/login.post.ts`
- 使用 `useAdminDB()` 验证用户凭据
- JWT payload 加入 `role`（仅作为前端初始化用，后端不信任）
- 响应体加入 `enabledModules[]` 和 `role`

---

## Phase 3: 超管 API

### Step 13: 用户管理 CRUD

**新建**: `server/api/admin/users/`（全部使用 `useAdminDB()`）
- `index.get.ts` — 用户列表（含角色、启用模块列表、DB 文件大小）
- `index.post.ts` — 创建用户：校验用户名格式 + 写入 admin.db + 调用 `initUserDB()` 创建用户 DB + 插入模块权限
- `[id]/modules.put.ts` — 更新用户模块权限，清除该用户的权限缓存
- `[id].delete.ts` — 删除用户：删 admin.db 记录 + 归档用户 DB 文件到 `data/archived/`（禁止删除最后一个 admin）
- `[id]/reset-password.post.ts` — 重置用户密码

---

## Phase 4: 前端权限系统

### Step 14: 权限 composable

**新建**: `composables/useModulePermissions.ts`
- 响应式状态：`enabledModules: Set<string>`, `role: string`
- 方法：`isModuleEnabled(moduleId: string): boolean`, `isAdmin(): boolean`
- 持久化到 localStorage（与 token 同步生命周期）

### Step 15: 更新 `useAuth`

**修改**: `composables/useAuth.ts`
- 登录成功后调用 `setPermissions(response.enabledModules, response.role)`
- `init()` 从 localStorage 恢复权限
- `logout()` 清除权限

### Step 16: 工具过滤

**修改**: `composables/useCurrentTool.ts`
- `getAll()` 结果通过 `isModuleEnabled(tool.id)` 过滤
- admin 工具仅 `isAdmin()` 时可见

### Step 17: UI 组件适配

- `AppSidebar.vue` — 小爽按钮 `v-if="isModuleEnabled('xiaoshuang')"`
- `MobileBottomNav.vue` — 同上
- `layouts/default.vue` — XiaoshuangChat 渲染条件加 `isModuleEnabled('xiaoshuang')`

### Step 18: 路由守卫

**修改**: `pages/[...slug].vue`
- 模块存在但未启用 → 重定向到第一个启用的工具

**修改**: `pages/index.vue`
- 默认重定向到第一个**已启用**的工具（而非固定第一个）

---

## Phase 5: 跨模块降级处理

### Step 19: Dashboard 上下文过滤

- `context-builder.ts` — `collectFullSummary` 新增 `enabledModules` 参数，仅采集已启用模块的数据
- `dashboard/summary.get.ts` — 传入 `event.context.auth.enabledModules`
- Dashboard 前端组件根据 `enabledModules` 隐藏对应卡片

### Step 20: 小爽 AI 上下文过滤

- `xiaoshuang/chat.post.ts` — 传入 `enabledModules` 给 `collectRelevantContext`，仅读取已启用模块数据

### Step 21: 可选链接降级

- `useAbilitySkillOptions.ts` — `ability-profile` 未启用时返回空数组（习惯/计划表单中隐藏链接选择器）
- Skill Learning `ArticlePicker` — `article-reader` 未启用时隐藏「关联文章」功能
- Skill Learning `LinkedSongs` — `skill-manager` 未启用时无影响（歌曲在用户自己的 DB 中）

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
