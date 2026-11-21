const { db, rowToPersona, J } = require('./db');
const { generateUsername } = require('./data/names');
const { NATIONALITIES, DIALECT_FAMILY, DIALECT_NAMES } = require('./data/dialects');
const { generateAvatar, chooseCategory } = require('./avatars');

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const jit = (x, d = 0.12) => clamp(x + rnd(-d, d));

// الطباع: قيم أساسية لكل نمط
const ARCHETYPES = {
  rude_curser: { label: 'قليل أدب ويحب السب الخفيف', t: { talk: 0.6, humor: 0.5, rude: 0.8, curse: 0.7, tease: 0.6, critic: 0.5, sarcasm: 0.5 } },
  teaser: { label: 'يحب الطقطقة على المذيع', t: { talk: 0.65, humor: 0.45, rude: 0.35, curse: 0.2, tease: 0.9, sarcasm: 0.5 } },
  critic: { label: 'ينتقد كل شيء تقريباً', t: { talk: 0.55, humor: 0.7, critic: 0.9, sarcasm: 0.4 } },
  hater: { label: 'لا يعجبه أي شيء', t: { talk: 0.45, humor: 0.92, critic: 0.75, rude: 0.3, sarcasm: 0.5, contrarian: 0.6 } },
  giggler: { label: 'يضحك بسرعة', t: { talk: 0.6, humor: 0.15, hype: 0.5 } },
  stoic: { label: 'نادراً ما يضحك', t: { talk: 0.35, humor: 0.9 } },
  calm: { label: 'هادئ جداً', t: { talk: 0.18, humor: 0.55 } },
  only_called: { label: 'لا يكتب إلا إذا نودي باسمه', t: { talk: 0, humor: 0.6 }, flags: { onlyWhenCalled: true } },
  chatterbox: { label: 'كثير الكلام', t: { talk: 0.95, humor: 0.4, curiosity: 0.6, debate: 0.5 } },
  quiet: { label: 'يتكلم قليلاً جداً', t: { talk: 0.1, humor: 0.6 } },
  debater: { label: 'يحب النقاشات', t: { talk: 0.6, debate: 0.95, contrarian: 0.5 } },
  gamer: { label: 'يحب الألعاب', t: { talk: 0.55, humor: 0.5, critic: 0.4 }, interests: ['games'] },
  memer: { label: 'يحب الميمز', t: { talk: 0.6, humor: 0.3, sarcasm: 0.5 }, interests: ['memes'] },
  sarcastic: { label: 'ساخر', t: { talk: 0.55, humor: 0.65, sarcasm: 0.95, tease: 0.5 } },
  serious: { label: 'جاد', t: { talk: 0.35, humor: 0.85, sarcasm: 0, critic: 0.4 } },
  curious: { label: 'فضولي', t: { talk: 0.55, curiosity: 0.95 } },
  contrarian: { label: 'يحب مخالفة الآخرين', t: { talk: 0.5, contrarian: 0.95, debate: 0.7 } },
  mixed: { label: 'يوافق أحياناً ويعارض أحياناً', t: { talk: 0.45, contrarian: 0.5, debate: 0.5 } },
  lurker: { label: 'يراقب ولا يتدخل غالباً', t: { talk: 0.04, humor: 0.6 }, flags: { importantOnly: true } },
  hype: { label: 'مشجع ومتحمس', t: { talk: 0.7, humor: 0.3, hype: 0.9 } },
  sweet: { label: 'محترم ولطيف', t: { talk: 0.45, humor: 0.4, rude: 0, curse: 0 } },
};
const BASE_T = { talk: 0.4, humor: 0.5, rude: 0.1, curse: 0.05, tease: 0.25, critic: 0.25, sarcasm: 0.2, contrarian: 0.25, debate: 0.3, curiosity: 0.35, hype: 0.25 };
const ARCH_WEIGHTS = { rude_curser: 4, teaser: 8, critic: 6, hater: 3, giggler: 7, stoic: 5, calm: 6, only_called: 4, chatterbox: 6, quiet: 7, debater: 5, gamer: 7, memer: 6, sarcastic: 6, serious: 4, curious: 6, contrarian: 4, mixed: 6, lurker: 6, hype: 5, sweet: 6 };
const INTERESTS = ['games', 'memes', 'football', 'food', 'music', 'general'];
const EMOJI_SETS = [['😂', '🤣'], ['💀', '😭'], ['🔥', '💯'], ['❤️', '🥰'], ['😑', '🙄'], ['👀'], ['🤡'], ['😅', '🙂'], ['🫠', '🥲'], ['👍'], ['😎', '✌️'], ['🌚'], ['🤦‍♂️', '🤷']];
const LAUGHS_AR = ['ههههههه', 'هههه', 'ههههههههههههه', 'خخخخخخ', 'هه', 'هاهاها', 'ههههه😂', 'ههههههه💀', 'هههههههه والله'];
const LAUGHS_EN = ['lmao', 'LMAO', 'lol', 'hahaha', '💀', 'LOL', 'lmfao'];

function weighted(obj) {
  const tot = Object.values(obj).reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (const [k, v] of Object.entries(obj)) if ((r -= v) <= 0) return k;
  return Object.keys(obj)[0];
}

// توزيع الجنسيات مع عشوائية طبيعية في كل بث
function nationalityWeights(foreignChance = 0.04, overrides = null) {
  const w = {};
  for (const [k, n] of Object.entries(NATIONALITIES)) if (!n.foreign) w[k] = (overrides && overrides[k] != null ? +overrides[k] : n.weight) * rnd(0.6, 1.4);
  const arabTotal = Object.values(w).reduce((a, b) => a + b, 0);
  const foreign = Object.keys(NATIONALITIES).filter((k) => NATIONALITIES[k].foreign);
  const fw = (arabTotal * foreignChance) / (1 - Math.min(foreignChance, 0.9)) / foreign.length;
  for (const k of foreign) w[k] = fw;
  return w;
}

function makeStyle(lang, age) {
  const st = {
    emoji: weighted({ never: 3, rare: 4, sometimes: 4, often: 2 }),
    length: weighted({ tiny: 2, short: 4, medium: 4, long: 2 }),
    punctuation: Math.random() < 0.35,
    abbreviations: Math.random() < 0.45,
    mixEnglish: lang === 'en' ? 0 : weighted({ 0: 5, 0.15: 3, 0.4: 1.2 }) * 1,
    arabizi: lang !== 'en' && Math.random() < 0.08,
    elongate: Math.random() < 0.35 ? rnd(0.1, 0.4) : 0,
    typos: Math.random() < 0.5 ? rnd(0.05, 0.3) : 0,
    dropHamza: Math.random() < 0.7,
    taAsHa: Math.random() < 0.45,
    lowercase: Math.random() < 0.6,
    numbers: Math.random() < 0.2,
    slang: Math.random() < 0.5,
    emojiSet: pick(EMOJI_SETS),
    laugh: lang === 'en' ? pick(LAUGHS_EN) : pick(LAUGHS_AR),
  };
  st.mixEnglish = +st.mixEnglish;
  return st;
}

function knownFamilies(dialect) {
  const fam = DIALECT_FAMILY[dialect];
  if (fam === 'english') return ['english'];
  const k = new Set([fam]);
  if (Math.random() < 0.7) k.add('egyptian'); // اللهجة المصرية منتشرة بسبب الأفلام
  if (fam === 'iraqi' && Math.random() < 0.4) k.add('gulf');
  if (fam === 'gulf' && Math.random() < 0.25) k.add('iraqi');
  if (Math.random() < 0.2) k.add(pick(['levant', 'gulf', 'iraqi']));
  if (Math.random() < 0.45) k.add('english');
  return [...k];
}

function createPersonaObject({ gender, nationality, archetype, avatarMode = 'mixed', taken, foreignChance, natOverrides } = {}) {
  gender = gender || (Math.random() < 0.5 ? 'f' : 'm');
  nationality = nationality || weighted(nationalityWeights(foreignChance, natOverrides));
  const nat = NATIONALITIES[nationality] || NATIONALITIES.SA;
  const dialect = pick(nat.dialects);
  const lang = dialect === 'english' ? 'en' : 'ar';
  archetype = archetype && ARCHETYPES[archetype] ? archetype : weighted(ARCH_WEIGHTS);
  const A = ARCHETYPES[archetype];
  const traits = {};
  for (const k of Object.keys(BASE_T)) traits[k] = jit(A.t[k] != null ? A.t[k] : BASE_T[k] * rnd(0.3, 1.6), 0.1);
  if (archetype === 'only_called') traits.talk = 0;
  Object.assign(traits, A.flags || {});
  traits.reactsNonText = rnd(0.05, 0.5);
  traits.speed = rnd(3, 9); // حروف/ثانية
  const interests = [...new Set([...(A.interests || []), pick(INTERESTS), Math.random() < 0.5 ? pick(INTERESTS) : null].filter(Boolean))];
  const username = generateUsername(gender, nationality, taken || existingNames());
  const av = generateAvatar({ category: chooseCategory(avatarMode), gender, name: username, kind: 'generated', save: false });
  return {
    username, gender, nationality, dialect, language: lang, archetype, traits, style: makeStyle(lang), interests,
    known_families: knownFamilies(dialect), avatar_url: av.url, avatar_category: av.category, bio: '', favorite: false, status: 'active', allow_return: true,
  };
}

function existingNames() { return new Set(db.prepare('SELECT username FROM personas').all().map((r) => r.username.toLowerCase())); }

function insertPersona(p) {
  const r = db.prepare(`INSERT INTO personas(username,gender,nationality,dialect,language,archetype,traits,style,interests,known_families,avatar_url,avatar_category,bio,favorite,status,allow_return,created_at)
    VALUES(@username,@gender,@nationality,@dialect,@language,@archetype,@traits,@style,@interests,@known_families,@avatar_url,@avatar_category,@bio,@favorite,@status,@allow_return,@created_at)`).run({
    ...p, traits: JSON.stringify(p.traits), style: JSON.stringify(p.style), interests: JSON.stringify(p.interests || []), known_families: JSON.stringify(p.known_families || []),
    favorite: p.favorite ? 1 : 0, allow_return: p.allow_return === false ? 0 : 1, status: p.status || 'active', bio: p.bio || '', created_at: Date.now(),
  });
  return getPersona(r.lastInsertRowid);
}

function updatePersona(id, patch) {
  const cur = getPersona(id); if (!cur) return null;
  const p = { ...cur, ...patch };
  if (patch.nationality && !patch.dialect && patch.nationality !== cur.nationality) {
    const nat = NATIONALITIES[patch.nationality]; if (nat) { p.dialect = pick(nat.dialects); p.known_families = knownFamilies(p.dialect); }
  }
  if (patch.dialect && patch.dialect !== cur.dialect && !patch.known_families) p.known_families = knownFamilies(p.dialect);
  p.language = p.dialect === 'english' ? 'en' : 'ar';
  db.prepare(`UPDATE personas SET username=@username,gender=@gender,nationality=@nationality,dialect=@dialect,language=@language,archetype=@archetype,traits=@traits,style=@style,
    interests=@interests,known_families=@known_families,avatar_url=@avatar_url,avatar_category=@avatar_category,bio=@bio,favorite=@favorite,status=@status,allow_return=@allow_return WHERE id=@id`).run({
    ...p, id, traits: JSON.stringify(p.traits), style: JSON.stringify(p.style), interests: JSON.stringify(p.interests), known_families: JSON.stringify(p.known_families),
    favorite: p.favorite ? 1 : 0, allow_return: p.allow_return ? 1 : 0,
  });
  return getPersona(id);
}

const getPersona = (id) => withReputation(rowToPersona(db.prepare('SELECT * FROM personas WHERE id=?').get(id)));
const listPersonas = () => db.prepare('SELECT * FROM personas ORDER BY favorite DESC, last_seen DESC, id DESC').all().map(rowToPersona).map(withReputation);

// سمعة الشخصية بين الجمهور
function reputation(p) {
  const t = p.traits || {};
  const scores = {
    'ملك الطقطقة': t.tease * 1.2 + (p.teases || 0) * 0.02, 'الناقد': t.critic * 1.1 + (p.criticisms || 0) * 0.02, 'قليل الأدب': t.rude * 1.1 + t.curse * 0.5,
    'الضحوك': (1 - t.humor) * 1.1 + (p.laughs || 0) * 0.01, 'الهادئ': (1 - t.talk) * 0.9, 'كثير الهرج': t.talk * 1.1, 'الساخر': t.sarcasm * 1.1,
    'المخالف دائماً': t.contrarian * 1.05, 'محب النقاش': t.debate, 'الفضولي': t.curiosity, 'المشجع': t.hype,
  };
  if (t.onlyWhenCalled) return 'ما يتكلم إلا إذا ناديته';
  if (t.importantOnly) return 'المراقب الصامت';
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}
function withReputation(p) { if (p) { p.reputation = reputation(p); p.dialect_name = DIALECT_NAMES[p.dialect]; p.nat = NATIONALITIES[p.nationality]; p.archetype_label = ARCHETYPES[p.archetype]?.label; } return p; }

// بناء تركيبة الجمهور قبل البث
function buildAudience(s = {}) {
  const total = Math.max(1, Math.min(200, +s.total || 20));
  const out = []; const used = new Set();
  const taken = existingNames();
  const avail = (p) => p.status === 'active' && (p.allow_return || s.allowKicked) && !used.has(p.id);
  for (const id of s.handpicked || []) { const p = getPersona(id); if (p && p.status !== 'banned' && !used.has(p.id)) { out.push(p); used.add(p.id); } }
  if (s.mode === 'manual') return out;
  let girls, boys;
  const remaining = Math.max(0, total - out.length);
  if (s.mode === 'counts') { girls = Math.max(0, +s.girls || 0); boys = Math.max(0, +s.boys || 0); const extra = remaining - girls - boys; if (extra > 0) for (let i = 0; i < extra; i++) Math.random() < 0.5 ? girls++ : boys++; }
  else if (s.mode === 'ratio') { girls = Math.round(remaining * clamp((+s.girlsRatio || 50) / 100)); boys = remaining - girls; }
  else { girls = 0; for (let i = 0; i < remaining; i++) if (Math.random() < rnd(0.3, 0.7)) girls++; boys = remaining - girls; }
  // طرح المختارين يدوياً من العدد
  const all = listPersonas().filter(avail).sort(() => Math.random() - 0.5);
  const returning = clamp((s.returningRatio != null ? +s.returningRatio : 60) / 100);
  const takeFrom = (pool, g, n) => { const r = []; for (const p of pool) { if (r.length >= n) break; if (p.gender === g && !used.has(p.id)) { r.push(p); used.add(p.id); } } return r; };
  for (const [g, need] of [['f', girls], ['m', boys]]) {
    let got = [];
    if (s.includeFavorites !== false) got = takeFrom(all.filter((p) => p.favorite), g, need);
    got = got.concat(takeFrom(all, g, Math.round(need * returning) - got.length));
    out.push(...got);
    for (let i = got.length; i < need; i++) out.push({ ...createPersonaObject({ gender: g, avatarMode: s.avatarMode, taken, foreignChance: s.foreignChance != null ? +s.foreignChance / 100 : 0.04, natOverrides: s.natWeights }), tmp: true, tmpId: 'tmp_' + Math.random().toString(36).slice(2, 9) });
  }
  return out.map(withReputation).sort(() => Math.random() - 0.5);
}

function savePreviewPersonas(list) {
  const ids = [];
  for (const p of list) {
    if (p.id && !p.tmp) { if (p.username || p.avatar_url) { const cur = getPersona(p.id); if (cur && (cur.username !== p.username || cur.avatar_url !== p.avatar_url)) updatePersona(p.id, { username: p.username || cur.username, avatar_url: p.avatar_url || cur.avatar_url, avatar_category: p.avatar_category || cur.avatar_category }); } ids.push(p.id); }
    else ids.push(insertPersona(p).id);
  }
  return ids;
}

module.exports = { ARCHETYPES, createPersonaObject, insertPersona, updatePersona, getPersona, listPersonas, buildAudience, savePreviewPersonas, withReputation, reputation };
