# UI-Driven Skill Learning System

## Context

Currently adding a new skill requires 4+ code file changes. Goal: fully UI-driven skill creation. Also migrate startup-map to the same DB-driven pattern (no code-defined skills remain). A seed script reinitializes startup-map data.

## Plan

### Phase 1: DB Schema + Template Engine

**1.1 New `skill_configs` table** — `server/database/schemas/skill-configs.ts`

```
skill_configs:
  id              INTEGER PK autoIncrement
  skillId         TEXT UNIQUE NOT NULL     -- URL slug, e.g. 'startup-map'
  name            TEXT NOT NULL            -- '创业地图'
  description     TEXT
  icon            TEXT DEFAULT 'BookOpen'  -- Lucide icon name
  teachingSystemPrompt  TEXT NOT NULL      -- {{variable}} template
  teachingUserPrompt    TEXT NOT NULL
  chatSystemPrompt      TEXT NOT NULL
  taskSystemPrompt      TEXT NOT NULL
  taskUserPrompt        TEXT NOT NULL
  sortOrder       INTEGER DEFAULT 100
  isActive        BOOLEAN DEFAULT true
  createdAt       INTEGER NOT NULL
  updatedAt       INTEGER NOT NULL
```

- Export from `server/database/schema.ts`, generate + apply migration

**1.2 Template renderer** — `server/lib/skill-learning/template.ts`

Simple `{{path.to.var}}` string replacement. Variables: `skill.name`, `skill.description`, `domain.name`, `topic.name`, `point.name`, `point.description`, `teachingSummary`.

**1.3 Rewrite `resolveSkill()`** — `server/lib/skill-learning/db-helpers.ts`

Query `skill_configs` table instead of in-memory Map. Add `buildSkillConfigFromDb(row)` that synthesizes `SkillConfig` using `renderTemplate()`. Teaching sections, status/activity labels are universal defaults.

**1.4 Startup-map seed script** — `server/database/seeds/startup-map-config.ts`

Creates the `skill_configs` row for startup-map with its prompt templates (extracted from current `skills/startup-map.ts`). Can be run via `POST /api/skill-configs/seed` or a DB seed command. The existing `server/database/seeds/startup-map.ts` (domain/topic/point data) stays as-is — it's imported via `POST /api/skills/startup-map/seed` after the config exists.

**1.5 Remove code-defined skill system**

Delete:
- `server/lib/skill-learning/skills/startup-map.ts`
- `server/lib/skill-learning/registry.ts` (registerSkill/getSkill/requireSkill Map)
- `server/lib/skill-learning/init.ts` (ensureSkillsRegistered)
- `server/plugins/skill-learning.ts` (side-effect imports)

Simplify `server/lib/skill-learning/index.ts` to only export DB-based helpers.

### Phase 2: API Endpoints

**2.1 Skill config CRUD** — `server/api/skill-configs/`

| Route | Purpose |
|-------|---------|
| `GET /api/skill-configs` | List all configs |
| `POST /api/skill-configs` | Create new skill config |
| `GET /api/skill-configs/[id]` | Get single config |
| `PUT /api/skill-configs/[id]` | Update config |
| `DELETE /api/skill-configs/[id]` | Delete config + cascade all `sm_*` data for that skillId |
| `POST /api/skill-configs/seed` | Seed built-in configs (startup-map) — idempotent |

Validation: `skillId` must be unique, valid URL slug.

**2.2 AI tree generation** — `POST /api/skill-configs/generate-tree`

Input: `{ name, description }`. Calls LLM to design knowledge tree (5-10 domains, 2-4 topics each, 2-5 points each, 4-8 stages). Returns `{ domains: SeedDomain[], stages: SeedStage[] }`.

**2.3 Modify seed endpoint** — `server/api/skills/[skillId]/seed.post.ts`

Currently reads `config.seedData` from code. Change to accept seed data from request body OR from `skill_configs.seedDataJson` if no body provided. This way both the wizard (sends JSON body) and the "导入知识树" button (uses stored seed) work.

Actually simpler: the wizard saves seed data to `sm_*` tables directly during creation (same transaction). The existing `seed.post.ts` continues to work for the "导入知识树" button — just read seed data from the request body instead of `config.seedData`.

### Phase 3: Generic Frontend Component + Dynamic Registration

**3.1 `GenericSkillTool.vue`** — `tools/skill-learning/GenericSkillTool.vue`

Receives `skillId` as prop. Creates store via `createSkillLearningStore(skillId)`, provides via `SKILL_STORE_KEY`. Renders: breadcrumb + `GlobalView` / `DomainDetail` / `PointPage`.

**3.2 Dynamic tool registration** — `plugins/tools.client.ts`

Remove static `import '~/tools/startup-map'`. Instead:
1. Keep static imports for non-skill tools (habit-tracker, vocab-tracker, annual-planner, article-reader)
2. After static imports, fetch `GET /api/skill-configs` (with auth token)
3. Register each skill config as a tool using `GenericSkillTool.vue` + icon from curated Lucide map
4. Also call this after login to handle the not-logged-in-yet case

**3.3 Remove startup-map tool files**

Delete:
- `tools/startup-map/` (entire directory — index.ts, StartupMap.vue, components/, types.ts)
- `stores/startup-map.ts` (product store — products feature dropped from skill tools)
- Remove startup-map import from `tools/index.ts`

The startup-map product APIs (`server/api/startup-map/products/`) and `sm_products` table can be removed too since product features are not part of the generic skill system.

### Phase 4: Skill Builder UI

**4.1 New "技能管理" tool** — `tools/skill-manager/`

| File | Purpose |
|------|---------|
| `index.ts` | registerTool (static, in sidebar) |
| `SkillManager.vue` | Root: list view + creation |
| `components/SkillList.vue` | Grid of existing skills with edit/delete |
| `components/SkillWizard.vue` | 3-step creation wizard |
| `components/TreeEditor.vue` | Edit domains/topics/points/stages tree |
| `components/PromptEditor.vue` | Edit prompt templates with variable chips |
| `components/IconPicker.vue` | Grid of ~30 curated Lucide icons |

**4.2 Wizard flow:**

1. **Basic Info**: name, description, icon → click "AI 生成知识树"
2. **Knowledge Tree**: AI-generated tree in editable form (add/remove/rename nodes). Stages section with point assignment. "重新生成" to retry.
3. **Prompt Templates**: pre-filled defaults, editable textareas, clickable `{{variable}}` chips

**Save**: POST skill_configs → seed knowledge tree → register tool in sidebar → navigate to new skill.

### Files to Create

| File | Purpose |
|------|--------|
| `server/database/schemas/skill-configs.ts` | New schema |
| `server/lib/skill-learning/template.ts` | renderTemplate() |
| `server/database/seeds/startup-map-config.ts` | Startup-map skill_config seed data |
| `server/api/skill-configs/index.get.ts` | List configs |
| `server/api/skill-configs/index.post.ts` | Create config |
| `server/api/skill-configs/[id].get.ts` | Get config |
| `server/api/skill-configs/[id].put.ts` | Update config |
| `server/api/skill-configs/[id].delete.ts` | Delete config + cascade |
| `server/api/skill-configs/seed.post.ts` | Seed built-in configs |
| `server/api/skill-configs/generate-tree.post.ts` | AI tree generation |
| `tools/skill-learning/GenericSkillTool.vue` | Generic root component |
| `tools/skill-manager/index.ts` | Tool registration |
| `tools/skill-manager/SkillManager.vue` | Root component |
| `tools/skill-manager/components/SkillList.vue` | Skill list |
| `tools/skill-manager/components/SkillWizard.vue` | Creation wizard |
| `tools/skill-manager/components/TreeEditor.vue` | Tree editor |
| `tools/skill-manager/components/PromptEditor.vue` | Prompt editor |
| `tools/skill-manager/components/IconPicker.vue` | Icon picker |

### Files to Modify

| File | Change |
|------|--------|
| `server/database/schema.ts` | Add skillConfigs export |
| `server/lib/skill-learning/db-helpers.ts` | Rewrite resolveSkill() to use DB |
| `server/lib/skill-learning/index.ts` | Remove registry exports, simplify |
| `server/api/skills/[skillId]/seed.post.ts` | Read seed from request body |
| `plugins/tools.client.ts` | Add dynamic skill registration |
| `tools/index.ts` | Remove startup-map import, add skill-manager import |

### Files to Delete

| File | Reason |
|------|--------|
| `server/lib/skill-learning/skills/startup-map.ts` | Moved to DB |
| `server/lib/skill-learning/registry.ts` | No longer needed |
| `server/lib/skill-learning/init.ts` | No longer needed |
| `server/plugins/skill-learning.ts` | No longer needed |
| `tools/startup-map/` (entire dir) | Replaced by GenericSkillTool |
| `stores/startup-map.ts` | Product store no longer needed |
| `server/api/startup-map/` (entire dir) | Product APIs removed |

### Verification

1. Run seed to create startup-map config: `POST /api/skill-configs/seed`
2. Seed startup-map knowledge tree: `POST /api/skills/startup-map/seed`
3. Verify startup-map works via GenericSkillTool (browse domains, generate teaching, chat)
4. Create a new skill via wizard (e.g. "烹饪技能")
5. Verify AI generates knowledge tree, edit it, save
6. New skill appears in sidebar, learning works end-to-end
7. Delete the test skill, verify cleanup
