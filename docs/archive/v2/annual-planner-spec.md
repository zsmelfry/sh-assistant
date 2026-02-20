# 年度计划 — 产品规格文档

> 基于 `docs/annual-planner-requirements.md`，细化 API 接口规格、数据模型和交互流程。

---

## 1. 数据模型

### 1.1 实体关系

```
areas 1──N goals N──M tags (通过 goal_tags 关联表)
goals 1──N checklist_items
```

### 1.2 实体定义

#### Area（领域）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | integer | PK, auto-increment | 主键 |
| name | text | NOT NULL | 领域名称 |
| sortOrder | integer | NOT NULL | 排序序号，从 0 开始 |
| createdAt | integer | NOT NULL | 创建时间 (Unix ms) |
| updatedAt | integer | NOT NULL | 更新时间 (Unix ms) |

#### Goal（目标）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | integer | PK, auto-increment | 主键 |
| areaId | integer | NOT NULL, FK → areas.id (cascade delete) | 所属领域 |
| title | text | NOT NULL | 目标标题 |
| description | text | 可空 | 目标描述 |
| priority | text | NOT NULL, enum: high/medium/low | 优先级，默认 `medium` |
| sortOrder | integer | NOT NULL | 领域内排序序号 |
| createdAt | integer | NOT NULL | 创建时间 (Unix ms) |
| updatedAt | integer | NOT NULL | 更新时间 (Unix ms) |

#### ChecklistItem（检查项）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | integer | PK, auto-increment | 主键 |
| goalId | integer | NOT NULL, FK → goals.id (cascade delete) | 所属目标 |
| content | text | NOT NULL | 检查项内容 |
| completed | integer (boolean) | NOT NULL, default false | 是否完成 |
| completedAt | integer | 可空 | 完成时间 (Unix ms)；取消勾选时置 NULL |
| sortOrder | integer | NOT NULL | 目标内排序序号 |
| createdAt | integer | NOT NULL | 创建时间 (Unix ms) |

#### Tag（标签）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | integer | PK, auto-increment | 主键 |
| name | text | NOT NULL, UNIQUE | 标签名称 |
| createdAt | integer | NOT NULL | 创建时间 (Unix ms) |

#### GoalTag（目标-标签关联）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| goalId | integer | NOT NULL, FK → goals.id (cascade delete) | 目标 ID |
| tagId | integer | NOT NULL, FK → tags.id (cascade delete) | 标签 ID |

- 复合主键：`(goalId, tagId)`

### 1.3 索引

| 表 | 索引 | 用途 |
|----|------|------|
| goals | `idx_goals_area_id` ON (areaId) | 按领域查询目标 |
| checklist_items | `idx_checklist_items_goal_id` ON (goalId) | 按目标查询检查项 |
| goal_tags | `idx_goal_tags_tag_id` ON (tagId) | 按标签查询关联目标 |

---

## 2. API 端点规格

所有端点前缀：`/api/planner`

错误处理遵循项目约定：验证输入 → 检查存在性 (404) → 执行操作。错误响应格式：`{ statusCode, message }`。

---

### 2.1 领域 (Areas)

#### `GET /api/planner/areas`

获取所有领域，含每个领域的统计信息。

**请求参数：** 无

**响应 `200`：**
```json
[
  {
    "id": 1,
    "name": "事业",
    "sortOrder": 0,
    "createdAt": 1708300000000,
    "updatedAt": 1708300000000,
    "goalCount": 3,
    "totalItems": 12,
    "completedItems": 5,
    "completionRate": 41.67
  }
]
```

> `completionRate` 为百分比，保留两位小数。`goalCount` / `totalItems` / `completedItems` 由服务端聚合计算。

---

#### `POST /api/planner/areas`

新建领域。`sortOrder` 由服务端自动设置为当前最大值 + 1。

**请求体：**
```json
{ "name": "新领域" }
```

**校验：**
- `name` 必填且非空白

**响应 `201`：**
```json
{
  "id": 1,
  "name": "新领域",
  "sortOrder": 0,
  "createdAt": 1708300000000,
  "updatedAt": 1708300000000
}
```

---

#### `PUT /api/planner/areas/:id`

编辑领域名称。

**请求体：**
```json
{ "name": "新名称" }
```

**校验：**
- `name` 若提供，不可为空白

**响应 `200`：** 返回更新后的完整领域对象

**错误：** `404` 领域不存在

---

#### `DELETE /api/planner/areas/:id`

删除领域。级联删除该领域下所有目标、检查项和标签关联（由 FK cascade 处理）。

**响应 `200`：**
```json
{ "success": true }
```

**错误：** `404` 领域不存在

---

#### `PUT /api/planner/areas/reorder`

批量更新领域排序。

**请求体：**
```json
{
  "items": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 },
    { "id": 3, "sortOrder": 2 }
  ]
}
```

**校验：**
- `items` 必须为非空数组
- 每个元素须有 `id` (integer) 和 `sortOrder` (integer >= 0)

**响应 `200`：**
```json
{ "success": true }
```

---

### 2.2 目标 (Goals)

#### `GET /api/planner/goals`

获取目标列表，支持按领域筛选。

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| areaId | integer | 否 | 按领域筛选 |

**响应 `200`：**
```json
[
  {
    "id": 1,
    "areaId": 1,
    "title": "升职加薪",
    "description": "Q2 前完成考核",
    "priority": "high",
    "sortOrder": 0,
    "createdAt": 1708300000000,
    "updatedAt": 1708300000000,
    "tags": [
      { "id": 1, "name": "管理" }
    ],
    "totalItems": 5,
    "completedItems": 2,
    "stagnant": false
  }
]
```

> `stagnant`：布尔值，由服务端根据停滞检测逻辑计算（见 §5）。
> `tags`：该目标关联的所有标签。

---

#### `POST /api/planner/goals`

在指定领域下新建目标。

**请求体：**
```json
{
  "areaId": 1,
  "title": "升职加薪",
  "description": "Q2 前完成考核",
  "priority": "high",
  "tagIds": [1, 3]
}
```

**校验：**
- `areaId` 必填，须为已存在的领域 ID
- `title` 必填且非空白
- `priority` 可选，默认 `medium`，须为 `high` | `medium` | `low`
- `tagIds` 可选数组

**响应 `201`：** 返回新建的目标对象（含 `tags`）

**错误：** `404` 领域不存在

---

#### `PUT /api/planner/goals/:id`

编辑目标。

**请求体（所有字段可选）：**
```json
{
  "title": "新标题",
  "description": "新描述",
  "priority": "low",
  "tagIds": [2, 5]
}
```

> 提供 `tagIds` 时为**全量替换**：先清空该目标的旧关联，再插入新关联。

**响应 `200`：** 返回更新后的目标对象（含 `tags`）

**错误：** `404` 目标不存在

---

#### `DELETE /api/planner/goals/:id`

删除目标。级联删除其下所有检查项和标签关联。

**响应 `200`：**
```json
{ "success": true }
```

**错误：** `404` 目标不存在

---

#### `PUT /api/planner/goals/reorder`

批量更新同一领域内目标排序。

**请求体：**
```json
{
  "items": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 }
  ]
}
```

**响应 `200`：**
```json
{ "success": true }
```

---

### 2.3 检查项 (Checklist Items)

#### `GET /api/planner/checklist-items`

获取检查项列表。

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| goalId | integer | 是 | 按目标筛选 |

**响应 `200`：**
```json
[
  {
    "id": 1,
    "goalId": 1,
    "content": "提交季度报告",
    "completed": false,
    "completedAt": null,
    "sortOrder": 0,
    "createdAt": 1708300000000
  }
]
```

---

#### `POST /api/planner/checklist-items`

新建检查项。

**请求体：**
```json
{
  "goalId": 1,
  "content": "提交季度报告"
}
```

**校验：**
- `goalId` 必填，须为已存在的目标 ID
- `content` 必填且非空白

**响应 `201`：** 返回新建的检查项对象

**错误：** `404` 目标不存在

---

#### `PUT /api/planner/checklist-items/:id`

编辑检查项内容。

**请求体：**
```json
{ "content": "新的检查项内容" }
```

**校验：**
- `content` 若提供，不可为空白

**响应 `200`：** 返回更新后的检查项对象

**错误：** `404` 检查项不存在

---

#### `POST /api/planner/checklist-items/:id/toggle`

切换检查项完成状态（乐观更新配合端点）。

**请求体：** 无

**逻辑：**
- 当前为未完成 → 设置 `completed = true`, `completedAt = Date.now()`
- 当前为已完成 → 设置 `completed = false`, `completedAt = null`

**响应 `200`：**
```json
{
  "id": 1,
  "completed": true,
  "completedAt": 1708300000000
}
```

**错误：** `404` 检查项不存在

---

#### `DELETE /api/planner/checklist-items/:id`

删除检查项。

**响应 `200`：**
```json
{ "success": true }
```

**错误：** `404` 检查项不存在

---

#### `PUT /api/planner/checklist-items/reorder`

批量更新同一目标内检查项排序。

**请求体：**
```json
{
  "items": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 }
  ]
}
```

**响应 `200`：**
```json
{ "success": true }
```

---

### 2.4 标签 (Tags)

#### `GET /api/planner/tags`

获取所有标签，含每个标签的统计信息。

**响应 `200`：**
```json
[
  {
    "id": 1,
    "name": "法语",
    "createdAt": 1708300000000,
    "goalCount": 4,
    "completionRate": 62.50
  }
]
```

> `goalCount`：关联的目标数量。`completionRate`：关联目标下所有检查项的总完成率。

---

#### `POST /api/planner/tags`

新建标签。

**请求体：**
```json
{ "name": "法语" }
```

**校验：**
- `name` 必填且非空白
- `name` 须唯一（重复返回 `409`）

**响应 `201`：**
```json
{
  "id": 1,
  "name": "法语",
  "createdAt": 1708300000000
}
```

**错误：** `409` 标签名称已存在

---

#### `PUT /api/planner/tags/:id`

编辑标签名称。

**请求体：**
```json
{ "name": "新名称" }
```

**校验：**
- `name` 若提供，不可为空白
- `name` 须唯一（重复返回 `409`）

**响应 `200`：** 返回更新后的标签对象

**错误：** `404` 标签不存在；`409` 名称已被占用

---

#### `DELETE /api/planner/tags/:id`

删除标签。仅删除标签本身和关联关系，不影响目标。

**响应 `200`：**
```json
{ "success": true }
```

**错误：** `404` 标签不存在

---

### 2.5 总览统计 (Overview)

#### `GET /api/planner/overview`

获取全局总览统计数据，包含停滞检测结果。

**响应 `200`：**
```json
{
  "totalGoals": 10,
  "totalItems": 42,
  "completedItems": 18,
  "globalCompletionRate": 42.86,
  "areas": [
    {
      "id": 1,
      "name": "事业",
      "sortOrder": 0,
      "goalCount": 3,
      "totalItems": 12,
      "completedItems": 5,
      "completionRate": 41.67,
      "stagnantGoalCount": 1
    }
  ]
}
```

---

### 2.6 标签聚合视图 (Tag Aggregation)

#### `GET /api/planner/tags/:id/goals`

获取某个标签下关联的所有目标（跨领域）。

**响应 `200`：**
```json
{
  "tag": { "id": 1, "name": "法语" },
  "goals": [
    {
      "id": 1,
      "areaId": 1,
      "areaName": "兴趣",
      "title": "通过 DELF B2",
      "priority": "high",
      "totalItems": 5,
      "completedItems": 3,
      "stagnant": false
    }
  ],
  "totalItems": 10,
  "completedItems": 6,
  "completionRate": 60.00
}
```

---

## 3. 前端架构

### 3.1 工具注册

```typescript
// tools/annual-planner/index.ts
import { Target } from 'lucide-vue-next';
import { registerTool } from '~/composables/useToolRegistry';

registerTool({
  id: 'annual-planner',
  name: '年度计划',
  icon: Target,
  order: 3,
  component: () => import('./AnnualPlanner.vue'),
  namespaces: ['planner'],
});
```

在 `tools/index.ts` 中添加：`import './annual-planner';`

### 3.2 页面结构与组件树

工具根组件 `AnnualPlanner.vue` 采用标签页切换三个视图：

```
AnnualPlanner.vue
├── PlannerTabs.vue              # 视图切换标签：总览 / 领域详情 / 标签视图
├── OverviewPanel.vue            # 总览页
│   ├── GlobalProgress.vue       #   全局进度条 + 统计数字
│   └── AreaCard.vue             #   领域卡片（进度条 + 目标数 + 停滞计数）
├── AreaDetailPanel.vue          # 领域详情页
│   ├── AreaSelector.vue         #   领域选择器（下拉/Tab）
│   ├── GoalCard.vue             #   目标卡片
│   │   ├── PriorityBadge.vue    #     优先级标记
│   │   ├── TagBadgeList.vue     #     标签列表
│   │   ├── ChecklistProgress.vue#     进度条 (3/7)
│   │   ├── StagnantBadge.vue    #     停滞标记
│   │   └── ChecklistItem.vue    #     检查项（勾选框）
│   └── GoalForm.vue             #   新建/编辑目标表单（含标签选择）
├── TagViewPanel.vue             # 标签聚合视图
│   ├── TagList.vue              #   标签列表及统计
│   └── TagGoalList.vue          #   标签下的目标列表
├── TagManager.vue               # 标签管理弹窗（新建/编辑/删除）
├── AreaForm.vue                 # 新建/编辑领域表单
├── ConfirmDialog.vue            # 二次确认对话框（复用或创建）
└── EmptyState.vue               # 空状态提示
```

### 3.3 Pinia Store

```typescript
// stores/planner.ts
defineStore('planner', () => {
  // ===== 状态 =====
  areas: Area[]
  goals: Goal[]              // 当前领域的目标列表
  selectedAreaId: number | null
  tags: Tag[]
  activeTab: 'overview' | 'detail' | 'tags'

  // ===== 动作 =====
  loadAreas()                // GET /api/planner/areas
  loadGoals(areaId)          // GET /api/planner/goals?areaId=
  loadTags()                 // GET /api/planner/tags
  loadOverview()             // GET /api/planner/overview

  createArea(name)
  updateArea(id, name)
  deleteArea(id)
  reorderAreas(items)

  createGoal(data)
  updateGoal(id, data)
  deleteGoal(id)
  reorderGoals(items)

  createChecklistItem(goalId, content)
  updateChecklistItem(id, content)
  toggleChecklistItem(id)    // 乐观更新
  deleteChecklistItem(id)
  reorderChecklistItems(items)

  createTag(name)
  updateTag(id, name)
  deleteTag(id)
})
```

### 3.4 类型定义

```typescript
// tools/annual-planner/types.ts

export type Priority = 'high' | 'medium' | 'low';

export interface Area {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface AreaWithStats extends Area {
  goalCount: number;
  totalItems: number;
  completedItems: number;
  completionRate: number;
  stagnantGoalCount?: number;
}

export interface Tag {
  id: number;
  name: string;
  createdAt: number;
}

export interface TagWithStats extends Tag {
  goalCount: number;
  completionRate: number;
}

export interface Goal {
  id: number;
  areaId: number;
  title: string;
  description: string | null;
  priority: Priority;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  tags: Tag[];
  totalItems: number;
  completedItems: number;
  stagnant: boolean;
}

export interface ChecklistItem {
  id: number;
  goalId: number;
  content: string;
  completed: boolean;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
}

// ===== 常量映射 =====

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const DEFAULT_AREAS = ['事业', '财务', '健康', '兴趣'];
```

---

## 4. 用户交互流程

### 4.1 首次使用

1. 用户进入年度计划工具
2. 显示空状态引导页（见 §6）
3. 用户点击「开始规划」
4. 系统自动创建四个默认领域（事业、财务、健康、兴趣）
5. 跳转到总览页，显示四个空白领域卡片

### 4.2 创建目标

1. 在总览页或领域详情页点击「添加目标」
2. 弹出目标表单，填写标题（必填）、描述（可选）、优先级（默认中）
3. 在表单中可选择已有标签或快速新建标签
4. 提交后目标出现在领域列表末尾

### 4.3 管理检查项

1. 在领域详情页展开目标卡片
2. 点击「添加检查项」，输入内容后回车确认
3. 点击检查项前的勾选框切换完成状态
4. 勾选采用乐观更新：立即切换 UI 状态，后台同步服务端
5. 同步失败时自动回滚 UI 并提示

### 4.4 拖拽排序

1. 长按/拖拽手柄拖动领域卡片、目标卡片或检查项
2. 释放后前端计算新的 sortOrder
3. 调用对应的 `reorder` 端点批量更新

### 4.5 删除流程（含二次确认）

1. 用户点击删除按钮
2. 弹出确认对话框，显示影响范围：
   - 删除领域："确认删除领域「{name}」？该领域下的 {n} 个目标将一并删除。"
   - 删除目标："确认删除目标「{title}」？其下 {n} 个检查项将一并删除。"
   - 删除标签："确认删除标签「{name}」？仅解除与目标的关联，不影响目标本身。"
   - 删除检查项：直接删除，无需二次确认（操作轻量）
3. 用户确认后执行删除

### 4.6 标签视图

1. 切换到「标签视图」标签页
2. 左侧显示所有标签列表，附带目标数和完成率
3. 点击某个标签，右侧展示关联的跨领域目标列表
4. 每个目标显示其所属领域名称、进度和优先级

---

## 5. 停滞检测逻辑

### 定义

一个目标被判定为**停滞**，当且仅当满足以下全部条件：

1. 该目标至少有 1 个检查项
2. 该目标未全部完成（`completedItems < totalItems`）
3. 该目标下所有检查项的 `completedAt` 均不在最近 14 天内（即最近一次勾选变动超过 14 天），**且**最近 14 天内没有新增任何检查项

### 服务端实现

在 `GET /api/planner/goals` 响应中计算 `stagnant` 字段：

```sql
-- 伪 SQL：对每个未完成目标，检查其检查项的最近活动时间
SELECT g.id,
  CASE
    WHEN COUNT(ci.id) = 0 THEN 0                    -- 无检查项不算停滞
    WHEN SUM(CASE WHEN ci.completed THEN 1 ELSE 0 END) = COUNT(ci.id) THEN 0  -- 全部完成不算停滞
    WHEN MAX(COALESCE(ci.completed_at, ci.created_at)) < :fourteenDaysAgo THEN 1
    ELSE 0
  END AS stagnant
FROM goals g
LEFT JOIN checklist_items ci ON ci.goal_id = g.id
GROUP BY g.id
```

> `:fourteenDaysAgo` = `Date.now() - 14 * 24 * 60 * 60 * 1000`

### 视觉呈现

- 停滞目标卡片左侧显示橙色竖条（使用 `border-left`）
- 目标卡片右上角显示「停滞」标记
- 总览页领域卡片中显示停滞目标数量（如"2 个目标停滞"）

---

## 6. 空状态文案（中文）

| 场景 | 主标题 | 副标题 | 操作按钮 |
|------|--------|--------|----------|
| 无领域（首次使用） | 开始规划你的年度目标 | 创建领域来组织你的目标，如事业、健康、兴趣 | 开始规划（自动创建默认领域） |
| 领域下无目标 | 还没有目标 | 在这个领域添加你的第一个年度目标 | 添加目标 |
| 目标下无检查项 | 还没有检查项 | 将目标拆解为具体的行动步骤 | 添加检查项 |
| 无标签 | 还没有标签 | 创建标签来标记你的能力维度，如"法语"、"管理" | 新建标签 |
| 标签视图下某标签无关联目标 | 暂无关联目标 | 在编辑目标时关联此标签 | —（无按钮） |

---

## 7. 100% 完成状态

当一个目标的所有检查项全部勾选完成时：
- 目标卡片整体降低不透明度（`opacity: 0.7`）
- 标题添加删除线样式
- 进度显示为「已完成」绿色标记
- 该目标不参与停滞检测

---

## 8. 测试重置

在 `server/api/_test/reset.post.ts` 中，按依赖关系清空表：

```typescript
// annual-planner (先删子表)
await db.delete(goalTags);
await db.delete(checklistItems);
await db.delete(goals);
await db.delete(tags);
await db.delete(areas);
```

---

## 9. 文件结构预览

```
tools/annual-planner/
├── index.ts                 # registerTool
├── AnnualPlanner.vue        # 根组件
├── types.ts                 # 类型定义
└── components/
    ├── PlannerTabs.vue
    ├── OverviewPanel.vue
    ├── GlobalProgress.vue
    ├── AreaCard.vue
    ├── AreaDetailPanel.vue
    ├── AreaSelector.vue
    ├── GoalCard.vue
    ├── GoalForm.vue
    ├── PriorityBadge.vue
    ├── TagBadgeList.vue
    ├── ChecklistProgress.vue
    ├── StagnantBadge.vue
    ├── ChecklistItem.vue
    ├── TagViewPanel.vue
    ├── TagList.vue
    ├── TagGoalList.vue
    ├── TagManager.vue
    ├── AreaForm.vue
    ├── ConfirmDialog.vue
    └── EmptyState.vue

server/database/schemas/
└── planner.ts               # areas, goals, checklist_items, tags, goal_tags

server/api/planner/
├── areas/
│   ├── index.get.ts
│   ├── index.post.ts
│   ├── [id].put.ts
│   ├── [id].delete.ts
│   └── reorder.put.ts
├── goals/
│   ├── index.get.ts
│   ├── index.post.ts
│   ├── [id].put.ts
│   ├── [id].delete.ts
│   └── reorder.put.ts
├── checklist-items/
│   ├── index.get.ts
│   ├── index.post.ts
│   ├── [id].put.ts
│   ├── [id].delete.ts
│   ├── [id]/
│   │   └── toggle.post.ts
│   └── reorder.put.ts
├── tags/
│   ├── index.get.ts
│   ├── index.post.ts
│   ├── [id].put.ts
│   ├── [id].delete.ts
│   └── [id]/
│       └── goals.get.ts
└── overview.get.ts

stores/
└── planner.ts

e2e/
└── annual-planner.spec.ts
```
