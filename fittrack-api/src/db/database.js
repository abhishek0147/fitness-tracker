// FITTRACK-DB-V2 (check this comment is present after pasting)
const IS_VERCEL = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION);

if (IS_VERCEL) {
  console.log("[DB] v2 in-memory store active");

  const T = { users: [], activities: [], kudos: [], follows: [], activity_routes: [] };
  const IDS = { users: 1, activities: 1, kudos: 1, follows: 1, activity_routes: 1 };
  const ts = () => new Date().toISOString();

  function tbl(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function wMatch(row, sql, params) {
    const m = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
    if (!m) return true;
    const pairs = [...m[1].matchAll(/(\w+)\s*=\s*\?/gi)];
    return pairs.every((p, i) =>
      String(row[p[1]] ?? "").toLowerCase() === String(params[i] ?? "").toLowerCase()
    );
  }

  function runSQL(sql, params) {
    sql = sql.trim();
    const t = tbl(sql);
    const rows = t ? T[t] : [];

    if (/^SELECT/i.test(sql)) {
      let out = rows.filter(r => wMatch(r, sql, params));
      const ob = sql.match(/ORDER\s+BY\s+(?:\w+\.)?(\w+)(?:\s+(DESC|ASC))?/i);
      if (ob) {
        const [, col, dir = "ASC"] = ob;
        out.sort((a, b) => {
          const cmp = (a[col] ?? "") < (b[col] ?? "") ? -1 : (a[col] ?? "") > (b[col] ?? "") ? 1 : 0;
          return dir.toUpperCase() === "DESC" ? -cmp : cmp;
        });
      }
      const lm = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
      if (lm) out = out.slice(+(lm[2] || 0), +(lm[2] || 0) + +lm[1]);
      if (/COUNT\(\*\)/i.test(sql) && !/\b(SUM|AVG|MAX)\s*\(/i.test(sql)) {
        const alias = (sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i) || [])[1] || "count";
        return [{ [alias]: out.length }];
      }
      if (/\b(SUM|AVG|MAX)\s*\(/i.test(sql)) {
        const res = {};
        for (const [, fn, col, alias] of sql.matchAll(/(SUM|AVG|MAX)\(\s*(?:COALESCE\(\s*)?(\w+)[^)]*\)\s*(?:\))?\s+as\s+(\w+)/gi)) {
          const vals = out.map(r => parseFloat(r[col]) || 0);
          res[alias] = fn === "SUM" ? vals.reduce((a, b) => a + b, 0)
                     : fn === "AVG" ? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
                     : vals.length ? Math.max(...vals) : 0;
        }
        const cp = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i);
        if (cp) res[cp[1]] = out.length;
        return [res];
      }
      return out;
    }

    if (/^INSERT/i.test(sql)) {
      const cm = sql.match(/\(([^)]+)\)\s*VALUES/i);
      if (!cm) return { changes: 0, lastInsertRowid: 0 };
      const cols = cm[1].split(",").map(s => s.trim());
      const id = IDS[t]++;
      const row = { id, created_at: ts() };
      cols.forEach((c, i) => { row[c] = params[i] !== undefined ? params[i] : null; });
      if (t === "users" && rows.some(r => r.email?.toLowerCase() === row.email?.toLowerCase())) {
        const e = new Error("UNIQUE constraint failed: users.email");
        e.code = "SQLITE_CONSTRAINT_UNIQUE";
        throw e;
      }
      rows.push(row);
      return { changes: 1, lastInsertRowid: id };
    }

    if (/^UPDATE/i.test(sql)) {
      const sc = [...((sql.match(/SET\s+(.+?)\s+WHERE/is) || [])[1] || "").matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
      const wc = [...((sql.match(/WHERE\s+(.+)/is) || [])[1] || "").matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
      const sv = {}; sc.forEach((c, i) => { sv[c] = params[i]; });
      const wv = {}; wc.forEach((c, i) => { wv[c] = params[sc.length + i]; });
      let ch = 0;
      rows.forEach(r => {
        if (Object.entries(wv).every(([k, v]) => String(r[k]) === String(v))) { Object.assign(r, sv); ch++; }
      });
      return { changes: ch, lastInsertRowid: 0 };
    }

    if (/^DELETE/i.test(sql)) {
      const before = rows.length;
      T[t] = rows.filter(r => !wMatch(r, sql, params));
      return { changes: before - T[t].length, lastInsertRowid: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  module.exports = {
    pragma() {}, exec() {},
    prepare(sql) {
      return {
        async get(...a)  { return runSQL(sql, a.flat())?.[0] ?? null; },
        async all(...a)  { const r = runSQL(sql, a.flat()); return Array.isArray(r) ? r : []; },
        async run(...a)  { const r = runSQL(sql, a.flat()); return r?.lastInsertRowid !== undefined ? r : { changes: 0, lastInsertRowid: 0 }; },
      };
    },
  };

} else {
  const path = require("path");
  const Database = require("better-sqlite3");
  const sqlite = new Database(path.join(__dirname, "../../fittrack.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, distance REAL DEFAULT 0, duration INTEGER NOT NULL, elevation_gain REAL DEFAULT 0, calories INTEGER DEFAULT 0, avg_heart_rate INTEGER DEFAULT 0, notes TEXT DEFAULT '', date DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS kudos (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(activity_id, user_id));
    CREATE TABLE IF NOT EXISTS follows (id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(follower_id, following_id));
    CREATE TABLE IF NOT EXISTS activity_routes (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, elevation REAL DEFAULT 0, distance_from_start REAL DEFAULT 0, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  const orig = sqlite.prepare.bind(sqlite);
  sqlite.prepare = (sql) => {
    const s = orig(sql);
    return {
      async get(...a) { return s.get(...a); },
      async all(...a) { return s.all(...a); },
      async run(...a) { return s.run(...a); },
    };
  };
  console.log("[DB] SQLite ready (local)");
  module.exports = sqlite;
}
