// كشف مناداة شخصية بالاسم (كتابي @name أو صوتي "يا name")
const { normalize } = require('./repeat');
const AR = { 'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 't', 'ج': 'j', 'ح': 'h', 'خ': 'k', 'د': 'd', 'ذ': 'd', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'g', 'ف': 'f', 'ق': 'k', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'و': 'u', 'ي': 'i', 'ى': 'a', 'ئ': 'i', 'ؤ': 'u', 'ء': '', 'گ': 'k', 'چ': 'ch', 'پ': 'b', 'ڤ': 'f' };
const EMOJI_ALIAS = { '☕': ['قهوه', 'قهوة', 'كوفي', 'coffee'], '🌹': ['ورده', 'وردة', 'rose'], '🐱': ['قطه', 'قطوه', 'بسه', 'cat'], '💀': ['جمجمه', 'skull'], '👀': ['عيون', 'eyes'], '🔥': ['نار', 'fire'], '🌙': ['قمر', 'moon'], '🍕': ['بيتزا', 'pizza'], '🎮': ['يد التحكم', 'قيمر', 'جيمر'], '🦋': ['فراشه', 'butterfly'], '🖤': ['قلب اسود', 'قلب'], '🐸': ['ضفدع', 'frog'], '🍓': ['فراوله', 'فراولة', 'strawberry'], '🥀': ['ورده ذابله', 'وردة'], '😶': ['ساكت'], '🤡': ['مهرج', 'clown'], '🐼': ['باندا', 'panda'], '🌸': ['زهره', 'وردة'], '👻': ['شبح', 'ghost'], '🍩': ['دونات', 'donut'], '🦊': ['ثعلب', 'fox'], '🍉': ['بطيخ', 'حبحب', 'watermelon'], '🌚': ['قمر اسود', 'moon'], '🫠': ['ذايب'], '♡': ['قلب', 'heart'], '☁': ['غيمه', 'سحابه'], '★': ['نجمه', 'star'], '?': ['علامة استفهام', 'استفهام'], '...': ['نقط', 'ثلاث نقاط'] };
const LETTER_NAMES = { x: ['اكس'], n: ['ان', 'إن'], k: ['كي'], j: ['جي'], m: ['ام'], s: ['اس'], a: ['اي'], b: ['بي'], z: ['زد', 'زي'], q: ['كيو'], r: ['ار'], l: ['ال'] };
function toLatin(s) {
  return String(s).toLowerCase().split('').map((c) => (AR[c] != null ? AR[c] : c)).join('')
    .replace(/7/g, 'h').replace(/3/g, 'a').replace(/5/g, 'k').replace(/2/g, 'a').replace(/6/g, 't').replace(/9/g, 'k').replace(/8/g, 'k');
}
function skeleton(s) {
  return toLatin(s).replace(/[^a-z]/g, '').replace(/sh/g, 'S').replace(/th|dh/g, 'd').replace(/ph/g, 'f').replace(/kh|gh/g, 'k').replace(/[qcg]/g, 'k').replace(/p/g, 'b').replace(/v/g, 'f').replace(/x/g, 'ks').replace(/[aeiouyw]/g, '').replace(/(.)\1+/g, '$1');
}
function nameParts(u) {
  const base = String(u);
  const parts = new Set([base]);
  base.split(/[._\-\s\d]+|xx|Xx|xX/).forEach((p) => p && p.length >= 3 && parts.add(p));
  return [...parts];
}
// يعيد قائمة معرفات الشخصيات المناداة
function detectMentions(text, personas) {
  const raw = String(text || '');
  const low = raw.toLowerCase();
  const hits = new Map(); // id -> score
  const add = (id, s) => hits.set(id, Math.max(hits.get(id) || 0, s));
  const sorted = [...personas].sort((a, b) => b.username.length - a.username.length);
  // 1) @الاسم
  for (const m of raw.matchAll(/@/g)) {
    const after = raw.slice(m.index + 1).toLowerCase();
    for (const p of sorted) if (after.startsWith(p.username.toLowerCase())) { add(p.id, 3); break; }
  }
  // 2) الاسم موجود حرفياً (أسماء مميزة)
  for (const p of sorted) {
    const u = p.username.toLowerCase();
    if (u.length >= 3 && !/^\p{Extended_Pictographic}+$/u.test(u)) {
      const re = new RegExp('(^|[^\\p{L}\\p{N}_])' + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}_])', 'u');
      if (re.test(low)) add(p.id, 2.5);
    } else if (raw.includes(p.username) && (u.length >= 2 || /يا\s*$/.test(raw.split(p.username)[0]) || raw.trim().startsWith(p.username))) add(p.id, 2.2);
  }
  // 3) نداء صوتي: "يا X" / "hey X"
  const calls = [...raw.matchAll(/(?:^|\s)(?:يا|ياا|ي|hey|yo|hi)\s+([^\s،,؟?!.]+(?:\s+[^\s،,؟?!.]+)?)/giu)].map((m) => m[1]);
  if (/^[^\s]+[،,]/.test(raw.trim())) calls.push(raw.trim().split(/[،,]/)[0]);
  for (const c of calls) {
    const words = c.split(/\s+/); const cands = [words[0], words.join(' ')];
    for (const cand of cands) {
      const cn = normalize(cand), cs = skeleton(cand);
      for (const p of personas) {
        const u = p.username;
        if (normalize(u) === cn && cn) { add(p.id, 2.8); continue; }
        for (const [e, al] of Object.entries(EMOJI_ALIAS)) if (u.includes(e) && al.some((a) => normalize(a) === cn)) add(p.id, 2);
        const ul = u.toLowerCase().replace(/[^a-z]/g, '');
        if (ul.length === 1 && (LETTER_NAMES[ul] || []).some((a) => normalize(a) === cn || cand.toLowerCase() === ul)) add(p.id, 2);
        for (const part of nameParts(u)) {
          const ps = skeleton(part);
          if (ps.length >= 2 && ps === cs) add(p.id, ps.length >= 3 ? 2 : 1.6);
        }
      }
    }
  }
  const best = [...hits.entries()].sort((a, b) => b[1] - a[1]);
  if (!best.length) return [];
  const top = best[0][1];
  return best.filter(([, s]) => s >= top - 0.3).slice(0, 3).map(([id]) => id);
}
module.exports = { detectMentions, skeleton, toLatin };
