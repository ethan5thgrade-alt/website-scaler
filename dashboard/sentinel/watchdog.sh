#!/bin/bash
# OS-level watchdog for the Sentinel process
# Add this to crontab: * * * * * /path/to/website-scaler/sentinel/watchdog.sh
#
# This script checks the sentinel heartbeat file.
# If it's stale (older than 15 seconds), it restarts the sentinel.

HEARTBEAT_FILE="$(dirname "$0")/../data/sentinel_heartbeat.json"
SENTINEL_SCRIPT="$(dirname "$0")/index.js"
LOG_FILE="$(dirname "$0")/../data/watchdog.log"

if [ ! -f "$HEARTBEAT_FILE" ]; then
  echo "$(date): No heartbeat file found — starting sentinel" >> "$LOG_FILE"
  cd "$(dirname "$0")/.." && node "$SENTINEL_SCRIPT" &
  exit 0
fi

# Check if heartbeat is stale (more than 15 seconds old)
if [ "$(uname)" = "Darwin" ]; then
  FILE_AGE=$(( $(date +%s) - $(stat -f %m "$HEARTBEAT_FILE") ))
else
  FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$HEARTBEAT_FILE") ))
fi

if [ "$FILE_AGE" -gt 15 ]; then
  echo "$(date): Sentinel heartbeat stale (${FILE_AGE}s) — restarting" >> "$LOG_FILE"

  # Kill existing sentinel process if any
  SENTINEL_PID=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$HEARTBEAT_FILE')).pid)}catch{}" 2>/dev/null)
  if [ -n "$SENTINEL_PID" ] && kill -0 "$SENTINEL_PID" 2>/dev/null; then
    kill "$SENTINEL_PID" 2>/dev/null
    sleep 2
  fi

  # Restart
  cd "$(dirname "$0")/.." && node "$SENTINEL_SCRIPT" &
  echo "$(date): Sentinel restarted" >> "$LOG_FILE"
else
  echo "$(date): Sentinel healthy (heartbeat ${FILE_AGE}s ago)" >> "$LOG_FILE"
fi
