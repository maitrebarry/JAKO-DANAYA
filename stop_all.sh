#!/usr/bin/env bash
set -uo pipefail

# stop_all.sh — arrête tout ce que start_all.sh a démarré (backend, Expo, frontend)
# Usage: ./stop_all.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "==> Arrêt du backend"
./backend/scripts/stop_backend.sh

echo ""
echo "==> Arrêt d'Expo (mobile)"
if [ -f mobile/expo.pid ]; then
  PID=$(cat mobile/expo.pid 2>/dev/null || true)
  if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
    kill "$PID" || true
    sleep 1
    ps -p "$PID" > /dev/null 2>&1 && kill -9 "$PID" || true
  fi
  rm -f mobile/expo.pid
fi
pkill -f "expo start" 2>/dev/null || true
echo "Expo arrêté."

echo ""
echo "==> Arrêt du frontend (Vite)"
pkill -f "vite" 2>/dev/null || true
echo "Frontend arrêté."

echo ""
echo "Tout est arrêté."
