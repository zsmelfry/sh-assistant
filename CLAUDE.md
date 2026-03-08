# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal assistant web app (个人助手) built with Nuxt 3 (SPA mode) + SQLite. Uses a monochrome black/white design system with JWT authentication for LAN access.

**Tool modules** (ordered by sidebar `order`): Dashboard (今日), Ability Profile (能力画像), Annual Planner (年度计划), Habit Tracker (日历打卡), Project Tracker (事项追踪), Article Reader (文章阅读), Vocab Tracker (法语词汇), Skill Manager (技能管理). Skill-based tools (e.g. Startup Map) are dynamically registered via the Skill Learning Core.

**Xiaoshuang (小爽):** A global AI assistant overlay accessible from any tool, with its own store (`stores/xiaoshuang.ts`) and API at `/api/xiaoshuang/chat`.

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

Tools are self-registering modules under `tools/`. Each tool has:
- `index.ts` — calls `registerTool()` from `composables/useToolRegistry.ts` at import time
- Root `.vue` component — lazy-loaded via `() => import('./Tool.vue')`
- `components/` — tool-specific subcomponents
- `types.ts` — tool-specific types

Registration flow: `plugins/tools.client.ts` → `tools/index.ts` (side-effect imports) → each tool's `index.ts` calls `registerTool(definition)` → stored in module-level `Map`.

**To add a new tool:** Create `tools/my-tool/index.ts` calling `registerTool(...)`, add side-effect import in `tools/index.ts`. Routing is automatic — `pages/[...slug].vue` resolves `slug[0]` as the tool ID.

### Skill Learning Core

A reusable structured learning engine extracted from Startup Map. Any skill tool shares the same DB tables (isolated by `skillId`), API routes (`/api/skills/[skillId]/...`), and UI components.

**To add a new skill tool** (~4 files):
1. Define seed data (`server/database/seeds/my-skill.ts`)
2. Register skill config with AI prompts (`server/lib/skill-learning/skills/my-skill.ts`) + add side-effect import in `server/plugins/skill-learning.ts`
3. Register tool (`tools/my-skill/index.ts`)
4. Create root component (`tools/my-skill/MySkill.vue`) using `createSkillLearningStore(skillId)` + `provide(SKILL_STORE_KEY, store)`

**Key files:**
- `server/lib/skill-learning/` — SkillConfig types, registry, DB helpers, skill configs
- `server/plugins/skill-learning.ts` — Ensures skill registration at server startup
- `composables/skill-learning/` — Store factory (`createSkillLearningStore`), shared types, `SKILL_STORE_KEY`
- `components/skill-learning/` — 22 shared learning UI components (excluded from Nuxt auto-import)

### Server (`server/`)

**API routes** use Nuxt file-based routing with method suffix convention: `index.get.ts`, `toggle.post.ts`, `[id].delete.ts`.

**Middleware chain** (numbered prefixes control execution order):
- `00.cache-control.ts` — Asset cache headers
- `01.log.ts` — Request logging
- `02.auth.ts` — JWT validation (whitelists `/api/_test/*` and `/api/auth/login`)
- `03.test-guard.ts` — Blocks test endpoints in production

**Database:** SQLite via `better-sqlite3` + Drizzle ORM, WAL mode, foreign keys enabled.
- Schema split into files under `server/database/schemas/` (auth, habits, vocab, llm, srs, planner, articles, startup-map)
- Migrations: `server/database/migrations/`
- Singleton connection: `server/database/index.ts` exports `useDB()`
- DB file: `./data/assistant.db` (configurable via `DATABASE_PATH` env var)

**Key API groups:**
- `/api/auth` — Login (JWT, 365-day expiry)
- `/api/habits` + `/api/checkins` — Habit CRUD, checkin management, heatmap/trend data
- `/api/vocab` — Word import/list, progress tracking, SRS spaced repetition
- `/api/planner` — Domains, goals, check items, tags, stats (overview/by-domain/by-tag)
- `/api/articles` + `/api/bookmarks` + `/api/article-tags` — Article fetch/translate/chat, bookmarks, tags
- `/api/ability-skills` + `/api/ability-categories` + `/api/ability-stats` + `/api/skill-templates` — Ability Profile system
- `/api/project-tracker` — Project/task tracking
- `/api/dashboard` + `/api/focus-plans` + `/api/badges` — Dashboard, daily focus plans, badges/gamification
- `/api/xiaoshuang` — Xiaoshuang AI assistant chat
- `/api/skills/[skillId]` — Skill Learning Core: knowledge tree, AI teaching (SSE), AI chat, learning status/stages, practice tasks, notes, recommendations, stats, article linking, activities (hourly dedup), heatmap/streak, seed data import. Data isolated by `skillId` column.
- `/api/skill-configs` — Skill configuration management
- `/api/songs` — Song-related features
- `/api/llm` — Provider CRUD, model discovery, chat, translation
- `/api/_test/reset` — Wipes all tables (used in e2e `beforeEach`, blocked in production)

### Frontend

- **State:** Pinia stores in `stores/` using Composition API style (`defineStore('id', () => { ... })`)
- **Routing:** `pages/index.vue` redirects to first tool; `pages/[...slug].vue` renders the matched tool component; `pages/login.vue` for auth
- **Layout:** `layouts/default.vue` with collapsible sidebar (`AppSidebar.vue`)
- **Styling:** CSS variables in `assets/css/variables.css`, all components use `<style scoped>`
- **Auth:** `composables/useAuth.ts` manages JWT in localStorage; `plugins/auth.client.ts` attaches token to all `$fetch` requests and redirects to `/login` on 401

**Shared composables:**
- `useToolRegistry` — Tool registration/retrieval
- `useAuth` — Login, logout, token management
- `useLlm` — LLM provider management, chat, translation
- `useTts` — Web Speech API wrapper (French voice preference)
- `useIsMobile` — Responsive breakpoint detection (768px)

**Pinia stores** (`stores/`): `habit`, `vocab`, `planner`, `article-reader`, `study`, `ability`, `project-tracker`, `xiaoshuang` (global AI assistant state)

### LLM Integration

Providers are pluggable via `server/lib/llm/`:
- **Claude:** Invokes `claude` CLI via `child_process.spawn` (must be installed and authenticated)
- **Ollama:** REST API at `http://localhost:11434` (must be running locally)
- **OpenAI:** Schema and UI exist but factory throws — not implemented yet

Supports streaming via SSE (used in article translation). Vocab definitions are cached in the `definitions` table (never invalidated).

### Deployment

PM2-based production setup. Config in `ecosystem.config.cjs`, deploy script in `scripts/deploy.sh`.
- Build output: `.output/server/index.mjs`
- DB backups: `./data/backups/` (keeps latest 5)
- Logs: `./logs/pm2-*.log`
- Env: `.env.production.local` for production secrets (`JWT_SECRET`, `DATABASE_PATH`)

## Key Conventions

- **DB access:** Always call `useDB()` inside the handler function, never at module level
- **API error pattern:** Validate input → check existence (throw 404) → then mutate. Use `createError({ statusCode, message })`
- **Timestamps:** Unix milliseconds (integer) for timestamps, `YYYY-MM-DD` strings for dates
- **IDs:** UUID strings for habits/checkins, auto-increment integers for vocab/SRS/planner/articles/startup-map
- **Optimistic updates:** Habit checkin toggling updates UI immediately, then syncs with server
- **Reactivity:** `Set<number>` state (e.g. `selectedWordIds`) must be replaced, not mutated, to trigger Vue reactivity
- **Batch DB operations:** Use synchronous transactions with 500-row chunks
- **CSS:** All colors/spacing/radii reference CSS variables — no hardcoded values. Monochrome palette with `--color-accent: #000000`
- **Language:** UI text is in Chinese; code (variables, comments) is in English
