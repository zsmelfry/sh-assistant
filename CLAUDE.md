# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal assistant web app (个人助手) built with Nuxt 3 (SPA mode) + SQLite. Uses a monochrome black/white design system with multi-user support, module-level permissions, and JWT authentication for LAN access.

**Tool modules** (ordered by sidebar `order`): Dashboard (今日, 0), Ability Profile (能力画像, 1), Vocab Tracker (法语词汇, 2), Annual Planner (年度计划, 3), Project Tracker (事项追踪, 4), Article Reader (文章阅读, 5), Skill Manager (技能管理, ∞), Admin (用户管理, 100). Skill-based tools are dynamically registered via the Skill Learning Core.

**Xiaoshuang (小爽):** A global AI assistant overlay accessible from any tool, with its own store (`src/stores/xiaoshuang.ts`) and API at `/api/xiaoshuang/chat`.

## Directory Structure

```
├── src/                    # App source (Nuxt srcDir)
│   ├── app.vue
│   ├── assets/             # CSS variables, static assets
│   ├── components/         # Shared Vue components
│   ├── composables/        # Vue composables (auto-imported)
│   ├── layouts/            # Nuxt layouts
│   ├── middleware/          # Client-side route middleware
│   ├── pages/              # File-based routing
│   ├── plugins/            # Nuxt plugins
│   ├── server/             # Nitro server (API routes, DB, middleware)
│   ├── stores/             # Pinia stores
│   ├── tools/              # Tool plugin modules
│   ├── types/              # TypeScript types
│   └── utils/              # Shared utilities
├── deployment/             # Deployment & ops
│   ├── Dockerfile
│   ├── docker-compose.local.yml
│   ├── ecosystem.config.cjs  # PM2 config
│   ├── entrypoint.sh
│   ├── render.yaml
│   ├── scripts/            # deploy.sh, migrate, seed scripts
│   └── README.md
├── e2e/                    # Playwright E2E tests
├── docs/                   # Documentation
├── public/                 # Static assets (served at /)
├── nuxt.config.ts          # Nuxt config (srcDir: 'src')
├── drizzle.config.ts       # Drizzle user DB config
├── drizzle-admin.config.ts # Drizzle admin DB config
├── playwright.config.ts    # Playwright config
├── package.json
└── tsconfig.json
```

**Gitignored runtime data:** `data/` (production DBs), `data-dev/` (dev DBs), `logs/` (PM2), `test-results/` (Playwright), `.nuxt/`, `.output/`, `node_modules/`

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000, binds 0.0.0.0)
npm run build        # Production build
npm run deploy       # Full deploy: build + DB backup + migrate + PM2 restart

# Database (Drizzle ORM + SQLite)
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio GUI
npm run db:seed-user # Create initial user (reads .env)

# Production (PM2)
npm run prod:start   # Start PM2 process
npm run prod:stop    # Stop PM2 process
npm run prod:logs    # View PM2 logs

# E2E Tests (Playwright)
npx playwright test                    # Run all tests (auto-starts dev server)
npx playwright test e2e/habit-tracker  # Run single test file
npx playwright test -g "test name"     # Run test by name
```

## Architecture

### Tool Plugin System

Tools are self-registering modules under `src/tools/`. Each tool has:
- `index.ts` — calls `registerTool()` from `src/composables/useToolRegistry.ts` at import time
- Root `.vue` component — lazy-loaded via `() => import('./Tool.vue')`
- `components/` — tool-specific subcomponents
- `types.ts` — tool-specific types

Registration flow: `src/plugins/tools.client.ts` → `src/tools/index.ts` (side-effect imports) → each tool's `index.ts` calls `registerTool(definition)` → stored in module-level `Map`.

**To add a new tool:** Create `src/tools/my-tool/index.ts` calling `registerTool(...)`, add side-effect import in `src/tools/index.ts`. Routing is automatic — `src/pages/[...slug].vue` resolves `slug[0]` as the tool ID.

### Skill Learning Core

A reusable structured learning engine. Any skill tool shares the same DB tables (isolated by `skillId`), API routes (`/api/skills/[skillId]/...`), and UI components.

**To add a new skill tool** (~4 files):
1. Define seed data (`src/server/database/seeds/my-skill.ts`)
2. Register skill config with AI prompts (`src/server/lib/skill-learning/skills/my-skill.ts`) + add side-effect import in `src/server/plugins/skill-learning.ts`
3. Register tool (`src/tools/my-skill/index.ts`)
4. Create root component (`src/tools/my-skill/MySkill.vue`) using `createSkillLearningStore(skillId)` + `provide(SKILL_STORE_KEY, store)`

**Key files:**
- `src/server/lib/skill-learning/` — SkillConfig types, registry, DB helpers, skill configs
- `src/server/plugins/skill-learning.ts` — Ensures skill registration at server startup
- `src/composables/skill-learning/` — Store factory (`createSkillLearningStore`), shared types, `SKILL_STORE_KEY`
- `src/components/skill-learning/` — 22 shared learning UI components (excluded from Nuxt auto-import)

### Server (`src/server/`)

**API routes** use Nuxt file-based routing with method suffix convention: `index.get.ts`, `toggle.post.ts`, `[id].delete.ts`.

**Middleware chain** (numbered prefixes control execution order):
- `00.cache-control.ts` — Asset cache headers
- `00.security-headers.ts` — CSP, X-Frame-Options, X-Content-Type-Options, etc.
- `01.log.ts` — Request logging
- `02.auth.ts` — JWT validation + role/module caching (60s TTL, whitelists `/api/_test/*` and `/api/auth/login`)
- `03.test-guard.ts` — Blocks test endpoints in production
- `04.module-guard.ts` — Enforces module permissions (namespace → moduleId reverse lookup via `MODULE_NAMESPACE_MAP`)

**Database:** Multi-user SQLite via `better-sqlite3` + Drizzle ORM, WAL mode, foreign keys enabled.
- **Admin DB** (`data/admin.db`): Users + module permissions only. Schema: `src/server/database/admin-schema.ts`. Access: `useAdminDB()`
- **User DBs** (`data/users/{username}.db`): All feature data per user. Schema: `src/server/database/schema.ts`. Access: `useDB(event)` or `useUserDB(username)`
- **Legacy fallback**: `useDB()` without event still works (returns singleton `data/assistant.db`), will be removed
- User DB connections use LRU cache (max=20, ttl=5min)
- Schema files: `src/server/database/schemas/` — habits, vocab, llm, srs, planner, articles, startup-map, skill-configs, project-tracker, ability, dashboard, music-ear, auth (13 files)
- Migrations: `src/server/database/migrations/` (user, 27+), `src/server/database/admin-migrations/` (admin)
- **New tool module must**: Update `MODULE_NAMESPACE_MAP` in `src/server/utils/module-ids.ts`

**Module permission map** (`src/server/utils/module-ids.ts`):
- `dashboard` → dashboard, badges
- `ability-profile` → ability-skills, ability-categories, ability-stats, skill-templates
- `habit-tracker` → habits, checkins
- `annual-planner` → planner
- `vocab-tracker` → vocab
- `article-reader` → articles, bookmarks, article-tags
- `project-tracker` → project-tracker
- `skill-manager` → skill-configs, skills
- `xiaoshuang` → xiaoshuang
- Exception paths (skip module guard): `/api/admin/`, `/api/auth/`, `/api/_test/`, `/api/llm/`, `/api/songs/`

**Key API groups:**
- `/api/auth` — Login (JWT, 365-day expiry)
- `/api/admin` — User CRUD + module permissions
- `/api/habits` + `/api/checkins` — Habit CRUD, checkin management, heatmap/trend data
- `/api/vocab` — Word import/list, progress tracking, SRS spaced repetition
- `/api/planner` — Domains, goals, check items, tags, stats (overview/by-domain/by-tag)
- `/api/articles` + `/api/bookmarks` + `/api/article-tags` — Article fetch/translate/chat, bookmarks, tags
- `/api/ability-skills` + `/api/ability-categories` + `/api/ability-stats` + `/api/skill-templates` — Ability Profile system
- `/api/project-tracker` — Project/task tracking
- `/api/dashboard` + `/api/badges` — Dashboard, badges/gamification
- `/api/xiaoshuang` — Xiaoshuang AI assistant chat
- `/api/skills/[skillId]` — Skill Learning Core: knowledge tree, AI teaching (SSE), AI chat, learning status/stages, practice tasks, notes, recommendations, stats, article linking, activities (hourly dedup), heatmap/streak, seed data import. Data isolated by `skillId` column.
- `/api/skill-configs` — Skill configuration management
- `/api/songs` — Music Ear skill tool data
- `/api/llm` — Provider CRUD, model discovery, chat, translation
- `/api/_test/reset` — Wipes all tables (used in e2e `beforeEach`, blocked in production)

### Frontend

- **State:** Pinia stores in `src/stores/` using Composition API style (`defineStore('id', () => { ... })`)
- **Routing:** `src/pages/index.vue` redirects to first tool; `src/pages/[...slug].vue` renders the matched tool component; `src/pages/login.vue` for auth
- **Layout:** `src/layouts/default.vue` with collapsible sidebar (`AppSidebar.vue`) + mobile bottom nav (`MobileBottomNav.vue`)
- **Styling:** CSS variables in `src/assets/css/variables.css`, all components use `<style scoped>`
- **Auth:** `src/composables/useAuth.ts` manages JWT in localStorage; `src/plugins/auth.client.ts` attaches token to all `$fetch` requests and redirects to `/login` on 401

**Shared composables:**
- `useToolRegistry` — Tool registration/retrieval
- `useAuth` — Login, logout, token management
- `useLlm` — LLM provider management, chat, translation
- `useTts` — Web Speech API wrapper (French voice preference)
- `useIsMobile` — Responsive breakpoint detection (768px)
- `useModulePermissions` — Module access control for current user
- `useMarkdown` — Markdown rendering utility
- `useAbilitySkillOptions` — Ability Profile skill option helpers

**Pinia stores** (`src/stores/`): `dashboard`, `habit`, `vocab`, `planner`, `article-reader`, `study`, `ability`, `project-tracker`, `xiaoshuang` (global AI assistant state)

### LLM Integration

Providers are pluggable via `src/server/lib/llm/`:
- **Claude CLI:** Invokes `claude` CLI via `child_process.spawn` (must be installed and authenticated)
- **Claude API:** REST API via Anthropic API (requires API key, encrypted in DB)
- **Gemini:** REST API (free tier, supports gemini-2.5-flash / flash-lite)
- **Ollama:** REST API at `http://localhost:11434` (must be running locally)

Supports streaming via SSE (used in article translation, AI teaching). Vocab definitions are cached in the `definitions` table (never invalidated).

### Deployment

All deployment configs live in `deployment/`. PM2-based production setup with Docker option for Render.
- PM2 config: `deployment/ecosystem.config.cjs`
- Deploy script: `deployment/scripts/deploy.sh`
- Docker: `deployment/Dockerfile` + `deployment/render.yaml`
- Build output: `.output/server/index.mjs`
- DB backups: `./data/backups/` (keeps latest 5)
- Logs: `./logs/pm2-*.log`
- Env: `.env.production.local` for production secrets (`JWT_SECRET`, `DATA_DIR`)
- Deploy script handles: build → legacy migration check → backup → migrate admin DB → migrate user DBs → PM2 restart

## Key Conventions

- **DB access:** Always call `useDB(event)` inside the handler function, never at module level. Use `useAdminDB()` only for auth/admin operations. Lib functions receive `db` as parameter from caller.
- **API error pattern:** Validate input → check existence (throw 404) → then mutate. Use `createError({ statusCode, message })`
- **Timestamps:** Unix milliseconds (integer) for timestamps, `YYYY-MM-DD` strings for dates
- **IDs:** UUID strings for habits/checkins, auto-increment integers for all other modules
- **Optimistic updates:** Habit checkin toggling updates UI immediately, then syncs with server
- **Reactivity:** `Set<number>` state (e.g. `selectedWordIds`) must be replaced, not mutated, to trigger Vue reactivity
- **Batch DB operations:** Use synchronous transactions with 500-row chunks
- **CSS:** All colors/spacing/radii reference CSS variables — no hardcoded values. Monochrome palette with `--color-accent: #000000`
- **Language:** UI text is in Chinese; code (variables, comments) is in English

<!-- stickymind -->
## StickyMind — Persistent Memory

This project uses StickyMind for persistent session memory across context resets.

- **Before starting ANY task**: call `read_latest_session_memory` and `search_project_memory`
- **After completing ANY task** (code changes, analysis, research, debugging, investigation, planning): call `write_session_memory` with structured bullet-style entries — if you learned something or produced a result, write it to memory
- **Proactive memory writes**: even in conversation-only sessions (no file edits), write session memory when your work produces significant findings — e.g., a code review surfacing bugs, an analysis revealing new technical knowledge, discovery of business rules, or architectural observations. Use your judgement: if the insight would be valuable in a future session, persist it.
- **Outcome lifecycle**: every entry starts as `pending` — always call `update_memory_entry` to set the final outcome (`success`, `rejected`, or `superseded`)
- **Before debugging**: call `search_solutions` to check if a similar problem was already solved
- **Before editing a file**: call `get_file_knowledge` to understand its purpose and gotchas
- **Before making architectural decisions**: call `search_decisions` to check past decisions
- **For implementation decisions** (why you chose approach X over Y): use the `rationale` field on `write_session_memory` — these are auto-extracted into the decision log
- **Before implementing business logic**: call `search_business_rules` or `get_domain_rules`
- **When you discover domain/business rules** — whether implementing new logic, reading existing code, or auditing a flow — call `log_business_rule` with domain, rule_name, description, conditions, and outcomes. If the rule already exists, call `update_business_rule` instead. Do NOT put domain rules in the `rationale` field — that's for implementation decisions only.
- **When you understand a file's role**: include `file_knowledge` in your `write_session_memory` call with purpose, dependencies, and gotchas — this populates the knowledge layer at zero extra cost
- **Delegation**: when the user says "agent", "delegate", "ask gemini/cursor", or "use another model" — ALWAYS use `run_agent` MCP tool to call the external agent. "Available agents" means Gemini/Cursor via `run_agent`, NOT built-in Claude Code subagents. Never use a subagent to do delegated work directly. Call `list_available_models` to discover available models.
- **Project ID**: `个人助手`
- **Your agent_id**: `orchestrator`
- Agents write their OWN memory with their own `agent_id`
- Always pass `task_id` when available, and `files_touched` with modified file paths

### Real-Time Alerts (Channels)

StickyMind pushes real-time events directly into your session via `<channel source="stickymind">` tags. No background watcher agents needed — alerts arrive automatically when:

- **Watcher alerts** (security/quality/architecture): detected by semantic embedding matching on agent memory writes. When you see `<channel source="stickymind" category="..." event_type="..." ...>`, review the alert, take action if needed, and call `resolve_alert` to close it.
- **Brainstorm rounds** (`type=brainstorm_round`): agent critiques from an interactive brainstorm. Discuss with the user, optionally write your perspective to shared context (`set_shared_context` with key `brainstorm_round_{round}_orchestrator`), then call `continue_brainstorm` to proceed. **NOTE**: The `brainstorm` tool blocks — always call it from a background subagent (Agent tool with `run_in_background=true`), never directly. After completion, individual per-round keys are cleaned up — use `get_shared_context(key="brainstorm_results")` for the full output.

- **Escalations** (event_type=agent.agent_escalated): a delegated agent couldn't complete its task and needs help. Before asking the user, triage it yourself: check `search_project_memory`, `get_file_knowledge`, `search_business_rules`, and `search_solutions`. Only escalate to the user if you genuinely can't resolve it.

**Alert lifecycle**: acknowledge (seen) → resolve (fixed, with reason). Never ignore critical alerts. Use `get_recent_alerts(unresolved_only=true)` to check what's outstanding.
