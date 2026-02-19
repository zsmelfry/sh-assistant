#!/usr/bin/env bash
set -euo pipefail

PROD_DB="./data/assistant.db"
BACKUP_DIR="./data/backups"
JOURNAL="./server/database/migrations/meta/_journal.json"

echo "=== 1/6 Stopping dev server ==="
# Kill any running Nuxt dev server to prevent it from overwriting
# the production manifest in .nuxt/dist/server/ with dev-mode entries.
# (The dev server watches .nuxt/ and will clobber client.manifest.mjs
#  during the build, causing the production HTML to reference
#  non-existent @vite/client paths → white screen.)
DEV_PIDS=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$DEV_PIDS" ]; then
  echo "Killing dev server (PIDs: $DEV_PIDS)..."
  echo "$DEV_PIDS" | xargs kill 2>/dev/null || true
  sleep 1
  # Force kill if still running
  REMAINING=$(lsof -ti :3000 2>/dev/null || true)
  if [ -n "$REMAINING" ]; then
    echo "Force killing remaining processes..."
    echo "$REMAINING" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
  echo "Dev server stopped."
else
  echo "No dev server running on port 3000."
fi

echo ""
echo "=== 2/6 Building ==="
npm run build

echo ""
echo "=== 3/6 Checking migration compatibility ==="
# Extract tags from _journal.json
JOURNAL_TAGS=$(node -e "
  const j = require('./$JOURNAL');
  j.entries.forEach(e => console.log(e.tag));
")

if [ -f "$PROD_DB" ]; then
  # Get applied migration tags from production DB
  APPLIED_TAGS=$(node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$PROD_DB');
    try {
      const rows = db.prepare('SELECT tag FROM __drizzle_migrations ORDER BY created_at').all();
      rows.forEach(r => console.log(r.tag));
    } catch(e) {
      // Table doesn't exist yet — fresh DB, no migrations applied
    }
    db.close();
  ")

  # Verify every applied migration still exists in the journal
  while IFS= read -r tag; do
    [ -z "$tag" ] && continue
    if ! echo "$JOURNAL_TAGS" | grep -qxF "$tag"; then
      echo "ERROR: Applied migration '$tag' not found in journal. Aborting."
      exit 1
    fi
  done <<< "$APPLIED_TAGS"

  echo "Migration compatibility check passed."
else
  echo "No production DB found — will be created during migration."
fi

echo ""
echo "=== 4/6 Backing up and dry-run migration ==="
if [ -f "$PROD_DB" ]; then
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/assistant_${TIMESTAMP}.db"
  DRY_RUN_DB="$BACKUP_DIR/_dry_run.db"

  # Backup production DB (including WAL/SHM files if present)
  cp "$PROD_DB" "$BACKUP_FILE"
  [ -f "${PROD_DB}-wal" ] && cp "${PROD_DB}-wal" "${BACKUP_FILE}-wal"
  [ -f "${PROD_DB}-shm" ] && cp "${PROD_DB}-shm" "${BACKUP_FILE}-shm"
  echo "Backup saved to $BACKUP_FILE"

  # Dry-run: migrate a copy to catch SQL errors before touching the real DB
  cp "$PROD_DB" "$DRY_RUN_DB"
  [ -f "${PROD_DB}-wal" ] && cp "${PROD_DB}-wal" "${DRY_RUN_DB}-wal"
  [ -f "${PROD_DB}-shm" ] && cp "${PROD_DB}-shm" "${DRY_RUN_DB}-shm"

  echo "Running dry-run migration on copy..."
  if DATABASE_PATH="$DRY_RUN_DB" npx drizzle-kit migrate; then
    echo "Dry-run migration succeeded."
  else
    echo "ERROR: Dry-run migration failed. Production DB is untouched."
    echo "Backup is at $BACKUP_FILE"
    rm -f "$DRY_RUN_DB" "${DRY_RUN_DB}-wal" "${DRY_RUN_DB}-shm"
    exit 1
  fi
  rm -f "$DRY_RUN_DB" "${DRY_RUN_DB}-wal" "${DRY_RUN_DB}-shm"

  # Prune old backups, keep the latest 5
  ls -1t "$BACKUP_DIR"/assistant_*.db 2>/dev/null | tail -n +6 | while read -r old; do
    rm -f "$old" "${old}-wal" "${old}-shm"
  done
else
  echo "No production DB to backup — skipping."
fi

echo ""
echo "=== 5/6 Running migrations on production DB ==="
DATABASE_PATH="$PROD_DB" npx drizzle-kit migrate

echo ""
echo "=== 6/6 Restarting PM2 ==="
if pm2 describe personal-assistant > /dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs
  echo "PM2 process restarted."
else
  pm2 start ecosystem.config.cjs
  echo "PM2 process started."
fi

echo ""
echo "=== Deploy complete ==="
pm2 status
