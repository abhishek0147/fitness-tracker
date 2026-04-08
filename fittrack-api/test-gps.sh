#!/bin/bash

# FitTrack API GPS Tracking Test Script
# Tests: Register → Login → Log Activity → Record GPS Points → View Route

API="http://localhost:3000/api"

echo "🚀 Starting FitTrack GPS Tracking Tests...\n"

# 1. REGISTER
echo "1️⃣  Registering new user..."
REGISTER=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPS Tracker",
    "email": "gpstracker@fittrack.com",
    "password": "SecurePass123!"
  }')

echo "$REGISTER\n"

# 2. LOGIN
echo "2️⃣  Logging in..."
LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gpstracker@fittrack.com",
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

echo "✅ Token obtained\n"

# 3. LOG ACTIVITY
echo "3️⃣  Logging a run activity..."
ACTIVITY=$(curl -s -X POST "$API/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Park Loop Run",
    "type": "run",
    "duration": 1800,
    "notes": "Beautiful morning run with GPS tracking"
  }')

ACTIVITY_ID=$(echo "$ACTIVITY" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "$ACTIVITY\n"

if [ -z "$ACTIVITY_ID" ]; then
  echo "❌ Failed to create activity"
  exit 1
fi

echo "✅ Activity created with ID: $ACTIVITY_ID\n"

# 4. RECORD GPS POINTS - Simulate a route through a park
echo "4️⃣  Recording GPS points (simulating 5K park run)..."
GPS_POINTS=$(curl -s -X POST "$API/routes/$ACTIVITY_ID/record" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "points": [
      {"latitude": 40.7128, "longitude": -74.0060, "elevation": 10},
      {"latitude": 40.7150, "longitude": -74.0050, "elevation": 12},
      {"latitude": 40.7180, "longitude": -74.0040, "elevation": 15},
      {"latitude": 40.7200, "longitude": -74.0030, "elevation": 18},
      {"latitude": 40.7210, "longitude": -74.0010, "elevation": 20},
      {"latitude": 40.7190, "longitude": -74.0000, "elevation": 19},
      {"latitude": 40.7170, "longitude": -74.0020, "elevation": 17},
      {"latitude": 40.7140, "longitude": -74.0040, "elevation": 14},
      {"latitude": 40.7120, "longitude": -74.0055, "elevation": 11}
    ]
  }')

echo "$GPS_POINTS\n"

# 5. GET ROUTE DATA
echo "5️⃣  Retrieving full route data..."
ROUTE=$(curl -s -X GET "$API/routes/$ACTIVITY_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$ROUTE\n"

# 6. GET ROUTE AS GEOJSON
echo "6️⃣  Retrieving route as GeoJSON (for mapping)..."
GEOJSON=$(curl -s -X GET "$API/routes/$ACTIVITY_ID/geojson" \
  -H "Authorization: Bearer $TOKEN")

echo "$GEOJSON\n"

# 7. GET ROUTE SUMMARY
echo "7️⃣  Retrieving route statistics..."
SUMMARY=$(curl -s -X GET "$API/routes/$ACTIVITY_ID/summary" \
  -H "Authorization: Bearer $TOKEN")

echo "$SUMMARY\n"

# 8. GET UPDATED ACTIVITY (should have calculated distance)
echo "8️⃣  Fetching updated activity with calculated GPS distance..."
UPDATED_ACTIVITY=$(curl -s -X GET "$API/activities/$ACTIVITY_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$UPDATED_ACTIVITY\n"

echo "✅ All GPS tracking tests complete!"
echo "\n📍 Your route is now stored and can be:"
echo "   - Visualized on a map using the GeoJSON data"
echo "   - Shared with other athletes"
echo "   - Analyzed for distance, elevation, and performance"
