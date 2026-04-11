// ============================================================
// FitTrack Database
// Vercel → pure JS in-memory (no native modules)
// Local  → better-sqlite3
// ============================================================

const IS_VERCEL = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION);

// ── VERCEL: pure in-memory store ─────────────────────────────
if (IS_VERCEL) {

  console.log("[DB] Using in-memory store (Vercel)");

  const T = {
    users: [], activities: [], kudos: [], follows: [], activity_routes: []
  };
  const ID = { users: 1, activities: 1, kudos: 1, follows: 1, activity_routes: 1 };
  const now = () => new Date().toISOString();

  // ── SQL parser helpers ──────────────────────────────────────
  function tableName(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE)\s+`?(\w+)`?/i);
    return m ? m[1].toLowerCase() : null;
  }

  function parseWhere(sql, params) {
    const m = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+GROUP\s+BY|$)/is);
    if (!m) return [];
    const cols = [...m[1].matchAll(/(\w+)\s*=\s*\?/gi)];
    return cols.map((c, i) => ({ k: c[1], v: params[i] }));
  }

  function rowMatches(row, conds) {
    return conds.every(({ k, v }) =>
      String(row[k] ?? "").toLowerCase() === String(v ?? "").toLowerCase()
    );
  }

  function runSQL(sql, params) {
    sql = sql.trim();
    const t = tableName(sql);
    const rows = t ? T[t] : [];

    // ── SELECT ──────────────────────────────────────────────
    if (/^SELECT/i.test(sql)) {
      const conds = parseWhere(sql, params);
      let out = conds.length ? rows.filter(r => rowMatches(r, conds)) : [...rows];

      // ORDER BY col DESC/ASC
      const ob = sql.match(/ORDER\s+BY\s+(?:\w+\.)?(\w+)(?:\s+(DESC|ASC))?/i);
      if (ob) {
        const [, col, dir = "ASC"] = ob;
        out.sort((a, b) => {
          const [x, y] = [a[col], b[col]];
          if (x == null) return 1; if (y == null) return -1;
          const cmp = x < y ? -1 : x > y ? 1 : 0;
          return dir.toUpperCase() === "DESC" ? -cmp : cmp;
        });
      }

      // LIMIT
      const lm = sql.match(/LIMIT\s+(\d+)/i);
      if (lm) out = out.slice(0, +lm[1]);

      // COUNT(*) AS alias
      const countAs = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i);
      if (countAs) return [{ [countAs[1]]: out.length }];

      // Aggregate functions: SUM / AVG / MAX / COALESCE
      if (/\b(SUM|AVG|MAX)\s*\(/i.test(sql)) {
        const result = {};
        for (const [, fn, inner, alias] of
          sql.matchAll(/(SUM|AVG|MAX)\(\s*(?:COALESCE\(\s*)?(\w+)[^)]*\)\s*(?:\))?\s+as\s+(\w+)/gi)
        ) {
          const vals = out.map(r => parseFloat(r[inner]) || 0);
          if (fn.toUpperCase() === "SUM") result[alias] = vals.reduce((a, b) => a + b, 0);
          if (fn.toUpperCase() === "AVG") result[alias] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          if (fn.toUpperCase() === "MAX") result[alias] = vals.length ? Math.max(...vals) : 0;
        }
        // Also handle COUNT(*) as total_activities pattern mixed in
        const countPart = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i);
        if (countPart) result[countPart[1]] = out.length;
        return [result];
      }

      return out;
    }

    // ── INSERT ───────────────────────────────────────────────
    if (/^INSERT/i.test(sql)) {
      const cm = sql.match(/\(([^)]+)\)\s*VALUES/i);
      if (!cm) return { changes: 0, lastInsertRowid: 0 };
      const cols = cm[1].split(",").map(s => s.trim());
      const id = ID[t]++;
      const row = { id, created_at: now() };
      cols.forEach((c, i) => { row[c] = params[i] !== undefined ? params[i] : null; });
      // Unique checks
      if (t === "users") {
        if (rows.some(r => r.email?.toLowerCase() === row.email?.toLowerCase())) {
          const e = new Error("UNIQUE constraint failed: users.email");
          e.code = "SQLITE_CONSTRAINT_UNIQUE";
          throw e;
        }
      }
      if (t === "kudos" && rows.some(r => r.activity_id == row.activity_id && r.user_id == row.user_id))
        return { changes: 0, lastInsertRowid: 0 };
      if (t === "follows" && rows.some(r => r.follower_id == row.follower_id && r.following_id == row.following_id))
        return { changes: 0, lastInsertRowid: 0 };
      rows.push(row);
      return { changes: 1, lastInsertRowid: id };
    }

    // ── UPDATE ───────────────────────────────────────────────
    if (/^UPDATE/i.test(sql)) {
      const setStr  = (sql.match(/SET\s+(.+?)\s+WHERE/is) || [])[1] || "";
      const whereStr = (sql.match(/WHERE\s+(.+)/is) || [])[1] || "";
      const setCols   = [...setStr.matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
      const whereCols = [...whereStr.matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
      let pi = 0;
      const sv = {}; setCols.forEach(c => { sv[c] = params[pi++]; });
      const wv = {}; whereCols.forEach(c => { wv[c] = params[pi++]; });
      let ch = 0;
      rows.forEach(r => {
        if (Object.entries(wv).every(([k, v]) => String(r[k]) === String(v))) {
          Object.assign(r, sv); ch++;
        }
      });
      return { changes: ch, lastInsertRowid: 0 };
    }

    // ── DELETE ───────────────────────────────────────────────
    if (/^DELETE/i.test(sql)) {
      const conds = parseWhere(sql, params);
      const before = rows.length;
      T[t] = conds.length ? rows.filter(r => !rowMatches(r, conds)) : [];
      return { changes: before - T[t].length, lastInsertRowid: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  // ── better-sqlite3-compatible API ───────────────────────────
  module.exports = {
    pragma() {},
    exec(sql) {
      sql.split(";").forEach(s => { try { if (s.trim()) runSQL(s.trim(), []); } catch (_) {} });
    },
    prepare(sql) {
      return {
        get(...a) {
          const r = runSQL(sql, a.flat());
          return Array.isArray(r) ? r[0] : undefined;
        },
        all(...a) {
          const r = runSQL(sql, a.flat());
          return Array.isArray(r) ? r : [];
        },
        run(...a) {
          const r = runSQL(sql, a.flat());
          return (r && "lastInsertRowid" in r) ? r : { changes: 0, lastInsertRowid: 0 };
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
