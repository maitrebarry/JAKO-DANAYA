#!/bin/bash
set -euo pipefail

# Simple smoke test for conditionnement flow (API only)
# Steps: login -> create product with conditionnement -> create commande fournisseur (conditionnement) -> reception (conditionnement) -> verify stock -> vente (conditionnement) -> verify stock decrement

BASE_URL="http://localhost:8085"
EMAIL="barrymoustapha908@gmail.com"
PASSWORD="superadmin123"

echo "Waiting briefly for services..."
sleep 5

echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r '.token')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "ERROR: Could not get token"
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"

# Get a boutiqueId
BOUTIQUE_ID=$(curl -s -H "$AUTH" "$BASE_URL/api/boutiques" | jq -r '.[0].id')
if [ -z "$BOUTIQUE_ID" ] || [ "$BOUTIQUE_ID" = "null" ]; then
  echo "ERROR: Could not find a boutique"
  exit 1
fi
echo "Using boutique id: $BOUTIQUE_ID"

# Choose a unit id (unite)
UNITE_ID=$(curl -s -H "$AUTH" "$BASE_URL/api/unites" | jq -r '.[0].id')
if [ -z "$UNITE_ID" ] || [ "$UNITE_ID" = "null" ]; then
  echo "ERROR: Could not find a unite"
  exit 1
fi

# Create product with conditionnement
PROD_NAME="SmokeCondProd_$(date +%s)"
NB_PER_COND=12
echo "Creating product $PROD_NAME with $NB_PER_COND units/carton..."
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/produits" \
  -H "$AUTH" \
  -F "nomProduit=$PROD_NAME" \
  -F "prixAchat=100" \
  -F "prixEnGros=150" \
  -F "prixDetail=200" \
  -F "uniteConditionnementId=$UNITE_ID" \
  -F "nombreUnitesParConditionnement=$NB_PER_COND" \
  -F "quantiteInitiale=0")
PROD_ID=$(echo "$CREATE_RESP" | jq -r '.id // empty')
if [ -n "$PROD_ID" ]; then
  echo "Created product id: $PROD_ID"
  # Find the stock for the created product
  sleep 1
  STOCK_JSON=$(curl -s -H "$AUTH" "$BASE_URL/api/stocks" | jq -c --arg pid "$PROD_ID" '.[] | select(.produitId == ($pid|tonumber))' | head -n1)
else
  echo "Product creation failed or not permitted, trying to find an existing product with conditionnement..."
  PROD_ID=$(curl -s -H "$AUTH" "$BASE_URL/api/produits" | jq -r '.[] | select(.nombreUnitesParConditionnement != null and .nombreUnitesParConditionnement > 1) | .id' | head -n1)
  if [ -z "$PROD_ID" ]; then
    echo "ERROR: No existing product with nombreUnitesParConditionnement found"
    exit 1
  fi
  echo "Using existing product id: $PROD_ID"
  STOCK_JSON=$(curl -s -H "$AUTH" "$BASE_URL/api/stocks" | jq -c --arg pid "$PROD_ID" '.[] | select(.produitId == ($pid|tonumber))' | head -n1)
fi

# If stock not found for the product, try to find any stock whose product has a conditionnement > 1
if [ -z "$STOCK_JSON" ]; then
  echo "No stock found for product $PROD_ID; searching all stocks for a product with conditionnement..."
  STOCK_JSON=""
  mapfile -t STOCKS_ARRAY < <(curl -s -H "$AUTH" "$BASE_URL/api/stocks" | jq -c '.[]')
  for s in "${STOCKS_ARRAY[@]}"; do
    pid=$(echo "$s" | jq -r '.produitId')
    if [ "$pid" = "null" ] || [ -z "$pid" ]; then continue; fi
    prod=$(curl -s -H "$AUTH" "$BASE_URL/api/produits/$pid")
    nb=$(echo "$prod" | jq -r '.nombreUnitesParConditionnement // 0')
    if [ "$nb" -gt 1 ]; then
      STOCK_JSON="$s"
      PROD_ID="$pid"
      NB_PER_COND="$nb"
      break
    fi
  done
fi

if [ -z "$STOCK_JSON" ]; then
  echo "ERROR: Could not find any suitable stock for a product with conditionnement"
  exit 1
fi
STOCK_ID=$(echo "$STOCK_JSON" | jq -r '.id')
echo "Found stock id: $STOCK_ID (product id: $PROD_ID, nb per cond: $NB_PER_COND)"
# Find a fournisseur
FOURN_ID=$(curl -s -H "$AUTH" "$BASE_URL/api/fournisseurs" | jq -r '.[0].id')
if [ -z "$FOURN_ID" ] || [ "$FOURN_ID" = "null" ]; then
  echo "ERROR: No fournisseur found"
  exit 1
fi

# Create commande fournisseur with quantiteConditionnement=2
echo "Creating commande fournisseur (2 cond)..."
CMD_JSON=$(cat <<EOF
{
  "reference": "SMK-$(date +%s)",
  "dateCommande": "$(date -Iseconds)",
  "fournisseur": { "id": $FOURN_ID },
  "total": 0,
  "produitsSelectionnes": [ { "id_stock": $STOCK_ID, "quantiteConditionnement": 2, "prix": 100 } ]
}
EOF
)

CRE_CMD_RESP=$(curl -s -X POST "$BASE_URL/api/commandes-fournisseurs" -H "Content-Type: application/json" -H "$AUTH" -d "$CMD_JSON")
CMD_ID=$(echo "$CRE_CMD_RESP" | jq -r '.id')
if [ -z "$CMD_ID" ] || [ "$CMD_ID" = "null" ]; then
  echo "ERROR: Creating commande failed: $CRE_CMD_RESP"
  exit 1
fi
echo "Created commande id: $CMD_ID"

# Get ligne id from commande
LIGNE_ID=$(curl -s -H "$AUTH" "$BASE_URL/api/commandes-fournisseurs/$CMD_ID" | jq -r '.lignes[0].id')
if [ -z "$LIGNE_ID" ] || [ "$LIGNE_ID" = "null" ]; then
  echo "ERROR: Could not get ligne id from commande"
  exit 1
fi

echo "Calling reception (quantiteConditionnement=2)..."
RECEP_JSON=$(cat <<EOF
{
  "reference": "REC-$(date +%s)",
  "dateReception": "$(date -Iseconds)",
  "lignes": [ { "ligneId": $LIGNE_ID, "quantiteConditionnement": 2 } ]
}
EOF
)

RECEP_RESP=$(curl -s -X POST "$BASE_URL/api/commandes-fournisseurs/$CMD_ID/reception?boutiqueId=$BOUTIQUE_ID" -H "Content-Type: application/json" -H "$AUTH" -d "$RECEP_JSON")

echo "Reception response: $RECEP_RESP"

# Verify stock increased by 2 * NB_PER_COND units
sleep 1
STOCK_AFTER=$(curl -s -H "$AUTH" "$BASE_URL/api/stocks" | jq -c --arg sid "$STOCK_ID" '.[] | select(.id == ($sid|tonumber))' | head -n1)
if [ -z "$STOCK_AFTER" ]; then
  echo "ERROR: Could not find stock after reception"
  exit 1
fi
QTY_AFTER=$(echo "$STOCK_AFTER" | jq -r '.quantiteDisponible')
EXPECTED_UNITS=$((NB_PER_COND * 2))
if [ "$QTY_AFTER" -lt "$EXPECTED_UNITS" ]; then
  echo "ERROR: Stock after reception ($QTY_AFTER) is less than expected units ($EXPECTED_UNITS)"
  exit 1
fi
 echo "Stock after reception: $QTY_AFTER (expected at least $EXPECTED_UNITS)"

# Perform a vente in conditionnement: sell 1 carton
echo "Creating vente (1 carton)..."
VENTE_JSON=$(cat <<EOF
{
  "reference": "VTE-$(date +%s)",
  "dateVente": "$(date -Iseconds)",
  "nomClient": "Clients divers",
  "total": 100,
  "montantRecu": 100,
  "produitsSelectionnes": [ { "id_stock": $STOCK_ID, "quantiteConditionnement": 1, "venteParConditionnement": true, "prix": 100 } ]
}
EOF
)

VENTE_RESP=$(curl -s -X POST "$BASE_URL/api/ventes/cash" -H "Content-Type: application/json" -H "$AUTH" -d "$VENTE_JSON")
if echo "$VENTE_RESP" | jq -e '.id' >/dev/null 2>&1; then
  VENTE_ID=$(echo "$VENTE_RESP" | jq -r '.id')
  echo "Vente created id: $VENTE_ID"
else
  echo "ERROR: Vente creation failed: $VENTE_RESP"
  exit 1
fi

# Verify stock decreased by NB_PER_COND units
sleep 1
STOCK_FINAL=$(curl -s -H "$AUTH" "$BASE_URL/api/stocks" | jq -c --arg sid "$STOCK_ID" '.[] | select(.id == ($sid|tonumber))' | head -n1)
QTY_FINAL=$(echo "$STOCK_FINAL" | jq -r '.quantiteDisponible')
EXPECTED_FINAL=$((QTY_AFTER - NB_PER_COND))
if [ "$QTY_FINAL" -ne "$EXPECTED_FINAL" ]; then
  echo "ERROR: Stock after vente ($QTY_FINAL) not equal expected ($EXPECTED_FINAL)"
  exit 1
fi

# Verify vente response includes quantiteConditionnement on ligne
if echo "$VENTE_RESP" | jq -e '.lignes[0].quantiteConditionnement' >/dev/null 2>&1; then
  echo "Vente ligne includes quantiteConditionnement: $(echo "$VENTE_RESP" | jq -r '.lignes[0].quantiteConditionnement')"
else
  echo "ERROR: Vente response does not contain quantiteConditionnement"
  exit 1
fi

echo "Smoke test passed ✅"
exit 0