const express = require("express");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET /api/stats
router.get("/", authMiddleware, async (req, res) => {
  try {
    const overall = await db
      .prepare(`
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
      `)
      .get(req.user.id);

    const byType = await db
      .prepare(`
        SELECT 
          type,
          COUNT(*) as count,
          COALESCE(SUM(distance), 0) as total_distance_km,
          COALESCE(SUM(duration), 0) as total_duration_seconds,
          COALESCE(SUM(calories), 0) as total_calories
        FROM activities WHERE user_id = ?
        GROUP BY type
        ORDER BY count DESC
      `)
      .all(req.user.id);

    const thisWeek = await db
      .prepare(`
        SELECT
          COUNT(*) as activities,
          COALESCE(SUM(distance), 0) as distance_km,
          COALESCE(SUM(duration), 0) as duration_seconds,
          COALESCE(SUM(calories), 0) as calories
        FROM activities
        WHERE user_id = ? AND date >= NOW() - INTERVAL '7 days'
      `)
      .get(req.user.id);

    const thisMonth = await db
      .prepare(`
        SELECT
          COUNT(*) as activities,
          COALESCE(SUM(distance), 0) as distance_km,
          COALESCE(SUM(duration), 0) as duration_seconds,
          COALESCE(SUM(calories), 0) as calories
        FROM activities
        WHERE user_id = ? AND date >= DATE_TRUNC('month', NOW())
      `)
      .get(req.user.id);

    const recentTrend = await db
      .prepare(`
        SELECT 
          TO_CHAR(date, 'IYYY-IW') as week,
          COUNT(*) as activities,
          COALESCE(SUM(distance), 0) as distance_km,
          COALESCE(SUM(duration), 0) as duration_seconds
        FROM activities WHERE user_id = ?
        GROUP BY week
        ORDER BY week DESC
        LIMIT 8
      `)
      .all(req.user.id);

    return res.json({
      overall,
      by_type: byType,
      this_week: thisWeek,
      this_month: thisMonth,
      weekly_trend: recentTrend.reverse(),
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats/personal-records
router.get("/personal-records", authMiddleware, async (req, res) => {
  try {
    const records = await db
      .prepare(`
        SELECT type,
          MAX(distance) as longest_distance_km,
          MAX(duration) as longest_duration_seconds,
          MAX(elevation_gain) as most_elevation_m,
          MAX(calories) as most_calories
        FROM activities WHERE user_id = ?
        GROUP BY type
      `)
      .all(req.user.id);

    return res.json({ personal_records: records });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
