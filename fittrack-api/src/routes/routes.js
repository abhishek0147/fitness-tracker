const express = require("express");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");
const { calculateDistance, calculateRouteStats, routeToGeoJSON } = require("../utils/gps");

const router = express.Router();

// POST /api/routes/:activityId/record
router.post("/:activityId/record", authMiddleware, async (req, res) => {
  const { activityId } = req.params;
  const { points } = req.body;

  if (!points || !Array.isArray(points) || points.length === 0)
    return res.status(400).json({ error: "Points array is required" });

  const activity = await db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
  if (!activity) return res.status(404).json({ error: "Activity not found" });
  if (activity.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

  try {
    let cumulativeDistance = 0;
    const existingRoute = await db
      .prepare("SELECT latitude, longitude FROM activity_routes WHERE activity_id = ? ORDER BY timestamp DESC LIMIT 1")
      .get(activityId);

    let lastLat = existingRoute?.latitude;
    let lastLon = existingRoute?.longitude;

    for (const point of points) {
      const { latitude, longitude, elevation, timestamp } = point;
      if (!latitude || !longitude) throw new Error("Each point must have latitude and longitude");

      if (lastLat !== undefined && lastLon !== undefined)
        cumulativeDistance += calculateDistance(lastLat, lastLon, latitude, longitude);

      await db.prepare(`
        INSERT INTO activity_routes (activity_id, latitude, longitude, elevation, distance_from_start, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(activityId, latitude, longitude, elevation || 0, cumulativeDistance, timestamp || new Date().toISOString());

      lastLat = latitude;
      lastLon = longitude;
    }

    const route = await db
      .prepare("SELECT latitude, longitude, elevation FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC")
      .all(activityId);

    if (route.length > 0) {
      const stats = calculateRouteStats(route);
      await db.prepare("UPDATE activities SET distance = ?, elevation_gain = ? WHERE id = ?").run(
        stats.total_distance_km, stats.total_elevation_m, activityId
      );
    }

    return res.json({ message: "GPS points recorded", points_added: points.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET /api/routes/:activityId
router.get("/:activityId", authMiddleware, async (req, res) => {
  const { activityId } = req.params;
  try {
    const activity = await db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

    const route = await db
      .prepare(`SELECT id, latitude, longitude, elevation, distance_from_start, timestamp 
        FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC`)
      .all(activityId);

    if (route.length === 0)
      return res.json({ points: [], stats: { total_distance_km: 0, total_elevation_m: 0, max_elevation_m: 0 } });

    const stats = calculateRouteStats(route);
    return res.json({ activity_id: activityId, points: route, stats, geojson: routeToGeoJSON(route) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/routes/:activityId/geojson
router.get("/:activityId/geojson", authMiddleware, async (req, res) => {
  const { activityId } = req.params;
  try {
    const activity = await db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

    const route = await db
      .prepare("SELECT latitude, longitude, elevation FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC")
      .all(activityId);

    if (route.length === 0) return res.json({ type: "FeatureCollection", features: [] });
    return res.json(routeToGeoJSON(route));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/routes/:activityId/summary
router.get("/:activityId/summary", authMiddleware, async (req, res) => {
  const { activityId } = req.params;
  try {
    const activity = await db.prepare("SELECT id, user_id FROM activities WHERE id = ?").get(activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });

    const route = await db
      .prepare("SELECT latitude, longitude, elevation FROM activity_routes WHERE activity_id = ? ORDER BY timestamp ASC")
      .all(activityId);

    const stats = calculateRouteStats(route);
    return res.json({ activity_id: activityId, total_points: route.length, ...stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
