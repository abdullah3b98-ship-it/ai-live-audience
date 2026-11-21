const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'avatars'), { recursive: true });

// قاعدة SQLite: better-sqlite3 إن توفّر، وإلا node:sqlite المدمج في Node 22+
function openDb(file) {
  if (process.env.DB_DRIVER !== 'builtin') try { const B = require('better-sqlite3'); const d = new B(file); d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;'); d.driver = 'better-sqlite3'; return d; } catch (e) { /* ننتقل للمدمج */ }
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const wrapStmt = (sql) => {
    const st = raw.prepare(sql);
    const names = new Set([...sql.matchAll(/[@:$]([A-Za-z_]\w*)/g)].map((m) => m[1]));
    const args = (a) => (a.length === 1 && a[0] && typeof a[0] === 'object' && !Array.isArray(a[0]) && !Buffer.isBuffer(a[0])
      ? [Object.fromEntries(Object.entries(a[0]).filter(([k]) => names.has(k)).map(([k, v]) => [k, norm(v)]))] : a.map(norm));
    return { run: (...a) => { const r = st.run(...args(a)); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; }, get: (...a) => st.get(...args(a)), all: (...a) => st.all(...args(a)) };
  };
  return { prepare: wrapStmt, exec: (sql) => raw.exec(sql), driver: 'node:sqlite' };
}
const db = openDb(path.join(DATA_DIR, 'audience.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS avatars (id INTEGER PRIMARY KEY, kind TEXT, category TEXT, url TEXT, label TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL, gender TEXT, nationality TEXT, dialect TEXT, language TEXT,
  archetype TEXT, traits TEXT, style TEXT, interests TEXT, known_families TEXT, avatar_url TEXT, avatar_category TEXT,
  bio TEXT, favorite INTEGER DEFAULT 0, status TEXT DEFAULT 'active', allow_return INTEGER DEFAULT 1,
  streams_attended INTEGER DEFAULT 0, msg_count INTEGER DEFAULT 0, laughs INTEGER DEFAULT 0, criticisms INTEGER DEFAULT 0,
  teases INTEGER DEFAULT 0, affinity REAL DEFAULT 0, created_at INTEGER, last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS relations (a INTEGER, b INTEGER, affinity REAL DEFAULT 0, interactions INTEGER DEFAULT 0, last_note TEXT,
  PRIMARY KEY (a, b), FOREIGN KEY (a) REFERENCES personas(id) ON DELETE CASCADE, FOREIGN KEY (b) REFERENCES personas(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS words (id INTEGER PRIMARY KEY, word TEXT, norm TEXT UNIQUE, meaning TEXT, cat TEXT, family TEXT,
  status TEXT, source TEXT, created_at INTEGER, confirmed_at INTEGER);
CREATE TABLE IF NOT EXISTS persona_words (persona_id INTEGER, word_id INTEGER, source TEXT, created_at INTEGER,
  PRIMARY KEY (persona_id, word_id), FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE, FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS knowledge (id INTEGER PRIMARY KEY, kind TEXT, key TEXT, value TEXT, detail TEXT, status TEXT, source TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS streams (id INTEGER PRIMARY KEY, title TEXT, game TEXT, started_at INTEGER, ended_at INTEGER, settings TEXT, persona_ids TEXT, summary TEXT);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, stream_id INTEGER, ts INTEGER, type TEXT, text TEXT, importance REAL, persona_id INTEGER, data TEXT, reactions INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, stream_id INTEGER, ts INTEGER, persona_id INTEGER, text TEXT, kind TEXT, reply_to TEXT, meta TEXT);
CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY, persona_id INTEGER, stream_id INTEGER, ts INTEGER, kind TEXT, text TEXT, event_id INTEGER, data TEXT,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, name TEXT, settings TEXT, created_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_msg_stream ON messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_ev_stream ON events(stream_id);
CREATE INDEX IF NOT EXISTS idx_mem_p ON memories(persona_id);
`);

const J = (s, d = null) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };

function getSetting(key, def = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return r ? J(r.value, def) : def;
}
function setSetting(key, val) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(val));
}

function rowToPersona(r) {
  if (!r) return null;
  return { ...r, traits: J(r.traits, {}), style: J(r.style, {}), interests: J(r.interests, []), known_families: J(r.known_families, []), favorite: !!r.favorite, allow_return: !!r.allow_return };
}

module.exports = { db, J, getSetting, setSetting, rowToPersona, DATA_DIR };
