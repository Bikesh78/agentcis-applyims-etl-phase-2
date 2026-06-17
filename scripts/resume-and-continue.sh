#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL="http://localhost:4000/api/migration"
RESUME_MIGRATION_ID="1f4a505a-abac-4428-93f4-b2c4271f3443"
POLL_INTERVAL=30  # seconds between status checks

# ETL DB connection
export PGPASSWORD="admin"
PG="psql -h localhost -p 7953 -U postgres -d etl_tracking_verification -t -A"

# Entities to start after applications complete (in dependency order)
NEXT_ENTITIES='["notes","contact-activities","office-visits","checkins","attachments"]'

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Returns "done" if all checkpoints for $1 migration have completed_at set
check_done() {
  local migration_id="$1"
  shift
  local entities=("$@")
  local entity_list
  entity_list=$(printf "'%s'," "${entities[@]}" | sed 's/,$//')

  local total done
  total=${#entities[@]}
  done=$($PG -c "
    SELECT COUNT(*) FROM migration_checkpoints
    WHERE migration_id = '$migration_id'
      AND entity_type IN ($entity_list)
      AND completed_at IS NOT NULL;
  ")

  [[ "$done" -ge "$total" ]] && echo "done" || echo "running"
}

# Prints a progress summary row from the checkpoint table
print_progress() {
  local migration_id="$1"
  $PG -c "
    SELECT
      entity_type,
      processed_count || '/' || total_count AS progress,
      success_count AS ok,
      failed_count AS fail,
      CASE WHEN completed_at IS NOT NULL THEN 'done' ELSE 'running' END AS status
    FROM migration_checkpoints
    WHERE migration_id = '$migration_id'
    ORDER BY id;
  " | column -t -s '|'
}

# ── Step 1: Resume the stalled applications migration ─────────────────────────
log "Resuming migration $RESUME_MIGRATION_ID (applications from ID 139057)..."

RESUME_RESP=$(curl -sf -X POST "$BASE_URL/$RESUME_MIGRATION_ID/resume" \
  -H "Content-Type: application/json")
STATUS=$(echo "$RESUME_RESP" | jq -r '.status')
log "Resume response: $STATUS — $(echo "$RESUME_RESP" | jq -r '.message')"

if [[ "$STATUS" == "completed" ]]; then
  log "Applications already completed, skipping poll."
elif [[ "$STATUS" == "resumed" ]]; then
  log "Polling for applications completion (every ${POLL_INTERVAL}s)..."
  while true; do
    sleep "$POLL_INTERVAL"
    print_progress "$RESUME_MIGRATION_ID"
    STATE=$(check_done "$RESUME_MIGRATION_ID" "applications")
    [[ "$STATE" == "done" ]] && { log "Applications migration complete."; break; }
  done
else
  log "ERROR: Unexpected resume status '$STATUS'. Full response:"
  echo "$RESUME_RESP" | jq .
  exit 1
fi

# ── Step 2: Start migration for remaining entities ────────────────────────────
log "Starting migration for: $NEXT_ENTITIES"

START_RESP=$(curl -sf -X POST "$BASE_URL/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"entities\": $NEXT_ENTITIES,
    \"dateRange\": {
      \"start\": \"2000-01-01T00:00:00.000Z\",
      \"end\": \"2030-01-01T00:00:00.000Z\"
    },
    \"batchSize\": 500,
    \"parallelism\": 1
  }")

NEW_ID=$(echo "$START_RESP" | jq -r '.migrationId')
if [[ -z "$NEW_ID" || "$NEW_ID" == "null" ]]; then
  log "ERROR: Failed to start new migration. Response:"
  echo "$START_RESP" | jq .
  exit 1
fi

log "New migration started: $NEW_ID"

# ── Step 3: Poll the new migration until all entities complete ────────────────
log "Polling new migration (every ${POLL_INTERVAL}s)..."
ENTITY_ARRAY=(notes contact-activities office-visits checkins attachments)

while true; do
  sleep "$POLL_INTERVAL"
  log "Progress for $NEW_ID:"
  print_progress "$NEW_ID"
  STATE=$(check_done "$NEW_ID" "${ENTITY_ARRAY[@]}")
  [[ "$STATE" == "done" ]] && break
done

log "All entities complete."
log "  Applications migration : $RESUME_MIGRATION_ID"
log "  Remaining entities     : $NEW_ID"

# Final summary
log "Final summary:"
print_progress "$RESUME_MIGRATION_ID"
print_progress "$NEW_ID"
