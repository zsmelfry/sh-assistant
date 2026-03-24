# TODO: 例句兴趣语境可配置化

> Status: PLANNED
> Priority: Medium
> Complexity: Low (~6 files)

## Background

`server/utils/translate-word.ts` 第16行硬编码"足球"作为 LLM 生成第3个例句的语境偏好。需改为用户可配置。

## Requirements

- 用户可在 vocab 设置中配置兴趣语境（如"烹饪"、"音乐"、"游戏"）
- 新生成的例句第3句会尝试使用该语境
- 已缓存的释义不受影响（用户可手动 regenerate）
- 安全：防 prompt injection，限制长度和字符

## Implementation Plan

### Phase 1: Backend

#### Step 1 — translate-word.ts (修改)

- `buildTranslateSystemPrompt(interestContext?: string)` 接收可选参数
- 默认值 `'足球'`（向后兼容）
- 拼接: `第3个例句如果这个词能自然地用在${interest}语境中...`
- `translateWord()` options 新增 `interestContext?: string`

#### Step 2 — 新建 vocab settings API

**`server/api/vocab/settings.get.ts`**
- 返回 `vocab_settings` 全部 KV pairs

**`server/api/vocab/settings.put.ts`**
- Body: `{ key: string, value: string }`
- 校验规则:
  - `key` 白名单: `['example_interest_context']`
  - `value` 长度 <= 20 字符
  - `value` 字符白名单: `/^[\u4e00-\u9fff\w\s]*$/` (中英文、数字、空格)
  - 空值允许（表示恢复默认"足球"）

#### Step 3 — definitions API (修改)

- `server/api/vocab/definitions/[wordId].get.ts`: 读 `example_interest_context` setting，传给 `translateWord()`
- `server/api/vocab/definitions/[wordId]/regenerate.post.ts`: 同上

### Phase 2: Frontend

#### Step 4 — stores/vocab.ts (修改)

- 新增 state: `interestContext: ref('')`
- 新增 action: `loadSettings()`, `updateInterestContext(value: string)`

#### Step 5 — Settings UI

在 VocabTracker 中添加设置入口（可在现有 UI 中找合适位置，如顶部工具栏或设置 modal）:
- 输入框 label: "例句兴趣语境"
- Placeholder: "例如：足球、烹饪、音乐、旅行"
- 前端校验: maxlength=20
- 保存提示: "设置后新生成的例句会尝试使用该语境，已有释义需手动刷新"

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Prompt injection | 字符白名单 (中英文+数字+空格) + 长度限制 20 字 |
| Key 篡改 | 服务端 key 白名单，只允许 `example_interest_context` |
| XSS | 值仅拼入 LLM prompt，前端通过 {{ }} 渲染（Vue 自动转义） |

## Files to Change

| File | Action |
|------|--------|
| `server/utils/translate-word.ts` | 修改 — prompt 参数化 |
| `server/api/vocab/settings.get.ts` | 新建 |
| `server/api/vocab/settings.put.ts` | 新建 |
| `server/api/vocab/definitions/[wordId].get.ts` | 修改 — 读 setting 传参 |
| `server/api/vocab/definitions/[wordId]/regenerate.post.ts` | 修改 — 读 setting 传参 |
| `stores/vocab.ts` | 修改 — settings state/actions |
| `tools/vocab-tracker/` (UI component) | 修改 — 设置入口 |

## Notes

- 已缓存的释义不会自动更新，用户需对感兴趣的词手动点 regenerate
- 默认值"足球"保持向后兼容，空值等同默认
- `vocab_settings` 表已存在，无需 migration
