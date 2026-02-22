# UI-Driven Skill Learning System — 功能需求文档

## 1. 项目背景

### 1.1 现状

当前系统的「技能学习核心」（Skill Learning Core）支持多技能隔离的学习引擎：知识树浏览、AI 教学生成、AI 对话、实践任务、笔记、学习热力图等功能完善。但添加新技能仍需修改 4+ 个代码文件：

1. 编写种子数据（`server/database/seeds/my-skill.ts`）
2. 注册技能配置含 AI 提示词（`server/lib/skill-learning/skills/my-skill.ts`）+ 在 `server/plugins/skill-learning.ts` 添加导入
3. 注册前端工具（`tools/my-skill/index.ts`）
4. 创建根组件（`tools/my-skill/MySkill.vue`）

技能配置（AI 提示词模板、教学分区定义、状态标签等）硬编码在 TypeScript 文件中，无法通过 UI 修改。

### 1.2 目标

- **完全 UI 驱动的技能创建**：用户通过 3 步向导（基本信息 → AI 生成知识树 → 提示词模板）即可创建新技能工具
- **消除代码级技能定义**：将技能配置从 TypeScript 硬编码迁移到数据库表 `skill_configs`
- **统一前端渲染**：用通用组件 `GenericSkillTool.vue` 替换各技能的独立前端文件
- **保持向后兼容**：现有 startup-map 数据零损失迁移

### 1.3 非目标

- 不迁移非技能类工具（habit-tracker、vocab-tracker 等仍保持代码注册）
- 不修改已有的 22 个共享学习组件（`components/skill-learning/`）
- 不修改核心 API 路由（`/api/skills/[skillId]/...`）的业务逻辑
- 产品管理功能（`smProducts`、product APIs）从通用技能系统中移除

---

## 2. 用户故事

### Phase 1 — 数据库 Schema + 模板引擎

| # | 用户故事 | 验收标准 |
|---|---------|---------|
| U1 | 作为开发者，我希望技能配置存储在数据库中，以便无需重启服务即可添加/修改技能 | `skill_configs` 表创建成功，包含所有必要字段；Migration 可正常执行 |
| U2 | 作为系统，我需要模板引擎将 `{{variable}}` 占位符替换为实际值，以支持动态提示词 | `renderTemplate('你好 {{skill.name}}', ctx)` → `'你好 创业地图'`；支持嵌套路径如 `{{domain.name}}` |
| U3 | 作为系统，我需要 `resolveSkill()` 从 DB 查询技能配置，而非内存 Map | 所有现有 API 端点（教学生成、对话、任务等）功能不变；DB 查询结果正确合成 `SkillConfig` 对象 |
| U4 | 作为开发者，我需要 startup-map 的配置数据以种子脚本形式存在 | `POST /api/skill-configs/seed` 成功创建 startup-map 配置行；幂等执行不报错 |
| U5 | 作为开发者，我需要删除所有代码级技能定义文件 | `registry.ts`、`init.ts`、`skills/startup-map.ts`、`server/plugins/skill-learning.ts` 全部移除；构建无报错 |

### Phase 2 — API 端点

| # | 用户故事 | 验收标准 |
|---|---------|---------|
| U6 | 作为用户，我希望能查看所有已创建的技能列表 | `GET /api/skill-configs` 返回技能数组，包含 id、name、icon、description |
| U7 | 作为用户，我希望能创建新技能配置 | `POST /api/skill-configs` 验证 skillId 唯一性和 URL slug 格式；成功返回 201 |
| U8 | 作为用户，我希望能修改已有技能的配置 | `PUT /api/skill-configs/[id]` 更新提示词模板等字段；更新后 `updatedAt` 刷新 |
| U9 | 作为用户，我希望删除技能时自动清理所有关联数据 | `DELETE /api/skill-configs/[id]` 级联删除该 skillId 下的 domains、topics、points、teachings、chats、tasks、notes、activities、stages |
| U10 | 作为用户，我希望 AI 能根据技能名称和描述自动生成知识树 | `POST /api/skill-configs/generate-tree` 返回 `{ domains[], stages[] }`；domains 含 5-10 个领域，每个含 2-4 个主题，每个含 2-5 个知识点；stages 含 4-8 个学习阶段 |
| U11 | 作为系统，种子端点需支持从请求体接收数据 | `POST /api/skills/[skillId]/seed` 优先读取 `req.body` 中的 `domains` 和 `stages`；无 body 时保持原有逻辑 |

### Phase 3 — 通用前端组件 + 动态注册

| # | 用户故事 | 验收标准 |
|---|---------|---------|
| U12 | 作为用户，所有技能工具应使用统一的学习界面 | `GenericSkillTool.vue` 接收 `skillId` prop，正确创建 store 并 provide，渲染全局视图/领域详情/知识点页面 |
| U13 | 作为用户，登录后侧边栏应自动显示所有已启用的技能 | `plugins/tools.client.ts` 启动时 fetch `/api/skill-configs`，为每个 `isActive` 的配置动态注册工具；登录后重新执行注册 |
| U14 | 作为开发者，startup-map 专属前端文件应全部移除 | `tools/startup-map/` 目录、`stores/startup-map.ts`、`server/api/startup-map/` 全部删除；构建无报错 |

### Phase 4 — 技能管理 UI

| # | 用户故事 | 验收标准 |
|---|---------|---------|
| U15 | 作为用户，我希望有专门的「技能管理」页面查看所有技能 | 侧边栏显示「技能管理」入口；页面以网格卡片展示所有技能，每个卡片显示名称、图标、描述、知识点统计 |
| U16 | 作为用户，我希望能编辑已有技能的配置 | 点击技能卡片进入编辑模式；可修改名称、描述、图标、提示词模板 |
| U17 | 作为用户，我希望能删除技能 | 删除前弹出确认对话框，提示将清除所有学习数据；确认后级联删除并从侧边栏移除 |
| U18 | 作为用户，我希望通过 3 步向导创建新技能 | 向导步骤见 §5 交互流程；每步有校验；可返回上一步修改 |
| U19 | 作为用户，我希望 AI 生成的知识树可手动编辑 | 树形编辑器支持：添加/删除/重命名 领域、主题、知识点、阶段；拖拽排序（可选） |
| U20 | 作为用户，我希望提示词模板编辑器支持变量插入 | 可点击变量芯片（`{{skill.name}}`、`{{domain.name}}` 等）插入到光标位置 |

---

## 3. 数据模型

### 3.1 新增表：`skill_configs`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, autoIncrement | 主键 |
| `skillId` | TEXT | UNIQUE, NOT NULL | URL slug（如 `'startup-map'`、`'cooking'`），用于路由和数据隔离 |
| `name` | TEXT | NOT NULL | 显示名称（如 `'创业地图'`） |
| `description` | TEXT | — | 技能描述 |
| `icon` | TEXT | DEFAULT `'BookOpen'` | Lucide 图标名称 |
| `teachingSystemPrompt` | TEXT | NOT NULL | 教学系统提示词模板，支持 `{{variable}}` |
| `teachingUserPrompt` | TEXT | NOT NULL | 教学用户提示词模板 |
| `chatSystemPrompt` | TEXT | NOT NULL | 对话系统提示词模板 |
| `taskSystemPrompt` | TEXT | NOT NULL | 任务系统提示词模板 |
| `taskUserPrompt` | TEXT | NOT NULL | 任务用户提示词模板 |
| `sortOrder` | INTEGER | DEFAULT `100` | 侧边栏排序 |
| `isActive` | BOOLEAN | DEFAULT `true` | 是否在侧边栏显示 |
| `createdAt` | INTEGER | NOT NULL | 创建时间（Unix 毫秒） |
| `updatedAt` | INTEGER | NOT NULL | 更新时间（Unix 毫秒） |

**索引**：`skillId` UNIQUE

**关联**：`skillId` 与现有表 `smDomains.skillId`、`smStages.skillId`、`smActivities.skillId` 逻辑关联（非外键，通过应用层级联删除）。

### 3.2 现有表变化

无 schema 变更。现有 `sm_*` 表的 `skillId` 列已支持多技能隔离。

### 3.3 待删除表

| 表 | 原因 |
|----|------|
| `smProducts` | 产品管理功能不纳入通用技能系统 |

### 3.4 模板变量

模板引擎支持的变量路径：

| 变量 | 类型 | 说明 | 可用上下文 |
|------|------|------|-----------|
| `{{skill.name}}` | string | 技能名称 | 所有模板 |
| `{{skill.description}}` | string | 技能描述 | 所有模板 |
| `{{domain.name}}` | string | 领域名称 | teaching, chat, task |
| `{{topic.name}}` | string | 主题名称 | teaching, chat, task |
| `{{point.name}}` | string | 知识点名称 | teaching, chat, task |
| `{{point.description}}` | string | 知识点描述 | teaching, chat, task |
| `{{teachingSummary}}` | string | 已生成教学内容摘要 | chat |

---

## 4. API 接口清单

### 4.1 新增端点

#### 技能配置 CRUD — `/api/skill-configs/`

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|------|------|--------|------|------|
| GET | `/api/skill-configs` | — | `SkillConfigRow[]` | 列出所有技能配置，按 `sortOrder` 排序 |
| POST | `/api/skill-configs` | `CreateSkillConfigBody` | `SkillConfigRow` (201) | 创建技能配置。校验 `skillId` 唯一性、URL slug 格式 |
| GET | `/api/skill-configs/[id]` | — | `SkillConfigRow` | 获取单个配置。`id` 为整数主键 |
| PUT | `/api/skill-configs/[id]` | `UpdateSkillConfigBody` | `SkillConfigRow` | 更新配置。自动刷新 `updatedAt` |
| DELETE | `/api/skill-configs/[id]` | — | `{ deleted: true }` | 删除配置 + 级联清除该 `skillId` 下所有 `sm_*` 数据 |
| POST | `/api/skill-configs/seed` | — | `{ seeded: string[] }` 或 `{ skipped: true }` | 幂等种子：创建 startup-map 内置配置 |

**`CreateSkillConfigBody` 类型**：

```typescript
{
  skillId: string           // URL slug, /^[a-z0-9-]+$/
  name: string
  description?: string
  icon?: string             // Lucide icon name
  teachingSystemPrompt: string
  teachingUserPrompt: string
  chatSystemPrompt: string
  taskSystemPrompt: string
  taskUserPrompt: string
  sortOrder?: number
  isActive?: boolean
}
```

**`UpdateSkillConfigBody` 类型**：`Partial<CreateSkillConfigBody>`（除 `skillId` 不可修改）

#### AI 知识树生成

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|------|------|--------|------|------|
| POST | `/api/skill-configs/generate-tree` | `{ name: string, description: string }` | `{ domains: SeedDomain[], stages: SeedStage[] }` | 调用 LLM 生成知识树结构 |

**返回格式**：

```typescript
{
  domains: Array<{
    name: string
    description: string
    topics: Array<{
      name: string
      description: string
      points: Array<{ name: string, description: string }>
    }>
  }>
  stages: Array<{
    name: string
    description: string
    objective: string
    pointNames: string[]  // 引用 points 的 name
  }>
}
```

### 4.2 修改端点

| 方法 | 路径 | 变更说明 |
|------|------|---------|
| POST | `/api/skills/[skillId]/seed.post.ts` | 优先从请求体读取 `{ domains, stages }` 数据；无 body 时维持原有逻辑（从 `config.seedData` 读取——但此路径将不再存在，所以 body 为必须） |

### 4.3 删除端点

| 路径 | 原因 |
|------|------|
| `GET /api/startup-map/products` | 产品功能移除 |
| `POST /api/startup-map/products` | 同上 |
| `GET /api/startup-map/products/active` | 同上 |
| `PUT /api/startup-map/products/[id]` | 同上 |
| `DELETE /api/startup-map/products/[id]` | 同上 |
| `PATCH /api/startup-map/products/[id]/activate` | 同上 |

### 4.4 错误处理规范

所有新端点遵循项目约定：

```typescript
// 验证输入
if (!body.skillId) throw createError({ statusCode: 400, message: 'skillId is required' })

// 检查存在性
const row = db.select()...
if (!row) throw createError({ statusCode: 404, message: 'Skill config not found' })

// 检查唯一性
const existing = db.select()...where(eq(skillConfigs.skillId, body.skillId))
if (existing) throw createError({ statusCode: 409, message: 'skillId already exists' })
```

---

## 5. UI 交互流程

### 5.1 技能管理页面 — `SkillManager.vue`

```
┌──────────────────────────────────────────┐
│  技能管理                    [+ 创建技能]  │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ 📘       │  │ 📗       │  │ 📙     │ │
│  │ 创业地图  │  │ 烹饪技能  │  │ ...    │ │
│  │ 96个知识点│  │ 45个知识点│  │        │ │
│  │ [编辑]    │  │ [编辑]    │  │        │ │
│  │ [删除]    │  │ [删除]    │  │        │ │
│  └──────────┘  └──────────┘  └────────┘ │
│                                          │
└──────────────────────────────────────────┘
```

- 网格布局展示技能卡片
- 每个卡片显示：图标、名称、描述（截断）、知识点数量
- 操作：编辑（进入编辑模式）、删除（确认对话框）
- 右上角「创建技能」按钮触发向导

### 5.2 技能创建向导 — `SkillWizard.vue`

#### 步骤 1：基本信息

```
┌──────────────────────────────────────────┐
│  创建新技能                 步骤 1 / 3    │
├──────────────────────────────────────────┤
│                                          │
│  技能名称 *                              │
│  ┌──────────────────────────────────┐    │
│  │ 烹饪技能                         │    │
│  └──────────────────────────────────┘    │
│                                          │
│  技能描述                                │
│  ┌──────────────────────────────────┐    │
│  │ 从基础刀工到高级烹饪技法的系统    │    │
│  │ 学习路径                         │    │
│  └──────────────────────────────────┘    │
│                                          │
│  图标                                    │
│  ┌──────────────────────────────────┐    │
│  │ ◻BookOpen ◼ChefHat ◻Map ...     │    │
│  └──────────────────────────────────┘    │
│                                          │
│  技能 ID（自动生成，可手动修改）           │
│  ┌──────────────────────────────────┐    │
│  │ cooking                          │    │
│  └──────────────────────────────────┘    │
│                                          │
│                     [取消]  [AI 生成知识树] │
└──────────────────────────────────────────┘
```

- `skillId` 从名称自动生成（中文转拼音或使用描述中英文词汇），允许手动修改
- `skillId` 校验：仅允许小写字母、数字、连字符；实时查重
- 点击「AI 生成知识树」调用 `POST /api/skill-configs/generate-tree`

#### 步骤 2：知识树编辑

```
┌──────────────────────────────────────────┐
│  编辑知识树                 步骤 2 / 3    │
├──────────────────────────────────────────┤
│                                          │
│  领域 (6)                    [+ 添加领域] │
│  ┌──────────────────────────────────┐    │
│  │ ▼ 基础刀工                  [✕]  │    │
│  │   烹饪中最基础的刀法技能          │    │
│  │   ├── ▼ 常用刀法            [✕]  │    │
│  │   │     • 直切 — 基本切法   [✕]  │    │
│  │   │     • 斜切 — 斜角切法   [✕]  │    │
│  │   │     [+ 知识点]                │    │
│  │   ├── ▼ 食材处理            [✕]  │    │
│  │   │     ...                       │    │
│  │   [+ 主题]                        │    │
│  └──────────────────────────────────┘    │
│                                          │
│  学习阶段 (5)                [+ 添加阶段] │
│  ┌──────────────────────────────────┐    │
│  │ 1. 入门基础 — 掌握基本刀工  [✕]  │    │
│  │    关联知识点: 直切, 斜切, ...     │    │
│  │ 2. 调味入门 — ...            [✕]  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [重新生成]         [上一步]  [下一步]     │
└──────────────────────────────────────────┘
```

- 树形结构可折叠/展开
- 每个节点支持：内联编辑名称/描述、删除（带确认）、添加子节点
- 「重新生成」按钮重新调用 AI，覆盖当前编辑（需确认）
- 阶段区域显示关联的知识点名称，支持编辑关联

#### 步骤 3：提示词模板

```
┌──────────────────────────────────────────┐
│  提示词模板                 步骤 3 / 3    │
├──────────────────────────────────────────┤
│                                          │
│  可用变量:                                │
│  [skill.name] [skill.description]        │
│  [domain.name] [topic.name]              │
│  [point.name] [point.description]        │
│  [teachingSummary]                       │
│                                          │
│  教学系统提示词 *                         │
│  ┌──────────────────────────────────┐    │
│  │ 你是一位{{skill.name}}领域的专家  │    │
│  │ 导师。请为用户讲解...             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  教学用户提示词 *                         │
│  ┌──────────────────────────────────┐    │
│  │ 请讲解「{{point.name}}」...       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  对话系统提示词 *                         │
│  ┌──────────────────────────────────┐    │
│  │ ...                               │    │
│  └──────────────────────────────────┘    │
│                                          │
│  任务系统提示词 *                         │
│  ┌──────────────────────────────────┐    │
│  │ ...                               │    │
│  └──────────────────────────────────┘    │
│                                          │
│  任务用户提示词 *                         │
│  ┌──────────────────────────────────┐    │
│  │ ...                               │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [上一步]                    [创建技能]    │
└──────────────────────────────────────────┘
```

- 变量以芯片样式展示，点击插入到当前聚焦的 textarea 光标位置
- 所有提示词字段预填通用默认值（从 startup-map 模板泛化而来）
- textarea 支持拖拽调整高度

### 5.3 创建完成流程

点击「创建技能」后：

1. **创建配置**：`POST /api/skill-configs` → 得到 `skillId`
2. **种入知识树**：`POST /api/skills/[skillId]/seed` + body `{ domains, stages }`
3. **注册工具**：在客户端调用 `registerTool()` 将新技能添加到侧边栏
4. **跳转**：自动导航到新技能页面

### 5.4 删除确认流程

```
┌──────────────────────────────────┐
│  确认删除                         │
│                                  │
│  确定要删除技能「烹饪技能」吗？     │
│  此操作将永久删除所有学习数据：     │
│  • 6 个领域、18 个主题、45 个知识点 │
│  • 所有教学内容和对话记录          │
│  • 所有实践任务和笔记             │
│                                  │
│         [取消]    [确认删除]       │
└──────────────────────────────────┘
```

### 5.5 动态工具注册流程

```
App 启动
  └─ plugins/tools.client.ts
      ├─ 静态导入非技能工具（habit-tracker, vocab-tracker, annual-planner, article-reader）
      ├─ 静态导入 skill-manager 工具
      └─ fetchAndRegisterSkills()
          ├─ 获取 auth token
          ├─ GET /api/skill-configs?isActive=true
          └─ 对每个配置: registerTool({
                id: config.skillId,
                name: config.name,
                icon: ICON_MAP[config.icon],
                order: config.sortOrder,
                component: () => GenericSkillTool(skillId)
              })

登录成功后
  └─ 再次调用 fetchAndRegisterSkills()（处理首次启动未登录的情况）
```

---

## 6. 实现阶段划分

### Phase 1: DB Schema + 模板引擎

**范围**：后端基础设施

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 创建 `skill_configs` 表 | `server/database/schemas/skill-configs.ts`, `server/database/schema.ts` | 新增 schema 定义 + 生成 migration |
| 1.2 模板渲染引擎 | `server/lib/skill-learning/template.ts` | `renderTemplate(template, context)` 函数 |
| 1.3 重写 `resolveSkill()` | `server/lib/skill-learning/db-helpers.ts` | 从 DB 查询配置 → 合成 `SkillConfig` |
| 1.4 startup-map 种子脚本 | `server/database/seeds/startup-map-config.ts` | 从现有 `skills/startup-map.ts` 提取提示词模板 |
| 1.5 删除代码级技能系统 | 多个文件删除 | 移除 registry.ts、init.ts、skills/、server plugin |

**验证**：运行种子创建 startup-map 配置 → 所有现有 API 正常工作

### Phase 2: API 端点

**范围**：技能配置管理 + AI 生成

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 Skill config CRUD | `server/api/skill-configs/*.ts` (6 个文件) | 列表/创建/读取/更新/删除/种子 |
| 2.2 AI 知识树生成 | `server/api/skill-configs/generate-tree.post.ts` | LLM 调用 + JSON 解析 |
| 2.3 修改 seed 端点 | `server/api/skills/[skillId]/seed.post.ts` | 支持 body 传入数据 |

**验证**：通过 API 创建新技能 → 种入知识树 → 教学/对话/任务正常工作

### Phase 3: 通用前端组件 + 动态注册

**范围**：前端架构迁移

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 通用技能组件 | `tools/skill-learning/GenericSkillTool.vue` | 接收 skillId prop，复用共享组件 |
| 3.2 动态工具注册 | `plugins/tools.client.ts` | fetch 配置 → 批量注册 |
| 3.3 删除 startup-map 前端 | `tools/startup-map/`, `stores/startup-map.ts`, `server/api/startup-map/` | 清理旧代码 |

**验证**：startup-map 通过 GenericSkillTool 正常渲染；浏览/教学/对话/任务功能不变

### Phase 4: 技能管理 UI

**范围**：用户界面

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 技能管理工具 | `tools/skill-manager/` (index.ts + SkillManager.vue + SkillList.vue) | 列表页 + 编辑/删除 |
| 4.2 创建向导 | `tools/skill-manager/components/SkillWizard.vue` + TreeEditor + PromptEditor + IconPicker | 3 步向导完整流程 |

**验证**：端到端流程——创建技能 → 生成知识树 → 编辑 → 保存 → 侧边栏出现 → 学习功能正常 → 删除 → 清理完成

---

## 7. 文件清单

### 7.1 新建文件（18 个）

| 文件 | 阶段 |
|------|------|
| `server/database/schemas/skill-configs.ts` | Phase 1 |
| `server/lib/skill-learning/template.ts` | Phase 1 |
| `server/database/seeds/startup-map-config.ts` | Phase 1 |
| `server/api/skill-configs/index.get.ts` | Phase 2 |
| `server/api/skill-configs/index.post.ts` | Phase 2 |
| `server/api/skill-configs/[id].get.ts` | Phase 2 |
| `server/api/skill-configs/[id].put.ts` | Phase 2 |
| `server/api/skill-configs/[id].delete.ts` | Phase 2 |
| `server/api/skill-configs/seed.post.ts` | Phase 2 |
| `server/api/skill-configs/generate-tree.post.ts` | Phase 2 |
| `tools/skill-learning/GenericSkillTool.vue` | Phase 3 |
| `tools/skill-manager/index.ts` | Phase 4 |
| `tools/skill-manager/SkillManager.vue` | Phase 4 |
| `tools/skill-manager/components/SkillList.vue` | Phase 4 |
| `tools/skill-manager/components/SkillWizard.vue` | Phase 4 |
| `tools/skill-manager/components/TreeEditor.vue` | Phase 4 |
| `tools/skill-manager/components/PromptEditor.vue` | Phase 4 |
| `tools/skill-manager/components/IconPicker.vue` | Phase 4 |

### 7.2 修改文件（6 个）

| 文件 | 阶段 | 变更 |
|------|------|------|
| `server/database/schema.ts` | Phase 1 | 导出 `skillConfigs` |
| `server/lib/skill-learning/db-helpers.ts` | Phase 1 | 重写 `resolveSkill()` 使用 DB 查询 |
| `server/lib/skill-learning/index.ts` | Phase 1 | 移除 registry 导出，简化 |
| `server/api/skills/[skillId]/seed.post.ts` | Phase 2 | 支持 body 传入种子数据 |
| `plugins/tools.client.ts` | Phase 3 | 添加动态技能注册 |
| `tools/index.ts` | Phase 3 | 移除 startup-map 导入，添加 skill-manager 导入 |

### 7.3 删除文件（11+ 个）

| 文件/目录 | 阶段 | 原因 |
|-----------|------|------|
| `server/lib/skill-learning/skills/startup-map.ts` | Phase 1 | 配置迁移到 DB |
| `server/lib/skill-learning/registry.ts` | Phase 1 | 不再需要内存 Map |
| `server/lib/skill-learning/init.ts` | Phase 1 | 不再需要动态导入初始化 |
| `server/plugins/skill-learning.ts` | Phase 1 | 不再需要副作用导入 |
| `tools/startup-map/` (整个目录) | Phase 3 | 被 GenericSkillTool 替代 |
| `stores/startup-map.ts` | Phase 3 | Product store 不再需要 |
| `server/api/startup-map/` (整个目录) | Phase 3 | 产品 API 移除 |

---

## 8. 非功能需求

### 8.1 性能

- **AI 知识树生成**：超时上限 60 秒，前端显示加载状态
- **动态工具注册**：`GET /api/skill-configs` 响应 < 100ms（数据量小，无需缓存）
- **级联删除**：使用事务确保原子性，防止部分删除
- **模板渲染**：纯字符串替换，性能开销可忽略

### 8.2 安全

- 所有新 API 端点受 JWT 中间件保护（`02.auth.ts` 自动拦截）
- `skillId` 输入校验：仅允许 `/^[a-z0-9-]+$/`，防止路径注入
- AI 生成内容不执行，仅作为文本存储和展示
- 删除操作需前端确认，API 层无二次确认（符合项目现有模式）

### 8.3 兼容性

- 支持桌面端和移动端（响应式布局，768px 断点）
- 向导在移动端以全屏模态展示
- 技能卡片网格在移动端自动切换为单列
- 遵循项目现有 CSS 变量系统（`--color-*`, `--spacing-*`, `--radius-*`）

### 8.4 数据迁移

- startup-map 现有数据（domains/topics/points/teachings/chats/tasks/notes/activities/stages）零损失保留
- 仅新增 `skill_configs` 行，不修改 `sm_*` 表数据
- `smProducts` 表数据在确认不再需要后可删除（建议先保留一个版本）

### 8.5 可测试性

- 所有新 API 端点应可通过 E2E 测试覆盖
- 测试场景：
  - Skill config CRUD（创建/读取/更新/删除）
  - 知识树生成（mock LLM 响应）
  - 创建后数据隔离验证
  - 删除级联验证
  - 动态注册后侧边栏验证
  - 向导端到端流程

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `resolveSkill()` 重写导致现有 API 回归 | 高 | Phase 1 完成后运行全量 E2E 测试验证 |
| AI 生成的知识树质量不稳定 | 中 | 步骤 2 提供手动编辑 + 重新生成；提示词可迭代优化 |
| 动态注册时机（登录前/后） | 中 | 双重注册：启动时尝试 + 登录成功后重试 |
| startup-map 产品功能丢失 | 低 | 产品管理是 startup-map 特有功能，通用技能系统不需要；`resolveExtraContext` 可在未来按需重新引入 |
| 模板变量不足以覆盖复杂提示词需求 | 低 | 模板引擎简单，未来可扩展条件逻辑或 helper 函数 |
