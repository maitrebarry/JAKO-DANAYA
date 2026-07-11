#!/usr/bin/env bash
set -euo pipefail

# start_all.sh — lance backend (en arrière-plan) puis frontend (Vite) en avant-plan
# Usage: ./start_all.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "==> Libération du port 8085 (si présent)"
./backend/kill-port.sh 8085 || true

echo "==> Démarrage du backend (script existant)
"
./backend/scripts/start_backend.sh

echo "==> Backend démarré. Démarrage d'Expo (mobile) en arrière-plan"
mkdir -p logs
cd mobile
if [ ! -d node_modules ]; then
  echo "node_modules introuvable — installation des dépendances mobile"
  npm install
fi
nohup npx expo start -c > ../logs/expo.log 2>&1 &
echo $! > expo.pid
cd "$ROOT_DIR"
echo "Expo démarré en arrière-plan (PID $(cat mobile/expo.pid))."
echo "  -> QR code et logs : tail -f logs/expo.log"
echo "  -> Pour arrêter : kill \$(cat mobile/expo.pid)"

echo "==> Démarrage du frontend (Vite) — restez dans ce terminal pour voir la sortie front
"
cd front-react
if [ ! -d node_modules ]; then
  echo "node_modules introuvable — installation des dépendances front"
  npm install
fi

npm run dev
