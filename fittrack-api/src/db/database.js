// ============================================================
// FitTrack Database
// Vercel → Supabase / any PostgreSQL (via pg)
// Local  → better-sqlite3
// ============================================================

const IS_VERCEL = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION);

// ── VERCEL: PostgreSQL via pg ─────────────────────────────────
if (IS_VERCEL) {
  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Create tables on first run
  async function initDB() {
    const client = await pool.connect();
    try {
      await client.query(`
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
      `);
      console.log("[DB] PostgreSQL tables ready");
    } finally {
      client.release();
    }
  }

  initDB().catch(err => console.error("[DB] Init error:", err.message));

  // ── Convert $1/$2 placeholders from ? style ──────────────────
  function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  // ── better-sqlite3-compatible synchronous-style API ──────────
  // We wrap async pg calls using a sync-looking interface via
  // a shared pending map + Atomics trick isn't available in Node
  // serverless, so instead we return a thenable proxy that routes
  // .get/.all/.run through async pg and resolves in the route handlers.
  //
  // IMPORTANT: All route handlers that use db.prepare().get/all/run
  // must be made async and awaited. We export a prepare() that
  // returns an object with async get/all/run methods.

  module.exports = {
    pragma() {},
    exec(sql) {
      pool.query(convertPlaceholders(sql)).catch(() => {});
    },
    prepare(sql) {
      const pgSql = convertPlaceholders(sql);
      return {
        async get(...args) {
          const params = args.flat();
          const { rows } = await pool.query(pgSql, params);
          return rows[0] || null;
        },
        async all(...args) {
          const params = args.flat();
          const { rows } = await pool.query(pgSql, params);
          return rows;
        },
        async run(...args) {
          const params = args.flat();
          // For INSERT ... RETURNING id
          let finalSql = pgSql;
          if (/^INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
            finalSql = pgSql + " RETURNING id";
          }
          const { rows, rowCount } = await pool.query(finalSql, params);
          return {
            changes: rowCount,
            lastInsertRowid: rows[0]?.id || 0,
          };
        },
      };
    },
  };

} else {
  // ── LOCAL: better-sqlite3 ─────────────────────────────────
  const path = require("path");
  const Database = require("better-sqlite3");
  const db = new Database(path.join(__dirname, "../../fittrack.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL, title TEXT NOT NULL,
      type TEXT NOT NULL, distance REAL DEFAULT 0,
      duration INTEGER NOT NULL, elevation_gain REAL DEFAULT 0,
      calories INTEGER DEFAULT 0, avg_heart_rate INTEGER DEFAULT 0,
      notes TEXT DEFAULT '', date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kudos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(activity_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );
    CREATE TABLE IF NOT EXISTS activity_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL, latitude REAL NOT NULL,
      longitude REAL NOT NULL, elevation REAL DEFAULT 0,
      distance_from_start REAL DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("[DB] better-sqlite3 ready (local)");
  module.exports = db;
}
