require("dotenv").config();
const express = require("express");

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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

// Home page - redirect or show dashboard
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FitTrack - Fitness Tracking</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #0a0e27 0%, #16213e 50%, #1a1a2e 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #e0e0e0;
        }
        .container {
          text-align: center;
          max-width: 600px;
          padding: 40px;
        }
        .logo { font-size: 80px; margin-bottom: 20px; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        h1 {
          font-size: 48px;
          background: linear-gradient(135deg, #66ffc0 0%, #00ff88 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 10px;
          animation: glow 2s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 10px rgba(102, 255, 192, 0.5); }
          50% { text-shadow: 0 0 20px rgba(102, 255, 192, 0.8); }
        }
        p {
          font-size: 18px;
          color: #b0e0d0;
          margin-bottom: 30px;
        }
        .buttons {
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
        }
        a, button {
          padding: 14px 30px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #66ffc0 0%, #00ff88 100%);
          color: #0a0e27;
          box-shadow: 0 0 20px rgba(102, 255, 192, 0.3);
        }
        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 5px 30px rgba(102, 255, 192, 0.6);
        }
        .btn-secondary {
          background: rgba(102, 255, 192, 0.1);
          color: #66ffc0;
          border: 2px solid #66ffc0;
        }
        .btn-secondary:hover {
          background: rgba(102, 255, 192, 0.2);
          box-shadow: 0 0 25px rgba(102, 255, 192, 0.5);
        }
        .features {
          margin-top: 50px;
          text-align: left;
          display: inline-block;
        }
        .feature {
          margin: 15px 0;
          font-size: 16px;
          color: #b0e0d0;
        }
        .status {
          margin-top: 30px;
          padding: 15px;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 8px;
          color: #00ff88;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🏃</div>
        <h1>FitTrack</h1>
        <p>Your Personal Fitness Companion</p>
        
        <div class="buttons">
          <a href="/login.html" class="btn-primary">Get Started</a>
          <a href="/api" class="btn-secondary">API Docs</a>
        </div>

        <div class="features">
          <div class="feature">✅ Live GPS Tracking</div>
          <div class="feature">✅ Activity Analytics</div>
          <div class="feature">✅ Social Community</div>
          <div class="feature">✅ Real-time Stats</div>
        </div>

        <div class="status">
          🟢 API Status: Online & Ready
        </div>
      </div>
    </body>
    </html>
  `);
});

// API docs
app.get("/api", (req, res) => {
  res.json({
    name: "FitTrack API",
    version: "1.0.0",
    description: "A Strava-like fitness tracking API",
    status: "running",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Create a new account",
        "POST /api/auth/login": "Login and get JWT token",
        "GET /api/auth/me": "Get current user profile (auth required)",
        "GET /api/auth/users/:id": "Get public profile of a user (auth required)",
        "POST /api/auth/follow/:id": "Follow/unfollow a user (auth required)",
      },
      activities: {
        "POST /api/activities": "Log a new activity (auth required)",
        "GET /api/activities": "Get your activities (auth required)",
        "GET /api/activities/:id": "Get a single activity (auth required)",
        "PUT /api/activities/:id": "Update an activity (auth required)",
        "DELETE /api/activities/:id": "Delete an activity (auth required)",
        "POST /api/activities/:id/kudos": "Give/remove kudos (auth required)",
      },
      stats: {
        "GET /api/stats": "Get your personal stats summary (auth required)",
        "GET /api/stats/personal-records": "Get your personal records (auth required)",
      },
      feed: {
        "GET /api/feed": "Get activity feed from people you follow (auth required)",
        "GET /api/feed/explore": "Explore all public activities (auth required)",
      },
      gps: {
        "POST /api/routes/:activityId/record": "Record GPS points for activity (auth required)",
        "GET /api/routes/:activityId": "Get full route data with GeoJSON (auth required)",
        "GET /api/routes/:activityId/geojson": "Get route as GeoJSON (auth required)",
        "GET /api/routes/:activityId/summary": "Get route statistics (auth required)",
      },
    },
  });
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

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║         FitTrack API 🏃‍♂️              ║
  ║   Server running on port ${PORT}         ║
  ║   Visit: http://localhost:${PORT}        ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
