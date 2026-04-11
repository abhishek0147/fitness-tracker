// FitTrack DB — better-sqlite3 locally, pure in-memory on Vercel
const IS_VERCEL = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;

if (!IS_VERCEL) {
  // ── LOCAL: better-sqlite3 ──────────────────────────────────────────────────
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
    CREATE INDEX IF NOT EXISTS idx_ar ON activity_routes(activity_id);
  `);
  module.exports = db;

} else {
  // ── VERCEL: pure in-memory, no native deps ─────────────────────────────────
  const tables = {
    users: [], activities: [], kudos: [], follows: [], activity_routes: []
  };
  const ids = { users: 1, activities: 1, kudos: 1, follows: 1, activity_routes: 1 };
  const now = () => new Date().toISOString();

  function tbl(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    return m ? m[1] : null;
  }

  function whereConds(sql, p) {
    const wm = sql.match(/WHERE\s+(.+?)(?=\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
    if (!wm) return [];
    return (wm[1].match(/(\w+)\s*=\s*\?/gi) || [])
      .map((c, i) => ({ k: c.match(/(\w+)/)[1], v: p[i] }));
  }

  function hit(row, conds) {
    return conds.every(({ k, v }) =>
      String(row[k] ?? "").toLowerCase() === String(v ?? "").toLowerCase());
  }

  function exec(sql, p = []) {
    sql = sql.trim();
    const t = tbl(sql);
    const rows = t ? tables[t] : [];

    if (/^SELECT/i.test(sql)) {
      const conds = whereConds(sql, p);
      let res = conds.length ? rows.filter(r => hit(r, conds)) : [...rows];

      // ORDER BY
      const ob = sql.match(/ORDER\s+BY\s+(?:\w+\.)?(\w+)\s*(DESC|ASC)?/i);
      if (ob) {
        const col = ob[1], desc = (ob[2] || "").toUpperCase() === "DESC";
        res.sort((a, b) => {
          const [av, bv] = [a[col], b[col]];
          return desc ? (av < bv ? 1 : av > bv ? -1 : 0) : (av < bv ? -1 : av > bv ? 1 : 0);
        });
      }

      // LIMIT
      const lm = sql.match(/LIMIT\s+(\d+)/i);
      if (lm) res = res.slice(0, +lm[1]);

      // COUNT(*)
      if (/COUNT\(\*\)\s+AS\s+(\w+)/i.test(sql)) {
        return [{ [sql.match(/COUNT\(\*\)\s+AS\s+(\w+)/i)[1]]: res.length }];
      }

      // Aggregates
      if (/\b(COUNT|SUM|AVG|MAX)\s*\(/i.test(sql)) {
        const out = {};
        for (const [, fn, inner, alias] of sql.matchAll(/(COUNT|SUM|AVG|MAX)\(([^)]*)\)\s+(?:as\s+)?(\w+)/gi)) {
          const col = inner.replace(/COALESCE\((\w+).*/i, "$1").trim();
          const F = fn.toUpperCase();
          if (F === "COUNT") out[alias] = res.length;
          else if (F === "SUM")  out[alias] = res.reduce((s, r) => s + (+r[col] || 0), 0);
          else if (F === "AVG")  out[alias] = res.length ? res.reduce((s, r) => s + (+r[col] || 0), 0) / res.length : 0;
          else if (F === "MAX")  out[alias] = res.reduce((mx, r) => Math.max(mx, +r[col] || 0), 0);
        }
        return [out];
      }

      return res;
    }

    if (/^INSERT/i.test(sql)) {
      const cm = sql.match(/\(([^)]+)\)\s*VALUES/i);
      if (!cm) return { changes: 0, lastInsertRowid: 0 };
      const cols = cm[1].split(",").map(c => c.trim());
      const id = ids[t]++;
      const row = { id, created_at: now() };
      cols.forEach((c, i) => { row[c] = p[i] !== undefined ? p[i] : null; });
      // UNIQUE constraints
      if (t === "users" && rows.some(r => r.email?.toLowerCase() === row.email?.toLowerCase())) {
        const e = new Error("UNIQUE constraint failed: users.email");
        e.code = "SQLITE_CONSTRAINT_UNIQUE";
        throw e;
      }
      if (t === "kudos"   && rows.some(r => r.activity_id == row.activity_id && r.user_id == row.user_id)) return { changes: 0, lastInsertRowid: 0 };
      if (t === "follows" && rows.some(r => r.follower_id == row.follower_id && r.following_id == row.following_id)) return { changes: 0, lastInsertRowid: 0 };
      rows.push(row);
      return { changes: 1, lastInsertRowid: id };
    }

    if (/^UPDATE/i.test(sql)) {
      const sm  = (sql.match(/SET\s+(.+?)\s+WHERE/is) || [])[1] || "";
      const wm2 = (sql.match(/WHERE\s+(.+)/is)        || [])[1] || "";
      const scs = (sm.match(/(\w+)\s*=\s*\?/gi)  || []).map(c => c.match(/(\w+)/)[1]);
      const wcs = (wm2.match(/(\w+)\s*=\s*\?/gi) || []).map(c => c.match(/(\w+)/)[1]);
      const sv = {}, wv = {}; let pi = 0;
      scs.forEach(c => { sv[c] = p[pi++]; });
      wcs.forEach(c => { wv[c] = p[pi++]; });
      let ch = 0;
      rows.forEach(r => {
        if (Object.entries(wv).every(([k, v]) => String(r[k]) === String(v))) { Object.assign(r, sv); ch++; }
      });
      return { changes: ch, lastInsertRowid: 0 };
    }

    if (/^DELETE/i.test(sql)) {
      const conds = whereConds(sql, p);
      const before = rows.length;
      tables[t] = conds.length ? rows.filter(r => !hit(r, conds)) : [];
      return { changes: before - tables[t].length, lastInsertRowid: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  module.exports = {
    pragma() {},
    exec(sql) { sql.split(";").forEach(s => { try { if (s.trim()) exec(s.trim()); } catch (e) {} }); },
    prepare(sql) {
      return {
        get(...a)  { const r = exec(sql, a.flat()); return Array.isArray(r) ? r[0] : undefined; },
        all(...a)  { const r = exec(sql, a.flat()); return Array.isArray(r) ? r : []; },
        run(...a)  { const r = exec(sql, a.flat()); return r?.lastInsertRowid !== undefined ? r : { changes: 0, lastInsertRowid: 0 }; },
      };
    },
  };
}
