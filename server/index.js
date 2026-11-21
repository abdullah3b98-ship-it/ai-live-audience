const path = require('path');
const http = require('http');
const express = require('express');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const { db, J, getSetting, setSetting, DATA_DIR } = require('./db');
const P = require('./personas');
const A = require('./avatars');
const llm = require('./engine/llm');
const learning = require('./engine/learning');
const memory = require('./engine/memory');
const { LiveSession, sessions } = require('./engine/session');
const { NATIONALITIES, DIALECT_NAMES } = require('./data/dialects');
const { PRESETS } = require('./engine/local');

const crypto = require('crypto');
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false }));
// ---------- حماية اختيارية بكلمة مرور: APP_PASSWORD=... ----------
// صفحة دخول + كوكي (تشتغل على الجوال وفي اتصال البث المباشر)، ومع قبول Basic Auth للأدوات مثل curl
const PASS = process.env.APP_PASSWORD || '';
const TOKEN = PASS ? crypto.createHmac('sha256', PASS).update('ai-live-audience-v1').digest('hex') : '';
const cookieOf = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((a) => a[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function authed(req) {
  if (!PASS) return true;
  if (safeEq(cookieOf(req).ala_auth || '', TOKEN)) return true;
  const [kind, b64] = (req.headers.authorization || '').split(' ');
  return kind === 'Basic' && !!b64 && safeEq(Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':'), PASS);
}
const LOGIN_HTML = (err) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول · جمهور AI المباشر</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e12;color:#efeff1;font-family:system-ui,Tahoma,sans-serif}form{background:#18181f;border:1px solid #2c2c3a;border-radius:16px;padding:28px;width:min(360px,90vw);display:flex;flex-direction:column;gap:14px}h1{font-size:20px;margin:0}p{color:#a3a3b5;margin:0;font-size:14px}input{background:#0f0f15;border:1px solid #2c2c3a;border-radius:10px;padding:12px;color:#fff;font-size:16px}button{background:#9147ff;border:0;border-radius:10px;padding:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer}.e{color:#ff8a80}</style></head><body><form method="post" action="/login"><h1>جمهور AI المباشر</h1><p>اكتب كلمة المرور للدخول</p>${err ? '<p class="e">كلمة المرور غير صحيحة</p>' : ''}<input type="password" name="password" autocomplete="current-password" autofocus required><button>دخول</button></form></body></html>`;
app.get('/login', (req, res) => res.type('html').send(LOGIN_HTML(false)));
app.post('/login', (req, res) => {
  if (PASS && !safeEq(String(req.body.password || ''), PASS)) return res.status(401).type('html').send(LOGIN_HTML(true));
  res.setHeader('Set-Cookie', `ala_auth=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}${req.secure ? '; Secure' : ''}`);
  res.redirect(303, '/');
});
app.get('/api/ping', (req, res) => res.json({ ok: true, t: Date.now() }));
if (PASS) app.use((req, res, next) => {
  if (authed(req)) return next();
  if (req.method === 'GET' && !req.path.startsWith('/api') && (req.headers.accept || '').includes('text/html')) return res.redirect(302, '/login');
  res.set('WWW-Authenticate', 'Basic realm="AI Live Audience"').status(401).json({ error: 'Password required' });
});
app.use('/media/avatars', express.static(path.join(DATA_DIR, 'avatars'), { maxAge: '30d' }));
app.use('/media/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
const upload = multer({ storage: multer.diskStorage({ destination: path.join(DATA_DIR, 'uploads'), filename: (req, f, cb) => cb(null, Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + path.extname(f.originalname || '.png').toLowerCase().replace(/[^.a-z0-9]/g, '')) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, /^image\//.test(f.mimetype)) });

A.ensureLibrary();
// أي بث كان مفتوحاً قبل إعادة التشغيل يُغلق
// بعد إعادة تشغيل الخادم: البثوث القديمة جداً تُنهى، والحديثة تُستأنف عند فتح صفحتها
db.prepare('UPDATE streams SET ended_at=? WHERE ended_at IS NULL AND started_at < ?').run(Date.now(), Date.now() - 6 * 3600e3);

const ok = (res, d) => res.json(d);
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error(e); res.status(500).json({ error: e.message }); });

app.get('/api/meta', (req, res) => ok(res, {
  nationalities: NATIONALITIES, dialects: DIALECT_NAMES, archetypes: Object.fromEntries(Object.entries(P.ARCHETYPES).map(([k, v]) => [k, v.label])),
  avatarCategories: Object.fromEntries(Object.entries(A.CATEGORIES).map(([k, v]) => [k, v.label])), presets: Object.keys(PRESETS), llm: llm.publicConfig(),
  streamerName: getSetting('streamerName', ''), memoryEnabled: getSetting('memoryEnabled', true), researchEnabled: getSetting('researchEnabled', true),
  activeStreams: [...sessions.keys()],
}));

// ---------- الشخصيات ----------
app.get('/api/personas', (req, res) => ok(res, P.listPersonas()));
app.get('/api/personas/:id', (req, res) => {
  const p = P.getPersona(+req.params.id); if (!p) return res.status(404).json({ error: 'not found' });
  const rel = db.prepare('SELECT r.*, p.username FROM relations r JOIN personas p ON p.id=r.b WHERE r.a=? ORDER BY interactions DESC LIMIT 20').all(p.id);
  ok(res, { ...p, memories: memory.memoriesFor(p.id), words: learning.personaWords(p.id), relations: rel });
});
app.post('/api/personas', wrap((req, res) => {
  const b = req.body || {};
  const base = P.createPersonaObject({ gender: b.gender, nationality: b.nationality, archetype: b.archetype, avatarMode: b.avatarMode });
  const p = P.insertPersona({ ...base, ...(b.username ? { username: b.username } : {}), ...(b.avatar_url ? { avatar_url: b.avatar_url, avatar_category: b.avatar_category || 'upload' } : {}) });
  ok(res, p);
}));
app.post('/api/personas/generate', wrap((req, res) => { const n = Math.min(50, +req.body.count || 5); const out = []; for (let i = 0; i < n; i++) out.push(P.insertPersona(P.createPersonaObject({ gender: req.body.gender }))); ok(res, out); }));
app.put('/api/personas/:id', wrap((req, res) => {
  const allowed = ['username', 'gender', 'nationality', 'dialect', 'archetype', 'traits', 'style', 'interests', 'avatar_url', 'avatar_category', 'bio', 'favorite', 'status', 'allow_return', 'known_families'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  if (patch.archetype && !patch.traits) { const cur = P.getPersona(+req.params.id); const fresh = P.createPersonaObject({ archetype: patch.archetype, gender: cur.gender, nationality: cur.nationality }); patch.traits = fresh.traits; }
  const p = P.updatePersona(+req.params.id, patch); if (!p) return res.status(404).json({ error: 'not found' });
  for (const s of sessions.values()) { const x = s.parts.get(p.id); if (x) x.p = p; }
  ok(res, p);
}));
app.delete('/api/personas/:id', (req, res) => { db.prepare('DELETE FROM personas WHERE id=?').run(+req.params.id); ok(res, { ok: true }); });

// ---------- الصور ----------
app.get('/api/avatars', (req, res) => ok(res, db.prepare('SELECT * FROM avatars ORDER BY kind, category, id DESC LIMIT 400').all()));
app.post('/api/avatars/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'صورة غير صالحة' });
  const url = '/media/uploads/' + req.file.filename;
  db.prepare('INSERT INTO avatars(kind,category,url,label,created_at) VALUES(?,?,?,?,?)').run('upload', 'upload', url, 'مرفوعة', Date.now());
  ok(res, { url, category: 'upload' });
});
app.post('/api/avatars/generate', wrap(async (req, res) => {
  const { prompt = '', category, gender, name } = req.body || {};
  const c = llm.config();
  if (c && c.provider === 'openai' && req.body.useAI) {
    try {
      const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + c.apiKey }, body: JSON.stringify({ model: 'gpt-image-1', prompt: `Social media profile picture, square avatar: ${prompt}. Not a real person or celebrity.`, size: '1024x1024' }) });
      const d = await r.json(); const b64 = d.data?.[0]?.b64_json;
      if (b64) { const file = 'ai-' + Date.now() + '.png'; require('fs').writeFileSync(path.join(DATA_DIR, 'uploads', file), Buffer.from(b64, 'base64')); const url = '/media/uploads/' + file; db.prepare('INSERT INTO avatars(kind,category,url,label,created_at) VALUES(?,?,?,?,?)').run('generated', 'ai', url, prompt.slice(0, 40), Date.now()); return ok(res, { url, category: 'ai', ai: true }); }
    } catch (e) { /* يرجع للمولد المحلي */ }
  }
  ok(res, A.generateAvatar({ category: category || A.categoryFromPrompt(prompt), gender, name }));
}));

// ---------- تركيبة الجمهور ----------
app.post('/api/audience/preview', wrap((req, res) => ok(res, P.buildAudience(req.body || {}))));
app.post('/api/audience/one', wrap((req, res) => { const b = req.body || {}; ok(res, P.withReputation({ ...P.createPersonaObject({ gender: b.gender, avatarMode: b.avatarMode, foreignChance: b.foreignChance != null ? b.foreignChance / 100 : 0.04 }), tmp: true, tmpId: 'tmp_' + Math.random().toString(36).slice(2, 9) })); }));

// ---------- القوالب ----------
app.get('/api/templates', (req, res) => ok(res, db.prepare('SELECT * FROM templates ORDER BY id DESC').all().map((t) => ({ ...t, settings: J(t.settings, {}) }))));
app.post('/api/templates', (req, res) => { const r = db.prepare('INSERT INTO templates(name,settings,created_at) VALUES(?,?,?)').run(String(req.body.name || 'قالب').slice(0, 60), JSON.stringify(req.body.settings || {}), Date.now()); ok(res, { id: r.lastInsertRowid }); });
app.delete('/api/templates/:id', (req, res) => { db.prepare('DELETE FROM templates WHERE id=?').run(+req.params.id); ok(res, { ok: true }); });

// ---------- البثوث ----------
app.post('/api/streams/start', wrap((req, res) => {
  const { title = 'بث مباشر', game = '', settings = {}, personas = [] } = req.body || {};
  if (!personas.length) return res.status(400).json({ error: 'اختر جمهوراً أولاً' });
  for (const s of sessions.values()) s.end();
  if (settings.streamerName != null) setSetting('streamerName', settings.streamerName);
  const ids = P.savePreviewPersonas(personas);
  const r = db.prepare('INSERT INTO streams(title,game,started_at,settings,persona_ids) VALUES(?,?,?,?,?)').run(title, game, Date.now(), JSON.stringify(settings), JSON.stringify(ids));
  const stream = db.prepare('SELECT * FROM streams WHERE id=?').get(r.lastInsertRowid);
  const ps = ids.map((id) => P.getPersona(id)).filter((p) => p && p.status !== 'banned');
  const s = new LiveSession(stream, ps, settings, (m) => broadcast(stream.id, m));
  sessions.set(stream.id, s); s.start();
  ok(res, { id: stream.id });
}));
function resumeStream(id) {
  if (!id || sessions.has(id)) return sessions.get(id) || null;
  const row = db.prepare('SELECT * FROM streams WHERE id=? AND ended_at IS NULL').get(id); if (!row) return null;
  if (Date.now() - row.started_at > 6 * 3600e3) { db.prepare('UPDATE streams SET ended_at=? WHERE id=?').run(Date.now(), id); return null; }
  for (const s of sessions.values()) s.end();
  const settings = J(row.settings, {}); const ps = J(row.persona_ids, []).map((pid) => P.getPersona(pid)).filter((p) => p && p.status !== 'banned');
  if (!ps.length) return null;
  const s = new LiveSession(row, ps, settings, (m) => broadcast(id, m)); sessions.set(id, s); s.start({ resumed: true });
  console.log('resumed stream', id); return s;
}
app.post('/api/streams/:id/end', (req, res) => { const s = sessions.get(+req.params.id); ok(res, { summary: s ? s.end() : null }); broadcast(+req.params.id, { type: 'ended' }); });
app.get('/api/streams', (req, res) => ok(res, db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.stream_id=s.id AND m.persona_id IS NOT NULL AND m.kind<>'reaction') msgs FROM streams s ORDER BY id DESC`).all().map((s) => ({ ...s, settings: J(s.settings, {}), persona_ids: J(s.persona_ids, []), live: sessions.has(s.id) }))));
app.get('/api/streams/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM streams WHERE id=?').get(+req.params.id); if (!s) return res.status(404).json({ error: 'not found' });
  const msgs = db.prepare('SELECT m.*, p.username, p.avatar_url FROM messages m LEFT JOIN personas p ON p.id=m.persona_id WHERE stream_id=? ORDER BY m.id').all(s.id);
  const highlights = db.prepare('SELECT * FROM events WHERE stream_id=? AND (importance>=0.6 OR reactions>=2) ORDER BY (importance + reactions*0.1) DESC LIMIT 20').all(s.id).map((e) => ({ ...e, data: J(e.data, {}) }));
  const ids = J(s.persona_ids, []);
  const people = ids.length ? db.prepare(`SELECT id, username, avatar_url, nationality FROM personas WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
  ok(res, { ...s, settings: J(s.settings, {}), messages: msgs, highlights, people, live: sessions.has(s.id) || (!s.ended_at && Date.now() - s.started_at < 6 * 3600e3) });
});
app.get('/api/streams/:id/state', (req, res) => { const s = sessions.get(+req.params.id); if (!s) return res.status(404).json({ error: 'not live' }); ok(res, { roster: s.roster(), viewers: s.present().length, game: s.game, streamer: s.streamer, llm: llm.enabled(), lastLlmError: s.lastLlmError || null }); });
app.delete('/api/streams/:id', (req, res) => { const id = +req.params.id; if (sessions.has(id)) return res.status(400).json({ error: 'البث شغال' }); db.prepare('DELETE FROM messages WHERE stream_id=?').run(id); db.prepare('DELETE FROM events WHERE stream_id=?').run(id); db.prepare('DELETE FROM memories WHERE stream_id=?').run(id); db.prepare('DELETE FROM streams WHERE id=?').run(id); ok(res, { ok: true }); });

// ---------- القاموس والمعرفة والذاكرة ----------
app.get('/api/words', (req, res) => ok(res, db.prepare('SELECT w.*, (SELECT COUNT(*) FROM persona_words pw WHERE pw.word_id=w.id) learners FROM words w ORDER BY id DESC').all()));
app.post('/api/words', (req, res) => { const { word, meaning, cat } = req.body || {}; if (!word || !meaning) return res.status(400).json({ error: 'الكلمة والمعنى مطلوبة' }); const w = learning.upsertWord({ word, meaning, cat, status: 'confirmed', source: 'user' }); for (const s of sessions.values()) for (const x of s.present()) { learning.learn(x.p.id, w.id, 'user'); x.words = learning.personaWords(x.p.id); } ok(res, w); });
app.post('/api/words/:id/confirm', (req, res) => { db.prepare("UPDATE words SET status='confirmed', confirmed_at=? WHERE id=?").run(Date.now(), +req.params.id); ok(res, { ok: true }); });
app.delete('/api/words/:id', (req, res) => { db.prepare('DELETE FROM words WHERE id=?').run(+req.params.id); ok(res, { ok: true }); });
app.post('/api/words/lookup', wrap(async (req, res) => ok(res, await learning.research(String(req.body.word || ''), '', { allowWeb: true }))));
app.get('/api/knowledge', (req, res) => ok(res, db.prepare('SELECT * FROM knowledge ORDER BY id DESC').all()));
app.post('/api/knowledge', (req, res) => { const { key, value } = req.body || {}; if (!key || !value) return res.status(400).json({ error: 'مطلوب' }); ok(res, { id: learning.saveObject(String(key).toLowerCase(), value, 'confirmed', 'user') }); });
app.post('/api/knowledge/:id/confirm', (req, res) => { const k = db.prepare('SELECT * FROM knowledge WHERE id=?').get(+req.params.id); if (k) learning.saveObject(k.key, req.body.value || k.value, 'confirmed', 'user'); ok(res, { ok: true }); });
app.delete('/api/knowledge/:id', (req, res) => { db.prepare('DELETE FROM knowledge WHERE id=?').run(+req.params.id); ok(res, { ok: true }); });
app.get('/api/memories', (req, res) => ok(res, db.prepare(`SELECT m.*, p.username, s.title stream_title FROM memories m JOIN personas p ON p.id=m.persona_id LEFT JOIN streams s ON s.id=m.stream_id ${req.query.persona ? 'WHERE m.persona_id=?' : ''} ORDER BY m.id DESC LIMIT 500`).all(...(req.query.persona ? [+req.query.persona] : []))));
app.delete('/api/memories/:id', (req, res) => { db.prepare('DELETE FROM memories WHERE id=?').run(+req.params.id); ok(res, { ok: true }); });
app.delete('/api/memories', (req, res) => { if (req.query.persona) db.prepare('DELETE FROM memories WHERE persona_id=?').run(+req.query.persona); else if (req.query.kind) db.prepare('DELETE FROM memories WHERE kind=?').run(req.query.kind); else db.prepare('DELETE FROM memories').run(); ok(res, { ok: true }); });

// ---------- الإعدادات ----------
app.get('/api/settings', (req, res) => ok(res, { llm: llm.publicConfig(), streamerName: getSetting('streamerName', ''), memoryEnabled: getSetting('memoryEnabled', true), researchEnabled: getSetting('researchEnabled', true) }));
app.post('/api/settings', (req, res) => {
  const b = req.body || {};
  if (b.llm) { const cur = getSetting('llm', {}) || {}; const next = { provider: b.llm.provider || 'local', model: b.llm.model || '', baseUrl: b.llm.baseUrl || '', apiKey: b.llm.apiKey === undefined || b.llm.apiKey === '__keep__' ? cur.apiKey : b.llm.apiKey }; setSetting('llm', next); }
  for (const k of ['streamerName', 'memoryEnabled', 'researchEnabled']) if (b[k] !== undefined) setSetting(k, b[k]);
  ok(res, { ok: true, llm: llm.publicConfig() });
});
app.post('/api/settings/test-llm', wrap(async (req, res) => {
  if (!llm.enabled()) return ok(res, { ok: false, error: 'لا يوجد مزود مفعّل — يعمل المحرك المحلي' });
  try { const t = await llm.chat([{ role: 'user', content: 'اكتب "تمام" فقط' }], { maxTokens: 10, temperature: 0 }); ok(res, { ok: true, reply: t }); } catch (e) { ok(res, { ok: false, error: e.message }); }
}));

app.get(/^\/(?!api|media|ws).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', verifyClient: (info) => authed(info.req) });
const clients = new Map(); // streamId -> Set(ws)
function broadcast(streamId, msg) { const set = clients.get(streamId); if (!set) return; const s = JSON.stringify(msg); for (const ws of set) if (ws.readyState === 1) ws.send(s); }
wss.on('connection', (ws, req) => {
  const sid = +new URL(req.url, 'http://x').searchParams.get('stream');
  if (!clients.has(sid)) clients.set(sid, new Set()); clients.get(sid).add(ws);
  const s = sessions.get(sid) || resumeStream(sid);
  if (s) { ws.send(JSON.stringify({ type: 'roster', roster: s.roster(), viewers: s.present().length })); s.begin(); }
  else ws.send(JSON.stringify({ type: 'ended' }));
  ws.isAlive = true; ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const s = sessions.get(sid); if (!s) return ws.send(JSON.stringify({ type: 'ended' }));
    try {
      if (m.type === 'chat') s.streamerSays(m.text, { voice: false });
      else if (m.type === 'voice') s.streamerSays(m.text, { voice: true });
      else if (m.type === 'action') s.action(m.action, m.text || '');
      else if (m.type === 'detect') s.detections(m.objects || []);
      else if (m.type === 'snapshot') s.snapshot(m.dataUrl, !!m.auto);
      else if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      else if (m.type === 'mod') s.moderate(m.action, m.pid, m.seconds);
      else if (m.type === 'add_random') s.addRandom(Math.min(20, +m.count || 1));
      else if (m.type === 'add_persona') { const p = P.getPersona(+m.pid); if (p) s.addPersonaLive(p); }
      else if (m.type === 'teach_word') s.teachWord(m.word, m.meaning, m.cat, 'user');
      else if (m.type === 'teach_object') s.teachObject(m.label, m.name);
      else if (m.type === 'set_max') { s.maxAudience = Math.max(1, +m.max || s.maxAudience); s.system(`الحد الأقصى للجمهور: ${s.maxAudience}`); }
    } catch (e) { console.error(e); }
  });
  ws.on('close', () => clients.get(sid)?.delete(ws));
});

// نبضات لإبقاء الاتصال حي خلف بروكسي الاستضافة
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} } }, 25000);
const PORT = +process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AI Live Audience on http://localhost:${PORT}  (LLM: ${llm.enabled() ? llm.config().provider : 'local engine'}, DB: ${db.driver})`));
module.exports = { app, server };
