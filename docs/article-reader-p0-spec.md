# 文章阅读器 P0 MVP — 功能拆解与验收标准

## 概述

本文档拆解文章阅读器 P0 MVP 的功能点，明确每个功能的具体需求和验收标准。P0 范围聚焦于核心阅读-翻译-收藏闭环。

---

## 功能模块一览

| # | 功能 | 简述 |
|---|------|------|
| F1 | 工具注册与路由 | 注册为 tool plugin，侧边栏可见 |
| F2 | URL 输入与文章抓取 | 输入 URL → 服务端提取正文 |
| F3 | 原文渲染面板 | 左侧展示提取的文章内容 |
| F4 | 完整翻译 | LLM 逐段翻译，右侧 tab 展示 |
| F5 | 精简概括 | LLM 生成摘要，右侧 tab 展示 |
| F6 | 收藏功能 | 保存文章及翻译/概括到数据库 |
| F7 | 收藏列表 | 展示收藏的文章，按时间排序 |

---

## F1: 工具注册与路由

### 需求

- 在 `tools/article-reader/index.ts` 中调用 `registerTool()`，注册为新工具模块
- 在 `tools/index.ts` 中添加 side-effect import
- 使用 `FileText`（或类似 lucide 图标）作为工具图标
- `id: 'article-reader'`, `name: '文章阅读'`, `order: 4`
- `namespaces: ['articles', 'bookmarks']`

### 验收标准

- [ ] 侧边栏显示「文章阅读」入口
- [ ] 点击后路由到 `/article-reader`，渲染文章阅读器主组件
- [ ] 不影响已有工具（日历打卡、法语词汇、年度计划）的正常运行

---

## F2: URL 输入与文章抓取

### 需求

#### 前端
- 页面顶部显示 URL 输入框 + 「加载」按钮
- 输入 URL 后按回车或点击按钮触发加载
- 加载中显示 loading 状态（按钮 disabled + spinner）
- 加载失败显示错误提示信息

#### 后端 API: `POST /api/articles/fetch`
- 请求体: `{ url: string }`
- 服务端使用 `@mozilla/readability` + `jsdom` 提取正文
- 流程: 1) fetch URL 获取 HTML → 2) jsdom 解析 → 3) Readability 提取 → 4) `sanitize-html` 清理 XSS → 5) 存入 `articles` 表 → 6) 返回文章数据
- 若 URL 已存在于 `articles` 表，直接返回已有记录（不重复抓取）
- 返回字段: `{ id, url, title, author, siteName, content, excerpt, publishedAt, createdAt }`

#### 错误处理
- URL 格式校验失败 → 400
- 网页抓取失败（网络错误、超时） → 502
- Readability 提取失败（无法提取正文） → 422，message 提示「无法提取文章正文」

#### 依赖包
- `@mozilla/readability` — 正文提取
- `jsdom` — DOM 解析
- `sanitize-html` — HTML 清理防 XSS

### 验收标准

- [ ] 输入有效 URL 后，能成功提取并返回文章数据
- [ ] 同一 URL 重复提交不会创建重复记录
- [ ] 输入无效 URL（格式错误）返回 400
- [ ] 抓取不到内容的 URL 返回 422 并提示
- [ ] 加载过程中有明确的 loading 反馈
- [ ] 返回的 HTML 内容经过 sanitize-html 清理

---

## F3: 原文渲染面板（左侧）

### 需求

- 分屏布局：左右各 50% 宽度（P0 不要求拖拽调整）
- 左侧面板内容：
  - **文章元信息区**：标题（h1）、来源站点、作者、发布时间
  - **正文区**：使用 `v-html` 渲染提取的 HTML 正文
  - 正文区可独立滚动
- 未加载文章时显示空状态提示（如「请输入文章 URL 开始阅读」）

### 验收标准

- [ ] 文章加载后，左侧正确渲染标题、作者、站点名、发布时间
- [ ] 正文区保留原文的段落、图片、代码块等 HTML 结构
- [ ] 左侧面板可独立滚动，不影响右侧
- [ ] 未加载文章时显示空状态

---

## F4: 完整翻译（右侧 tab 之一）

### 需求

#### 前端
- 右侧面板顶部有 tab 切换：「完整翻译」|「精简概括」
- 默认选中「完整翻译」tab
- 点击「完整翻译」tab 或文章加载后，触发翻译请求
- 翻译结果渲染在右侧面板（纯文本/Markdown，逐段展示）
- 翻译中显示 loading 状态
- 已有缓存的翻译结果直接展示，不重复调用 LLM

#### 后端 API: `POST /api/articles/:id/translate`
- 请求体: `{ type: 'full' }` 或 `{ type: 'summary' }` 或 `{ type: 'both' }`
- 先查询 `article_translations` 表是否有缓存，有则直接返回
- 无缓存时：组装 prompt → 调用现有 LLM chat 能力 → 将结果存入 `article_translations` 表 → 返回
- prompt 设计（完整翻译）：要求 LLM 逐段翻译，保持段落结构，翻译为中文
- 返回: `{ type: 'full', content: string, cached: boolean }`

#### 后端 API: `GET /api/articles/:id/translations`
- 返回该文章所有已缓存的翻译结果
- 返回: `Array<{ id, type, content, createdAt }>`

### 验收标准

- [ ] 文章加载后可在右侧面板查看完整翻译
- [ ] 翻译结果逐段展示，段落结构与原文对应
- [ ] 同一文章的翻译结果被缓存，二次访问不重新调用 LLM
- [ ] 翻译过程中有 loading 状态
- [ ] LLM 不可用时显示错误提示

---

## F5: 精简概括（右侧 tab 之二）

### 需求

#### 前端
- 切换到「精简概括」tab 后展示概括内容
- 概括内容格式：要点列表 + 一段话总结
- 若未生成概括，切换到此 tab 时自动触发生成
- 已有缓存则直接展示

#### 后端
- 复用 `POST /api/articles/:id/translate` 接口，`type: 'summary'`
- prompt 设计（精简概括）：要求 LLM 提炼文章要点（3-5 条），再写一段总结性概括，输出中文
- 缓存机制与完整翻译相同

### 验收标准

- [ ] 切换到「精简概括」tab 后展示概括内容
- [ ] 概括包含要点列表和一段话总结
- [ ] 概括结果被缓存，不重复调用 LLM
- [ ] 生成过程中有 loading 状态

---

## F6: 收藏功能

### 需求

#### 前端
- URL 输入栏右侧有「收藏」按钮（星形图标）
- 文章未收藏时显示空心星，已收藏时显示实心星
- 点击切换收藏状态
- 收藏时将当前文章（含原文、已生成的翻译和概括）保存

#### 后端 API: `POST /api/articles/:id/bookmark`
- 在 `article_bookmarks` 表中创建记录
- `bookmarkedAt` 为当前时间（Unix ms）
- 若已收藏则返回 409

#### 后端 API: `DELETE /api/articles/:id/bookmark`
- 删除 `article_bookmarks` 表中对应记录
- 若未收藏则返回 404

### 验收标准

- [ ] 文章加载后，收藏按钮可见
- [ ] 点击收藏按钮后，文章被标记为已收藏（图标变为实心）
- [ ] 再次点击取消收藏（图标恢复空心）
- [ ] 收藏状态在页面刷新后保持一致
- [ ] 收藏操作保存原文 + 已有翻译 + 已有概括（通过 articles + article_translations 关联）

---

## F7: 收藏列表

### 需求

#### 前端
- 页面顶部 tab 或导航：「阅读」|「收藏库」两个视图
- 收藏库视图展示所有收藏的文章，卡片式列表：
  - 文章标题
  - 来源站点 + 作者
  - 概括摘要前两行（若有）
  - 收藏时间
- 默认按收藏时间倒序排列（最新在前）
- 点击卡片 → 切换到阅读视图，加载该文章（从本地数据库加载，不重新抓取）

#### 后端 API: `GET /api/bookmarks`
- 查询参数: `sort=bookmarkedAt` (默认) 或 `sort=publishedAt`
- 联表查询 `article_bookmarks` + `articles` + `article_translations`（type='summary' 作为摘要预览）
- 返回: `Array<{ id, articleId, title, url, author, siteName, excerpt, summaryPreview, bookmarkedAt, publishedAt }>`

### 验收标准

- [ ] 收藏库视图展示所有已收藏文章
- [ ] 每张卡片显示标题、来源、收藏时间
- [ ] 若有概括，显示摘要前两行
- [ ] 默认按收藏时间倒序排列
- [ ] 点击卡片跳转到阅读视图并显示该文章内容（含已有翻译/概括）
- [ ] 无收藏时显示空状态

---

## 数据库 Schema（P0 涉及的表）

P0 需要创建以下 3 张表：

```
articles              — 文章主表
article_translations  — 翻译/概括缓存
article_bookmarks     — 收藏表
```

字段定义参照 PRD 中的数据模型设计（docs/article-reader-prd.md 第三节）。

关键约束：
- `articles.url` 添加唯一索引
- `article_bookmarks.articleId` 添加唯一约束（一篇文章只能收藏一次）
- `article_translations` 的 `(articleId, type)` 组合应唯一（同一文章同一类型只缓存一份）
- 所有时间戳使用 Unix 毫秒（integer）
- 所有外键关联 `articles.id`，删除文章时级联删除翻译和收藏

---

## 技术依赖总结

| 类别 | 内容 |
|------|------|
| 新增 npm 包 | `@mozilla/readability`, `jsdom`, `sanitize-html` |
| 复用现有能力 | `/api/llm/chat` 的 LLM 调用能力、`llmProviders` 体系 |
| 新增 DB 表 | `articles`, `article_translations`, `article_bookmarks` |
| 工具注册 | `registerTool({ id: 'article-reader', ... })` |

---

## P0 不包含的功能（P1/P2）

以下功能明确不在 P0 范围内，避免范围蔓延：

- ~~标签系统~~（P1）
- ~~AI 聊天面板~~（P1）
- ~~个人笔记编辑~~（P1）
- ~~收藏搜索~~（P1）
- ~~流式翻译输出~~（P2，P0 使用同步返回）
- ~~分屏拖拽调整宽度~~（P2，P0 固定 50/50）
- ~~选中文本快捷翻译/提问~~（P2）
- ~~阅读历史~~（P2）
- ~~手动粘贴正文备选~~（P2）
- ~~提取失败时的备选方案~~（P2）
