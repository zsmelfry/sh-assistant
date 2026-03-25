# 用户 Email + 登录记录

## 概述

为用户表添加 email 字段（管理员创建时必填、可修改、唯一），并新增登录记录功能（密码登录 + token 会话开始）。

---

## Part A — Email 字段

### Step 1 — Schema

**文件:** `src/server/database/admin-schema.ts`

- `users` 表加 `email: text('email')` — nullable（兼容已有用户）
- 加 unique 索引 `idx_users_email`

### Step 2 — 创建用户 API（email 必填）

**文件:** `src/server/api/admin/users/index.post.ts`

- body 校验加 email：必填、格式验证、唯一性检查
- insert 写入 email

### Step 3 — 修改 email API（新建）

**文件:** `src/server/api/admin/users/[id]/email.put.ts`（新建）

- 校验格式 + 排除自身的唯一性检查
- 更新 email

### Step 4 — 用户列表返回 email

**文件:** `src/server/api/admin/users/index.get.ts`

- 返回对象加 `email` 字段（已有用户可能为 null）

### Step 5 — 前端创建表单加 email

**文件:** `src/tools/admin/components/UserForm.vue`

- 非 reset-password 模式显示 email 输入框（required）

### Step 6 — 前端列表显示 + 编辑 email

**文件:**
- `src/tools/admin/components/UserList.vue` — 显示 email（null 时 "未设置"），内联编辑或弹窗编辑
- `src/tools/admin/Admin.vue` — `AdminUser` 接口加 `email: string | null`，处理 emailChange 事件

### Step 7 — 辅助脚本

**文件:**
- `deployment/scripts/seed-user.ts` — CREATE TABLE SQL 加 email 列
- `src/server/api/_test/seed-user.post.ts` — insert 加 email（可选）

---

## Part B — 登录记录

### Step 8 — Schema

**文件:** `src/server/database/admin-schema.ts`

新增 `loginLogs` 表：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | 自增整数 | 主键 |
| userId | 整数 | 关联 users.id |
| username | 文本 | 冗余存储，方便查询 |
| method | `'password'` / `'token'` | 登录方式 |
| ip | 文本 | 客户端 IP |
| createdAt | 整数 (Unix ms) | 时间 |

不存 userAgent，保持轻量（10 万条约 10-15 MB）。

### Step 9 — 密码登录写日志

**文件:** `src/server/api/auth/login.post.ts`

- 登录成功后 insert 一条 `method: 'password'` 的记录
- 从 event 取 IP

### Step 10 — Token 会话开始写日志

**文件:**
- `src/server/api/auth/session-start.post.ts`（新建）— 写一条 `method: 'token'` 的记录
- `src/plugins/auth.client.ts` — 初始化时如果 token 有效，调 `POST /api/auth/session-start`

只在页面加载/刷新时触发，SPA 内切换页面不会重复调用。

### Step 11 — 管理员查看登录记录 API（新建）

**文件:** `src/server/api/admin/login-logs.get.ts`（新建）

- 查询参数：`userId`（可选过滤）、`limit`（默认 50）
- 按时间倒序

### Step 12 — 前端登录记录面板

**文件:**
- `src/tools/admin/components/LoginLogs.vue`（新建）— 展开某用户时显示最近登录记录（时间、方式、IP）
- `src/tools/admin/Admin.vue` + `UserList.vue` — 集成 LoginLogs 组件

---

## Migration

全部 schema 改完后执行一次 `npm run db:generate` 生成一个 admin migration（email + loginLogs 合并）。

## 不受影响

- 登录验证逻辑、JWT 签发
- 所有用户侧功能模块
- 删除用户、重置密码、模块权限

## 文件清单

| 操作 | 文件 |
|---|---|
| 修改 | `src/server/database/admin-schema.ts` |
| 修改 | `src/server/api/admin/users/index.post.ts` |
| 修改 | `src/server/api/admin/users/index.get.ts` |
| 修改 | `src/server/api/auth/login.post.ts` |
| 修改 | `src/plugins/auth.client.ts` |
| 修改 | `src/tools/admin/Admin.vue` |
| 修改 | `src/tools/admin/components/UserForm.vue` |
| 修改 | `src/tools/admin/components/UserList.vue` |
| 修改 | `deployment/scripts/seed-user.ts` |
| 修改 | `src/server/api/_test/seed-user.post.ts` |
| 新建 | `src/server/api/admin/users/[id]/email.put.ts` |
| 新建 | `src/server/api/auth/session-start.post.ts` |
| 新建 | `src/server/api/admin/login-logs.get.ts` |
| 新建 | `src/tools/admin/components/LoginLogs.vue` |
| 生成 | admin migration（1 个） |
