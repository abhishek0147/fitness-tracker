/**
 * FitTrack Database
 * - Users: persisted in Firebase Realtime DB via REST (survives restarts)
 * - Activities/etc: in-memory (also saved to localStorage on client)
 * - Local dev: better-sqlite3
 */

const IS_VERCEL = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION);

// ── LOCAL: better-sqlite3 ─────────────────────────────────────────────────────
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
  console.log("[DB] better-sqlite3 ready (local)");
  module.exports = db;

} else {
  // ── VERCEL: Firebase REST for users + in-memory for the rest ──────────────
  console.log("[DB] Firebase persistent store (Vercel)");

  const https = require("https");

  // Firebase project — already in your frontend
  const FB_URL = "https://fitness-tracking-d01f6-default-rtdb.firebaseio.com";

  // ── Firebase REST helpers ─────────────────────────────────────────────────
  function fbRequest(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = `${FB_URL}${path}.json`;
      const data = body ? JSON.stringify(body) : null;
      const options = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      const req = https.request(url, options, res => {
        let raw = "";
        res.on("data", c => raw += c);
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { resolve(null); }
        });
      });
      req.on("error", reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async function fbGet(path) {
    try { return await fbRequest("GET", path, null); }
    catch (e) { return null; }
  }

  async function fbSet(path, data) {
    try { return await fbRequest("PUT", path, data); }
    catch (e) { return null; }
  }

  async function fbPatch(path, data) {
    try { return await fbRequest("PATCH", path, data); }
    catch (e) { return null; }
  }

  async function fbDelete(path) {
    try { return await fbRequest("DELETE", path, null); }
    catch (e) { return null; }
  }

  // ── In-memory tables (non-user data) ─────────────────────────────────────
  const T = { activities: [], kudos: [], follows: [], activity_routes: [] };
  const ID = { users: 1000, activities: 1, kudos: 1, follows: 1, activity_routes: 1 };
  const ts = () => new Date().toISOString();

  // ── User cache (avoid hitting Firebase on every request) ──────────────────
  const userCache = new Map(); // email.toLowerCase() → user object
  let userCacheTime = 0;
  const CACHE_TTL = 30000; // 30 seconds

  async function getAllUsers() {
    // Return from cache if fresh
    if (Date.now() - userCacheTime < CACHE_TTL && userCache.size > 0) {
      return [...userCache.values()];
    }
    try {
      const data = await fbGet("/fittrack_users");
      if (data && typeof data === "object") {
        userCache.clear();
        Object.values(data).forEach(u => {
          if (u && u.email) userCache.set(u.email.toLowerCase(), u);
        });
        userCacheTime = Date.now();
      }
    } catch (e) {}
    return [...userCache.values()];
  }

  async function getUserByEmail(email) {
    await getAllUsers(); // refresh cache
    return userCache.get(email.toLowerCase()) || null;
  }

  async function getUserById(id) {
    await getAllUsers();
    return [...userCache.values()].find(u => String(u.id) === String(id)) || null;
  }

  async function createUser(name, email, password, bio) {
    await getAllUsers();
    const emailLower = email.toLowerCase();
    if (userCache.has(emailLower)) {
      const e = new Error("UNIQUE constraint failed: users.email");
      e.code = "SQLITE_CONSTRAINT_UNIQUE";
      throw e;
    }
    const id = ID.users++;
    const user = { id, name, email: emailLower, password, bio: bio || "", avatar_url: "", created_at: ts() };
    await fbSet(`/fittrack_users/${id}`, user);
    userCache.set(emailLower, user);
    userCacheTime = Date.now();
    return { changes: 1, lastInsertRowid: id };
  }

  // ── In-memory helpers ─────────────────────────────────────────────────────
  function getTable(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    return m ? m[1].toLowerCase() : null;
  }
  function getWhere(sql, p) {
    const m = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
    if (!m) return [];
    return [...m[1].matchAll(/(\w+)\s*=\s*\?/gi)].map((c, i) => ({ k: c[1], v: p[i] }));
  }
  function hits(row, conds) {
    return conds.every(({ k, v }) => String(row[k] ?? "").toLowerCase() === String(v ?? "").toLowerCase());
  }

  function runMemory(sql, p = []) {
    const t = getTable(sql);
    const rows = t ? T[t] : [];
    if (!rows && !/^INSERT/i.test(sql)) return null; // not an in-memory table

    if (/^SELECT/i.test(sql)) {
      const conds = getWhere(sql, p);
      let out = conds.length ? rows.filter(r => hits(r, conds)) : [...rows];
      const ob = sql.match(/ORDER\s+BY\s+(?:\w+\.)?(\w+)(?:\s+(DESC|ASC))?/i);
      if (ob) { const [, col, dir = "ASC"] = ob; out.sort((a, b) => { const d = a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0; return dir.toUpperCase() === "DESC" ? -d : d; }); }
      const lm = sql.match(/LIMIT\s+(\d+)/i); if (lm) out = out.slice(0, +lm[1]);
      const ca = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i); if (ca) return [{ [ca[1]]: out.length }];
      if (/\b(SUM|AVG|MAX)\s*\(/i.test(sql)) {
        const res = {};
        for (const [, fn, inner, alias] of sql.matchAll(/(SUM|AVG|MAX)\(\s*(?:COALESCE\(\s*)?(\w+)[^)]*\)\s*(?:\))?\s+as\s+(\w+)/gi)) {
          const vals = out.map(r => parseFloat(r[inner]) || 0);
          res[alias] = fn.toUpperCase() === "SUM" ? vals.reduce((a, b) => a + b, 0) : fn.toUpperCase() === "AVG" ? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0) : (vals.length ? Math.max(...vals) : 0);
        }
        const cp = sql.match(/COUNT\(\*\)\s+as\s+(\w+)/i); if (cp) res[cp[1]] = out.length;
        return [res];
      }
      return out;
    }
    if (/^INSERT/i.test(sql)) {
      const cm = sql.match(/\(([^)]+)\)\s*VALUES/i); if (!cm) return { changes: 0, lastInsertRowid: 0 };
      const cols = cm[1].split(",").map(s => s.trim());
      const id = ID[t]++; const row = { id, created_at: ts() };
      cols.forEach((c, i) => { row[c] = p[i] !== undefined ? p[i] : null; });
      if (t === "kudos" && rows.some(r => r.activity_id == row.activity_id && r.user_id == row.user_id)) return { changes: 0, lastInsertRowid: 0 };
      if (t === "follows" && rows.some(r => r.follower_id == row.follower_id && r.following_id == row.following_id)) return { changes: 0, lastInsertRowid: 0 };
      rows.push(row); return { changes: 1, lastInsertRowid: id };
    }
    if (/^UPDATE/i.test(sql)) {
      const ss = (sql.match(/SET\s+(.+?)\s+WHERE/is) || [])[1] || "";
      const ws = (sql.match(/WHERE\s+(.+)/is) || [])[1] || "";
      const sc = [...ss.matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
      const wc = [...ws.matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
      let pi = 0; const sv = {}; sc.forEach(c => { sv[c] = p[pi++]; }); const wv = {}; wc.forEach(c => { wv[c] = p[pi++]; });
      let ch = 0; rows.forEach(r => { if (Object.entries(wv).every(([k, v]) => String(r[k]) === String(v))) { Object.assign(r, sv); ch++; } });
      return { changes: ch, lastInsertRowid: 0 };
    }
    if (/^DELETE/i.test(sql)) {
      const conds = getWhere(sql, p); const before = rows.length;
      T[t] = conds.length ? rows.filter(r => !hits(r, conds)) : [];
      return { changes: before - T[t].length, lastInsertRowid: 0 };
    }
    return null;
  }

  // ── Sync prepare — returns an object with async .get/.all/.run ─────────────
  // We wrap async Firebase calls to look synchronous using a shared promise queue
  // Routes use async/await so we use a special AsyncStatement approach

  class AsyncStatement {
    constructor(sql) { this.sql = sql; }

    get(...args) {
      const p = args.flat();
      const sql = this.sql;
      const t = getTable(sql);

      if (t === "users" || sql.toLowerCase().includes("users")) {
        return this._getUserAsync(sql, p);
      }
      const r = runMemory(sql, p);
      return Promise.resolve(Array.isArray(r) ? r[0] : undefined);
    }

    all(...args) {
      const p = args.flat();
      const sql = this.sql;
      const r = runMemory(sql, p);
      return Promise.resolve(Array.isArray(r) ? r : []);
    }

    run(...args) {
      const p = args.flat();
      const sql = this.sql;
      const t = getTable(sql);

      if (t === "users") {
        return this._runUserAsync(sql, p);
      }
      const r = runMemory(sql, p);
      return Promise.resolve(r?.lastInsertRowid !== undefined ? r : { changes: 0, lastInsertRowid: 0 });
    }

    async _getUserAsync(sql, p) {
      // SELECT * FROM users WHERE email = ?
      if (/WHERE\s+email\s*=\s*\?/i.test(sql)) {
        return await getUserByEmail(p[0]);
      }
      // SELECT * FROM users WHERE id = ?
      if (/WHERE\s+id\s*=\s*\?/i.test(sql)) {
        return await getUserById(p[0]);
      }
      // SELECT id FROM users WHERE email = ?
      if (/SELECT\s+id\s+FROM\s+users/i.test(sql) && p[0]) {
        const u = await getUserByEmail(p[0]);
        return u ? { id: u.id } : undefined;
      }
      // Aggregate queries on users
      if (/COUNT|SUM|AVG/i.test(sql)) {
        return { total_activities: 0, total_distance: 0, total_duration: 0, total_calories: 0 };
      }
      return undefined;
    }

    async _runUserAsync(sql, p) {
      // INSERT INTO users
      if (/^INSERT/i.test(sql)) {
        const cm = sql.match(/\(([^)]+)\)\s*VALUES/i);
        if (!cm) return { changes: 0, lastInsertRowid: 0 };
        const cols = cm[1].split(",").map(s => s.trim());
        const data = {};
        cols.forEach((c, i) => { data[c] = p[i] !== undefined ? p[i] : null; });
        return await createUser(data.name, data.email, data.password, data.bio);
      }
      // UPDATE users
      if (/^UPDATE/i.test(sql)) {
        // Find user and update in Firebase
        const wm = sql.match(/WHERE\s+id\s*=\s*\?/i);
        if (wm) {
          const userId = p[p.length - 1];
          const user = await getUserById(userId);
          if (user) {
            const ss = (sql.match(/SET\s+(.+?)\s+WHERE/is) || [])[1] || "";
            const sc = [...ss.matchAll(/(\w+)\s*=\s*\?/gi)].map(m => m[1]);
            const updates = {};
            sc.forEach((c, i) => { updates[c] = p[i]; });
            Object.assign(user, updates);
            userCache.set(user.email.toLowerCase(), user);
            await fbSet(`/fittrack_users/${userId}`, user);
            return { changes: 1, lastInsertRowid: 0 };
          }
        }
        return { changes: 0, lastInsertRowid: 0 };
      }
      return { changes: 0, lastInsertRowid: 0 };
    }
  }

  // ── Patch auth routes to handle async DB ──────────────────────────────────
  // The routes use synchronous db.prepare().get() but we need async for Firebase.
  // We return a thenable from .get()/.all()/.run() so routes using await work.
  // Routes that DON'T await will get a Promise — we patch auth.js to use async.

  module.exports = {
    pragma() {},
    exec() {},
    prepare(sql) {
      return new AsyncStatement(sql);
    },
    // Direct async methods for convenience
    async findUserByEmail(email) { return getUserByEmail(email); },
    async findUserById(id) { return getUserById(id); },
    async insertUser(name, email, password, bio) { return createUser(name, email, password, bio); },
  };
}
