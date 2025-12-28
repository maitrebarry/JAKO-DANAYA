#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Try to stop PID from boot.pid first
if [ -f boot.pid ]; then
  PID_FILE=$(cat boot.pid 2>/dev/null || true)
  if [ -n "$PID_FILE" ] && ps -p $PID_FILE > /dev/null 2>&1; then
    echo "Stopping PID from boot.pid: $PID_FILE"
    kill $PID_FILE || true
    sleep 1
    if ps -p $PID_FILE > /dev/null 2>&1; then
      echo "Forcing kill for PID $PID_FILE"
      kill -9 $PID_FILE || true
    fi
  fi
  rm -f boot.pid || true
else
  echo "No boot.pid file found."
fi

PIDS=$(pgrep -f "backend-0.0.1-SNAPSHOT.jar" || true)
if [ -n "$PIDS" ]; then
  echo "Stopping PIDs: $PIDS"
  kill $PIDS || true
  sleep 1
  PIDS=$(pgrep -f "backend-0.0.1-SNAPSHOT.jar" || true)
  if [ -n "$PIDS" ]; then
    echo "Forcing kill for remaining PIDs: $PIDS"
    kill -9 $PIDS || true
  fi
else
  echo "No backend jar processes found."
fi

PIDS_MVN=$(pgrep -f "spring-boot:run" || true)
if [ -n "$PIDS_MVN" ]; then
  echo "Stopping maven run PIDs: $PIDS_MVN"
  kill $PIDS_MVN || true
  sleep 1
  PIDS_MVN=$(pgrep -f "spring-boot:run" || true)
  if [ -n "$PIDS_MVN" ]; then
    echo "Forcing kill for mvn PIDs: $PIDS_MVN"
    kill -9 $PIDS_MVN || true
  fi
else
  echo "No mvn spring-boot:run processes found."
fi

echo "Done. Current listeners on port 8085:"
ss -ltnp | grep :8085 || true
