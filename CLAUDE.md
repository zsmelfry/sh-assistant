# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal assistant web app (个人助手) built with Nuxt 3 (SPA mode) + SQLite. Currently has two tool modules: **Habit Tracker** (日历打卡) and **Vocab Tracker** (法语词汇学习). The app uses a monochrome black/white design system.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run preview      # Preview production build

# Database (Drizzle ORM + SQLite)
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio GUI

# E2E Tests (Playwright)
npx playwright test                    # Run all tests (starts dev server automatically)
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

### Server (`server/`)

**API routes** use Nuxt file-based routing with method suffix convention: `index.get.ts`, `toggle.post.ts`, `[id].delete.ts`.

**Database:** SQLite via `better-sqlite3` + Drizzle ORM, WAL mode, foreign keys enabled.
- Schema: `server/database/schema.ts`
- Migrations: `server/database/migrations/`
- Singleton connection: `server/database/index.ts` exports `useDB()`
- DB file: `./data/assistant.db` (configurable via `DATABASE_PATH` env var)

**Key API groups:**
- `/api/habits` + `/api/checkins` — Habit CRUD and checkin management
- `/api/vocab` — User management, word import/list, progress tracking, SRS spaced repetition
- `/api/llm` — Provider CRUD, model discovery, chat, and French→Chinese translation
- `/api/_test/reset` — Wipes all tables (used in e2e `beforeEach`)

### Frontend

- **State:** Pinia stores in `stores/` using Composition API style (`defineStore('id', () => { ... })`)
- **Routing:** `pages/index.vue` redirects to first tool; `pages/[...slug].vue` renders the matched tool component
- **Layout:** `layouts/default.vue` with collapsible sidebar (`AppSidebar.vue`)
- **Styling:** CSS variables in `assets/css/variables.css`, all components use `<style scoped>`

### LLM Integration

Providers are pluggable via `server/lib/llm/`:
- **Claude:** Invokes `claude` CLI via `child_process.spawn` (must be installed and authenticated)
- **Ollama:** REST API at `http://localhost:11434` (must be running locally)
- **OpenAI:** Schema and UI exist but factory throws — not implemented yet

LLM vocab definitions are cached in the `definitions` table (never invalidated).

## Key Conventions

- **DB access:** Always call `useDB()` inside the handler function, never at module level
- **API error pattern:** Validate input → check existence (throw 404) → then mutate. Use `createError({ statusCode, message })`.
- **Timestamps:** Unix milliseconds (integer) for timestamps, `YYYY-MM-DD` strings for dates
- **IDs:** UUID strings for habits/checkins, auto-increment integers for vocab/SRS tables
- **Optimistic updates:** Habit checkin toggling updates UI immediately, then syncs with server
- **Reactivity:** `Set<number>` state (e.g. `selectedWordIds`) must be replaced, not mutated, to trigger Vue reactivity
- **Batch DB operations:** Use synchronous transactions with 500-row chunks
- **CSS:** All colors/spacing/radii reference CSS variables — no hardcoded values. Monochrome palette with `--color-accent: #000000`
- **Language:** UI text is in Chinese; code (variables, comments) is in English
