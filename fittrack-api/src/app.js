require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const activitiesRoutes = require("./routes/activities");
const statsRoutes = require("./routes/stats");
const feedRoutes = require("./routes/feed");
const routesRoutes = require("./routes/routes");
const { initializeFirebase } = require("./services/firebaseService");

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase
initializeFirebase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/routes", routesRoutes);

// Serve all HTML pages
const HTML_PAGES = ["login","dashboard","start-activity","save-activity","activity-history","squad","live-tracker-neon","map-viewer"];
HTML_PAGES.forEach(p => {
  app.get([`/${p}`, `/${p}.html`], (req, res) => {
    const f = path.join(__dirname, `../${p}.html`);
    res.sendFile(f, err => { if (err) res.redirect('/'); });
  });
});

// Home page - redirect or show dashboard
app.get("/", (req, res) => {
  res.redirect('/login.html');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         FitTrack API 🏃‍♂️              ║
  ║   Server running on port ${PORT}         ║
  ║   Visit: http://localhost:${PORT}        ║
  ╚═══════════════════════════════════════╝
  `);
  });
}

module.exports = app;
