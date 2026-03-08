# 事项追踪器 (Project Tracker) — 产品需求文档 V1

## 1. 产品定位

一个灵活的模版型事项管理工具，用于追踪日常生活和工作中各类事情的进度。每个事项独立运作，支持可选的 Checklist、笔记、Diagram 插件，并具备 AI 对话能力。

**工具 ID:** `project-tracker`
**工具名称:** 事项追踪

---

## 2. 信息架构

```
事项追踪 (Project Tracker)
├── 总览列表页 (ListView)
│   ├── 按分类分组显示
│   ├── 状态筛选 / 标签筛选
│   ├── 搜索
│   └── 归档区（已完成/已取消自动归档）
├── 事项详情页 (ProjectDetail)
│   ├── 基础信息区 (标题/描述/状态/分类/标签/due date)
│   ├── 进度可视化条
│   ├── Tab: Checklist
│   │   ├── 里程碑分组
│   │   ├── 任务列表 (可设 due date, 可外链笔记/diagram)
│   │   └── 进度统计
│   ├── Tab: 笔记
│   │   ├── 笔记列表
│   │   ├── 富文本编辑 (Markdown)
│   │   ├── 附件 (URL / 本地图片上传)
│   │   └── AI 一键总结
│   ├── Tab: Diagram
│   │   ├── Diagram 列表
│   │   ├── Mermaid 编辑器 + 实时预览
│   │   └── AI 生成 Diagram
│   └── Tab/侧边: AI 对话
│       ├── 事项上下文感知
│       └── 对话历史
└── 分类管理 (CategoryManager)
    ├── 分类 CRUD
    └── 标签 CRUD
```

---

## 3. 状态系统

采用线性流程 + 特殊状态的设计：

| 状态 | 标识 | 说明 | 颜色标记 |
|------|------|------|----------|
| 灵感 | `idea` | 初步想法，尚未决定是否执行 | 浅灰虚线 |
| 待办 | `todo` | 已决定要做，排入队列 | 灰色实线 |
| 进行中 | `in_progress` | 正在积极推进 | 黑色粗体 |
| 受阻 | `blocked` | 因外部原因暂停，需记录阻塞原因 | 红色标记 |
| 已完成 | `done` | 成功完成 → 自动归档 | 绿色标记 |
| 已放弃 | `dropped` | 主动放弃 → 自动归档 | 删除线 |

**状态流转规则：**
- 任何状态 → 任何状态（不做强制约束，个人工具以灵活为主）
- `done` / `dropped` 触发自动归档（从主列表移到归档区）
- `blocked` 时要求填写阻塞原因（字符串字段）

---

## 4. 核心功能详解

### 4.1 事项 (Project) 基础

**字段：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✅ | 事项标题 |
| description | text | ❌ | 详细描述 (Markdown) |
| status | enum | ✅ | 见状态系统，默认 `idea` |
| categoryId | FK | ✅ | 所属分类 |
| dueDate | date | ❌ | 截止日期 (YYYY-MM-DD) |
| priority | enum | ❌ | `low` / `medium` / `high`，默认 `medium` |
| blockedReason | text | ❌ | 受阻原因，仅 `blocked` 状态时使用 |
| archived | boolean | ✅ | 是否归档，默认 false |
| sortOrder | int | ✅ | 排序权重 |
| createdAt | int | ✅ | 创建时间 (Unix ms) |
| updatedAt | int | ✅ | 更新时间 (Unix ms) |

**操作：**
- CRUD + 拖拽排序
- 状态快速切换（下拉或点击流转）
- 批量归档/取消归档

### 4.2 分类 & 标签

**分类 (Category):**
- 预置「生活」「工作」两个默认分类，用户可增删改
- 字段：`name`, `sortOrder`, `createdAt`
- 每个事项必须属于一个分类

**标签 (Tag):**
- 自由创建，多对多关联事项
- 字段：`name`, `createdAt`
- 用于总览页筛选

### 4.3 Checklist 插件

**Milestone (里程碑):**
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 里程碑名称 |
| dueDate | date | 截止日期 (可选) |
| sortOrder | int | 排序 |

**Checklist Item (任务项):**
| 字段 | 类型 | 说明 |
|------|------|------|
| content | string | 任务描述 |
| isCompleted | boolean | 是否完成 |
| completedAt | int | 完成时间 |
| dueDate | date | 截止日期 (可选) |
| milestoneId | FK | 所属里程碑 (可选，null=无归属) |
| linkedNoteId | FK | 外链笔记 (可选) |
| linkedDiagramId | FK | 外链 Diagram (可选) |
| sortOrder | int | 排序 |

**行为：**
- 按里程碑分组显示（无里程碑的归入「未分组」）
- 单条任务可拖拽排序、跨里程碑移动
- 点击外链图标跳转到对应笔记/Diagram
- 进度条 = 已完成数 / 总任务数

### 4.4 笔记插件

**Note (笔记):**
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 笔记标题 |
| content | text | Markdown 正文 |
| aiSummary | text | AI 生成的摘要 |
| createdAt | int | 创建时间 |
| updatedAt | int | 更新时间 |

**Attachment (附件):**
| 字段 | 类型 | 说明 |
|------|------|------|
| noteId | FK | 所属笔记 |
| type | enum | `url` / `image` |
| url | string | URL 地址 (外链时使用) |
| filePath | string | 本地文件路径 (上传时使用) |
| caption | string | 说明文字 (可选) |

**行为：**
- 笔记列表按创建时间倒序
- Markdown 编辑器带预览切换
- 图片上传存储至 `./data/uploads/project-tracker/{projectId}/`
- AI 总结：将笔记内容 + 附件URL发送给 LLM，生成结构化摘要
- 每条笔记可独立生成/刷新 AI 摘要

### 4.5 Diagram 插件

**Diagram:**
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 图表标题 |
| type | string | Mermaid 图表类型 (flowchart/sequence/gantt/mindmap 等) |
| mermaidCode | text | Mermaid 源码 |
| description | text | 图表说明 (可选) |
| createdAt | int | 创建时间 |
| updatedAt | int | 更新时间 |

**行为：**
- 左右分栏：左侧 Mermaid 代码编辑，右侧实时渲染预览
- AI 生成：用户描述需求 → LLM 生成 Mermaid 代码 → 用户可手动调整
- 支持常用图表类型：流程图、时序图、甘特图、思维导图
- 导出为 SVG/PNG（可选，V1 不强制）

### 4.6 AI 对话

**Chat Message:**
| 字段 | 类型 | 说明 |
|------|------|------|
| projectId | FK | 所属事项 |
| role | enum | `user` / `assistant` / `system` |
| content | text | 消息内容 |
| createdAt | int | 时间 |

**上下文策略（智能摘要模式）：**

每次对话时，自动构建 system prompt 包含：
1. **事项基础信息**：标题、描述、状态、分类、due date、阻塞原因
2. **Checklist 概要**：里程碑列表 + 各里程碑完成率 + 未完成任务列表（仅标题）
3. **笔记摘要**：每条笔记的 AI 摘要（如无摘要则截取前 200 字）+ 附件 URL 列表
4. **Diagram 摘要**：各 Diagram 的标题 + 类型 + 描述
5. **最近对话历史**：最近 20 条消息

预估 token：控制在 2000-4000 tokens 内（视事项复杂度），避免超长上下文。

**行为：**
- 以侧边抽屉或底部面板形式打开（不离开当前详情页）
- 支持 SSE 流式输出
- AI 可以被要求：分析进度、建议下一步、帮助分解任务、总结笔记、生成 Diagram 代码等

### 4.7 进度可视化

在事项详情页顶部显示一个复合进度条：

```
[====Milestone1====|==M2==|===M3===|====未分组====]
 ████████░░░░░░░░░  ████   ░░░░░░░   ██████░░░░
 (4/6)              (2/2)  (0/3)     (3/5)
```

- 按里程碑分段，每段内显示完成比例
- 总进度百分比在旁边显示
- 无里程碑任务归入「未分组」段
- 颜色区分：完成(实心) / 未完成(空心) / 逾期(红色标记)

### 4.8 Due Date 提醒

**触发规则：**
- 事项 due date 提前 1 天 + 当天提醒
- Checklist 任务 due date 当天提醒
- 里程碑 due date 提前 1 天 + 当天提醒

**实现方式：**
- 服务端定时检查（每小时一次），通过 `osascript` 调用 macOS 原生通知
- 每条提醒记录已发送状态，避免重复通知
- 仅在事项处于活跃状态（`todo` / `in_progress` / `blocked`）时发送

---

## 5. 总览列表页

### 布局

```
┌──────────────────────────────────────────────┐
│ 事项追踪                    [+ 新事项] [管理分类] │
├──────────────────────────────────────────────┤
│ 筛选: [全部状态 ▼] [全部分类 ▼] [标签...] [搜索] │
│ □ 显示归档                                     │
├──────────────────────────────────────────────┤
│                                              │
│ ── 工作 ──────────────────────────────────── │
│ │ ● GEO 研究          进行中  due: 03-15  ██░ │
│ │ ● MCP 项目           受阻   due: 04-01  █░░ │
│ │ ● 季度报告           待办   due: 03-20     │
│                                              │
│ ── 生活 ──────────────────────────────────── │
│ │ ● 周日宴请朋友        进行中  due: 03-08  ███ │
│ │ ● 德国自驾游          筹备中                  │
│ │ ● 办理长居卡          待办   due: 03-30  ░░░ │
│                                              │
│ ── 灵感池 ──────────────────────────────────  │
│ │ ○ 学习摄影           灵感                    │
│ │ ○ 写个人博客          灵感                    │
└──────────────────────────────────────────────┘
```

**排序逻辑：**
1. 按分类分组
2. 分组内按状态优先级：`blocked` > `in_progress` > `todo` > `idea`
3. 同状态按 due date 升序（有 due date 的排前面）
4. `idea` 状态单独归入底部「灵感池」区域

**筛选：**
- 状态多选筛选
- 分类单选筛选
- 标签多选筛选
- 关键词搜索（匹配标题 + 描述）
- 归档开关（默认隐藏）

---

## 6. 数据库设计

所有表名以 `pt_` 前缀（project tracker）。

```sql
-- 分类
pt_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL  -- Unix ms
)

-- 标签
pt_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
)

-- 事项
pt_projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'idea',  -- idea|todo|in_progress|blocked|done|dropped
  category_id     INTEGER NOT NULL REFERENCES pt_categories(id),
  due_date        TEXT,           -- YYYY-MM-DD
  priority        TEXT DEFAULT 'medium',  -- low|medium|high
  blocked_reason  TEXT,
  archived        INTEGER NOT NULL DEFAULT 0,  -- boolean
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
)

-- 事项-标签 多对多
pt_project_tags (
  project_id  INTEGER NOT NULL REFERENCES pt_projects(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES pt_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
)

-- 里程碑
pt_milestones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES pt_projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
)

-- Checklist 任务项
pt_checklist_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES pt_projects(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  is_completed      INTEGER NOT NULL DEFAULT 0,
  completed_at      INTEGER,
  due_date          TEXT,
  milestone_id      INTEGER REFERENCES pt_milestones(id) ON DELETE SET NULL,
  linked_note_id    INTEGER REFERENCES pt_notes(id) ON DELETE SET NULL,
  linked_diagram_id INTEGER REFERENCES pt_diagrams(id) ON DELETE SET NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL
)

-- 笔记
pt_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES pt_projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT,           -- Markdown
  ai_summary  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)

-- 笔记附件
pt_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id     INTEGER NOT NULL REFERENCES pt_notes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- url|image
  url         TEXT,
  file_path   TEXT,
  caption     TEXT,
  created_at  INTEGER NOT NULL
)

-- Diagram
pt_diagrams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES pt_projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'flowchart',
  mermaid_code  TEXT NOT NULL,
  description   TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
)

-- AI 对话
pt_chats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES pt_projects(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,  -- user|assistant|system
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
)

-- 提醒记录（防重复通知）
pt_notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type   TEXT NOT NULL,  -- project|checklist|milestone
  target_id     INTEGER NOT NULL,
  remind_type   TEXT NOT NULL,  -- day_before|day_of
  sent_at       INTEGER NOT NULL,
  UNIQUE(target_type, target_id, remind_type)
)
```

---

## 7. API 路由设计

```
/api/project-tracker/
  categories/
    index.get.ts            GET    列出所有分类
    index.post.ts           POST   创建分类
    [id].put.ts             PUT    更新分类
    [id].delete.ts          DELETE 删除分类（需无关联事项）
    reorder.put.ts          PUT    排序
  tags/
    index.get.ts            GET    列出所有标签
    index.post.ts           POST   创建标签
    [id].delete.ts          DELETE 删除标签
  projects/
    index.get.ts            GET    列出事项（支持 status/category/tag/archived/search 筛选）
    index.post.ts           POST   创建事项
    [id].get.ts             GET    事项详情（含 checklist 概要、笔记数、diagram 数）
    [id].put.ts             PUT    更新事项（标题/描述/状态/分类/due/priority/blocked_reason）
    [id].delete.ts          DELETE 删除事项（级联删除所有子数据）
    [id]/
      tags.put.ts           PUT    更新事项标签（全量替换）
      archive.post.ts       POST   归档/取消归档
      progress.get.ts       GET    进度数据（按里程碑分组的完成率）
      milestones/
        index.get.ts        GET    里程碑列表
        index.post.ts       POST   创建里程碑
        [mid].put.ts        PUT    更新里程碑
        [mid].delete.ts     DELETE 删除里程碑（任务归入未分组）
        reorder.put.ts      PUT    排序
      checklist/
        index.get.ts        GET    任务列表（按里程碑分组）
        index.post.ts       POST   创建任务
        [cid].put.ts        PUT    更新任务
        [cid].delete.ts     DELETE 删除任务
        [cid]/toggle.post.ts POST  切换完成状态
        reorder.put.ts      PUT    排序（支持跨里程碑移动）
      notes/
        index.get.ts        GET    笔记列表
        index.post.ts       POST   创建笔记
        [nid].get.ts        GET    笔记详情（含附件）
        [nid].put.ts        PUT    更新笔记
        [nid].delete.ts     DELETE 删除笔记
        [nid]/
          summarize.post.ts POST   AI 生成笔记摘要
          attachments.post.ts POST 添加附件（支持文件上传）
          attachments/[aid].delete.ts DELETE 删除附件
      diagrams/
        index.get.ts        GET    Diagram 列表
        index.post.ts       POST   创建 Diagram
        [did].get.ts        GET    Diagram 详情
        [did].put.ts        PUT    更新 Diagram
        [did].delete.ts     DELETE 删除 Diagram
        generate.post.ts    POST   AI 生成 Mermaid 代码 (SSE)
      chat/
        messages.get.ts     GET    对话历史
        send.post.ts        POST   发送消息 + AI 回复 (SSE)
        clear.delete.ts     DELETE 清空对话
  stats/
    overview.get.ts         GET    总体统计（按状态/分类/标签的分布）
  notifications/
    check.post.ts           POST   手动触发通知检查（定时任务也会自动调用）
  uploads/
    image.post.ts           POST   图片上传接口
```

---

## 8. 前端组件结构

```
tools/project-tracker/
  index.ts                          # registerTool()
  types.ts                          # 所有 TypeScript 类型
  ProjectTracker.vue                # 根组件
  components/
    # 总览
    ProjectListView.vue             # 列表视图主页
    ProjectCard.vue                 # 事项卡片
    ProjectFilters.vue              # 筛选栏
    ProjectForm.vue                 # 新建/编辑事项弹窗
    CategoryManager.vue             # 分类管理弹窗
    StatusBadge.vue                 # 状态标签
    PriorityBadge.vue              # 优先级标签
    TagBadge.vue                    # 标签

    # 详情页
    ProjectDetailView.vue           # 事项详情主页
    ProjectHeader.vue               # 标题/状态/进度区
    ProgressBar.vue                 # 复合进度条
    TabNav.vue                      # Tab 切换导航

    # Checklist Tab
    ChecklistTab.vue                # Checklist 主容器
    MilestoneGroup.vue              # 里程碑分组
    MilestoneForm.vue               # 创建/编辑里程碑
    ChecklistItem.vue               # 单条任务
    ChecklistItemForm.vue           # 创建/编辑任务

    # Notes Tab
    NotesTab.vue                    # 笔记列表 + 编辑
    NoteEditor.vue                  # Markdown 编辑器
    NoteCard.vue                    # 笔记卡片
    AttachmentList.vue              # 附件列表
    AttachmentUpload.vue            # 上传/添加URL

    # Diagram Tab
    DiagramTab.vue                  # Diagram 列表
    DiagramEditor.vue               # Mermaid 编辑器 + 预览
    DiagramCard.vue                 # Diagram 卡片
    DiagramAiGenerator.vue          # AI 生成交互

    # AI Chat
    AiChatPanel.vue                 # AI 对话面板 (侧边抽屉)
    ChatMessage.vue                 # 消息气泡
    ChatInput.vue                   # 输入框
```

---

## 9. 实施分期

### Phase 1 — 核心骨架 (预估 3-4 次开发会话)
1. 数据库 Schema + Migration
2. 分类 & 标签 CRUD API
3. 事项 CRUD API + 列表筛选
4. 工具注册 + 总览列表页 UI
5. 事项详情页骨架 + 状态系统

### Phase 2 — Checklist 插件 (预估 2-3 次会话)
1. 里程碑 + Checklist API
2. Checklist Tab UI (分组/拖拽/toggle)
3. 进度可视化条

### Phase 3 — 笔记插件 (预估 2-3 次会话)
1. 笔记 CRUD API
2. 图片上传 API + 文件存储
3. 笔记编辑器 UI (Markdown + 附件)
4. AI 摘要生成

### Phase 4 — Diagram + AI 对话 (预估 2-3 次会话)
1. Diagram CRUD API
2. Mermaid 编辑器 + 渲染 UI
3. AI Diagram 生成 (SSE)
4. AI 对话 API + 上下文构建
5. AI 对话面板 UI

### Phase 5 — 通知 + 打磨 (预估 1-2 次会话)
1. 通知定时检查 + macOS 原生通知
2. Checklist ↔ 笔记/Diagram 外链
3. 归档管理
4. UI 细节打磨

---

## 10. 技术要点

### Mermaid 渲染
使用 `mermaid` npm 包，在客户端动态渲染。编辑器为纯文本 textarea，右侧实时预览。

### 图片上传
- 使用 `multipart/form-data` + Nuxt server handler 处理
- 存储路径：`./data/uploads/project-tracker/{projectId}/{uuid}.{ext}`
- 返回可访问的 URL：`/api/project-tracker/uploads/{projectId}/{filename}`
- 限制：单文件 5MB，仅 jpg/png/gif/webp

### AI 上下文构建函数
```typescript
function buildProjectContext(project: Project): string {
  // 1. 基础信息 (~200 tokens)
  // 2. Checklist 概要: 里程碑 + 完成率 + 未完成任务标题 (~300 tokens)
  // 3. 笔记摘要: 每条笔记的 aiSummary 或前 200 字 (~500 tokens)
  // 4. Diagram 摘要: 标题 + 类型 + 描述 (~200 tokens)
  // 总计控制在 ~1500 tokens，留空间给对话历史
}
```

### macOS 通知
```typescript
import { execSync } from 'child_process'

function sendMacNotification(title: string, message: string) {
  const script = `display notification "${message}" with title "${title}"`
  execSync(`osascript -e '${script}'`)
}
```

使用 Nitro 的 `scheduledTask`（如果支持）或 `setInterval` 实现每小时检查。

---

## 11. 与现有系统的区别

| | 年度计划 (Annual Planner) | 事项追踪 (Project Tracker) |
|---|---|---|
| 粒度 | 年度目标 → 子任务 | 任意大小的事项 |
| 时间范围 | 按年组织 | 不限 |
| 插件 | 无 | Checklist / 笔记 / Diagram / AI |
| AI | 无 | 上下文感知对话 |
| 状态 | 简单完成/未完成 | 6 种状态 + 流转 |
| 适用场景 | 长期规划 | 日常事务追踪 |
