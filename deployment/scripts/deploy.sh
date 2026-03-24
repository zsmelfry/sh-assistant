#!/usr/bin/env bash
set -euo pipefail

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --lan) export LAN=1 ;;
  esac
done

DATA_DIR="${DATA_DIR:-./data}"
ADMIN_DB="$DATA_DIR/admin.db"
LEGACY_DB="$DATA_DIR/assistant.db"
USERS_DIR="$DATA_DIR/users"
BACKUP_DIR="$DATA_DIR/backups"
MIGRATION_STATE="$DATA_DIR/.migration-state"
JOURNAL="./server/database/migrations/meta/_journal.json"
ADMIN_JOURNAL="./server/database/admin-migrations/meta/_journal.json"

echo "=== 1/7 Stopping dev server ==="
DEV_PIDS=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$DEV_PIDS" ]; then
  echo "Killing dev server (PIDs: $DEV_PIDS)..."
  echo "$DEV_PIDS" | xargs kill 2>/dev/null || true
  sleep 1
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
echo "=== 2/7 Building ==="
npm run build

echo ""
echo "=== 3/7 First-time migration (if needed) ==="
if [ -f "$LEGACY_DB" ] && [ ! -f "$MIGRATION_STATE" ]; then
  echo "Found legacy assistant.db without migration state."
  echo "Running one-time migration to multi-user architecture..."
  npx tsx scripts/migrate-to-multi-user.ts
  echo "Migration complete."
elif [ ! -f "$ADMIN_DB" ] && [ ! -f "$LEGACY_DB" ]; then
  echo "Fresh installation — no existing data to migrate."
else
  echo "Multi-user architecture already in place — skipping."
fi

echo ""
echo "=== 4/7 Backing up databases ==="
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup admin.db
if [ -f "$ADMIN_DB" ]; then
  cp "$ADMIN_DB" "$BACKUP_DIR/admin_${TIMESTAMP}.db"
  [ -f "${ADMIN_DB}-wal" ] && cp "${ADMIN_DB}-wal" "$BACKUP_DIR/admin_${TIMESTAMP}.db-wal"
  [ -f "${ADMIN_DB}-shm" ] && cp "${ADMIN_DB}-shm" "$BACKUP_DIR/admin_${TIMESTAMP}.db-shm"
  echo "Backed up admin.db"
fi

# Backup all user DBs
if [ -d "$USERS_DIR" ]; then
  USER_BACKUP_DIR="$BACKUP_DIR/users_${TIMESTAMP}"
  mkdir -p "$USER_BACKUP_DIR"
  for db in "$USERS_DIR"/*.db; do
    [ -f "$db" ] || continue
    cp "$db" "$USER_BACKUP_DIR/"
    [ -f "${db}-wal" ] && cp "${db}-wal" "$USER_BACKUP_DIR/"
    [ -f "${db}-shm" ] && cp "${db}-shm" "$USER_BACKUP_DIR/"
  done
  echo "Backed up user DBs to $USER_BACKUP_DIR"
fi

# Prune old backups, keep the latest 5
ls -1td "$BACKUP_DIR"/admin_*.db 2>/dev/null | tail -n +6 | while read -r old; do
  rm -f "$old" "${old}-wal" "${old}-shm"
done
ls -1td "$BACKUP_DIR"/users_* 2>/dev/null | tail -n +6 | while read -r old; do
  rm -rf "$old"
done

echo ""
echo "=== 5/7 Migrating admin.db ==="
if [ -f "$ADMIN_JOURNAL" ]; then
  ADMIN_DB_PATH="$ADMIN_DB" npx drizzle-kit migrate --config drizzle-admin.config.ts
  echo "Admin DB migrated."
else
  echo "No admin migrations found — skipping."
fi

echo ""
echo "=== 6/7 Migrating user DBs ==="
if [ -d "$USERS_DIR" ] && [ -f "$JOURNAL" ]; then
  npx tsx scripts/migrate-user-dbs.ts
else
  echo "No user DBs or migrations found — skipping."
fi

echo ""
echo "=== 7/7 Restarting PM2 ==="
if [ "${LAN:-}" = "1" ]; then
  echo "LAN mode: binding to 0.0.0.0 (accessible from network)"
else
  echo "Local mode: binding to 127.0.0.1 (use --lan to expose to network)"
fi
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
