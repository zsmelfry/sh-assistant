#!/usr/bin/env bash
set -euo pipefail

PROD_DB="./data/assistant.db"
JOURNAL="./server/database/migrations/meta/_journal.json"

echo "=== 1/4 Building ==="
npm run build

echo ""
echo "=== 2/4 Checking migration compatibility ==="
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
echo "=== 3/4 Running migrations on production DB ==="
DATABASE_PATH="$PROD_DB" npx drizzle-kit migrate

echo ""
echo "=== 4/4 Restarting PM2 ==="
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
