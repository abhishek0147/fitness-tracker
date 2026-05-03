/**
 * FitTrack Database
 * Local  → better-sqlite3
 * Vercel → PostgreSQL via pg
 */
const IS_VERCEL = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION);

if (!IS_VERCEL) {
  const path = require("path");
  const Database = require("better-sqlite3");
  const db = new Database(path.join(__dirname, "../../fittrack.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, distance REAL DEFAULT 0, duration INTEGER NOT NULL, elevation_gain REAL DEFAULT 0, calories INTEGER DEFAULT 0, avg_heart_rate INTEGER DEFAULT 0, notes TEXT DEFAULT '', date DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS kudos (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(activity_id, user_id));
    CREATE TABLE IF NOT EXISTS follows (id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(follower_id, following_id));
    CREATE TABLE IF NOT EXISTS activity_routes (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, elevation REAL DEFAULT 0, distance_from_start REAL DEFAULT 0, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  console.log("[DB] SQLite ready");
  module.exports = db;

} else {
  // Vercel: PostgreSQL
  console.log("[DB] Using PostgreSQL");

  if (!process.env.DATABASE_URL) {
    console.error("[DB] FATAL: DATABASE_URL is not set. All API calls will fail.");
  }

  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  // Create tables on first run (safe to call multiple times)
  pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      distance REAL DEFAULT 0,
      duration INTEGER NOT NULL,
      elevation_gain REAL DEFAULT 0,
      calories INTEGER DEFAULT 0,
      avg_heart_rate INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      date TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS kudos (
      id SERIAL PRIMARY KEY,
      activity_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(activity_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(follower_id, following_id)
    );
    CREATE TABLE IF NOT EXISTS activity_routes (
      id SERIAL PRIMARY KEY,
      activity_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL DEFAULT 0,
      distance_from_start REAL DEFAULT 0,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `).then(() => console.log("[DB] PostgreSQL tables ready")).catch(e => console.error("[DB] Table init error:", e.message));

  // Convert SQLite ? placeholders to PostgreSQL $1 $2 ...
  function toPostgres(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  module.exports = {
    pragma() {},
    exec(sql) { return pool.query(sql).catch(() => {}); },
    prepare(sql) {
      return {
        async get(...args) {
          const params = args.flat();
          const { rows } = await pool.query(toPostgres(sql), params.length ? params : undefined);
          return rows[0];
        },
        async all(...args) {
          const params = args.flat();
          const { rows } = await pool.query(toPostgres(sql), params.length ? params : undefined);
          return rows;
        },
        async run(...args) {
          const params = args.flat();
          let q = toPostgres(sql);
          if (/^INSERT/i.test(q) && !/RETURNING/i.test(q)) q += " RETURNING id";
          try {
            const result = await pool.query(q, params.length ? params : undefined);
            return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id || 0 };
          } catch (e) {
            if (e.code === "23505") {
              const err = new Error("UNIQUE constraint failed");
              err.code = "SQLITE_CONSTRAINT_UNIQUE";
              throw err;
            }
            throw e;
          }
        },
      };
    },
  };
}
