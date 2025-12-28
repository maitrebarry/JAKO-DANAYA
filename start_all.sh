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

echo "==> Backend démarré. Démarrage du frontend (Vite) — restez dans ce terminal pour voir la sortie front)
"
cd front-react
if [ ! -d node_modules ]; then
  echo "node_modules introuvable — installation des dépendances front"
  npm install
fi

npm run dev
