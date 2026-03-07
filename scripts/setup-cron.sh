#!/usr/bin/env bash
set -euo pipefail

# Setup cron jobs for the ability system scheduled tasks.
# Requires JWT_SECRET in .env.production.local to generate a token.
#
# Usage: ./scripts/setup-cron.sh [--remove]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.production.local"
BASE_URL="${BASE_URL:-http://localhost:3000}"

if [ "${1:-}" = "--remove" ]; then
  echo "Removing ability system cron jobs..."
  crontab -l 2>/dev/null | grep -v 'coach/run-scheduled' | crontab -
  echo "Done."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Cannot read JWT_SECRET."
  exit 1
fi

# Read JWT_SECRET from env file
JWT_SECRET=$(grep '^JWT_SECRET=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$JWT_SECRET" ]; then
  echo "Error: JWT_SECRET not found in $ENV_FILE"
  exit 1
fi

# Generate a long-lived token using node
TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ sub: 'cron' }, '$JWT_SECRET', { expiresIn: '3650d' });
console.log(token);
" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "Error: Failed to generate JWT token. Make sure jsonwebtoken is installed."
  exit 1
fi

CURL_CMD="curl -sf -H 'Authorization: Bearer $TOKEN'"

# Build cron entries
CRON_ENTRIES="# Ability system scheduled tasks
0 8 * * * $CURL_CMD '$BASE_URL/api/coach/run-scheduled?type=daily' > /dev/null 2>&1
0 9 * * 1 $CURL_CMD '$BASE_URL/api/coach/run-scheduled?type=weekly' > /dev/null 2>&1
0 9 1 * * $CURL_CMD '$BASE_URL/api/coach/run-scheduled?type=monthly' > /dev/null 2>&1"

# Merge with existing crontab (remove old entries first)
EXISTING=$(crontab -l 2>/dev/null | grep -v 'coach/run-scheduled' | grep -v '# Ability system' || true)

echo "$EXISTING
$CRON_ENTRIES" | crontab -

echo "Cron jobs installed:"
echo "  - Daily check: 08:00 every day"
echo "  - Weekly review: 09:00 every Monday"
echo "  - Monthly report: 09:00 on the 1st"
echo ""
echo "Verify with: crontab -l"
