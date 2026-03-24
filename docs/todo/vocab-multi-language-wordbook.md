# TODO: Vocab-Tracker 多语言词汇本

> Status: PLANNED
> Priority: High
> Complexity: High (~30 files, 6 phases)

## Background

vocab-tracker 当前硬编码法语，无法支持其他语言。需引入"词汇本"概念，每本有独立语言属性，支持多次导入和切换。

## Requirements

- R1: 引入 `wordbooks` 表，每个词汇本有名称、语言、创建时间等属性
- R2: 用户可多次导入，每次创建独立词汇本
- R3: 切换词汇本功能由 admin 开关控制（`multi_wordbook_enabled`）
- R4: 未开启时只能有一本词汇本（保持当前行为）
- R5: LLM prompt、TTS、WordChat 根据词汇本语言动态适配
- R6: 现有法语数据零损失迁移为默认词汇本
- R7: 当前先支持法语和英语，架构可扩展任意语言

## Implementation Plan

### Phase 1: Database Schema & Migration

#### Step 1 — 语言配置注册表 (新建)

**`server/lib/vocab/languages.ts`**
- `LanguageConfig` 接口: displayName, nativeName, ttsLang, translatePromptBuilder, chatPromptBuilder, csvColumnAlias
- `LANGUAGES` map: `fr` 和 `en` 两个条目
- 从 `translate-word.ts` 提取当前法语 prompt 为 builder 函数
- 新增英语 prompt builder

#### Step 2 — wordbooks 表 (修改 schema)

**`server/database/schemas/vocab.ts`**
- 新增 `wordbooks` 表:
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `name` TEXT NOT NULL — 词汇本名称
  - `language` TEXT NOT NULL — 语言代码 'fr', 'en' 等
  - `isActive` INTEGER (boolean) DEFAULT false
  - `wordCount` INTEGER DEFAULT 0 — 冗余缓存词数
  - `createdAt` INTEGER NOT NULL — Unix ms

#### Step 3 — vocab_words 加 wordbookId (修改 schema)

**`server/database/schemas/vocab.ts`**
- `vocab_words` 新增 `wordbookId: integer('wordbook_id').notNull().references(() => wordbooks.id)`
- 新增复合索引 `(wordbook_id, rank)`

#### Step 4 — Migration SQL

**`server/database/migrations/XXXX_wordbooks.sql`**
1. CREATE TABLE `wordbooks`
2. INSERT 默认法语词汇本: `('法语频率词', 'fr', 1, (SELECT COUNT(*) FROM vocab_words), <now_ms>)`
3. ALTER TABLE `vocab_words` ADD COLUMN `wordbook_id` DEFAULT 1
4. UPDATE `vocab_words` SET `wordbook_id` = 1
5. INSERT OR IGNORE INTO `vocab_settings` VALUES ('multi_wordbook_enabled', 'false')

> 风险(中): 需在 DB 备份后执行，deploy 脚本已自动备份

#### Step 5 — Wordbook helpers (新建)

**`server/utils/wordbook-helpers.ts`**
- `getActiveWordbook(db)` — 返回活跃词汇本，无则 404
- `getWordbookById(db, id)` — 按 ID 查
- `setActiveWordbook(db, id)` — 设为活跃，其余置 false
- `isMultiWordbookEnabled(db)` — 读 vocab_settings 开关

### Phase 2: Wordbook CRUD API

| 文件 (新建) | 功能 |
|-------------|------|
| `server/api/vocab/wordbooks/index.get.ts` | 列出所有词汇本 + activeWordbookId |
| `server/api/vocab/wordbooks/index.post.ts` | 创建词汇本（受 feature gate 控制，未开启且已有一本则 403） |
| `server/api/vocab/wordbooks/[id].put.ts` | 重命名词汇本 |
| `server/api/vocab/wordbooks/[id].delete.ts` | 删除词汇本（级联清理 words/progress/SRS/definitions，禁删活跃本和唯一本） |
| `server/api/vocab/wordbooks/[id]/activate.post.ts` | 切换活跃词汇本 |

### Phase 3: 现有 API 加 Wordbook 作用域

所有查询加 `WHERE w.wordbook_id = ?` 过滤:

| 文件 | 改动 |
|------|------|
| `server/api/vocab/words.get.ts` | 按活跃词汇本过滤 word list |
| `server/api/vocab/stats.get.ts` | 统计限定活跃词汇本 |
| `server/api/vocab/progress/chart.get.ts` | 图表数据按词汇本过滤 |
| `server/api/vocab/progress/status.post.ts` | 校验 wordId 归属活跃词汇本 |
| `server/api/vocab/progress/batch.post.ts` | 校验 wordId 归属活跃词汇本 |
| `server/api/vocab/srs/daily-plan.get.ts` | SRS 计划按词汇本过滤 (中风险, JOIN 复杂) |
| `server/api/vocab/srs/overview.get.ts` | SRS 概览按词汇本过滤 |
| `server/api/vocab/srs/rate.post.ts` | 校验 wordId + 动态 activity label |
| `server/api/vocab/definitions/[wordId].get.ts` | 查词汇本语言，传给 translateWord() |
| `server/api/vocab/definitions/[wordId]/regenerate.post.ts` | 同上 |

#### translate-word.ts 参数化 (修改)

**`server/utils/translate-word.ts`**
- `buildTranslateSystemPrompt(language: string)` — 从 languages.ts 获取对应 prompt
- `translateWord()` 新增 `language` 参数
- user message 从 "法语单词" 改为动态语言名

> 风险(中): 已缓存的法语 definitions 不受影响，仅新生成的使用新 prompt

#### words-import.post.ts 重构 (修改, 高风险)

**`server/api/vocab/words-import.post.ts`**
- 新增 body 参数: `{ csv, wordbookName?, language? }`，默认 language='fr'
- 兼容 CSV 列名 `word` 和 `french_word`
- multi_wordbook_enabled=true: 创建新词汇本，保留旧数据
- multi_wordbook_enabled=false: 替换唯一词汇本数据（保持当前行为）
- 新词汇本自动设为活跃

### Phase 4: 前端 UI

#### Step 16 — Vocab Store 扩展

**`stores/vocab.ts`**
- 新增 state: `wordbooks`, `activeWordbookId`, `multiWordbookEnabled`
- 新增 computed: `activeWordbook`
- 新增 actions: `loadWordbooks()`, `switchWordbook(id)`, `createWordbook()`, `deleteWordbook()`
- `initialize()` 中调 `loadWordbooks()`

#### Step 17 — 类型定义

**`tools/vocab-tracker/types.ts`**
- 新增 `Wordbook` 接口: `{ id, name, language, isActive, wordCount, createdAt }`
- 新增 `LanguageOption`: `{ code, displayName }`

#### Step 18 — WordbookSelector 组件 (新建)

**`tools/vocab-tracker/components/WordbookSelector.vue`**
- 下拉/tab 切换所有词汇本
- 显示: 词汇本名称 + 语言标签 + 词数
- "+" 按钮创建新词汇本（表单: 名称 + 语言下拉）
- 仅 `multiWordbookEnabled=true` 时可见

#### Step 19 — VocabTracker 集成

**`tools/vocab-tracker/VocabTracker.vue`**
- 在主 tabs 上方添加 `<WordbookSelector />`
- 切换词汇本后所有子组件通过 store 响应式刷新

#### Step 20 — ImportModal 重构

**`tools/vocab-tracker/components/ImportModal.vue`**
- 新增: 语言选择下拉 + 词汇本名称输入
- 兼容 `word` 和 `french_word` CSV 列名
- multi_wordbook_enabled=false 时隐藏这些字段

#### Step 21 — SpeakButton 语言适配

**`tools/vocab-tracker/components/SpeakButton.vue`**
- 新增 `lang` prop (默认 'fr-FR')
- 父组件从 `store.activeWordbook.language` 映射 TTS locale 传入

#### Step 22 — WordChat 语言适配

**`tools/vocab-tracker/components/WordChat.vue`**
- 新增 `language` prop
- 系统 prompt "法语教学助手" / "法语单词" 改为动态语言名

#### Step 23-24 — FlashCard + 工具注册

- `FlashCard.vue`: 传 lang 给 SpeakButton
- `tools/vocab-tracker/index.ts`: 工具名 '法语词汇' → '词汇学习' (产品决策)

### Phase 5: 跨模块适配

| 文件 | 改动 |
|------|------|
| `composables/useTts.ts` | 按语言选择 preferred voices (英语: Alex, Samantha 等) |
| `tools/dashboard/components/TodayAgenda.vue` | "法语词汇复习" → 动态语言标签 |
| `server/api/vocab/srs/rate.post.ts` | activity label 动态化 |
| `server/lib/coach/context-builder.ts` | "法语词汇" 引用动态化 |

### Phase 6: Testing

- 更新 `e2e/vocab-tracker.spec.ts` 和 `e2e/vocab-study.spec.ts` (侧边栏名称 + 导入流程变更)
- 新增 `e2e/vocab-wordbooks.spec.ts`:
  - 导入创建词汇本
  - 多词汇本切换
  - 删除词汇本
  - Feature gate 关闭时限制

## Key Design Decisions

- **definitions 不加 wordbookId** — 通过 wordId → vocab_words → wordbookId 间接关联，无缓存冲突
- **progress / srs_cards 不加冗余 wordbookId** — 通过 JOIN vocab_words 过滤，避免反范式化
- **studySessions 暂不分词汇本** — 全局统计学习量，后续按需扩展
- **multi_wordbook 关闭时** — 导入替换式（保持当前行为），UI 不显示切换器

## Risk Matrix

| Risk | Level | Mitigation |
|------|-------|-----------|
| 迁移损坏数据 | Medium | deploy 自动备份；先建表再加列 |
| SRS 查询性能 | Low | wordbookId 有索引，现有查询已有 JOIN |
| 导入行为变更 | High | feature gate 关闭时完全保持旧行为 |
| 定义缓存冲突 | None | 不同词汇本同词有不同 wordId |

## Files Summary

**新建 (~10 files):**
- `server/lib/vocab/languages.ts`
- `server/utils/wordbook-helpers.ts`
- `server/api/vocab/wordbooks/index.get.ts`
- `server/api/vocab/wordbooks/index.post.ts`
- `server/api/vocab/wordbooks/[id].put.ts`
- `server/api/vocab/wordbooks/[id].delete.ts`
- `server/api/vocab/wordbooks/[id]/activate.post.ts`
- `tools/vocab-tracker/components/WordbookSelector.vue`
- Migration SQL

**修改 (~20 files):**
- `server/database/schemas/vocab.ts` (schema)
- `server/utils/translate-word.ts` (语言参数化)
- `server/api/vocab/words-import.post.ts` (词汇本创建)
- `server/api/vocab/words.get.ts`, `stats.get.ts`, `progress/*.ts`, `srs/*.ts` (作用域过滤)
- `server/api/vocab/definitions/[wordId].get.ts`, `regenerate.post.ts` (语言查找)
- `stores/vocab.ts` (wordbook state)
- `tools/vocab-tracker/types.ts`, `VocabTracker.vue`, `ImportModal.vue`
- `tools/vocab-tracker/components/SpeakButton.vue`, `WordChat.vue`, `FlashCard.vue`
- `composables/useTts.ts` (多语言 voices)
- `tools/dashboard/components/TodayAgenda.vue` (动态 label)
- `tools/vocab-tracker/index.ts` (工具名)
