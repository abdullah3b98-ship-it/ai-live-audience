// نظام تعلم الكلمات والأشياء من المستخدم + القاموس المشترك
const { db, getSetting } = require('../db');
const { LEXICON, findInLexicon, norm, OBJECT_AR } = require('../data/lexicon');
const llm = require('./llm');

function categoryFromMeaning(m = '') {
  if (/سب|سبه|سبّة|شتيم|اهان|إهان|غبي|حمار|احمق|مزعج|ثقيل|سخيف|تافه|بايخ|سامج|اهبل|أهبل|كذاب|فاشل|insult|stupid|idiot|annoying|lame/i.test(m)) return 'insult';
  if (/مدح|حلو|رائع|جميل|ممتاز|قوي|شجاع|praise|cool|great|awesome/i.test(m)) return 'praise';
  if (/مزح|نكت|ضحك|طقطق|سخري|joke|funny/i.test(m)) return 'joke';
  return 'neutral';
}
const CAT_AR = { insult: 'سبّة/إهانة', praise: 'مدح', joke: 'مزحة', neutral: 'كلمة عادية' };

function getWord(word) { return db.prepare('SELECT * FROM words WHERE norm=?').get(norm(word)); }
function upsertWord({ word, meaning, cat, family = null, status = 'confirmed', source = 'user' }) {
  const n = norm(word); const cur = getWord(word); const now = Date.now();
  cat = cat || categoryFromMeaning(meaning);
  if (cur) {
    if (cur.status === 'confirmed' && status !== 'confirmed') return cur; // لا نستبدل حقيقة مؤكدة بتخمين
    db.prepare('UPDATE words SET meaning=?, cat=?, status=?, source=?, family=COALESCE(?,family), confirmed_at=? WHERE id=?').run(meaning, cat, status, source, family, status === 'confirmed' ? now : null, cur.id);
    return getWord(word);
  }
  db.prepare('INSERT INTO words(word,norm,meaning,cat,family,status,source,created_at,confirmed_at) VALUES(?,?,?,?,?,?,?,?,?)').run(word, n, meaning, cat, family, status, source, now, status === 'confirmed' ? now : null);
  return getWord(word);
}
function learn(personaId, wordId, source) { db.prepare('INSERT OR IGNORE INTO persona_words(persona_id,word_id,source,created_at) VALUES(?,?,?,?)').run(personaId, wordId, source, Date.now()); }
function personaWords(pid) { return db.prepare('SELECT w.*, pw.source learned_from FROM persona_words pw JOIN words w ON w.id=pw.word_id WHERE pw.persona_id=?').all(pid); }
function knows(persona, entry) {
  if (entry.family && (persona.known_families || []).includes(entry.family)) return true;
  const w = getWord(entry.word); if (!w) return false;
  return !!db.prepare('SELECT 1 FROM persona_words WHERE persona_id=? AND word_id=?').get(persona.id, w.id);
}

// كلمات في النص: من القاموس المرجعي أو مما علّمه المستخدم
function termsIn(text) {
  const found = findInLexicon(text).map((e) => ({ word: e.word, matched: e.matched, family: e.family, meaning: e.meaning, cat: e.cat, ref: true }));
  const t = ' ' + norm(text).replace(/[^\p{L}\p{N}\s]/gu, ' ') + ' ';
  for (const w of db.prepare("SELECT * FROM words").all()) if (t.includes(' ' + w.norm + ' ') && !found.some((f) => norm(f.word) === w.norm)) found.push({ word: w.word, matched: w.word, family: w.family, meaning: w.meaning, cat: w.cat, status: w.status, taught: true });
  return found;
}

// صيغ التعليم: "X يعني Y" / "X معناها Y" / "معنى X هو Y" / "X means Y"
function parseTeaching(text) {
  const t = String(text).trim();
  let m = t.match(/^(?:كلمة\s+)?[«"']?([^\s«»"']{2,25}(?:\s[^\s«»"']{2,15})?)[»"']?\s+(?:يعني|معناها|معناه|تعني|=|means|meaning)\s+(.{2,120})$/i)
    || t.match(/^معنى\s+[«"']?(.{2,25}?)[»"']?\s+(?:هو|هي|:)\s*(.{2,120})$/);
  if (m) return { word: m[1].replace(/^[@#]/, ''), meaning: m[2].trim() };
  return null;
}
function parseObjectTeaching(text) {
  const m = String(text).trim().match(/^(?:لا\s+)?(?:هذا|هذي|هاد|هيدا|ده|دي|هاذا|this is|it'?s|its|اسمه|اسمها)\s+(?:اسمه\s+|اسمها\s+|a\s+|an\s+|the\s+)?(.{2,40})$/i);
  return m ? m[1].replace(/[.!؟?]+$/, '').trim() : null;
}

async function webLookup(word) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 5000);
  try {
    const isLatin = /^[a-z\s]+$/i.test(word);
    const url = isLatin ? `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`
      : `https://ar.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=0&format=json&titles=${encodeURIComponent(word)}`;
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'ai-live-audience/1.0' } });
    if (!r.ok) return null; const d = await r.json();
    if (isLatin) { const def = d.en?.[0]?.definitions?.map((x) => x.definition).find(Boolean); return def ? def.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').replace(/\.mw-parser-output[\s\S]*$/, '').replace(/\s+/g, ' ').trim().slice(0, 140) || null : null; }
    const page = Object.values(d.query?.pages || {})[0];
    if (!page || page.missing != null || !page.extract) return null;
    const line = page.extract.split('\n').map((x) => x.trim()).find((x) => x.length > 8 && !/^=/.test(x) && !/هل تقصد|انظر أيضا|^\(|^ال?جذر/.test(x));
    return line ? line.slice(0, 120) : null;
  } catch { return null; } finally { clearTimeout(to); }
}
async function wikiSummary(title) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 5000);
  try { const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: ctrl.signal, headers: { 'user-agent': 'ai-live-audience/1.0' } }); if (!r.ok) return null; const d = await r.json(); return d.extract ? d.extract.slice(0, 200) : null; } catch { return null; } finally { clearTimeout(to); }
}

// خطوات فهم كلمة مجهولة: قاموس مرجعي ← ذكاء اصطناعي ← بحث ويب ← سؤال المستخدم
async function research(word, context, { allowWeb = true } = {}) {
  const ref = LEXICON.find((e) => [e.word, ...e.variants].some((v) => norm(v) === norm(word)));
  if (ref) return { meaning: ref.meaning, cat: ref.cat, family: ref.family, status: 'confirmed', source: 'reference' };
  if (llm.enabled()) { try { const r = await llm.explainWord(word, context); if (r && r.meaning) return { meaning: r.meaning, cat: r.category || categoryFromMeaning(r.meaning), status: r.confident ? 'guess' : 'guess', source: 'llm' }; } catch {} }
  if (allowWeb && getSetting('researchEnabled', true) !== false) { const w = await webLookup(word); if (w) return { meaning: w, cat: categoryFromMeaning(w), status: 'guess', source: 'web' }; }
  return null;
}

// المعرفة (الأشياء والحقائق) — مع تمييز المؤكد عن التخمين
function getObject(label) { return db.prepare("SELECT * FROM knowledge WHERE kind='object' AND key=? ORDER BY status='confirmed' DESC, id DESC").get(label); }
function saveObject(label, value, status, source, detail = null) {
  const cur = db.prepare("SELECT * FROM knowledge WHERE kind='object' AND key=? AND status=?").get(label, status);
  if (status === 'confirmed') db.prepare("DELETE FROM knowledge WHERE kind='object' AND key=? AND status='guess'").run(label);
  if (cur) { db.prepare('UPDATE knowledge SET value=?, source=?, detail=COALESCE(?,detail) WHERE id=?').run(value, source, detail, cur.id); return cur.id; }
  return db.prepare('INSERT INTO knowledge(kind,key,value,detail,status,source,created_at) VALUES(?,?,?,?,?,?,?)').run('object', label, value, detail, status, source, Date.now()).lastInsertRowid;
}

module.exports = { categoryFromMeaning, CAT_AR, getWord, upsertWord, learn, personaWords, knows, termsIn, parseTeaching, parseObjectTeaching, research, webLookup, wikiSummary, getObject, saveObject, OBJECT_AR };
