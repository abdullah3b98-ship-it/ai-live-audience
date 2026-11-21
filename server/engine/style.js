// تطبيق أسلوب الكتابة الخاص بكل شخصية
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const EMOJI_RE = /\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic}|\ufe0f)*/gu;
const AR2LAT = { 'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': '7', 'خ': '5', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': '6', 'ظ': 'z', 'ع': '3', 'غ': 'gh', 'ف': 'f', 'ق': '9', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ء': '2', 'ؤ': 'o', 'گ': 'g', 'چ': 'ch', '؟': '?', '،': ',' };
const arabizi = (s) => s.split('').map((c) => (AR2LAT[c] != null ? AR2LAT[c] : c)).join('').replace(/aa+/g, 'a');
const EN_FILLERS = ['bro', 'ok', 'literally', 'fr', 'lol', 'same', 'nice', 'XD', 'omg', 'wallah', 'bruh', 'tbh', 'pls', 'yes'];
const AR_ABBR = [[/ان شاء الله/g, ['انشالله', 'ان شاءالله', 'انشاء الله']], [/ما شاء الله/g, ['ماشاءالله', 'مشالله']], [/السلام عليكم/g, ['السلام', 'سلام', 'السلام عليكم ورحمة الله']], [/والله/g, ['ولله', 'والله', 'wallah']], [/يعطيك العافية/g, ['يعطيك العافيه', 'يعطيك الف عافيه']], [/الحمد لله/g, ['الحمدلله', 'الحمدالله']], [/ليش/g, ['لش', 'ليش']], [/يا /g, ['ي ', 'يا ']]];
const EN_ABBR = [[/\byou\b/g, 'u'], [/\bare\b/g, 'r'], [/\bplease\b/g, 'pls'], [/\bbecause\b/g, 'cuz'], [/\bokay\b/g, 'ok'], [/\bto\b/g, '2'], [/\bfor\b/g, '4'], [/\bthat\b/g, 'tht'], [/\bwhat\b/g, 'wat']];

function applyStyle(text, persona, opts = {}) {
  const st = persona.style || {};
  let t = String(text);
  const en = persona.language === 'en';
  // الضحكة الخاصة بالشخصية بدلاً من ضحكة موحدة
  if (st.laugh && !opts.keepLaugh) t = t.replace(en ? /\b(lmao+|lol|hahaha+|LMAO+|LOL)\b/ : /ه{4,}|خ{4,}/, st.laugh);
  if (en) {
    if (st.abbreviations) for (const [re, r] of EN_ABBR) if (Math.random() < 0.7) t = t.replace(re, r);
    if (st.lowercase) t = t.toLowerCase(); else if (Math.random() < 0.1) t = t.toUpperCase();
  } else {
    if (st.abbreviations) for (const [re, rs] of AR_ABBR) if (re.test(t)) t = t.replace(re, pick(rs));
    if (st.dropHamza) t = t.replace(/[أإآ]/g, 'ا');
    if (st.taAsHa) t = t.replace(/ة(?=\s|$|[^\p{L}])/gu, 'ه');
    if (st.typos && Math.random() < st.typos) t = t.replace(/ى(?=\s|$)/g, 'ي').replace(/ذ/g, (m) => (Math.random() < 0.5 ? 'ز' : m));
    if (st.mixEnglish && Math.random() < st.mixEnglish) t = Math.random() < 0.5 ? t + ' ' + pick(EN_FILLERS) : pick(EN_FILLERS) + ' ' + t;
    if (st.elongate && Math.random() < st.elongate) t = t.replace(/([اويه])(?=\s|$)/, (m) => m.repeat(3 + Math.floor(Math.random() * 4)));
    if (st.numbers && Math.random() < 0.3) t = t.replace(/مره|مرة/, 'مره ١٠٠٪').replace(/\bواحد\b/, '1');
    if (st.arabizi) t = arabizi(t);
  }
  if (!st.punctuation) t = t.replace(/[.,،!؛]+/g, '').replace(/\?{1}/g, Math.random() < 0.5 ? '' : '?').replace(/؟/g, Math.random() < 0.5 ? '' : '؟');
  else if (Math.random() < 0.3 && !/[؟?!.]$/.test(t)) t += pick(['.', '!', '!!', '...']);
  // الإيموجي
  const e = st.emoji;
  if (e === 'never') t = t.replace(EMOJI_RE, '');
  else if (!opts.noEmoji) {
    const p = { rare: 0.12, sometimes: 0.35, often: 0.75 }[e] || 0;
    if (Math.random() < p) { const set = st.emojiSet || ['😂']; t += ' ' + pick(set).repeat(e === 'often' && Math.random() < 0.4 ? 3 : 1); }
  }
  // الطول
  return t.replace(/\s+/g, ' ').trim();
}
module.exports = { applyStyle, arabizi, EMOJI_RE };
