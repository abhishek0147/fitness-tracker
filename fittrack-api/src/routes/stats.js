const express = require("express");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");
const router = express.Router();

// GET /api/stats
router.get("/", authMiddleware, async (req, res) => {
  try {
    const overall = await db.prepare(`
      SELECT
        COUNT(*) as total_activities,
        COALESCE(SUM(distance), 0) as total_distance_km,
        COALESCE(SUM(duration), 0) as total_duration_seconds,
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(SUM(elevation_gain), 0) as total_elevation_m,
        COALESCE(AVG(avg_heart_rate), 0) as avg_heart_rate,
        COALESCE(MAX(distance), 0) as longest_distance_km,
        COALESCE(MAX(duration), 0) as longest_duration_seconds
      FROM activities WHERE user_id = ?
    `).get(req.user.id);

    const byType = await db.prepare(`
      SELECT type,
        COUNT(*) as count,
        COALESCE(SUM(distance), 0) as total_distance_km,
        COALESCE(SUM(duration), 0) as total_duration_seconds,
        COALESCE(SUM(calories), 0) as total_calories
      FROM activities WHERE user_id = ?
      GROUP BY type ORDER BY count DESC
    `).all(req.user.id);

    // SQLite-compatible: last 7 days using date arithmetic
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thisWeek = await db.prepare(`
      SELECT COUNT(*) as activities,
        COALESCE(SUM(distance), 0) as distance_km,
        COALESCE(SUM(duration), 0) as duration_seconds,
        COALESCE(SUM(calories), 0) as calories
      FROM activities WHERE user_id = ? AND date >= ?
    `).get(req.user.id, sevenDaysAgo);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const thisMonth = await db.prepare(`
      SELECT COUNT(*) as activities,
        COALESCE(SUM(distance), 0) as distance_km,
        COALESCE(SUM(duration), 0) as duration_seconds,
        COALESCE(SUM(calories), 0) as calories
      FROM activities WHERE user_id = ? AND date >= ?
    `).get(req.user.id, thirtyDaysAgo);

    return res.json({
      overall,
      by_type: byType,
      this_week: thisWeek,
      this_month: thisMonth,
      weekly_trend: [],
    });
  } catch (err) {
    console.error("Stats error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats/personal-records
router.get("/personal-records", authMiddleware, async (req, res) => {
  try {
    const records = await db.prepare(`
      SELECT type,
        MAX(distance) as longest_distance_km,
        MAX(duration) as longest_duration_seconds,
        MAX(elevation_gain) as most_elevation_m,
        MAX(calories) as most_calories
      FROM activities WHERE user_id = ?
      GROUP BY type
    `).all(req.user.id);
    return res.json({ personal_records: records });
  } catch (err) {
    console.error("Records error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
