// مولّد صور حسابات SVG متنوعة (بدون صور مشاهير حقيقيين)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, DATA_DIR } = require('./db');

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const PALETTE = ['#f94144','#f3722c','#f8961e','#f9c74f','#90be6d','#43aa8b','#577590','#277da1','#9b5de5','#f15bb5','#00bbf9','#00f5d4','#ff6b6b','#4ecdc4','#1a535c','#ffe66d','#2b2d42','#8d99ae','#ef233c','#06d6a0','#118ab2','#073b4c','#e76f51','#264653','#e9c46a'];
const SKIN = ['#f5d0b5','#e8b48f','#d39a6a','#b07a4f','#8a5a3b','#f1c27d','#c68642'];
const HAIR = ['#1b1b1b','#3b2417','#6b3e26','#a0522d','#d4a017','#2c1608','#4a4a4a','#8b0000'];
const wrap = (inner, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${bg ? `<rect width="128" height="128" fill="${bg}"/>` : ''}${inner}</svg>`;
const emojiSvg = (e, bg, size = 72) => wrap(`<text x="64" y="66" font-size="${size}" text-anchor="middle" dominant-baseline="central" font-family="Noto Color Emoji, Apple Color Emoji, Segoe UI Emoji, sans-serif">${e}</text>`, bg);

function face(gender) {
  const skin = pick(SKIN), hair = pick(HAIR), bg = pick(PALETTE), shirt = pick(PALETTE);
  const long = gender === 'f' ? Math.random() < 0.85 : Math.random() < 0.08;
  const hijab = gender === 'f' && Math.random() < 0.35;
  const beard = gender === 'm' && Math.random() < 0.45;
  const glasses = Math.random() < 0.25;
  const cap = !hijab && gender === 'm' && Math.random() < 0.2;
  let s = `<rect y="96" width="128" height="40" rx="30" fill="${shirt}"/>`;
  if (hijab) s += `<ellipse cx="64" cy="66" rx="40" ry="46" fill="${pick(PALETTE)}"/>`;
  else if (long) s += `<path d="M24 60 Q24 18 64 18 Q104 18 104 60 L108 110 L20 110 Z" fill="${hair}"/>`;
  s += `<rect x="56" y="80" width="16" height="20" fill="${skin}"/><ellipse cx="64" cy="60" rx="28" ry="32" fill="${skin}"/>`;
  if (!hijab) s += long ? `<path d="M36 52 Q40 24 64 24 Q90 24 92 52 Q80 36 64 38 Q46 38 36 52Z" fill="${hair}"/>` : `<path d="M36 50 Q36 26 64 26 Q92 26 92 50 Q84 38 64 40 Q44 40 36 50Z" fill="${hair}"/>`;
  if (cap) s += `<path d="M34 46 Q34 22 64 22 Q94 22 94 46 Z" fill="${pick(PALETTE)}"/><rect x="60" y="40" width="46" height="7" rx="3" fill="${pick(PALETTE)}"/>`;
  s += `<circle cx="53" cy="60" r="3.5" fill="#222"/><circle cx="75" cy="60" r="3.5" fill="#222"/>`;
  if (glasses) s += `<g fill="none" stroke="#111" stroke-width="2.5"><circle cx="53" cy="60" r="8"/><circle cx="75" cy="60" r="8"/><path d="M61 60h6"/></g>`;
  s += Math.random() < 0.6 ? `<path d="M54 76 Q64 84 74 76" stroke="#7a2e2e" stroke-width="3" fill="none" stroke-linecap="round"/>` : `<path d="M56 78h16" stroke="#7a2e2e" stroke-width="3" stroke-linecap="round"/>`;
  if (beard) s += `<path d="M38 66 Q40 94 64 96 Q88 94 90 66 Q84 86 64 86 Q44 86 38 66Z" fill="${hair}" opacity=".9"/>`;
  return wrap(s, bg);
}

function portrait(gender) { // صورة "بورتريه فني" مولدة — بديل آمن لصور الممثلين
  const g1 = pick(PALETTE), g2 = pick(PALETTE), id = 'g' + crypto.randomBytes(3).toString('hex');
  const hair = pick(HAIR), skin = pick(SKIN);
  const long = gender === 'f';
  return wrap(`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient></defs>
<rect width="128" height="128" fill="url(#${id})"/><circle cx="${rnd(20, 108)}" cy="${rnd(10, 40)}" r="${rnd(8, 18)}" fill="#fff" opacity=".25"/>
${long ? `<path d="M30 70 Q28 22 66 22 Q100 22 98 70 L104 128 L24 128Z" fill="${hair}"/>` : ''}
<path d="M18 128 Q22 96 64 94 Q106 96 110 128Z" fill="#111" opacity=".85"/><rect x="56" y="78" width="16" height="20" fill="${skin}"/>
<ellipse cx="64" cy="60" rx="24" ry="29" fill="${skin}"/><path d="M40 54 Q42 28 66 28 Q88 30 88 54 Q78 40 62 42 Q48 42 40 54Z" fill="${hair}"/>
<path d="M52 58h8M68 58h8" stroke="#222" stroke-width="3" stroke-linecap="round"/><path d="M57 74 Q64 78 71 74" stroke="#8a3b3b" stroke-width="2.5" fill="none"/>
<text x="64" y="122" font-size="9" fill="#fff" opacity=".7" text-anchor="middle" font-family="sans-serif">★ ${long ? 'actress' : 'actor'} vibe</text>`);
}

function abstract() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const c = pick(PALETTE), t = Math.random();
    if (t < 0.4) s += `<circle cx="${rnd(0, 128)}" cy="${rnd(0, 128)}" r="${rnd(10, 50)}" fill="${c}" opacity="${rnd(0.5, 0.95).toFixed(2)}"/>`;
    else if (t < 0.7) s += `<rect x="${rnd(-20, 100)}" y="${rnd(-20, 100)}" width="${rnd(20, 80)}" height="${rnd(20, 80)}" fill="${c}" transform="rotate(${rnd(0, 90)} 64 64)" opacity=".85"/>`;
    else s += `<polygon points="${rnd(0, 128)},${rnd(0, 128)} ${rnd(0, 128)},${rnd(0, 128)} ${rnd(0, 128)},${rnd(0, 128)}" fill="${c}" opacity=".8"/>`;
  }
  return wrap(s, pick(PALETTE));
}
function landscape() {
  const sky = pick(['#87ceeb', '#ffb347', '#2c3e50', '#ff7e5f', '#a1c4fd']), sun = pick(['#fff3b0', '#ffd166', '#f8f9fa']);
  return wrap(`<rect width="128" height="128" fill="${sky}"/><circle cx="${rnd(30, 100)}" cy="${rnd(25, 50)}" r="14" fill="${sun}"/>
<path d="M0 100 L36 52 L64 86 L88 60 L128 100 L128 128 L0 128Z" fill="${pick(['#2d6a4f', '#40916c', '#6c584c', '#3d405b'])}"/>
<path d="M0 110 Q64 92 128 112 L128 128 L0 128Z" fill="${pick(['#1b4332', '#081c15', '#5e503f', '#264653'])}"/>`);
}
function pixel() {
  const c = pick(PALETTE); let s = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) if (Math.random() < 0.5) { s += `<rect x="${16 + x * 12}" y="${16 + y * 12}" width="12" height="12" fill="${c}"/><rect x="${100 - x * 12}" y="${16 + y * 12}" width="12" height="12" fill="${c}"/>`; }
  return wrap(s, '#f0f0f0');
}
function letters(name) {
  const ch = (Array.from(String(name || '?').replace(/[_.\s\d]/g, ''))[0] || pick(['?', '#', '!', 'X', '∞'])).toUpperCase();
  return wrap(`<text x="64" y="68" font-size="64" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="Noto Sans Arabic, Noto Sans, sans-serif" font-weight="700">${ch.replace(/[<&>]/g, '')}</text>`, pick(PALETTE));
}
function meme() {
  const e = pick(['🐸', '💀', '🤡', '🗿', '😐', '🫠', '😭', '🤨', '🐒', '🥴']);
  const t = pick(['bruh', 'ok', 'lol', 'why', 'نعم؟', 'ليه', 'no', 'meh', 'هاه']);
  return wrap(`<text x="64" y="58" font-size="62" text-anchor="middle" dominant-baseline="central" font-family="Noto Color Emoji, sans-serif">${e}</text><text x="64" y="112" font-size="20" font-weight="900" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="1.5" font-family="Impact, Noto Sans Arabic, sans-serif">${t}</text>`, pick(['#ddd', '#fff', '#222', '#ffd166']));
}

const CATEGORIES = {
  person: { label: 'صورة شخص', gen: (g) => face(g) },
  portrait: { label: 'بورتريه "ممثل/ممثلة" (مولد)', gen: (g) => portrait(g) },
  fantasy: { label: 'شخصية خيالية', gen: () => emojiSvg(pick(['🧙', '🧛', '🧝', '🧞', '🦸', '🦹', '🧚', '👽', '🤖', '🐉', '🦄', '👹']), pick(PALETTE)) },
  game: { label: 'ألعاب', gen: () => (Math.random() < 0.5 ? pixel() : emojiSvg(pick(['🎮', '🕹️', '👾', '🎯', '⚔️', '🏆', '🧩', '🎲']), pick(PALETTE))) },
  animal: { label: 'قطط وحيوانات', gen: () => emojiSvg(pick(['🐱', '😺', '🐈', '🐈‍⬛', '🐶', '🦊', '🐼', '🐨', '🐸', '🦁', '🐰', '🦉', '🐧', '🐢']), pick(PALETTE)) },
  coffee: { label: 'أكواب قهوة', gen: () => emojiSvg(pick(['☕', '🧋', '🍵', '🥤']), pick(['#6f4e37', '#c8a27a', '#f5ebe0', '#222'])) },
  flower: { label: 'ورود', gen: () => emojiSvg(pick(['🌹', '🥀', '🌸', '🌷', '🌻', '💐', '🌺']), pick(['#fff0f3', '#ffccd5', '#111', '#e9f5db'])) },
  nature: { label: 'مناظر طبيعية', gen: () => landscape() },
  black: { label: 'سوداء بالكامل', gen: () => wrap('', '#000') },
  cartoon: { label: 'كرتونية', gen: () => emojiSvg(pick(['😎', '🤠', '🥸', '😺', '🐻', '🦖', '🐙', '👻', '🎃', '🧸']), pick(PALETTE)) },
  meme: { label: 'ميمز', gen: () => meme() },
  abstract: { label: 'مجردة', gen: () => abstract() },
  letters: { label: 'حروف ورموز', gen: (g, name) => letters(name) },
  default: { label: 'بدون صورة (افتراضية)', gen: () => wrap('<circle cx="64" cy="50" r="22" fill="#bbb"/><path d="M22 120 Q24 80 64 80 Q104 80 106 120Z" fill="#bbb"/>', '#e5e5e5') },
};
// أوزان الاختيار العشوائي: ليست كل الحسابات احترافية
const WEIGHTS = { person: 14, portrait: 6, fantasy: 6, game: 8, animal: 10, coffee: 5, flower: 6, nature: 6, black: 5, cartoon: 7, meme: 7, abstract: 7, letters: 9, default: 8 };

function chooseCategory(mode = 'mixed') {
  const w = { ...WEIGHTS };
  if (mode === 'people') { w.person = 40; w.portrait = 20; }
  if (mode === 'random') { w.person = 4; w.portrait = 2; }
  if (mode === 'none') return 'default';
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k;
  return 'abstract';
}

function generateAvatar({ category, gender, name, kind = 'generated', save = true } = {}) {
  const cat = CATEGORIES[category] ? category : chooseCategory();
  const svg = CATEGORIES[cat].gen(gender, name);
  const file = `${cat}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}.svg`;
  fs.writeFileSync(path.join(DATA_DIR, 'avatars', file), svg);
  const url = '/media/avatars/' + file;
  if (save) db.prepare('INSERT INTO avatars(kind,category,url,label,created_at) VALUES(?,?,?,?,?)').run(kind, cat, url, CATEGORIES[cat].label, Date.now());
  return { url, category: cat };
}

// كلمات في وصف التوليد → فئة
function categoryFromPrompt(p = '') {
  const map = [[/قط|بس|cat|حيوان|كلب|dog|animal/i, 'animal'], [/قهو|كوب|coffee|شاي/i, 'coffee'], [/ورد|زهر|flower|rose/i, 'flower'], [/منظر|طبيع|جبل|بحر|nature|sea/i, 'nature'],
    [/لعب|game|قيم|pixel/i, 'game'], [/خيال|ساحر|تنين|fantasy|anime|انمي/i, 'fantasy'], [/ميم|meme/i, 'meme'], [/اسود|سوداء|black/i, 'black'], [/كرتون|cartoon/i, 'cartoon'],
    [/ممثل|actor|actress|بورتريه|portrait/i, 'portrait'], [/حرف|رمز|letter/i, 'letters'], [/مجرد|abstract/i, 'abstract'], [/شخص|ولد|بنت|person|face/i, 'person']];
  for (const [re, c] of map) if (re.test(p)) return c;
  return chooseCategory();
}

function ensureLibrary() {
  const n = db.prepare("SELECT COUNT(*) c FROM avatars WHERE kind='library'").get().c;
  if (n >= 40) return;
  for (const cat of Object.keys(CATEGORIES)) for (let i = 0; i < (cat === 'black' || cat === 'default' ? 1 : 4); i++) generateAvatar({ category: cat, gender: i % 2 ? 'f' : 'm', name: cat, kind: 'library' });
}

module.exports = { generateAvatar, chooseCategory, categoryFromPrompt, ensureLibrary, CATEGORIES };
