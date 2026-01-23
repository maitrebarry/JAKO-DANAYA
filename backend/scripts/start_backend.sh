#!/usr/bin/env bash
set -euo pipefail

# start_backend.sh
# - Stops any running backend instance (matching jar or main class)
# - Builds (optional) and starts the jar, redirecting logs to logs/application.log
# - Waits until port 8085 is listening and prints status

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Stopping any existing backend processes..."
PIDS=$(pgrep -f "backend-0.0.1-SNAPSHOT.jar" || true)
if [ -n "$PIDS" ]; then
  echo "Found existing backend PIDs: $PIDS"
  kill $PIDS || true
  sleep 1
  # ensure they are gone
  PIDS=$(pgrep -f "backend-0.0.1-SNAPSHOT.jar" || true)
  if [ -n "$PIDS" ]; then
    echo "Forcing kill for remaining PIDs: $PIDS"
    kill -9 $PIDS || true
  fi
else
  echo "No existing backend jar processes found."
fi

# Also try to kill running spring-boot:run (maven) processes that run the app main class
PIDS_MVN=$(pgrep -f "spring-boot:run" || true)
if [ -n "$PIDS_MVN" ]; then
  echo "Found running maven spring-boot:run processes: $PIDS_MVN"
  kill $PIDS_MVN || true
  sleep 1
  PIDS_MVN=$(pgrep -f "spring-boot:run" || true)
  if [ -n "$PIDS_MVN" ]; then
    echo "Forcing kill for mvn PIDs: $PIDS_MVN"
    kill -9 $PIDS_MVN || true
  fi
fi

# Ensure the port is free
if ss -ltnp | grep -q ":8085"; then
  echo "Port 8085 still in use, aborting start." >&2
  ss -ltnp | grep :8085 || true
  exit 1
fi

# Build the project (skip tests) to ensure jar is up-to-date
echo "Building backend jar..."
mvn -DskipTests package -q

if [ ! -f target/backend-0.0.1-SNAPSHOT.jar ]; then
  echo "Jar not found at target/backend-0.0.1-SNAPSHOT.jar" >&2
  exit 1
fi

mkdir -p logs

# Verify logs directory is writable; if not, fallback to /tmp and show remediation steps.
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/application.log"
FALLBACK_LOG="/tmp/backend-application.log"

if [ -e "$LOG_FILE" ] && [ ! -w "$LOG_FILE" ]; then
  echo "WARNING: $LOG_FILE exists but is not writable by $(id -un)." >&2
  echo "-> Will fallback to $FALLBACK_LOG for this run to avoid startup failure." >&2
  echo "Suggested fix (run as sudo):" >&2
  echo "  sudo chown $(id -un):$(id -gn) ${LOG_FILE} && sudo chmod 0644 ${LOG_FILE}" >&2
  echo "Or remove the file if it should not be present: sudo rm ${LOG_FILE}" >&2
  LOG_FILE="$FALLBACK_LOG"
fi

# If logs dir is not writable, attempt to create fallback and warn
if [ ! -w "$LOG_DIR" ]; then
  echo "WARNING: cannot write to $LOG_DIR (owner: $(ls -ld $LOG_DIR 2>/dev/null))." >&2
  echo "-> Will fallback to $FALLBACK_LOG for this run." >&2
  echo "Suggested fix (run as sudo): sudo chown -R $(id -un):$(id -gn) $LOG_DIR && sudo chmod -R 0755 $LOG_DIR" >&2
  LOG_FILE="$FALLBACK_LOG"
fi

echo "Starting backend jar... (logs at $LOG_FILE)"
nohup java -jar target/backend-0.0.1-SNAPSHOT.jar > "$LOG_FILE" 2>&1 &
PID=$!
# write pid for easier stop
echo $PID > boot.pid
echo "Started PID $PID (written to boot.pid)"

# Wait for port to be listening
echo "Waiting for port 8085 to become available..."
for i in {1..30}; do
  if ss -ltnp | grep -q ":8085"; then
    echo "Backend started and listening on port 8085"
    echo "--- last 50 lines of logs ---"
    tail -n 50 logs/application.log
    exit 0
  fi
  sleep 1
done

echo "Backend did not start within timeout, last 100 lines of logs:" >&2
tail -n 100 logs/application.log >&2
exit 2
