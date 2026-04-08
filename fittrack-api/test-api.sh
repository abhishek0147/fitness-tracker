#!/bin/bash

# FitTrack API Test Script
# Tests: Register → Login → Log Activity → View Stats

API="http://localhost:3000/api"

echo "🚀 Starting FitTrack API Tests...\n"

# 1. REGISTER
echo "1️⃣  Registering new user..."
REGISTER=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Athlete",
    "email": "athlete@fittrack.com",
    "password": "SecurePass123!"
  }')

echo "$REGISTER\n"

# 2. LOGIN
echo "2️⃣  Logging in..."
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "athlete@fittrack.com",
    "password": "SecurePass123!"
  }')

echo "$LOGIN\n"

# Extract token
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Login response:"
  echo "$LOGIN"
  exit 1
fi

echo "✅ Token obtained: $TOKEN\n"

# 3. LOG ACTIVITY
echo "3️⃣  Logging a run activity..."
ACTIVITY=$(curl -s -X POST "$API/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Morning 5K Run",
    "type": "run",
    "distance": 5.2,
    "duration": 1860,
    "notes": "Morning 5K run in the park"
  }')

echo "$ACTIVITY\n"

# 4. GET STATS
echo "4️⃣  Fetching personal stats..."
STATS=$(curl -s -X GET "$API/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATS\n"

# 5. GET ACTIVITIES
echo "5️⃣  Fetching your activities..."
ACTIVITIES=$(curl -s -X GET "$API/activities" \
  -H "Authorization: Bearer $TOKEN")

echo "$ACTIVITIES\n"

echo "✅ All tests complete!"
