const express = require("express");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET /api/feed — activities from people you follow + your own
router.get("/", authMiddleware, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const activities = db
      .prepare(`
        SELECT 
          a.*,
          u.name as athlete_name,
          u.avatar_url as athlete_avatar,
          (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id) as kudos_count,
          (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id AND user_id = ?) as has_kudoed
        FROM activities a
        JOIN users u ON a.user_id = u.id
        WHERE a.user_id = ?
          OR a.user_id IN (
            SELECT following_id FROM follows WHERE follower_id = ?
          )
        ORDER BY a.date DESC
        LIMIT ? OFFSET ?
      `)
      .all(req.user.id, req.user.id, req.user.id, parseInt(limit), offset);

    const total = db
      .prepare(`
        SELECT COUNT(*) as count FROM activities a
        WHERE a.user_id = ?
          OR a.user_id IN (
            SELECT following_id FROM follows WHERE follower_id = ?
          )
      `)
      .get(req.user.id, req.user.id);

    return res.json({
      activities,
      pagination: {
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.count / parseInt(limit)),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/feed/explore — all public activities (discover athletes)
router.get("/explore", authMiddleware, (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT 
        a.*,
        u.name as athlete_name,
        u.avatar_url as athlete_avatar,
        (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id) as kudos_count,
        (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id AND user_id = ?) as has_kudoed
      FROM activities a
      JOIN users u ON a.user_id = u.id
    `;
    const params = [req.user.id];

    if (type) {
      query += " WHERE a.type = ?";
      params.push(type);
    }

    query += " ORDER BY a.date DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const activities = db.prepare(query).all(...params);

    return res.json({ activities });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
