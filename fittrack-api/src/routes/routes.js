const express = require("express");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");
const { calculateDistance, calculateRouteStats, routeToGeoJSON } = require("../utils/gps");

const router = express.Router();

// POST /api/routes/:activityId/record
// Record GPS point(s) for an activity
router.post("/:activityId/record", authMiddleware, (req, res) => {
  const { activityId } = req.params;
  const { points } = req.body;

  if (!points || !Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: "Points array is required" });
  }

  // Verify activity exists and belongs to user
  const activity = db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
  if (!activity) {
    return res.status(404).json({ error: "Activity not found" });
  }
  if (activity.user_id !== req.user.id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO activity_routes (activity_id, latitude, longitude, elevation, distance_from_start, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Calculate cumulative distance
    let cumulativeDistance = 0;
    const existingRoute = db
      .prepare("SELECT latitude, longitude FROM activity_routes WHERE activity_id = ? ORDER BY timestamp DESC LIMIT 1")
      .get(activityId);

    let lastLat = existingRoute?.latitude;
    let lastLon = existingRoute?.longitude;

    points.forEach((point) => {
      const { latitude, longitude, elevation, timestamp } = point;

      if (!latitude || !longitude) {
        throw new Error("Each point must have latitude and longitude");
      }

      // Calculate distance from previous point
      if (lastLat !== undefined && lastLon !== undefined) {
        cumulativeDistance += calculateDistance(lastLat, lastLon, latitude, longitude);
      }

      stmt.run(activityId, latitude, longitude, elevation || 0, cumulativeDistance, timestamp || new Date().toISOString());

      lastLat = latitude;
      lastLon = longitude;
    });

    // Update activity with calculated distance if not set
    const route = db
      .prepare("SELECT latitude, longitude, elevation FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC")
      .all(activityId);

    if (route.length > 0) {
      const stats = calculateRouteStats(route);
      db.prepare("UPDATE activities SET distance = ?, elevation_gain = ? WHERE id = ?").run(
        stats.total_distance_km,
        stats.total_elevation_m,
        activityId
      );
    }

    return res.json({ message: "GPS points recorded", points_added: points.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/routes/:activityId
// Retrieve full route for an activity
router.get("/:activityId", authMiddleware, (req, res) => {
  const { activityId } = req.params;

  try {
    // Verify activity exists and belongs to user
    const activity = db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }
    if (activity.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const route = db
      .prepare(
        `SELECT id, latitude, longitude, elevation, distance_from_start, timestamp 
       FROM activity_routes 
       WHERE activity_id = ? 
       ORDER BY timestamp ASC`
      )
      .all(activityId);

    if (route.length === 0) {
      return res.json({ points: [], stats: { total_distance_km: 0, total_elevation_m: 0, max_elevation_m: 0 } });
    }

    const stats = calculateRouteStats(route);

    return res.json({
      activity_id: activityId,
      points: route,
      stats,
      geojson: routeToGeoJSON(route),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/routes/:activityId/geojson
// Get route as GeoJSON (for mapping)
router.get("/:activityId/geojson", authMiddleware, (req, res) => {
  const { activityId } = req.params;

  try {
    // Verify activity exists and belongs to user
    const activity = db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }
    if (activity.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const route = db
      .prepare("SELECT latitude, longitude, elevation FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC")
      .all(activityId);

    if (route.length === 0) {
      return res.json({
        type: "FeatureCollection",
        features: [],
      });
    }

    return res.json(routeToGeoJSON(route));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/routes/:activityId/summary
// Get route statistics
router.get("/:activityId/summary", authMiddleware, (req, res) => {
  const { activityId } = req.params;

  try {
    // Verify activity exists and belongs to user
    const activity = db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }
    if (activity.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const route = db
      .prepare("SELECT latitude, longitude, elevation FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC")
      .all(activityId);

    const pointCount = route.length;
    const stats = calculateRouteStats(route);

    return res.json({
      activity_id: activityId,
      total_points: pointCount,
      ...stats,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
