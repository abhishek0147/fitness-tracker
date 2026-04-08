# 📍 FitTrack GPS Tracking Guide

Your FitTrack API now includes full **Strava-like GPS tracking** capabilities! Record your runs, rides, and adventures with precise location data.

## 🚀 Quick Start

### 1. Log an Activity
```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning Run",
    "type": "run",
    "duration": 1800,
    "notes": "Beautiful sunrise run"
  }'
```

### 2. Record GPS Points
```bash
curl -X POST http://localhost:3000/api/routes/ACTIVITY_ID/record \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "elevation": 10,
        "timestamp": "2026-04-08T10:00:00Z"
      },
      {
        "latitude": 40.7150,
        "longitude": -74.0050,
        "elevation": 12,
        "timestamp": "2026-04-08T10:05:00Z"
      }
    ]
  }'
```

### 3. Retrieve Route Data
```bash
curl http://localhost:3000/api/routes/ACTIVITY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📡 GPS Endpoints

### Record GPS Points
**POST** `/api/routes/:activityId/record`

Records GPS coordinates for an activity. Points are stored incrementally, allowing you to stream data during the activity.

**Request Body:**
```json
{
  "points": [
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "elevation": 10,
      "timestamp": "2026-04-08T10:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "message": "GPS points recorded",
  "points_added": 1
}
```

### Get Full Route
**GET** `/api/routes/:activityId`

Retrieves the complete route with all GPS points and calculated statistics.

**Response:**
```json
{
  "activity_id": "2",
  "points": [
    {
      "id": 1,
      "latitude": 40.7128,
      "longitude": -74.0060,
      "elevation": 10,
      "distance_from_start": 0,
      "timestamp": "2026-04-08T10:00:00Z"
    }
  ],
  "stats": {
    "total_distance_km": 5.2,
    "total_elevation_m": 45,
    "max_elevation_m": 120
  },
  "geojson": { /* GeoJSON FeatureCollection */ }
}
```

### Get Route as GeoJSON
**GET** `/api/routes/:activityId/geojson`

Returns route in GeoJSON format, perfect for mapping applications.

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-74.0060, 40.7128, 10],
          [-74.0050, 40.7150, 12]
        ]
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-74.0060, 40.7128] },
      "properties": { "name": "Start", "marker": "start" }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-74.0050, 40.7150] },
      "properties": { "name": "Finish", "marker": "finish" }
    }
  ]
}
```

### Get Route Summary
**GET** `/api/routes/:activityId/summary`

Quick stats endpoint for route metrics.

**Response:**
```json
{
  "activity_id": "2",
  "total_points": 124,
  "total_distance_km": 5.2,
  "total_elevation_m": 45,
  "max_elevation_m": 120
}
```

## 📊 How GPS Tracking Works

### Automatic Calculations
When you record GPS points, FitTrack automatically calculates:

1. **Distance** - Using the Haversine formula for accurate great-circle distances between points
2. **Elevation Gain** - Cumulative uphill elevation (only positive changes count)
3. **Max Elevation** - Highest point in your route
4. **Cumulative Distance** - Distance from start for each point

These values automatically update your activity's `distance` and `elevation_gain` fields.

### Distance Formula
FitTrack uses the **Haversine formula**, the same method used by Strava:
```
a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
c = 2 ⋅ atan2( √a, √(1−a) )
d = R ⋅ c
```
Where R = 6371 km (Earth's radius)

### Elevation Tracking
- Only positive elevation changes count toward "elevation gain"
- Negative changes (descending) don't add to the total
- Max elevation is tracked separately

## 🗺️ Interactive Map Viewer

Open `map-viewer.html` in your browser to visualize routes:

1. Get your route as GeoJSON: `GET /api/routes/:activityId/geojson`
2. Copy the full GeoJSON response
3. Paste into the map viewer's text area
4. Click "Load Route on Map"

Features:
- 🟢 Green marker for start point
- 🏁 Red marker for finish point
- 📈 Elevation profile visualization
- 🎯 Auto-zoom to route bounds

## 💡 Use Cases

### Mobile App Integration
Stream GPS points in real-time as users exercise:
```javascript
// Simulate live GPS tracking
const interval = setInterval(async () => {
  const location = getCurrentLocation(); // Your GPS API
  await fetch(`/api/routes/${activityId}/record`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      points: [{
        latitude: location.lat,
        longitude: location.lng,
        elevation: location.elevation
      }]
    })
  });
}, 5000); // Record every 5 seconds
```

### Batch Import
Import historical routes from other apps:
```bash
curl -X POST http://localhost:3000/api/routes/ACTIVITY_ID/record \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      /* 1000+ GPS points from your other activity */
    ]
  }'
```

### Route Comparison
Compare your fastest/slowest times on the same route:
```javascript
const routes = await fetch('/api/activities?type=run', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

for (const activity of routes.activities) {
  const route = await fetch(`/api/routes/${activity.id}/summary`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  console.log(`${activity.title}: ${route.total_distance_km}km in ${activity.duration}s`);
}
```

## 📝 Example: Complete Workflow

```bash
#!/bin/bash

# 1. Login
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}' \
  | jq -r '.token')

# 2. Create activity
ACTIVITY=$(curl -X POST http://localhost:3000/api/activities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"5K Run","type":"run","duration":1800}')

ID=$(echo "$ACTIVITY" | jq -r '.activity.id')

# 3. Record GPS points
curl -X POST http://localhost:3000/api/routes/$ID/record \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      {"latitude":40.7128,"longitude":-74.0060,"elevation":10},
      {"latitude":40.7150,"longitude":-74.0050,"elevation":12},
      {"latitude":40.7180,"longitude":-74.0040,"elevation":15}
    ]
  }'

# 4. Get route summary
curl -X GET http://localhost:3000/api/routes/$ID/summary \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Get GeoJSON for mapping
curl -X GET http://localhost:3000/api/routes/$ID/geojson \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## 🔒 Security & Privacy

- Routes are **per-user only** - users can only access their own routes
- Points are **stored incrementally** - no need to wait for activity completion
- GeoJSON is **private** - only the activity owner can retrieve it
- Timestamps are optional - if not provided, server timestamp is used

## 🛠️ Testing

Run the GPS test script:
```bash
./test-gps.sh
```

This will:
1. Register a new user
2. Create an activity
3. Record 9 GPS points (simulating a 5K loop)
4. Retrieve the full route data
5. Fetch the route as GeoJSON
6. Display calculated statistics

## 🚧 Future Enhancements

- **Segment Detection** - Auto-identify notable segments (climbs, sprints)
- **Social Routes** - Compare your routes with friends' on same paths
- **Route Recommendations** - "Popular routes near you"
- **Privacy Zones** - Hide sensitive locations (home, work)
- **GPX Export** - Download routes as standard GPX files
- **Heart Rate Zones** - If heart rate data is available
- **Real-time Tracking** - Share live GPS stream with friends

## 📞 Support

For issues or questions:
- Check the example test script: `test-gps.sh`
- Review the GPS utility functions: `src/utils/gps.js`
- Test endpoints with `curl` or Postman
- Use `map-viewer.html` for visualization debugging
