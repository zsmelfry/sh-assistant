# 创业地图 (Startup Map) — 功能需求规格文档

> 来源 PRD：`docs/startup-map-prd.md`
> 工具 ID：`startup-map` | 显示名称：创业地图

---

## P0 — MVP 核心（第一期）

### P0-1 知识树浏览

#### P0-1.1 全局视图（首页）

**描述：** 进入创业地图工具后的默认页面。以卡片网格展示所有领域，页面顶部显示全局统计摘要。

**验收标准（AC）：**
- AC1: 页面顶部显示全局统计栏：总知识点数、已完成数（已理解 + 已实践）、总体完成率（百分比）
- AC2: 统计栏下方以卡片网格展示所有 10 个领域（桌面端 2-3 列，移动端单列）
- AC3: 每张领域卡片展示：领域名称、领域简介（最多 2 行截断）、主题数量、学习进度（已掌握/总数）、进度条
- AC4: 领域卡片按 `sortOrder` 预设顺序排列
- AC5: 点击领域卡片跳转到领域详情页
- AC6: 进度条以灰色底 + 黑色填充展示完成比例
- AC7: 页面数据加载时显示骨架屏/加载状态

**涉及页面/组件：**
- `tools/startup-map/StartupMap.vue` — 工具根组件，管理子页面路由状态
- `tools/startup-map/components/GlobalView.vue` — 全局视图
- `tools/startup-map/components/GlobalStats.vue` — 全局统计栏
- `tools/startup-map/components/DomainCard.vue` — 领域卡片

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/domains` | 返回所有领域列表，含每个领域的 `topicCount`、`pointCount`、`completedCount`，按 `sortOrder` 排序 |
| GET | `/api/startup-map/stats/overview` | 返回全局统计：`totalPoints`、`completedCount`、`completionRate` |

---

#### P0-1.2 领域详情页

**描述：** 展示某个领域下所有主题和知识点，按主题分组排列。用户从此进入具体知识点。

**验收标准（AC）：**
- AC1: 顶部显示领域名称、领域简介、该领域的学习进度（已完成/总数 + 百分比）
- AC2: 提供面包屑导航：`全局视图 > 领域名称`，可点击返回
- AC3: 下方按主题分组展示知识点，每个主题显示：主题名称、主题简介
- AC4: 每个知识点显示为一行，包含：知识点名称、学习状态标记
- AC5: 状态标记用颜色区分四种状态——未开始（灰色描边）、学习中（浅灰背景）、已理解（黑色背景白字）、已实践（黑色背景白字 + 勾选图标）
- AC6: 点击知识点跳转到知识点学习页
- AC7: 主题分组默认全部展开

**涉及页面/组件：**
- `tools/startup-map/components/DomainDetail.vue` — 领域详情页
- `tools/startup-map/components/TopicGroup.vue` — 主题分组
- `tools/startup-map/components/PointItem.vue` — 知识点列表项
- `tools/startup-map/components/StatusBadge.vue` — 学习状态标记

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/domains/[id]` | 返回领域详情 + 下属主题列表 + 每个主题的知识点列表（含状态），按 `sortOrder` 排序 |

---

### P0-2 知识点学习页

#### P0-2.1 教学内容（AI 生成 6 个板块）

**描述：** 知识点的核心学习页面。展示 AI 生成的六个板块教学内容：是什么（What）、怎么做（How）、案例（Example）、我的应用（Apply）、推荐资源（Resources）、笔记引导（Notes Guide）。首次进入时由 AI 生成，生成后持久化保存。

**验收标准（AC）：**
- AC1: 页面顶部显示面包屑导航：`全局视图 > 领域名称 > 知识点名称`
- AC2: 首次进入未生成内容的知识点时，自动触发 AI 生成教学内容，显示生成中加载状态
- AC3: AI 生成时将产品档案（如有）和知识点上下文（领域、主题、知识点名称和描述）作为 prompt 上下文
- AC4: 生成完成后，内容按六个板块保存到 `sm_point_contents` 表，每个板块一条记录
- AC5: 再次进入时直接展示已保存内容，不重新生成
- AC6: 六个板块以手风琴（Accordion）形式展示，每个板块可独立折叠/展开
- AC7: 默认展开前两个板块（What、How），其余折叠
- AC8: 教学内容支持 Markdown 渲染（标题、列表、粗体、代码块等）
- AC9: 生成失败时显示错误提示和"重试"按钮

**涉及页面/组件：**
- `tools/startup-map/components/PointPage.vue` — 知识点学习页主容器
- `tools/startup-map/components/TeachingContent.vue` — 教学内容区
- `tools/startup-map/components/ContentSection.vue` — 单个教学板块（手风琴项）

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/points/[id]` | 返回知识点详情 + 已保存的教学内容 + 学习状态 + 所属领域/主题名称 |
| POST | `/api/startup-map/points/[id]/teaching` | 触发 AI 生成教学内容。请求体：`{ regenerate?: boolean }`。已有内容且 `regenerate=false` 时返回已有内容；调用 LLM 生成六个板块并保存后返回。使用 SSE 流式输出 |

---

#### P0-2.2 学习状态管理（4 种状态切换）

**描述：** 用户可在知识点学习页手动切换学习状态。四种状态：未开始、学习中、已理解、已实践。

**验收标准（AC）：**
- AC1: 知识点页面顶部显示当前学习状态标记
- AC2: 点击状态标记弹出状态选择器，显示四种状态选项
- AC3: 选择新状态后立即更新 UI（乐观更新），同时异步请求后端
- AC4: 状态变更记录时间戳到 `statusUpdatedAt` 字段
- AC5: 首次打开知识点（状态为"未开始"）并触发教学内容生成时，自动切换为"学习中"
- AC6: 状态变更后，返回领域详情页或全局视图时统计数据刷新

**涉及页面/组件：**
- `tools/startup-map/components/StatusSelector.vue` — 状态选择器

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/startup-map/points/[id]/status` | 更新知识点状态。请求体：`{ status: 'not_started' \| 'learning' \| 'understood' \| 'practiced' }`。更新 `status` 和 `statusUpdatedAt`，返回更新后的知识点 |

---

### P0-3 AI 对话

**描述：** 知识点页面内嵌 AI 对话区域，用户可就当前知识点与 AI 深入讨论。AI 了解知识点上下文（领域、主题、教学内容）和用户的产品背景。对话支持流式输出，历史保存在知识点下。

**验收标准（AC）：**
- AC1: 知识点页面下方（移动端）或右侧（桌面端）展示 AI 对话区域
- AC2: 对话区域包含消息列表和底部输入框 + 发送按钮
- AC3: 发送消息后，AI 回复以 SSE 流式输出（打字机效果）逐字展示
- AC4: AI 的 system prompt 包含：当前知识点名称、所属领域/主题、已生成的教学内容摘要、产品档案信息（如有）
- AC5: 对话历史保存在 `sm_chats` 表，下次进入时加载历史记录
- AC6: 提供"清空对话"按钮，点击后弹出确认弹窗，确认则删除该知识点全部对话记录
- AC7: 对话为空时显示引导文案："问我任何关于这个知识点的问题"
- AC8: 用户消息靠右黑底白字、AI 消息靠左白底黑字（沿用已有对话样式）
- AC9: AI 回复支持 Markdown 渲染
- AC10: 发送消息时输入框禁用，AI 回复完成后恢复

**涉及页面/组件：**
- `tools/startup-map/components/ChatPanel.vue` — AI 对话区域（参考 article-reader 的 ChatPanel 模式）
- `tools/startup-map/components/ChatMessage.vue` — 单条消息组件

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/points/[id]/chats` | 返回该知识点的对话历史，按 `createdAt` 升序 |
| POST | `/api/startup-map/points/[id]/chat` | 发送消息并获取 AI 流式回复（SSE）。请求体：`{ message: string }`。AI 回复完成后将用户消息和 AI 回复都保存到 `sm_chats` |
| DELETE | `/api/startup-map/points/[id]/chats` | 清空该知识点的全部对话历史 |

---

### P0-4 预置知识树数据

**描述：** 系统内置完整的创业品牌运营知识树作为种子数据，包含 PRD 中定义的 10 个领域、约 30 个主题、约 90 个知识点。

**验收标准（AC）：**
- AC1: 提供种子数据脚本，包含 PRD 第八节定义的全部 10 个领域
- AC2: 每个领域包含 PRD 定义的全部主题（共约 30 个主题）
- AC3: 每个主题包含 PRD 定义的全部知识点（共约 90 个知识点）
- AC4: 每个领域/主题/知识点包含 `name` 和 `description`（从 PRD 中的名称和"——"后的说明提取）
- AC5: 所有知识点初始状态为 `not_started`
- AC6: 领域、主题、知识点的 `sortOrder` 按 PRD 中的出现顺序设置
- AC7: 种子数据可通过 `POST /api/startup-map/seed` 端点或 `npm run db:seed-startup-map` 命令导入
- AC8: 重复执行种子脚本不产生重复数据（检测 `sm_domains` 是否已有数据，有则跳过）

**涉及页面/组件：**
- 无前端组件（纯数据层）

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/startup-map/seed` | 执行种子数据导入，幂等操作。有数据时返回 `{ skipped: true }`，无数据时插入并返回 `{ inserted: true }` |

种子数据源文件：`server/database/seeds/startup-map.ts`

---

### P0-5 产品档案（单产品）

**描述：** 用户配置自己的产品信息，供 AI 生成教学内容和对话时参考。P0 阶段仅支持单产品。

**验收标准（AC）：**
- AC1: 全局视图提供"产品档案"入口（顶部图标按钮或 Tab）
- AC2: 产品档案页面包含以下可编辑字段：产品名称、产品描述、目标市场、目标客户、生产来源、当前阶段（下拉选择：构想中/调研中/准备中/已启动）、补充说明
- AC3: 所有字段支持编辑，底部有"保存"按钮
- AC4: 保存成功后显示"已保存"提示
- AC5: 首次进入工具且无产品档案时，展示欢迎引导弹窗/卡片，提示用户先填写产品档案
- AC6: 产品档案为可选，用户可跳过直接浏览知识树
- AC7: AI 生成教学内容和对话时，如存在产品档案则自动注入到 prompt 上下文

**涉及页面/组件：**
- `tools/startup-map/components/ProductProfile.vue` — 产品档案编辑页
- `tools/startup-map/components/WelcomeGuide.vue` — 首次使用欢迎引导

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/products` | 返回产品档案列表（P0 阶段最多一个） |
| POST | `/api/startup-map/products` | 创建产品档案。请求体：`{ name, description, targetMarket, targetCustomer, productionSource, currentStage, notes }`。首个产品自动设 `isActive=true` |
| PUT | `/api/startup-map/products/[id]` | 更新产品档案全部可编辑字段 |
| GET | `/api/startup-map/products/active` | 返回当前激活的产品档案（`isActive=true`），无则返回 `null` |

---

### P0-6 Tool 注册

**描述：** 将创业地图注册为个人助手的第 5 个工具模块，遵循现有插件系统注册流程，路由自动生效。

**验收标准（AC）：**
- AC1: `tools/startup-map/index.ts` 调用 `registerTool()`，参数：`id: 'startup-map'`、`name: '创业地图'`、`icon: Map`（from lucide-vue-next）、`order: 5`、`namespaces: ['startup-map']`
- AC2: `tools/index.ts` 添加 `import './startup-map'` side-effect 导入
- AC3: 侧边栏自动显示"创业地图"入口，图标和名称正确
- AC4: 访问 `/startup-map` 路由时正确加载创业地图工具根组件
- AC5: 数据库 schema 文件 `server/database/schemas/startup-map.ts` 创建并在 schema index 中导出
- AC6: `server/api/_test/reset.post.ts` 中添加 `sm_*` 表的清理逻辑（按 FK 顺序删除）

**涉及页面/组件：**
- `tools/startup-map/index.ts` — 工具注册入口
- `tools/startup-map/StartupMap.vue` — 工具根组件
- `tools/startup-map/types.ts` — 类型定义
- `tools/index.ts` — 添加 side-effect import
- `stores/startup-map.ts` — Pinia store（Composition API 风格）

**API 需求：**
- 新建 API 路由目录：`server/api/startup-map/`
- 新建 Schema 文件：`server/database/schemas/startup-map.ts`

---

## P1 — 重要增强（第二期）

### P1-1 学习路径 / 阶段视图

**描述：** 展示 8 个预设学习阶段的时间线视图，每个阶段包含跨领域的知识点列表，引导用户按合理顺序推进学习。

**验收标准（AC）：**
- AC1: 全局视图顶部提供 Tab 切换：`领域视图` / `阶段视图`
- AC2: 阶段视图以纵向时间线展示 8 个阶段，每个阶段节点显示：阶段序号、名称、目标描述、完成进度（百分比 + 进度条）
- AC3: 当前所在阶段（第一个未完成的阶段）高亮标识
- AC4: 点击某阶段展开该阶段的知识点列表，显示知识点名称、所属领域/主题、学习状态
- AC5: 知识点可点击跳转到知识点学习页
- AC6: 阶段完成条件：该阶段所有知识点状态达到"已理解"或"已实践"
- AC7: 已完成阶段显示勾选标记
- AC8: 用户可自由跳转到任意阶段学习，不强制线性顺序
- AC9: 全局统计栏新增"当前学习阶段"显示

**涉及页面/组件：**
- `tools/startup-map/components/StageView.vue` — 阶段视图
- `tools/startup-map/components/StageTimeline.vue` — 阶段时间线
- `tools/startup-map/components/StageNode.vue` — 阶段节点
- `tools/startup-map/components/StagePointList.vue` — 阶段知识点列表

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/stages` | 返回所有阶段列表，含每个阶段的 `pointCount`、`completedCount`、`isCurrent` |
| GET | `/api/startup-map/stages/[id]` | 返回阶段详情，含关联知识点列表及其状态和所属领域/主题信息 |

数据库新增：
- `sm_stages` 表 — 存储 8 个学习阶段
- `sm_stage_points` 联合表 — 阶段与知识点的多对多映射，含 `sortOrder`

种子数据需包含 8 个阶段及其知识点映射关系。

---

### P1-2 实践任务

**描述：** 每个知识点附带 1-3 个实践任务，由 AI 在生成教学内容时一并生成，引导用户将知识应用于实际产品。

**验收标准（AC）：**
- AC1: 知识点学习页中教学内容下方展示"实践任务"区域
- AC2: 实践任务在 AI 生成教学内容时一并生成并保存到 `sm_tasks` 表
- AC3: 每个任务显示：任务描述、预期产出、参考提示
- AC4: 每个任务有"标记完成"按钮，点击后展开完成心得输入框
- AC5: 填写心得后确认，任务标记为已完成，记录完成时间和心得
- AC6: 已完成任务显示勾选状态和完成心得（可折叠查看）
- AC7: 可取消已完成状态（心得保留）
- AC8: 对已在 P0 阶段生成过教学内容但无任务数据的知识点，显示"生成任务"按钮

**涉及页面/组件：**
- `tools/startup-map/components/PracticeTasks.vue` — 实践任务区域
- `tools/startup-map/components/TaskItem.vue` — 单个任务项

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/points/[id]/tasks` | 返回该知识点的实践任务列表 |
| POST | `/api/startup-map/points/[id]/tasks/generate` | 独立 AI 生成实践任务（用于补充旧知识点），请求体：`{ productId?: number }` |
| PATCH | `/api/startup-map/tasks/[id]` | 更新任务状态。请求体：`{ isCompleted: boolean, completionNote?: string }` |

---

### P1-3 笔记系统

**描述：** 每个知识点下提供 Markdown 笔记编辑区域，支持编辑/预览切换和自动保存。

**验收标准（AC）：**
- AC1: 知识点学习页的"我的笔记"板块展示 Markdown 编辑器
- AC2: 编辑器支持编辑模式和预览模式切换（桌面端并排显示、移动端 Tab 切换）
- AC3: 支持标准 Markdown 语法：标题、列表、粗体、斜体、链接、代码块、引用
- AC4: 输入停止后 1 秒自动保存（debounce 1000ms），保存时显示"保存中..."，完成后显示"已保存"+ 最后编辑时间
- AC5: 笔记内容保存在 `sm_notes` 表，关联 `pointId`
- AC6: 笔记为空时显示占位文案："记录你的学习心得、调研结果..."
- AC7: 再次进入知识点时加载已保存笔记
- AC8: "重新生成"教学内容不影响笔记内容

**涉及页面/组件：**
- `tools/startup-map/components/NoteEditor.vue` — 笔记编辑区（参考 article-reader 的笔记编辑模式）

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/points/[id]/notes` | 返回该知识点的笔记，无则返回 `null` |
| PUT | `/api/startup-map/points/[id]/notes` | 保存/更新笔记（upsert）。请求体：`{ content: string }` |

---

### P1-4 学习建议

**描述：** 在全局视图和阶段视图中推荐用户下一步应学习的 1-3 个知识点。

**验收标准（AC）：**
- AC1: 全局视图统计栏下方显示"建议下一步学习"区域，推荐 1-3 个知识点
- AC2: 推荐逻辑：当前阶段（第一个未完成阶段）中尚未完成的知识点，按 `sortOrder` 排列取前 3 个
- AC3: 每个推荐项显示：知识点名称、所属领域/主题、当前状态
- AC4: 点击推荐项直接跳转到知识点学习页
- AC5: 所有知识点都已完成时显示"恭喜完成全部学习！"
- AC6: 阶段视图中当前阶段节点也显示推荐知识点

**涉及页面/组件：**
- `tools/startup-map/components/LearningRecommendation.vue` — 学习建议区域

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/recommendations` | 返回推荐的 1-3 个知识点，含所属领域/主题和阶段信息 |

---

### P1-5 进度统计

**描述：** 增强全局和领域维度的学习进度展示，提供各状态的详细分布。

**验收标准（AC）：**
- AC1: 全局统计栏展示各状态数量及占比：未开始/学习中/已理解/已实践
- AC2: 完成率定义：（已理解 + 已实践）/ 总知识点数 * 100%
- AC3: 各状态占比以分段进度条展示（四种灰阶分色段）
- AC4: 每个领域卡片上展示该领域的知识点完成率和分段进度条
- AC5: 领域详情页顶部也展示该领域的详细统计（各状态数量）
- AC6: 统计数据随知识点状态变更实时更新（返回页面时刷新）

**涉及页面/组件：**
- `tools/startup-map/components/GlobalStats.vue` — 增强全局统计（增加各状态明细和分段进度条）
- `tools/startup-map/components/SegmentedProgress.vue` — 分段进度条组件

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/stats/overview` | 增强返回：`totalPoints`、`notStarted`、`learning`、`understood`、`practiced`、`completionRate`、`currentStageId` |
| GET | `/api/startup-map/stats/by-domain` | 按领域返回进度统计：`{ domains: [{ id, name, total, notStarted, learning, understood, practiced, rate }] }` |

---

## P2 — 增强体验（第三期）

### P2-1 文章关联

**描述：** 知识点可关联 article-reader 中已收藏的文章，建立知识与阅读材料的双向链接。需同时修改 article-reader 侧。

**验收标准（AC）：**
- AC1: 知识点学习页中显示"关联文章"区域，列出已关联的文章（标题、来源）
- AC2: 提供"添加关联"按钮，点击弹出文章选择面板
- AC3: 文章选择面板展示所有已收藏文章，支持按标题搜索和按标签筛选
- AC4: 可多选文章后确认关联
- AC5: 已关联文章可点击跳转到 article-reader 工具打开该文章
- AC6: 可取消关联（不删除文章本身）
- AC7: 知识点列表（领域详情页）中每个知识点显示关联文章数量
- AC8: 在 article-reader 的已收藏文章详情中新增"关联知识点"区域，显示已关联的知识点列表（名称 + 所属领域/主题）
- AC9: article-reader 侧可添加/移除知识点关联
- AC10: article-reader 侧点击知识点名称跳转到创业地图对应知识点页面

**涉及页面/组件：**
- `tools/startup-map/components/LinkedArticles.vue` — 关联文章展示区
- `tools/startup-map/components/ArticlePicker.vue` — 文章选择面板（全屏弹窗，移动端全屏模式）
- `tools/article-reader/components/LinkedPoints.vue` — 文章侧关联知识点展示（需修改 article-reader）

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/points/[id]/articles` | 返回知识点关联的文章列表（标题、来源、收藏时间） |
| POST | `/api/startup-map/points/[id]/articles` | 添加关联。请求体：`{ articleIds: number[] }` |
| DELETE | `/api/startup-map/points/[id]/articles/[articleId]` | 移除关联 |
| GET | `/api/startup-map/articles/[articleId]/points` | 返回文章关联的知识点列表（供 article-reader 调用） |
| POST | `/api/startup-map/articles/[articleId]/points` | 从文章侧添加关联。请求体：`{ pointIds: number[] }` |
| DELETE | `/api/startup-map/articles/[articleId]/points/[pointId]` | 从文章侧移除关联 |

---

### P2-2 学习热力图

**描述：** 以年度热力图展示学习活跃度，复用 habit-tracker 的热力图样式和布局。

**验收标准（AC）：**
- AC1: 提供学习热力图页面（通过全局视图的 Tab 或导航访问）
- AC2: 展示过去一年的日级热力图，横轴为周、纵轴为周几
- AC3: 颜色深浅表示当天学习行为次数：无行为（空白）、1-2 次（浅灰）、3-5 次（中灰）、6+ 次（深黑）
- AC4: 学习行为包括：查看知识点、AI 对话、编辑笔记、完成实践任务、状态变更
- AC5: 鼠标悬停/点击某天显示该天的学习行为次数和具体记录摘要
- AC6: 热力图上方显示连续学习天数
- AC7: 复用 habit-tracker 的热力图组件样式

**涉及页面/组件：**
- `tools/startup-map/components/LearningHeatmap.vue` — 学习热力图页面
- `tools/startup-map/components/HeatmapGrid.vue` — 热力图网格（参考 habit-tracker 实现）

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/stats/heatmap` | 返回每天学习行为次数。查询参数：`year`（默认当年）。返回：`{ [date: string]: number }` |
| GET | `/api/startup-map/stats/streak` | 返回当前连续学习天数 |

---

### P2-3 学习记录

**描述：** 记录用户的所有学习行为，为热力图和统计功能提供数据支撑。

**验收标准（AC）：**
- AC1: 以下用户行为自动记录到 `sm_activities` 表：查看知识点（`view`）、AI 对话（`chat`）、编辑笔记（`note`）、完成实践任务（`task`）、状态变更（`status_change`）
- AC2: 每条记录包含：时间戳（Unix ms）、行为类型、关联知识点 ID、日期字符串（`YYYY-MM-DD`，便于热力图查询）
- AC3: 同一知识点同一类型行为在同一小时内只记录一次（服务端去重，防刷）
- AC4: 热力图页面下方可查看学习记录列表，按时间倒序，支持分页
- AC5: 记录列表每条显示：时间、行为类型图标/文本、知识点名称
- AC6: 点击记录中的知识点名称跳转到对应知识点页面

**涉及页面/组件：**
- `tools/startup-map/components/LearningLogList.vue` — 学习记录列表

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/startup-map/activities` | 记录学习行为。请求体：`{ pointId: number, type: 'view' \| 'chat' \| 'note' \| 'task' \| 'status_change' }`。服务端做同小时去重 |
| GET | `/api/startup-map/activities` | 返回学习记录列表。查询参数：`page`（默认 1）、`pageSize`（默认 20）、`date`（可选，筛选指定日期）。返回含知识点名称的记录 |

---

### P2-4 多产品支持

**描述：** 支持配置多个产品档案，同一时间只有一个激活产品。不同产品下同一知识点可有各自的应用笔记。

**验收标准（AC）：**
- AC1: 产品档案页面支持创建多个产品，以列表形式展示
- AC2: 每个产品显示名称、当前阶段和"设为当前"按钮
- AC3: 同一时间只有一个产品处于激活状态（`isActive` 字段）
- AC4: 切换当前产品后，AI 对话和生成内容的上下文使用新产品信息
- AC5: 已保存的教学内容不因切换产品而消失（教学内容与产品无关）
- AC6: `sm_notes` 表通过 `productId` 字段关联产品，不同产品下同一知识点可有各自的笔记
- AC7: 切换产品后，知识点笔记区显示对应产品的笔记内容
- AC8: 可删除非激活状态的产品（确认弹窗），同时删除该产品下的笔记

**涉及页面/组件：**
- `tools/startup-map/components/ProductProfile.vue` — 增强为多产品管理
- `tools/startup-map/components/ProductList.vue` — 产品列表
- `tools/startup-map/components/ProductSwitcher.vue` — 产品切换器（顶部导航区域）

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| DELETE | `/api/startup-map/products/[id]` | 删除产品档案（仅非激活产品），级联删除该产品的笔记 |
| PATCH | `/api/startup-map/products/[id]/activate` | 激活指定产品，自动取消其他产品的激活状态 |
| GET | `/api/startup-map/points/[id]/notes` | 增加 `productId` 查询参数，返回特定产品的笔记 |
| PUT | `/api/startup-map/points/[id]/notes` | 请求体增加 `productId` 字段，按产品隔离保存 |

---

### P2-5 教学内容重新生成

**描述：** 用户可手动触发重新生成知识点的 AI 教学内容，覆盖旧内容但不影响笔记、对话和任务。

**验收标准（AC）：**
- AC1: 知识点学习页教学内容区顶部提供"重新生成"按钮（仅在已有教学内容时显示）
- AC2: 点击后弹出确认弹窗，告知用户将覆盖现有教学内容
- AC3: 确认后触发 AI 重新生成六个板块内容，显示生成中状态
- AC4: 生成完成后覆盖 `sm_point_contents` 中的旧内容，更新 `generatedAt` 时间戳
- AC5: 用户笔记（`sm_notes`）不受影响
- AC6: 对话历史（`sm_chats`）不受影响
- AC7: 实践任务（`sm_tasks`）不受影响
- AC8: 重新生成时使用当前激活的产品档案作为 AI 上下文

**涉及页面/组件：**
- `tools/startup-map/components/TeachingContent.vue` — 增加"重新生成"按钮和确认弹窗逻辑

**API 需求：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/startup-map/points/[id]/teaching` | 使用 `{ regenerate: true }` 参数调用，强制删除旧内容并重新生成（复用 P0-2.1 的 API） |

---

## 数据库 Schema 设计

文件：`server/database/schemas/startup-map.ts`

### 核心表

```
sm_domains          领域（10个）
 ├─ id              integer PK auto
 ├─ name            text NOT NULL
 ├─ description     text
 ├─ sortOrder       integer NOT NULL default 0
 └─ createdAt       integer NOT NULL (Unix ms)

sm_topics           主题（~30个）
 ├─ id              integer PK auto
 ├─ domainId        integer NOT NULL FK → sm_domains.id (cascade)
 ├─ name            text NOT NULL
 ├─ description     text
 ├─ sortOrder       integer NOT NULL default 0
 └─ createdAt       integer NOT NULL (Unix ms)
 索引: idx on domainId

sm_points           知识点（~90个）
 ├─ id              integer PK auto
 ├─ topicId         integer NOT NULL FK → sm_topics.id (cascade)
 ├─ name            text NOT NULL
 ├─ description     text
 ├─ status          text NOT NULL default 'not_started'
 │                  enum: 'not_started' | 'learning' | 'understood' | 'practiced'
 ├─ statusUpdatedAt integer (Unix ms), nullable
 ├─ sortOrder       integer NOT NULL default 0
 └─ createdAt       integer NOT NULL (Unix ms)
 索引: idx on topicId, idx on status

sm_teachings        教学内容（每知识点一条，含6个板块字段）
 ├─ id              integer PK auto
 ├─ pointId         integer NOT NULL FK → sm_points.id (cascade), UNIQUE
 ├─ what            text           "是什么" (markdown)
 ├─ how             text           "怎么做" (markdown)
 ├─ example         text           "案例" (markdown)
 ├─ apply           text           "我的应用" (markdown)
 ├─ resources       text           "推荐资源" (markdown)
 ├─ productId       integer FK → sm_products.id (set null)
 ├─ createdAt       integer NOT NULL (Unix ms)
 └─ updatedAt       integer NOT NULL (Unix ms)
 索引: unique idx on pointId

sm_chats            知识点对话
 ├─ id              integer PK auto
 ├─ pointId         integer NOT NULL FK → sm_points.id (cascade)
 ├─ role            text NOT NULL   'user' | 'assistant'
 ├─ content         text NOT NULL
 └─ createdAt       integer NOT NULL (Unix ms)
 索引: idx on pointId, idx on createdAt

sm_products         产品档案
 ├─ id              integer PK auto
 ├─ name            text NOT NULL
 ├─ description     text
 ├─ targetMarket    text
 ├─ targetCustomer  text
 ├─ productionSource text
 ├─ currentStage    text default 'ideation'
 │                  enum: 'ideation' | 'researching' | 'preparing' | 'launched'
 ├─ notes           text
 ├─ isActive        integer (boolean) NOT NULL default true
 ├─ createdAt       integer NOT NULL (Unix ms)
 └─ updatedAt       integer NOT NULL (Unix ms)
```

### P1 新增表

```
sm_stages           学习阶段（8个）
 ├─ id              integer PK auto
 ├─ name            text NOT NULL
 ├─ description     text
 ├─ objective       text           阶段目标
 └─ sortOrder       integer NOT NULL default 0

sm_stage_points     阶段-知识点多对多映射
 ├─ stageId         integer FK → sm_stages.id (cascade)  ── composite PK
 ├─ pointId         integer FK → sm_points.id (cascade)  ── composite PK
 └─ sortOrder       integer NOT NULL default 0

sm_tasks            实践任务
 ├─ id              integer PK auto
 ├─ pointId         integer NOT NULL FK → sm_points.id (cascade)
 ├─ description     text NOT NULL
 ├─ expectedOutput  text
 ├─ hint            text
 ├─ isCompleted     integer (boolean) default false
 ├─ completionNote  text
 ├─ sortOrder       integer NOT NULL default 0
 ├─ createdAt       integer NOT NULL (Unix ms)
 └─ updatedAt       integer NOT NULL (Unix ms)
 索引: idx on pointId

sm_notes            知识点笔记
 ├─ id              integer PK auto
 ├─ pointId         integer NOT NULL FK → sm_points.id (cascade)
 ├─ productId       integer FK → sm_products.id (set null), nullable  [P2多产品]
 ├─ content         text NOT NULL default ''
 ├─ createdAt       integer NOT NULL (Unix ms)
 └─ updatedAt       integer NOT NULL (Unix ms)
 索引: unique idx on (pointId, productId)
```

### P2 新增表

```
sm_point_articles   知识点-文章关联
 ├─ pointId         integer FK → sm_points.id (cascade)  ── composite PK
 ├─ articleId       integer FK → articles.id (cascade)   ── composite PK
 └─ createdAt       integer NOT NULL (Unix ms)

sm_activities       学习行为记录
 ├─ id              integer PK auto
 ├─ pointId         integer FK → sm_points.id (set null)
 ├─ type            text NOT NULL
 │                  enum: 'view' | 'chat' | 'note' | 'task' | 'status_change'
 ├─ date            text NOT NULL   'YYYY-MM-DD'（便于热力图聚合）
 └─ createdAt       integer NOT NULL (Unix ms)
 索引: idx on date, idx on pointId
```

### 类型导出

```typescript
export type SmDomain = typeof smDomains.$inferSelect;
export type SmTopic = typeof smTopics.$inferSelect;
export type SmPoint = typeof smPoints.$inferSelect;
export type SmTeaching = typeof smTeachings.$inferSelect;
export type SmChat = typeof smChats.$inferSelect;
export type SmProduct = typeof smProducts.$inferSelect;
export type SmStage = typeof smStages.$inferSelect;
export type SmTask = typeof smTasks.$inferSelect;
export type SmNote = typeof smNotes.$inferSelect;
export type SmActivity = typeof smActivities.$inferSelect;
```

---

## API 路由汇总

### P0

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/domains` | 领域列表（含统计） |
| GET | `/api/startup-map/domains/[id]` | 领域详情（含主题和知识点） |
| GET | `/api/startup-map/points/[id]` | 知识点详情（含教学内容） |
| POST | `/api/startup-map/points/[id]/teaching` | AI 生成/重新生成教学内容（SSE） |
| PATCH | `/api/startup-map/points/[id]/status` | 更新学习状态 |
| GET | `/api/startup-map/points/[id]/chats` | 获取对话历史 |
| POST | `/api/startup-map/points/[id]/chat` | 发送消息（SSE 流式） |
| DELETE | `/api/startup-map/points/[id]/chats` | 清空对话历史 |
| GET | `/api/startup-map/products` | 产品档案列表 |
| GET | `/api/startup-map/products/active` | 当前激活产品 |
| POST | `/api/startup-map/products` | 创建产品档案 |
| PUT | `/api/startup-map/products/[id]` | 更新产品档案 |
| GET | `/api/startup-map/stats/overview` | 全局统计 |
| POST | `/api/startup-map/seed` | 种子数据导入 |

### P1

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/stages` | 阶段列表（含进度） |
| GET | `/api/startup-map/stages/[id]` | 阶段详情（含知识点） |
| GET | `/api/startup-map/points/[id]/tasks` | 知识点实践任务 |
| POST | `/api/startup-map/points/[id]/tasks/generate` | AI 生成实践任务 |
| PATCH | `/api/startup-map/tasks/[id]` | 更新任务状态 |
| GET | `/api/startup-map/points/[id]/notes` | 获取笔记 |
| PUT | `/api/startup-map/points/[id]/notes` | 保存/更新笔记 |
| GET | `/api/startup-map/recommendations` | 学习建议 |
| GET | `/api/startup-map/stats/by-domain` | 按领域统计 |

### P2

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/startup-map/points/[id]/articles` | 知识点关联文章 |
| POST | `/api/startup-map/points/[id]/articles` | 添加文章关联 |
| DELETE | `/api/startup-map/points/[id]/articles/[articleId]` | 移除文章关联 |
| GET | `/api/startup-map/articles/[articleId]/points` | 文章关联知识点 |
| POST | `/api/startup-map/articles/[articleId]/points` | 文章侧添加关联 |
| DELETE | `/api/startup-map/articles/[articleId]/points/[pointId]` | 文章侧移除关联 |
| GET | `/api/startup-map/stats/heatmap` | 热力图数据 |
| GET | `/api/startup-map/stats/streak` | 连续学习天数 |
| POST | `/api/startup-map/activities` | 记录学习行为 |
| GET | `/api/startup-map/activities` | 学习记录列表 |
| DELETE | `/api/startup-map/products/[id]` | 删除产品档案 |
| PATCH | `/api/startup-map/products/[id]/activate` | 激活产品 |

---

## 前端组件树

```
tools/startup-map/
├── index.ts                          # Tool 注册 (P0)
├── types.ts                          # 类型定义 (P0)
├── StartupMap.vue                    # 根组件，管理视图路由 (P0)
└── components/
    ├── GlobalView.vue                # 全局视图 — 领域卡片网格 (P0)
    ├── GlobalStats.vue               # 全局统计栏 (P0, P1增强)
    ├── DomainCard.vue                # 领域卡片 (P0)
    ├── DomainDetail.vue              # 领域详情页 (P0)
    ├── TopicGroup.vue                # 主题分组 (P0)
    ├── PointItem.vue                 # 知识点列表项 (P0)
    ├── StatusBadge.vue               # 学习状态标记 (P0)
    ├── PointPage.vue                 # 知识点学习页主容器 (P0)
    ├── TeachingContent.vue           # 教学内容区 (P0, P2增强)
    ├── ContentSection.vue            # 教学板块手风琴项 (P0)
    ├── StatusSelector.vue            # 状态选择器 (P0)
    ├── ChatPanel.vue                 # AI 对话区域 (P0)
    ├── ChatMessage.vue               # 聊天消息 (P0)
    ├── ProductProfile.vue            # 产品档案 (P0, P2增强)
    ├── WelcomeGuide.vue              # 首次使用欢迎引导 (P0)
    ├── StageView.vue                 # 阶段视图 (P1)
    ├── StageTimeline.vue             # 阶段时间线 (P1)
    ├── StageNode.vue                 # 阶段节点 (P1)
    ├── StagePointList.vue            # 阶段知识点列表 (P1)
    ├── PracticeTasks.vue             # 实践任务区域 (P1)
    ├── TaskItem.vue                  # 单个任务项 (P1)
    ├── NoteEditor.vue                # 笔记编辑器 (P1)
    ├── LearningRecommendation.vue    # 学习建议 (P1)
    ├── SegmentedProgress.vue         # 分段进度条 (P1)
    ├── LinkedArticles.vue            # 关联文章展示 (P2)
    ├── ArticlePicker.vue             # 文章选择面板 (P2)
    ├── LearningHeatmap.vue           # 学习热力图 (P2)
    ├── HeatmapGrid.vue              # 热力图网格 (P2)
    ├── LearningLogList.vue           # 学习记录列表 (P2)
    ├── ProductList.vue               # 产品列表 (P2)
    └── ProductSwitcher.vue           # 产品切换器 (P2)

stores/
└── startup-map.ts                    # Pinia store (P0)

server/database/schemas/
└── startup-map.ts                    # 所有 sm_* 表定义

server/database/seeds/
└── startup-map.ts                    # 知识树种子数据

server/api/startup-map/
├── seed.post.ts
├── domains/
│   ├── index.get.ts
│   └── [id].get.ts
├── points/
│   ├── [id].get.ts
│   └── [id]/
│       ├── teaching.post.ts
│       ├── chat.post.ts
│       ├── chats.get.ts
│       ├── chats.delete.ts
│       ├── status.patch.ts
│       ├── notes.get.ts              (P1)
│       ├── notes.put.ts              (P1)
│       ├── tasks.get.ts              (P1)
│       ├── tasks/
│       │   └── generate.post.ts      (P1)
│       ├── articles.get.ts           (P2)
│       ├── articles.post.ts          (P2)
│       └── articles/
│           └── [articleId].delete.ts  (P2)
├── products/
│   ├── index.get.ts
│   ├── index.post.ts
│   ├── active.get.ts
│   ├── [id].put.ts
│   ├── [id].delete.ts               (P2)
│   └── [id]/
│       └── activate.patch.ts         (P2)
├── tasks/
│   └── [id].patch.ts                 (P1)
├── stages/
│   ├── index.get.ts                  (P1)
│   └── [id].get.ts                   (P1)
├── stats/
│   ├── overview.get.ts
│   ├── by-domain.get.ts              (P1)
│   ├── heatmap.get.ts                (P2)
│   └── streak.get.ts                 (P2)
├── recommendations.get.ts            (P1)
├── activities/
│   ├── index.get.ts                  (P2)
│   └── index.post.ts                 (P2)
└── articles/
    └── [articleId]/
        ├── points.get.ts             (P2)
        ├── points.post.ts            (P2)
        └── points/
            └── [pointId].delete.ts   (P2)
```

---

## 实现注意事项

1. **DB 访问：** 所有 API handler 内调用 `useDB()` 获取数据库连接，不在模块顶层调用
2. **时间戳：** 所有时间字段使用 Unix 毫秒（integer），日期字段使用 `YYYY-MM-DD` 字符串
3. **ID：** 所有表使用 auto-increment integer 主键
4. **LLM 调用：** 教学内容生成和对话复用已有的 `server/lib/llm/` 基础设施，通过默认 provider 调用
5. **SSE 流式输出：** 对话和教学内容生成 API 参考 `articles/[id]/translate-stream.post.ts` 的 SSE 实现模式
6. **CSS：** 所有样式使用 CSS 变量，遵循黑白单色（monochrome）设计系统，不使用硬编码颜色值
7. **种子数据：** 知识树数据量较大（约 90 个知识点），建议以 JSON/TS 对象存储原始数据，脚本读取后在事务中批量插入
8. **乐观更新：** 状态切换使用乐观更新模式，先更新 UI 再同步服务端
9. **防抖保存：** 笔记自动保存使用 1000ms debounce，避免频繁请求
10. **去重记录：** 学习行为记录在服务端做同小时同类型去重，避免刷数据
11. **E2E 测试清理：** `server/api/_test/reset.post.ts` 需按 FK 依赖顺序清理 `sm_*` 表
12. **Pinia Store：** 使用 Composition API 风格 `defineStore('startup-map', () => { ... })`，所有 API 调用通过 store 统一管理

---

## 建议实现顺序

### Phase 1（P0 MVP）

1. Schema 定义 + 迁移（`sm_domains`、`sm_topics`、`sm_points`、`sm_teachings`、`sm_chats`、`sm_products`）
2. 种子数据脚本 + seed 端点
3. Test reset 清理
4. Tool 注册 + 根组件 + Pinia store 骨架
5. 产品档案（API + UI）— AI 上下文前置
6. 全局视图（API + UI）
7. 领域详情页（API + UI）
8. 知识点学习页 — 教学内容生成（API + AI + UI）
9. 学习状态管理（API + UI）
10. AI 对话（API + SSE + UI）

### Phase 2（P1）

11. 笔记系统（Schema + API + UI）
12. 实践任务（Schema + API + AI + UI）
13. 学习阶段（Schema + 种子数据 + API + UI）
14. 学习建议（API + UI）
15. 进度统计增强（API + UI）

### Phase 3（P2）

16. 学习行为记录（Schema + API）
17. 学习热力图（API + UI）
18. 文章关联（Schema + API + UI + article-reader 改造）
19. 多产品支持（Schema 改造 + API + UI）
20. 教学内容重新生成（UI 增强）
