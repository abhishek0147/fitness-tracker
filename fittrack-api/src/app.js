require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

try { const { initializeFirebase } = require("./services/firebaseService"); initializeFirebase(); } catch (e) { console.warn("Firebase skipped:", e.message); }

const routes = { "/api/auth": "./routes/auth", "/api/activities": "./routes/activities", "/api/stats": "./routes/stats", "/api/feed": "./routes/feed", "/api/routes": "./routes/routes" };
for (const [prefix, file] of Object.entries(routes)) {
  try { app.use(prefix, require(file)); }
  catch (e) { console.error(`Route ${prefix} failed:`, e.message); app.use(prefix, (req, res) => res.status(503).json({ error: "Service unavailable" })); }
}

// PWA files
app.get("/manifest.json", (req, res) => res.sendFile(path.join(__dirname, "../manifest.json")));
app.get("/sw.js", (req, res) => { res.setHeader("Service-Worker-Allowed", "/"); res.sendFile(path.join(__dirname, "../sw.js")); });

// HTML pages
["login","dashboard","start-activity","save-activity","activity-history","squad","live-tracker-neon","map-viewer"].forEach(p => {
  app.get([`/${p}`, `/${p}.html`], (req, res) => {
    res.sendFile(path.join(__dirname, `../${p}.html`), err => { if (err) res.redirect("/login.html"); });
  });
});

app.get("/", (req, res) => res.redirect("/login.html"));
app.use((req, res) => {
  if (req.headers.accept?.includes("text/html")) return res.redirect("/login.html");
  res.status(404).json({ error: "Not found" });
});
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: "Server error" }); });

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;
if (!isVercel) app.listen(PORT, () => console.log(`🏃 FitTrack → http://localhost:${PORT}`));

module.exports = app;
