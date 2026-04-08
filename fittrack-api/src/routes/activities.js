const express = require("express");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const VALID_TYPES = ["run", "ride", "swim", "walk", "hike", "workout", "other"];

// POST /api/activities — log a new activity
router.post("/", authMiddleware, (req, res) => {
  const { title, type, distance, duration, elevation_gain, calories, avg_heart_rate, notes, date } =
    req.body;

  if (!title || !type || !duration) {
    return res.status(400).json({ error: "Title, type, and duration are required" });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Type must be one of: ${VALID_TYPES.join(", ")}` });
  }

  if (typeof duration !== "number" || duration <= 0) {
    return res.status(400).json({ error: "Duration must be a positive number (in seconds)" });
  }

  try {
    const result = db
      .prepare(`
        INSERT INTO activities 
          (user_id, title, type, distance, duration, elevation_gain, calories, avg_heart_rate, notes, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.user.id,
        title,
        type,
        distance || 0,
        duration,
        elevation_gain || 0,
        calories || 0,
        avg_heart_rate || 0,
        notes || "",
        date || new Date().toISOString()
      );

    const activity = db
      .prepare("SELECT * FROM activities WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({ message: "Activity logged!", activity });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/activities — get current user's activities
router.get("/", authMiddleware, (req, res) => {
  const { page = 1, limit = 10, type } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT a.*, 
        (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id) as kudos_count,
        (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id AND user_id = ?) as has_kudoed
      FROM activities a
      WHERE a.user_id = ?
    `;
    const params = [req.user.id, req.user.id];

    if (type && VALID_TYPES.includes(type)) {
      query += " AND a.type = ?";
      params.push(type);
    }

    query += " ORDER BY a.date DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const activities = db.prepare(query).all(...params);

    const total = db
      .prepare(`SELECT COUNT(*) as count FROM activities WHERE user_id = ?${type ? " AND type = ?" : ""}`)
      .get(...(type ? [req.user.id, type] : [req.user.id]));

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

// GET /api/activities/:id — get single activity
router.get("/:id", authMiddleware, (req, res) => {
  try {
    const activity = db
      .prepare(`
        SELECT a.*, 
          u.name as athlete_name, u.id as athlete_id,
          (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id) as kudos_count,
          (SELECT COUNT(*) FROM kudos WHERE activity_id = a.id AND user_id = ?) as has_kudoed
        FROM activities a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
      `)
      .get(req.user.id, req.params.id);

    if (!activity) return res.status(404).json({ error: "Activity not found" });

    return res.json(activity);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/activities/:id — update activity
router.put("/:id", authMiddleware, (req, res) => {
  const { title, type, distance, duration, elevation_gain, calories, avg_heart_rate, notes, date } =
    req.body;

  try {
    const activity = db
      .prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);

    if (!activity) {
      return res.status(404).json({ error: "Activity not found or unauthorized" });
    }

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${VALID_TYPES.join(", ")}` });
    }

    db.prepare(`
      UPDATE activities SET
        title = ?, type = ?, distance = ?, duration = ?,
        elevation_gain = ?, calories = ?, avg_heart_rate = ?, notes = ?, date = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title || activity.title,
      type || activity.type,
      distance ?? activity.distance,
      duration || activity.duration,
      elevation_gain ?? activity.elevation_gain,
      calories ?? activity.calories,
      avg_heart_rate ?? activity.avg_heart_rate,
      notes ?? activity.notes,
      date || activity.date,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare("SELECT * FROM activities WHERE id = ?").get(req.params.id);
    return res.json({ message: "Activity updated", activity: updated });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/activities/:id
router.delete("/:id", authMiddleware, (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM activities WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Activity not found or unauthorized" });
    }

    return res.json({ message: "Activity deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/activities/:id/kudos — give/remove kudos
router.post("/:id/kudos", authMiddleware, (req, res) => {
  try {
    const activity = db
      .prepare("SELECT * FROM activities WHERE id = ?")
      .get(req.params.id);

    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (activity.user_id === req.user.id) {
      return res.status(400).json({ error: "You cannot give kudos to your own activity" });
    }

    const existing = db
      .prepare("SELECT id FROM kudos WHERE activity_id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);

    if (existing) {
      db.prepare("DELETE FROM kudos WHERE activity_id = ? AND user_id = ?").run(
        req.params.id,
        req.user.id
      );
      const count = db
        .prepare("SELECT COUNT(*) as count FROM kudos WHERE activity_id = ?")
        .get(req.params.id);
      return res.json({ message: "Kudos removed", kudos_count: count.count, has_kudoed: false });
    } else {
      db.prepare("INSERT INTO kudos (activity_id, user_id) VALUES (?, ?)").run(
        req.params.id,
        req.user.id
      );
      const count = db
        .prepare("SELECT COUNT(*) as count FROM kudos WHERE activity_id = ?")
        .get(req.params.id);
      return res.json({ message: "Kudos given! 🎉", kudos_count: count.count, has_kudoed: true });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
