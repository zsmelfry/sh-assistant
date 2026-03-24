#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
USERS_DIR="$DATA_DIR/users"
ADMIN_DB="$DATA_DIR/admin.db"

echo "=== [entrypoint] Ensuring data directories ==="
mkdir -p "$DATA_DIR" "$USERS_DIR" "$DATA_DIR/backups"

# ── 1. Migrate Admin DB ──
echo "=== [entrypoint] Migrating admin.db ==="
ADMIN_DB_PATH="$ADMIN_DB" npx drizzle-kit migrate --config drizzle-admin.config.ts

# ── 2. Migrate all User DBs ──
echo "=== [entrypoint] Migrating user DBs ==="
if [ -d "$USERS_DIR" ] && [ "$(ls -A "$USERS_DIR"/*.db 2>/dev/null)" ]; then
  npx tsx deployment/scripts/migrate-user-dbs.ts
else
  echo "No user DBs found — skipping user migration."
fi

# ── 3. Seed admin user (first deploy only) ──
if [ -n "${SEED_USERNAME:-}" ] && [ -n "${SEED_PASSWORD:-}" ]; then
  echo "=== [entrypoint] Seeding admin user ==="
  npx tsx deployment/scripts/seed-user.ts "$SEED_USERNAME" "$SEED_PASSWORD"
fi

# ── 4. Start Nuxt server ──
echo "=== [entrypoint] Starting server ==="
exec node .output/server/index.mjs
