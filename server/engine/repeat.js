// نظام منع التكرار: يراقب الرسائل الأخيرة عالمياً ولكل شخصية
const OVERUSED = ['هه', 'خخ', 'واو', 'رهيب', 'فعلا', 'وش ذا', 'متحمس', 'lol', 'lmao', 'هاها', 'كفو', 'wow'];
function normalize(s) {
  return String(s || '').toLowerCase().replace(/\p{Extended_Pictographic}|\ufe0f|\u200d/gu, '').replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
}
function bigrams(s) { const t = s.replace(/\s/g, ''); const b = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); b.set(g, (b.get(g) || 0) + 1); } return b; }
function dice(a, b) {
  if (!a.length || !b.length) return a === b ? 1 : 0;
  const A = bigrams(a), B = bigrams(b); let inter = 0, ta = 0, tb = 0;
  for (const v of A.values()) ta += v; for (const v of B.values()) tb += v;
  for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
  return (2 * inter) / (ta + tb || 1);
}
class RepeatGuard {
  constructor(level = 30) { this.setLevel(level); this.recent = []; this.byPersona = new Map(); }
  setLevel(level) { this.level = Math.max(0, Math.min(100, +level)); this.threshold = 0.62 + this.level * 0.0035; this.window = Math.round(45 - this.level * 0.35); }
  isOverusedOnly(n) { return OVERUSED.some((o) => n === normalize(o)) || /^(ه|خ|ha|lo|l)+$/.test(n.replace(/\s/g, '')); }
  check(text, pid) {
    const n = normalize(text);
    if (!n) return { ok: true };
    const win = this.recent.slice(-this.window);
    if (win.some((r) => r.n === n)) return { ok: false, why: 'exact' };
    if (n.length > 6 && win.slice(-15).some((r) => dice(r.n, n) > this.threshold)) return { ok: false, why: 'similar' };
    if (this.isOverusedOnly(n)) { const k = Math.max(3, Math.round(10 - this.level * 0.08)); if (win.slice(-k).some((r) => this.isOverusedOnly(r.n))) return { ok: false, why: 'overused' }; }
    const mine = this.byPersona.get(pid) || [];
    if (mine.slice(-40).some((m) => m === n || (n.length > 6 && dice(m, n) > this.threshold - 0.05))) return { ok: false, why: 'self' };
    return { ok: true };
  }
  record(text, pid) {
    const n = normalize(text); if (!n) return;
    this.recent.push({ n, pid }); if (this.recent.length > 300) this.recent.shift();
    const mine = this.byPersona.get(pid) || []; mine.push(n); if (mine.length > 200) mine.shift(); this.byPersona.set(pid, mine);
  }
}
module.exports = { RepeatGuard, normalize, dice };
