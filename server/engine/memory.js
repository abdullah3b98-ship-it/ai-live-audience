// ذاكرة طويلة المدى مرتبطة بالأحداث الحقيقية فقط (لا تخترع ذكريات)
const { db, J, getSetting } = require('../db');
const { normalize, dice } = require('./repeat');
const short = (t, n = 40) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

function phrase(kind, d, lang = 'ar') {
  const g = d.game || (lang === 'en' ? 'the game' : 'اللعبة');
  const ar = { joke: `قلت النكتة «${short(d.text)}»`, fail: `طحت في ${g}${d.text ? ' (' + short(d.text, 30) + ')' : ''}`, win: `فزت في ${g}`, game: `لعبت ${g}`, word: `علمتنا كلمة «${d.word}» يعني ${short(d.meaning, 30)}`,
    object: `ورّيتنا ${d.name}`, named: `ناديتني وقلت «${short(d.text, 30)}»`, important: short(d.text, 50), funny: `صار الموقف «${short(d.text, 40)}» وضحكنا كلنا` };
  const en = { joke: `you told the joke "${short(d.text)}"`, fail: `you failed in ${g}`, win: `you won in ${g}`, game: `you played ${g}`, word: `you taught us the word "${d.word}"`,
    object: `you showed us the ${d.name_en || d.name}`, named: 'you called me out in chat', important: short(d.text, 50), funny: 'that funny moment happened' };
  return (lang === 'en' ? en : ar)[kind] || short(d.text, 50);
}

function recordEvent({ streamId, type, text = '', importance = 0.5, personaId = null, data = {}, present = [], memoryOn = true }) {
  const ev = db.prepare('INSERT INTO events(stream_id,ts,type,text,importance,persona_id,data) VALUES(?,?,?,?,?,?,?)').run(streamId, Date.now(), type, text, importance, personaId, JSON.stringify(data));
  const eid = ev.lastInsertRowid;
  if (memoryOn && getSetting('memoryEnabled', true) !== false && importance >= 0.6) {
    const ins = db.prepare('INSERT INTO memories(persona_id,stream_id,ts,kind,text,event_id,data) VALUES(?,?,?,?,?,?,?)');
    const d = { ...data, text };
    const targets = type === 'named' && personaId ? [personaId] : present;
    for (const pid of targets) ins.run(pid, streamId, Date.now(), type, phrase(type, d, 'ar'), eid, JSON.stringify(d));
  }
  return eid;
}
const bumpReaction = (eid, n = 1) => eid && db.prepare('UPDATE events SET reactions=reactions+? WHERE id=?').run(n, eid);

// ذكرى حقيقية من بث سابق لهذه الشخصية
function recall(personaId, currentStreamId, lang = 'ar') {
  const rows = db.prepare('SELECT * FROM memories WHERE persona_id=? AND stream_id<>? ORDER BY ts DESC LIMIT 30').all(personaId, currentStreamId);
  if (!rows.length) return null;
  const r = rows[Math.floor(Math.pow(Math.random(), 1.6) * rows.length)];
  return { id: r.id, text: lang === 'en' ? phrase(r.kind, J(r.data, {}), 'en') : r.text, kind: r.kind, stream_id: r.stream_id };
}
const memoriesFor = (pid, limit = 50) => db.prepare('SELECT m.*, s.title stream_title FROM memories m LEFT JOIN streams s ON s.id=m.stream_id WHERE persona_id=? ORDER BY ts DESC LIMIT ?').all(pid, limit);

// هل قال المذيع هذه النكتة في بث سابق؟
function findOldJoke(text, currentStreamId) {
  const n = normalize(text); if (n.length < 8) return null;
  const rows = db.prepare("SELECT * FROM events WHERE type='joke' AND stream_id<>? ORDER BY ts DESC LIMIT 200").all(currentStreamId);
  return rows.find((r) => dice(normalize(r.text), n) > 0.75) || null;
}

module.exports = { recordEvent, bumpReaction, recall, memoriesFor, findOldJoke, phrase };
