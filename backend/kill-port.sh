#!/usr/bin/env bash
set -euo pipefail

# kill-port.sh — kill processes listening on a TCP port (SIGTERM first, then SIGKILL)
# Usage: ./kill-port.sh [port]
# Default port: 8085

PORT=${1:-8085}

# Find PIDs listening on the port
PIDS=$(lsof -t -iTCP:${PORT} -sTCP:LISTEN || true)
if [ -z "${PIDS}" ]; then
  echo "No process listening on port ${PORT}"
  exit 0
fi

echo "Found process(es) listening on port ${PORT}: ${PIDS}"

# Send SIGTERM first
for pid in ${PIDS}; do
  echo "Sending SIGTERM to PID ${pid}"
  kill "${pid}" || true
done

# Wait for processes to exit
sleep 3

PIDS_STILL=$(lsof -t -iTCP:${PORT} -sTCP:LISTEN || true)
if [ -z "${PIDS_STILL}" ]; then
  echo "Processes terminated cleanly on port ${PORT}"
else
  echo "Processes still present on port ${PORT}: ${PIDS_STILL} — sending SIGKILL"
  for pid in ${PIDS_STILL}; do
    echo "Sending SIGKILL to PID ${pid}"
    kill -9 "${pid}" || true
  done
fi

# Remove stale backend/boot.pid if it doesn't match a running process
BOOTPID_FILE="backend/boot.pid"
if [ -f "${BOOTPID_FILE}" ]; then
  BOOTPID=$(cat "${BOOTPID_FILE}" || true)
  if [ -n "${BOOTPID}" ] && ! ps -p "${BOOTPID}" > /dev/null 2>&1; then
    echo "Removing stale ${BOOTPID_FILE} (contained PID ${BOOTPID})"
    rm -f "${BOOTPID_FILE}"
  fi
fi

echo "Done."