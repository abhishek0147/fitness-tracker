# 🏃‍♂️ FitTrack API

A Strava-like fitness tracking REST API built with Node.js, Express, and SQLite.

## Features

- 🔐 JWT Authentication (register, login)
- 🏋️ Activity logging (run, ride, swim, walk, hike, workout)
- 📊 Personal stats & weekly trends
- 🏅 Personal records tracking
- 👏 Kudos system (give/remove likes on activities)
- 👥 Follow/unfollow athletes
- 📰 Social feed (activities from people you follow)
- 🌍 Explore feed (discover all athletes)

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite (via `better-sqlite3`)
- **Auth:** JWT + bcrypt
- **No external database setup required!**

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/fittrack-api.git
cd fittrack-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# Start the server
npm start

# Development mode (auto-restart)
npm run dev
```

The server starts at `http://localhost:3000`

Visit `http://localhost:3000` to see all available endpoints.

## API Endpoints

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account | ❌ |
| POST | `/api/auth/login` | Login, get token | ❌ |
| GET | `/api/auth/me` | Get own profile + stats | ✅ |
| GET | `/api/auth/users/:id` | Get public profile | ✅ |
| POST | `/api/auth/follow/:id` | Follow/unfollow user | ✅ |

### Activities

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/activities` | Log new activity | ✅ |
| GET | `/api/activities` | Get your activities | ✅ |
| GET | `/api/activities/:id` | Get single activity | ✅ |
| PUT | `/api/activities/:id` | Update activity | ✅ |
| DELETE | `/api/activities/:id` | Delete activity | ✅ |
| POST | `/api/activities/:id/kudos` | Toggle kudos | ✅ |

### Stats

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/stats` | Personal stats summary | ✅ |
| GET | `/api/stats/personal-records` | Your PRs by activity type | ✅ |

### Feed

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/feed` | Feed from people you follow | ✅ |
| GET | `/api/feed/explore` | All public activities | ✅ |

## Usage Examples

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "secret123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "secret123"}'
```

### Log an activity
```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning Run",
    "type": "run",
    "distance": 5.2,
    "duration": 1800,
    "elevation_gain": 120,
    "calories": 420,
    "avg_heart_rate": 155,
    "notes": "Felt great today!"
  }'
```

### Get your stats
```bash
curl http://localhost:3000/api/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Activity Types

`run` | `ride` | `swim` | `walk` | `hike` | `workout` | `other`

## Activity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | ✅ | Activity name |
| type | string | ✅ | Activity type |
| duration | number | ✅ | Duration in seconds |
| distance | number | ❌ | Distance in km |
| elevation_gain | number | ❌ | Elevation in meters |
| calories | number | ❌ | Calories burned |
| avg_heart_rate | number | ❌ | Average heart rate (bpm) |
| notes | string | ❌ | Activity notes |
| date | ISO string | ❌ | Defaults to current time |

## Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Tokens expire after **7 days**.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret key for JWT signing | — |

## Project Structure

```
fittrack-api/
├── src/
│   ├── routes/
│   │   ├── auth.js          # Auth & user endpoints
│   │   ├── activities.js    # Activity CRUD + kudos
│   │   ├── stats.js         # Stats & personal records
│   │   └── feed.js          # Social feed & explore
│   ├── middleware/
│   │   └── auth.js          # JWT middleware
│   ├── db/
│   │   └── database.js      # SQLite setup & schema
│   └── app.js               # Express app entry point
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## License

MIT
