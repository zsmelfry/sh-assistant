# 文章阅读器（Article Reader）— 产品需求文档

## 一、核心定位

一个「阅读 + 翻译 + 笔记」三合一的外文文章管理工具。用户粘贴一个 URL，工具自动抓取正文，通过 LLM 进行翻译/概括，支持边读边聊，喜欢的文章可收藏归档。

## 二、功能模块

### 1. 文章导入

- **输入方式：** 顶部输入框粘贴 URL，回车即加载
- **内容提取：** 服务端抓取 URL 页面，用 readability 类库提取正文（标题、作者、正文 HTML、发布时间、站点名称），剥离广告/导航等干扰元素
- **提取失败处理：** 若无法提取（付费墙、JS 渲染页），提示用户，并提供手动粘贴正文的备选方案
- **历史记录：** 最近阅读过的文章列表（不必收藏也会保留），方便快速回访

### 2. 分屏阅读

- **布局：** 左右分栏，可拖拽调整宽度比例（默认 50/50）
- **左侧 — 原文面板：**
  - 渲染提取后的正文（富文本），保留标题、段落、图片、代码块等结构
  - 顶部显示：文章标题、来源站点、作者、发布时间
  - 支持选中文本后右键「翻译选中段落」或「追问 LLM」
- **右侧 — 译文/AI 面板：** 标签页切换三个视图
  - **完整翻译：** 逐段对照翻译，段落与原文尽量对齐
  - **精简概括：** LLM 生成的摘要（要点列表 + 一段话总结）
  - **聊天：** 针对当前文章的对话（详见模块 4）

### 3. 翻译控制

- **触发方式：** 文章加载后，用户点击按钮选择翻译模式：
  - 「完整翻译」— 全文逐段翻译
  - 「精简概括」— 提炼要点 + 总结
  - 「两者都要」— 同时生成，分 tab 展示
- **LLM 选择：** 复用现有 `llmProviders` 体系，用户可在设置里切换模型
- **翻译语言：** 默认翻译为中文（后续可扩展目标语言）
- **流式输出：** 翻译结果流式返回，实时渲染（长文章体验更好）
- **缓存：** 同一 URL 的翻译结果缓存到数据库，避免重复消耗 token

### 4. AI 聊天

- **上下文：** 自动将文章正文作为 system context 注入，用户可直接提问
- **典型用法：**
  - 「这篇文章的核心论点是什么？」
  - 「第三段提到的 XX 概念帮我解释一下」
  - 「帮我用中文总结这篇文章的三个关键结论」
  - 选中某段原文后发送：「翻译这段 / 解释这段」
- **对话历史：** 每篇文章独立对话记录，收藏后随文章保存
- **复用现有 `/api/llm/chat` 接口**，前端组装 messages 即可

### 5. 收藏管理

**收藏时保存的数据：**

| 字段 | 说明 |
|------|------|
| 原文 URL | 来源链接 |
| 文章标题 | 提取的标题 |
| 来源/作者 | 站点名 + 作者（如有） |
| 原文内容 | 提取的 HTML 正文（本地化存储，防止原文链接失效） |
| 完整译文 | 如果已生成 |
| 精简概括 | 如果已生成 |
| 个人笔记 | 用户手写的 Markdown 笔记（可选） |
| 标签 | 多标签分类 |
| 收藏时间 | 时间戳 |
| 文章发布时间 | 原文的发布时间（如有） |

**收藏列表视图：**

- **排序：** 按收藏时间（默认） / 按文章发布时间
- **筛选：** 按标签筛选，支持多标签交集/并集
- **搜索：** 关键词搜索（匹配标题、笔记、概括）
- **展示：** 卡片式列表，显示标题、来源、标签、概括摘要前几行、收藏时间
- **点击卡片：** 重新进入分屏阅读模式（从本地缓存加载，无需重新抓取）

### 6. 标签管理

- **标签 CRUD：** 新建 / 重命名 / 删除标签
- **删除保护：** 删除标签时，已关联文章的该标签自动移除（不删文章）
- **标签颜色：** 每个标签可选一个颜色（从预设色板选取），便于视觉区分
- **快捷打标签：** 收藏时弹出标签选择器，支持搜索已有标签或快速新建

## 三、数据模型设计

```
articles              — 文章主表（url, title, author, siteName, content, publishedAt, createdAt）
article_translations  — 翻译缓存（articleId, type[full/summary], content, providerId, createdAt）
article_bookmarks     — 收藏表（articleId, notes, bookmarkedAt）
article_tags          — 标签表（id, name, color, createdAt）
article_tag_map       — 文章-标签关联（articleId, tagId）
article_chats         — 聊天记录（articleId, role, content, createdAt）
```

### 字段详细定义

#### articles

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增主键 |
| url | text NOT NULL | 原文地址（唯一索引） |
| title | text NOT NULL | 文章标题 |
| author | text | 作者 |
| siteName | text | 来源站点名 |
| content | text NOT NULL | 提取的 HTML 正文 |
| excerpt | text | readability 提取的摘要 |
| publishedAt | integer | 文章发布时间（Unix ms） |
| createdAt | integer NOT NULL | 记录创建时间（Unix ms） |

#### article_translations

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增主键 |
| articleId | integer NOT NULL FK | 关联 articles.id |
| type | text NOT NULL | `'full'` 或 `'summary'` |
| content | text NOT NULL | 翻译/概括内容 |
| providerId | integer FK | 使用的 LLM provider |
| createdAt | integer NOT NULL | 生成时间（Unix ms） |

#### article_bookmarks

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增主键 |
| articleId | integer NOT NULL FK UNIQUE | 关联 articles.id（一篇文章只能收藏一次） |
| notes | text | 用户笔记（Markdown） |
| bookmarkedAt | integer NOT NULL | 收藏时间（Unix ms） |

#### article_tags

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增主键 |
| name | text NOT NULL UNIQUE | 标签名 |
| color | text | 颜色值（如 `#FF6B6B`） |
| createdAt | integer NOT NULL | 创建时间（Unix ms） |

#### article_tag_map

| 字段 | 类型 | 说明 |
|------|------|------|
| articleId | integer NOT NULL FK | 关联 articles.id |
| tagId | integer NOT NULL FK | 关联 article_tags.id |
| PRIMARY KEY | (articleId, tagId) | 联合主键 |

#### article_chats

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增主键 |
| articleId | integer NOT NULL FK | 关联 articles.id |
| role | text NOT NULL | `'user'` / `'assistant'` / `'system'` |
| content | text NOT NULL | 消息内容 |
| createdAt | integer NOT NULL | 发送时间（Unix ms） |

## 四、页面结构

### 主界面布局

```
┌──────────────────────────────────────────────────────────────┐
│  [阅读] [收藏库]                                    [标签管理] │
├──────────────────────────────────────────────────────────────┤
│  [ 粘贴文章 URL ...                        ] [加载] [★ 收藏]  │
├─────────────────────────────┬────────────────────────────────┤
│                             │  [完整翻译] [精简概括] [AI 聊天]  │
│                             │                                │
│         原文正文              │       译文 / 概括 / 聊天        │
│        （可滚动）             │        （可滚动）               │
│                             │                                │
│                             │                                │
│                             │                                │
├─────────────────────────────┴────────────────────────────────┤
│  文章元信息：来源 · 作者 · 发布时间                              │
└──────────────────────────────────────────────────────────────┘
```

### 收藏库视图

```
┌──────────────────────────────────────────────────────────────┐
│  [阅读] [收藏库]                                    [标签管理] │
├──────────────────────────────────────────────────────────────┤
│  [搜索...]          排序: [收藏时间 ▼] [发布时间]              │
│  标签筛选: [全部] [技术] [设计] [商业] ...                     │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 文章标题                                  2026-02-18 │     │
│  │ source.com · 作者名                                  │     │
│  │ 概括摘要前两行文字...                                  │     │
│  │ [技术] [AI]                                          │     │
│  └─────────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 另一篇文章标题                              2026-02-15 │     │
│  │ ...                                                  │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## 五、API 设计

### 文章相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/articles/fetch` | 传入 URL，服务端抓取并提取正文，返回文章数据 |
| GET | `/api/articles` | 获取文章列表（支持分页） |
| GET | `/api/articles/:id` | 获取单篇文章详情 |
| DELETE | `/api/articles/:id` | 删除文章 |

### 翻译相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/articles/:id/translate` | 触发翻译（body: `{ type: 'full' \| 'summary' \| 'both' }`） |
| GET | `/api/articles/:id/translations` | 获取已缓存的翻译结果 |

### 收藏相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/articles/:id/bookmark` | 收藏文章 |
| DELETE | `/api/articles/:id/bookmark` | 取消收藏 |
| PATCH | `/api/articles/:id/bookmark` | 更新笔记 |
| GET | `/api/bookmarks` | 获取收藏列表（支持排序、标签筛选、搜索、分页） |

### 标签相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/article-tags` | 获取所有标签 |
| POST | `/api/article-tags` | 创建标签 |
| PATCH | `/api/article-tags/:id` | 更新标签（名称/颜色） |
| DELETE | `/api/article-tags/:id` | 删除标签 |
| POST | `/api/articles/:id/tags` | 为文章添加标签（body: `{ tagIds: number[] }`） |
| PUT | `/api/articles/:id/tags` | 替换文章的全部标签 |

### 聊天相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/articles/:id/chat` | 发送消息并获取 AI 回复（复用 LLM chat 能力） |
| GET | `/api/articles/:id/chats` | 获取文章的聊天历史 |
| DELETE | `/api/articles/:id/chats` | 清空聊天历史 |

## 六、技术要点

| 项目 | 方案 |
|------|------|
| 网页内容提取 | 服务端使用 `@mozilla/readability` + `jsdom` 解析 HTML |
| 翻译 | 复用 `/api/llm/chat`，prompt 区分「逐段翻译」和「概括总结」 |
| 流式响应 | SSE（Server-Sent Events）逐段推送翻译结果 |
| 聊天 | 复用 `/api/llm/chat`，把文章正文注入 system message |
| 分屏拖拽 | CSS `resize` 或轻量拖拽库 |
| 富文本渲染 | `v-html` 渲染 readability 提取的 sanitized HTML |
| HTML 安全 | 使用 `sanitize-html` 清理提取内容，防止 XSS |
| 工具注册 | `registerTool({ id: 'article-reader', name: '文章阅读', ... })` |

## 七、分期规划

### P0 — MVP

- URL 输入 → 服务端提取正文 → 左侧渲染原文
- 右侧完整翻译 + 精简概括（tab 切换）
- 收藏功能（保存原文 + 译文 + 概括）
- 收藏列表展示 + 按时间排序

### P1

- 标签系统（CRUD + 文章打标签 + 按标签筛选）
- AI 聊天面板
- 个人笔记编辑
- 收藏搜索

### P2

- 流式翻译输出
- 分屏拖拽调整宽度
- 选中文本快捷翻译/提问
- 阅读历史（非收藏）
- 手动粘贴正文备选方案
