#!/bin/bash

# Test script for reception endpoints with authentication and boutique filtering

echo "=== Testing Reception Endpoints with Authentication ==="

# Login to get JWT token
echo "1. Logging in as superadmin..."
TOKEN=$(curl -s -X POST http://localhost:8085/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@example.com","password":"password123"}' | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token received"
  exit 1
fi

echo "✅ Login successful, token received"

# Test unfinished receptions endpoint with authentication
echo "2. Testing /api/receptions/unfinished with authentication..."
RESPONSE=$(curl -s -X GET http://localhost:8085/api/receptions/unfinished \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
  echo "✅ Endpoint responded with valid JSON"
  COUNT=$(echo "$RESPONSE" | jq length)
  echo "📊 Number of unfinished receptions: $COUNT"

  if [ "$COUNT" -gt 0 ]; then
    echo "📋 Sample reception data:"
    echo "$RESPONSE" | jq '.[0]' 2>/dev/null || echo "No sample data available"
  fi
else
  echo "❌ Invalid JSON response: $RESPONSE"
fi

# Test without authentication (should fail)
echo "3. Testing /api/receptions/unfinished without authentication..."
NO_AUTH_RESPONSE=$(curl -s -X GET http://localhost:8085/api/receptions/unfinished \
  -H "Content-Type: application/json")

if echo "$NO_AUTH_RESPONSE" | grep -q "error\|unauthorized\|forbidden"; then
  echo "✅ Correctly rejected unauthorized request"
else
  echo "❌ Should have rejected unauthorized request, got: $NO_AUTH_RESPONSE"
fi

echo "=== Test completed ==="