#!/bin/bash

# Attendre que le serveur démarre
sleep 25

echo "=== Test d'authentification ==="
# Login et récupération du token
TOKEN=$(curl -s -X POST http://localhost:8085/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"barrymoustapha908@gmail.com","password":"superadmin123"}' | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Erreur: Impossible d'obtenir le token JWT"
  exit 1
fi

echo "Token obtenu: ${TOKEN:0:50}..."

echo ""
echo "=== Test de l'endpoint des réceptions non terminées ==="
# Test de l'endpoint avec authentification
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8085/api/receptions/unfinished)

echo "Réponse de l'API:"
echo "$RESPONSE" | jq .

echo ""
echo "=== Test terminé ==="
