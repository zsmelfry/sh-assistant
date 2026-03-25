# 登录系统重构 — 邀请制 + 邮箱登录 + 密码管理

## 概述

将登录系统从「管理员设密码 + 用户名登录」改为「管理员发邀请 + 用户自设凭证 + 邮箱登录」。新增忘记密码、修改密码、管理员强制重置等完整密码管理流程。

**核心决策（brainstorm 2轮讨论确认）：**

| 决策 | 结论 | 理由 |
|------|------|------|
| username 唯一性 | **保持唯一** | 避免 DB 文件命名、缓存、JWT 全面重构 |
| 登录标识 | **邮箱 + 密码** | username 由用户自选，不再是登录凭证 |
| 用户创建时机 | **接受邀请时创建** | 避免无密码用户记录 |
| 迁移策略 | **硬切换** | 管理员先设邮箱，然后一刀切 |
| 密码策略 | **NIST: 8+字符，无复杂度规则，常见密码黑名单** | 安全且不影响 UX |
| JWT 有效期 | **保持 30 天** | LAN 个人工具，7天太频繁 |
| 密码修改方式 | **当前密码 + 新密码（已登录状态）** | 用户已认证，无需邮件验证 |
| 个人设置 | **sidebar 下拉菜单，非独立 tool** | 设置不是生产力工具 |
| 邀请链接 | **复制链接为主，邮件为辅** | LAN 应用邮件是弱环节 |

---

## Part A — 基础设施

### Step 1 — verification_tokens 表

**文件:** `src/server/database/admin-schema.ts`

新增 `verificationTokens` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | 自增整数 | 主键 |
| email | text, NOT NULL | 目标邮箱 |
| tokenHash | text, NOT NULL, UNIQUE | SHA-256 hash（不存明文） |
| type | `'invite'` / `'reset'` | token 类型 |
| role | text | 仅 invite: 预设角色 |
| modules | text | 仅 invite: JSON 序列化的模块 ID 列表 |
| expiresAt | integer (Unix ms) | 过期时间 |
| usedAt | integer (Unix ms), nullable | 使用时间（null = 未使用） |
| createdAt | integer (Unix ms) | 创建时间 |

**Token 生成与验证规则：**
- 生成：`crypto.randomBytes(32)` → base64url 编码（43 字符，比 hex 短）
- 存储：`sha256(token)` 存 DB，明文只在 URL 中出现一次
- 消费：`UPDATE ... SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING *`（SQLite 串行写入，天然原子）
- 过期：invite 72小时，reset 30分钟
- 清理：服务启动时删除 7 天前的过期 token（Nitro plugin）

### Step 2 — 密码校验工具

**文件:** `src/server/utils/password-validation.ts`（新建）

```typescript
// 规则：8-128 字符，不在常见密码黑名单中
// 不要求大小写/数字/特殊字符（NIST SP 800-63B）
// 导出 validatePassword(password: string): void — 不合规时 throw createError
// 导出 PASSWORD_RULES 常量供前端显示
```

黑名单：内嵌 top 1000 常见密码数组，启动时加载到 Set。

**文件:** `src/utils/password-rules.ts`（新建，前后端共享）

```typescript
// 导出密码规则常量（最小/最大长度），供前端校验和显示
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
```

### Step 3 — Resend 邮件工具

**文件:** `src/server/utils/email.ts`（新建）

```typescript
// sendEmail(to, subject, html): Promise<{ id: string }>
// 使用 Resend API（npm install resend）
// API key 从 RESEND_API_KEY 环境变量读取
// 发件人从 EMAIL_FROM 环境变量读取（如 "个人助手 <noreply@yourdomain.com>"）
// 失败时 throw createError({ statusCode: 502, message: '邮件发送失败' })
```

**文件:** `src/server/utils/email-templates.ts`（新建）

```typescript
// inviteEmailHtml(inviteUrl: string, expiresHours: number): string
// resetEmailHtml(resetUrl: string, expiresMinutes: number): string
// 中文内容，简洁，移动端友好
// APP_BASE_URL 环境变量用于构造链接
```

### Step 4 — Rate limiter 工具提取

**文件:** `src/server/utils/rate-limiter.ts`（新建）

从 `login.post.ts` 提取通用 rate limiter：

```typescript
// createRateLimiter(options: { maxAttempts, windowMs, keyPrefix? })
// 返回 { check(key), record(key), clear(key) }
```

具体限制：

| 端点 | 限制 | Key |
|------|------|-----|
| POST /api/auth/login | 5次/15分钟 | email + IP |
| POST /api/auth/forgot-password | 3次/小时 | email |
| Token 消费端点 | 5次/小时 | IP |

---

## Part B — 邀请流程（管理员 → 用户）

### Step 5 — 管理员发送邀请 API

**文件:** `src/server/api/admin/invites/index.post.ts`（新建）

- 入参：`{ email, role, enabledModules }`（不再传 username/password）
- 校验 email 格式 + 唯一性（users 表 + 未过期 invite 中不重复）
- 生成 token → 存 hash 到 `verificationTokens`（附带 role + modules）
- 调用 sendEmail 发送邀请邮件（可选，失败不阻断）
- 返回 `{ id, email, inviteUrl, emailSent: boolean }`
- 管理员 UI 可直接复制 inviteUrl

### Step 6 — 管理员查看/管理待处理邀请

**文件:** `src/server/api/admin/invites/index.get.ts`（新建）

- 返回所有未使用且未过期的 invite token（email, role, expiresAt, createdAt）

**文件:** `src/server/api/admin/invites/[id].delete.ts`（新建）

- 撤销邀请（删除 token 行）

**文件:** `src/server/api/admin/invites/[id]/resend.post.ts`（新建）

- 废弃旧 token，生成新 token，重新发送邮件
- 返回新的 inviteUrl

### Step 7 — 用户接受邀请 API

**文件:** `src/server/api/auth/accept-invite.post.ts`（新建）

- 入参：`{ token, username, password }`
- 验证 token（hash 匹配 + 未使用 + 未过期）
- validateUsername(username) + 唯一性检查
- validatePassword(password)
- **一个事务内：**
  1. 创建 `users` 行（email 从 token 取, username, passwordHash, role 从 token 取）
  2. 创建 `userModules` 行（modules 从 token 取）
  3. `initUserDB(username)`
  4. 标记 token 为已使用
- 返回 JWT token（用户直接登录，无需再次输入凭证）

### Step 8 — 验证 token 有效性 API

**文件:** `src/server/api/auth/verify-token.post.ts`（新建）

- 入参：`{ token, type }` （type: 'invite' | 'reset'）
- 校验 token hash + 未使用 + 未过期
- 返回 `{ valid: true, email }` 或 `{ valid: false, reason: 'expired' | 'used' | 'invalid' }`
- 前端在展示表单前先调用，避免用户填完表单才发现 token 无效

---

## Part C — 登录改为邮箱

### Step 9 — 修改登录 API

**文件:** `src/server/api/auth/login.post.ts`

- 入参从 `{ username, password }` 改为 `{ email, password }`
- 按 email 查询用户（`WHERE email = ?`）
- Rate limiting key 从 username 改为 email
- JWT payload 加入 email：`{ userId, username, email, role, tokenVersion }`
- loginLogs 记录不变（username 字段保留作审计）

### Step 10 — Auth 中间件更新

**文件:** `src/server/middleware/02.auth.ts`

- 白名单加入：`/api/auth/accept-invite`, `/api/auth/verify-token`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- JWT 解码后 `event.context.auth` 增加 `email` 字段

**文件:** `src/server/middleware/04.module-guard.ts`

- 确认 module-guard 的 exception paths 包含新端点

---

## Part D — 忘记密码 + 重置密码

### Step 11 — 忘记密码 API

**文件:** `src/server/api/auth/forgot-password.post.ts`（新建）

- 入参：`{ email }`
- 如果 email 存在：生成 reset token（30分钟过期），发邮件
- 如果 email 不存在：**仍返回 200**（防止邮箱枚举）
- 废弃该 email 所有未使用的旧 reset token
- Rate limiting: 3次/小时/email

### Step 12 — 重置密码 API

**文件:** `src/server/api/auth/reset-password.post.ts`（新建）

- 入参：`{ token, password }`
- 验证 token（hash + 未使用 + 未过期 + type = 'reset'）
- validatePassword(password)
- 更新 `users.passwordHash` + bump `tokenVersion`（注销所有现有会话）
- 标记 token 为已使用
- 返回 `{ success: true }`（用户需重新登录）

---

## Part E — 已登录用户修改密码

### Step 13 — 修改密码 API

**文件:** `src/server/api/auth/change-password.post.ts`（新建）

- 需要认证（Bearer token）
- 入参：`{ currentPassword, newPassword }`
- 验证 currentPassword 正确
- validatePassword(newPassword)
- 更新 passwordHash + bump tokenVersion
- 返回新 JWT（当前会话继续有效，其他会话失效）

---

## Part F — 管理员密码管理

### Step 14 — 管理员强制重置密码

**文件:** `src/server/api/admin/users/[id]/force-reset.post.ts`（新建）

- 管理员发起 → 生成 reset token → 发送重置邮件 + 返回链接
- bump 目标用户 tokenVersion（立即注销）
- 删除该用户 email 的所有未使用 token
- loginLogs 记录 method: `'admin_reset'`

### Step 15 — 修改管理员创建用户流程

**文件:** `src/server/api/admin/users/index.post.ts`

- **移除** username 和 password 参数
- 改为调用邀请流程（或直接重定向到 invite API）
- 或者：此 API 废弃，统一用 `/api/admin/invites` 创建

### Step 16 — loginLogs method 扩展

**文件:** `src/server/database/admin-schema.ts`

- method 枚举扩展：`'password'` / `'token'` / `'invite_setup'` / `'password_reset'` / `'admin_reset'`

---

## Part G — 前端改动

### Step 17 — 登录页改造

**文件:** `src/pages/login.vue`

- 表单从「用户名 + 密码」改为「邮箱 + 密码」
- input type 改为 `email`，autocomplete 改为 `email`
- 新增「忘记密码？」链接 → 展开邮箱输入框 + 发送按钮（或跳转 `/forgot-password`）
- 发送后显示「重置链接已发送到您的邮箱」提示

### Step 18 — 忘记密码页

**文件:** `src/pages/forgot-password.vue`（新建）

- layout: `auth`（无侧边栏）
- 输入邮箱 → POST /api/auth/forgot-password
- 成功后显示「如果该邮箱已注册，我们已发送重置链接」
- 返回登录链接

### Step 19 — 邀请接受页

**文件:** `src/pages/invite/[token].vue`（新建）

- layout: `auth`
- 页面加载时：POST /api/auth/verify-token 验证 token
  - 无效/过期：显示错误信息 + 联系管理员提示
  - 有效：显示表单
- 表单字段：用户名 + 密码 + 确认密码
- 密码强度指示器（视觉反馈，不阻断提交）
- 提交 → POST /api/auth/accept-invite → 成功后自动登录跳转首页

### Step 20 — 重置密码页

**文件:** `src/pages/reset-password/[token].vue`（新建）

- layout: `auth`
- 页面加载时验证 token
- 表单：新密码 + 确认密码
- 提交 → POST /api/auth/reset-password → 成功后跳转登录页

### Step 21 — 用户设置（sidebar 下拉菜单）

**文件:** `src/components/AppSidebar.vue`（修改）

- sidebar 底部显示当前用户名
- 点击弹出下拉菜单：
  - 修改密码（弹出 modal）
  - 登出所有设备（bump tokenVersion）
  - 退出登录

**文件:** `src/components/ChangePasswordModal.vue`（新建）

- 当前密码 + 新密码 + 确认密码
- 前端密码规则校验 + 强度指示器
- POST /api/auth/change-password

### Step 22 — useAuth composable 更新

**文件:** `src/composables/useAuth.ts`

- `login(email, password)` 参数名改为 email
- 新增 `forgotPassword(email)` 方法
- 新增 `changePassword(currentPassword, newPassword)` 方法
- 新增 `logoutAllDevices()` 方法

### Step 23 — 客户端路由守卫更新

**文件:** `src/middleware/auth.global.ts`（或对应的 middleware 文件）

- 白名单加入：`/invite/*`, `/reset-password/*`, `/forgot-password`

### Step 24 — 管理员面板改造

**文件:** `src/tools/admin/components/UserForm.vue`

- 移除 username 和 password 输入框
- 只保留：email + role + modules 选择
- 提交调用 invite API

**文件:** `src/tools/admin/components/UserList.vue`

- 用户列表增加「强制重置密码」按钮
- 新增「待处理邀请」区域（展示 pending invites）
- 邀请行支持：复制链接、重新发送、撤销

**文件:** `src/tools/admin/Admin.vue`

- 集成 pending invites 数据获取

---

## Part H — 安全加固

### Step 25 — Token 页面安全头

**文件:** `src/server/middleware/00.security-headers.ts`

- 对 `/invite/` 和 `/reset-password/` 路径增加：
  - `Cache-Control: no-store`
  - `Referrer-Policy: no-referrer`

### Step 26 — Token 清理 plugin

**文件:** `src/server/plugins/token-cleanup.ts`（新建）

- 服务启动时删除 `expires_at < now() - 7天` 的 token
- 无需 cron，重启即清理

---

## Part I — 迁移

### Step 27 — DB 迁移

1. `npm run db:generate` 生成 admin migration：
   - 新增 `verification_tokens` 表
   - `loginLogs.method` 枚举扩展
2. 部署前：管理员通过现有 admin 面板为所有用户设置 email
3. 部署后：旧登录方式不再可用

### Step 28 — 环境变量

新增必需环境变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `APP_BASE_URL` | 应用访问地址（用于邮件链接） | `http://192.168.1.100:3000` |
| `RESEND_API_KEY` | Resend API 密钥 | `re_xxx` |
| `EMAIL_FROM` | 发件人地址 | `个人助手 <noreply@yourdomain.com>` |

### Step 29 — seed-user 脚本更新

**文件:** `deployment/scripts/seed-user.ts`

- 初始管理员创建仍用直接设密码方式（bootstrap 例外）
- 新增 email 必填参数

### Step 30 — E2E 测试更新

**文件:** `e2e/admin.spec.ts`（修改）+ `e2e/auth.spec.ts`（新建）

覆盖场景：
- 管理员发送邀请 → 复制链接 → 用户接受 → 设置凭证 → 登录
- 邮箱 + 密码登录（替代用户名登录）
- 忘记密码 → 重置链接 → 设置新密码 → 登录
- 已登录修改密码 → 旧密码失效
- 管理员强制重置 → 用户会话失效
- 过期/已用 token 错误处理
- Rate limiting 触发
- 密码不符合规则的拒绝

---

## 文件清单

| 操作 | 文件 |
|------|------|
| **修改** | `src/server/database/admin-schema.ts` |
| **修改** | `src/server/api/auth/login.post.ts` |
| **修改** | `src/server/api/admin/users/index.post.ts`（废弃或重定向到 invite） |
| **修改** | `src/server/middleware/02.auth.ts` |
| **修改** | `src/server/middleware/00.security-headers.ts` |
| **修改** | `src/pages/login.vue` |
| **修改** | `src/composables/useAuth.ts` |
| **修改** | `src/components/AppSidebar.vue` |
| **修改** | `src/tools/admin/Admin.vue` |
| **修改** | `src/tools/admin/components/UserForm.vue` |
| **修改** | `src/tools/admin/components/UserList.vue` |
| **修改** | `deployment/scripts/seed-user.ts` |
| **修改** | `e2e/admin.spec.ts` |
| **新建** | `src/server/utils/password-validation.ts` |
| **新建** | `src/utils/password-rules.ts` |
| **新建** | `src/server/utils/email.ts` |
| **新建** | `src/server/utils/email-templates.ts` |
| **新建** | `src/server/utils/rate-limiter.ts` |
| **新建** | `src/server/api/admin/invites/index.post.ts` |
| **新建** | `src/server/api/admin/invites/index.get.ts` |
| **新建** | `src/server/api/admin/invites/[id].delete.ts` |
| **新建** | `src/server/api/admin/invites/[id]/resend.post.ts` |
| **新建** | `src/server/api/auth/accept-invite.post.ts` |
| **新建** | `src/server/api/auth/verify-token.post.ts` |
| **新建** | `src/server/api/auth/forgot-password.post.ts` |
| **新建** | `src/server/api/auth/reset-password.post.ts` |
| **新建** | `src/server/api/auth/change-password.post.ts` |
| **新建** | `src/server/api/admin/users/[id]/force-reset.post.ts` |
| **新建** | `src/server/plugins/token-cleanup.ts` |
| **新建** | `src/pages/forgot-password.vue` |
| **新建** | `src/pages/invite/[token].vue` |
| **新建** | `src/pages/reset-password/[token].vue` |
| **新建** | `src/components/ChangePasswordModal.vue` |
| **新建** | `e2e/auth.spec.ts` |
| **生成** | admin migration（1个） |

## 依赖

- `resend` — Resend API SDK
- 无其他新依赖（crypto 为 Node.js 内置）
