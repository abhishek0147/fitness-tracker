const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const authMiddleware = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "fittrack-secret-fallback-2024";
const router = express.Router();

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { name, email, password, bio } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email, and password are required" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email format" });
  try {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: "Email already in use" });
    const hashed = bcrypt.hashSync(password, 10);
    const result = db.prepare("INSERT INTO users (name, email, password, bio) VALUES (?, ?, ?, ?)").run(name, email.toLowerCase(), hashed, bio || "");
    const token = jwt.sign({ id: result.lastInsertRowid, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: "7d" });
    return res.status(201).json({ message: "Account created successfully", token, user: { id: result.lastInsertRowid, name, email: email.toLowerCase(), bio: bio || "" } });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Invalid email or password" });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ message: "Login successful", token, user: { id: user.id, name: user.name, email: user.email, bio: user.bio, avatar_url: user.avatar_url, created_at: user.created_at } });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/google
router.post("/google", (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user) {
      const hashed = bcrypt.hashSync(Math.random().toString(36), 10);
      const result = db.prepare("INSERT INTO users (name, email, password, bio) VALUES (?, ?, ?, ?)").run(name || "Google User", email.toLowerCase(), hashed, "Joined via Google");
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ message: "Google login successful", token, user: { id: user.id, name: user.name, email: user.email, bio: user.bio, avatar_url: user.avatar_url, created_at: user.created_at } });
  } catch (err) {
    console.error("Google auth error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  try {
    const user = db.prepare("SELECT id, name, email, bio, avatar_url, created_at FROM users WHERE id = ?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const stats = db.prepare("SELECT COUNT(*) as total_activities, COALESCE(SUM(distance), 0) as total_distance, COALESCE(SUM(duration), 0) as total_duration, COALESCE(SUM(calories), 0) as total_calories FROM activities WHERE user_id = ?").get(req.user.id);
    return res.json({ ...user, stats });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/users/:id
router.get("/users/:id", authMiddleware, (req, res) => {
  try {
    const user = db.prepare("SELECT id, name, bio, avatar_url, created_at FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const stats = db.prepare("SELECT COUNT(*) as total_activities, COALESCE(SUM(distance), 0) as total_distance, COALESCE(SUM(duration), 0) as total_duration FROM activities WHERE user_id = ?").get(req.params.id);
    const followers = db.prepare("SELECT COUNT(*) as count FROM follows WHERE following_id = ?").get(req.params.id);
    const following = db.prepare("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?").get(req.params.id);
    const isFollowing = db.prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?").get(req.user.id, req.params.id);
    return res.json({ ...user, stats, followers: followers.count, following: following.count, is_following: !!isFollowing });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/follow/:id
router.post("/follow/:id", authMiddleware, (req, res) => {
  const followingId = parseInt(req.params.id);
  if (followingId === req.user.id)
    return res.status(400).json({ error: "You cannot follow yourself" });
  try {
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(followingId);
    if (!target) return res.status(404).json({ error: "User not found" });
    const existing = db.prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?").get(req.user.id, followingId);
    if (existing) {
      db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(req.user.id, followingId);
      return res.json({ message: "Unfollowed successfully", following: false });
    }
    db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(req.user.id, followingId);
    return res.json({ message: "Followed successfully", following: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
