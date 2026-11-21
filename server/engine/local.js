// المحرك المحلي: يقرر رد فعل كل شخصية ويولّد النص بلهجتها وأسلوبها بدون أي API
const { BANKS } = require('../data/dialects');
const { applyStyle } = require('./style');
const { isSafe } = require('./safety');

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function weighted(obj) { const e = Object.entries(obj).filter(([, v]) => v > 0); const tot = e.reduce((a, [, v]) => a + v, 0); if (!tot) return null; let r = Math.random() * tot; for (const [k, v] of e) if ((r -= v) <= 0) return k; return e[0][0]; }

// مستويات الجرأة قبل البث
const PRESETS = {
  respectful: { rude: 0, curse: 0, tease: 0.2, critic: 0.5, sarcasm: 0.3 },
  normal: { rude: 0.4, curse: 0.15, tease: 0.7, critic: 0.8, sarcasm: 0.8 },
  sarcastic: { rude: 0.6, curse: 0.2, tease: 1, critic: 1, sarcasm: 1.8 },
  rude: { rude: 1.4, curse: 0.6, tease: 1.2, critic: 1.2, sarcasm: 1.1 },
  heavy_tease: { rude: 0.9, curse: 0.4, tease: 2, critic: 1.1, sarcasm: 1.3 },
  light_curse: { rude: 1.2, curse: 1.6, tease: 1.2, critic: 1, sarcasm: 1 },
  mixed: { rude: 1, curse: 0.8, tease: 1, critic: 1, sarcasm: 1 },
};
function levelMultipliers(s = {}) {
  const base = PRESETS[s.politeness] || PRESETS.mixed;
  const sl = (v) => (v == null ? 1 : clamp(+v / 50, 0, 2));
  return { ...base, tease: base.tease * sl(s.tease), curse: base.curse * sl(s.curse), rude: base.rude * (s.politeness === 'respectful' ? 0 : 1) };
}

const NO_SHORT = new Set(['joke_better', 'explain', 'learned', 'searched', 'remember', 'ask_meaning', 'object_guess', 'object_known', 'object_learned']);
const COMBOS = { joke_bad: ['criticize', 'tease'], fail: ['tease', 'criticize'], win: ['praise', 'hype'], greet: ['question', 'idle_general'], tease: ['laugh'], joke_good: ['praise'], criticize: ['opinion'], question: ['idle_general'], bored: ['question'], greet_back: ['remember'] };

function fill(t, v) {
  let s = t;
  if (!v.s) s = s.replace(/\s*يا\s*\{s\}/g, '').replace(/\{s\}\s*/g, '');
  return s.replace(/\{(\w)\}/g, (m, k) => (v[k] != null ? v[k] : '')).replace(/\s+/g, ' ').replace(/^\s*[،,]\s*/, '').trim();
}

// يولد عبارة لنية معينة مع مراعاة مفردات الشخصية ومنع التكرار
function phrase(persona, intent, vars, guard, opts = {}) {
  const bank = BANKS[persona.dialect] || BANKS.white;
  let list = bank[intent]; if (!list || !list.length) return null;
  // كل شخصية تملك "مفردات" خاصة: مجموعة جزئية ثابتة من العبارات
  const mine = list.filter((x) => hash(persona.id + '|' + x) % 10 < 6);
  let first = [...(mine.length >= 2 ? mine : list)].sort(() => Math.random() - 0.5);
  // أصحاب الرسائل القصيرة جداً يختارون أقصر العبارات بدلاً من قصها
  const len = persona.style?.length;
  if ((len === 'tiny' || len === 'short') && !NO_SHORT.has(intent)) { first.sort((a, b) => a.length - b.length); first = first.slice(0, Math.max(2, Math.ceil(first.length * (len === 'tiny' ? 0.35 : 0.6)))).sort(() => Math.random() - 0.5); }
  const order = first.concat([...list].sort(() => Math.random() - 0.5));
  for (const raw of order.slice(0, 10)) {
    let text = fill(raw, vars);
    if (opts.long || (persona.style?.length === 'long' && Math.random() < 0.6)) {
      const extra = COMBOS[intent]; const e2 = extra && bank[pick(extra)];
      if (e2) { const t2 = fill(pick(e2), vars); if (t2 && !t2.includes('{')) text += pick([' ', '، ', ' و', '\n'.replace('\n', ' ')]) + t2; }
    }
    if (opts.suffix) text += ' ' + opts.suffix;
    text = applyStyle(text, persona, opts);
    if (!text || !isSafe(text)) continue;
    if (!guard || guard.check(text, persona.id).ok) return text;
  }
  return null;
}

// قرار رد الفعل لكل حدث → {intent, vars, suffix} أو {reaction} أو null
function decide(persona, ev, ctx) {
  const t = persona.traits || {}; const L = ctx.level || PRESETS.mixed; const en = persona.language === 'en';
  const tease = clamp(t.tease * L.tease), critic = clamp(t.critic * L.critic), sarcasm = clamp(t.sarcasm * L.sarcasm), rude = clamp(t.rude * L.rude);
  const canCurse = t.curse > 0.25 && L.curse > 0 && Math.random() < clamp(t.curse * L.curse * 0.35) && ctx.curseBudget();
  const vars = { s: ctx.streamer || '', g: ctx.game || (en ? 'the game' : 'اللعبة') };
  const r = (intent, extra = {}) => ({ intent, vars: { ...vars, ...extra.vars }, suffix: extra.suffix, long: extra.long });

  if (en && ev.arabic && !['named', 'join', 'idle', 'reply', 'fail', 'win', 'object'].includes(ev.kind)) {
    // الأجنبي لا يفهم العربية: يتفاعل مع ما يراه فقط
    if (['salam', 'greet', 'bye'].includes(ev.kind)) return r(ev.kind === 'bye' ? 'bye_reply' : 'salam_reply');
    if (ev.kind === 'joke' || ev.kind === 'chat' || ev.kind === 'question' || ev.kind === 'howru' || ev.kind === 'request' || ev.kind === 'here') return Math.random() < 0.45 ? r('not_understand') : null;
  }
  switch (ev.kind) {
    case 'join': if (ev.memory && ctx.memoryOn && Math.random() < 0.35) return r('remember', { vars: { e: ev.memory.text } });
      return r(persona.streams_attended > 0 && ctx.memoryOn ? 'greet_back' : (persona.streams_attended > 0 ? 'greet' : pick(['greet', 'greet', 'new_join'])));
    case 'greet': return r(weighted({ streamer_greet_reply: 3, greet: 1, respectful: (1 - rude) * 0.5 }));
    // ---- كلام المذيع نفسه (أولوية) ----
    case 'salam': return r('salam_reply');
    case 'howru': return r(Math.random() < 0.8 ? 'howru_reply' : 'salam_reply');
    case 'thanks': return r('thanks_reply');
    case 'request': return r(weighted({ request_ok: 3, ack: 0.6, tease: tease * 0.4 }));
    case 'love': return r(weighted({ love_back: 3, praise: 1 }));
    case 'bye': return r('bye_reply');
    case 'insult': return r(weighted({ defensive: 2 + (1 - rude), tease: tease * 1.5, rude: rude * 0.8 }));
    case 'here': return r('here_reply');
    case 'suggest': return r(weighted({ suggest: 3, answer_open: 0.7, opinion: 0.6 }));
    case 'laughing': return r(weighted({ laugh: 2, laugh_rare: 1, ack: 0.4 }));
    case 'joke': {
      if (ev.oldJoke && Math.random() < 0.65) return r('joke_old', { suffix: ev.oldJokeSeenBy?.has(persona.id) ? (en ? '(you told it last stream)' : pick(['قلتها البث اللي فات', 'سمعناها منك قبل', 'نفس نكتة البث الماضي'])) : '' });
      const diff = ev.quality - t.humor + rnd(-0.15, 0.15);
      if (diff > 0.15) return r(weighted({ laugh: 3, joke_good: 3, joke_sarcastic: sarcasm > 0.7 ? 1 : 0 }));
      if (diff > -0.08) return Math.random() < 0.4 ? null : r(weighted({ laugh_rare: 2, joke_good: 1, joke_sarcastic: sarcasm * 2 }));
      if (canCurse) return r('curse');
      const k = weighted({ joke_bad: 1 + critic * 3, joke_old: 0.6, _ignore: 2.5 - t.talk * 1.5, joke_better: t.talk * 1.2, joke_sarcastic: sarcasm * 2.5, tease: tease * 1.5, rude: rude * 0.6 });
      return k === '_ignore' ? null : r(k);
    }
    case 'fail': {
      if (canCurse) return r('curse');
      return r(weighted({ fail: 3, laugh: 1.5 * (1 - t.humor), tease: tease * 3, criticize: critic * 2, respectful: (1 - rude) * 0.8, joke_sarcastic: sarcasm }));
    }
    case 'win': return r(weighted({ win: 3, praise: 1.5, hype: t.hype * 2, answer_meh: critic * 1.2, joke_sarcastic: sarcasm * 0.7, tease: tease * 0.6 }));
    case 'game': return r(weighted({ hype: 1 + t.hype * 2, question: t.curiosity * 2, idle_games: (persona.interests || []).includes('games') ? 2 : 0.5, criticize: critic, bored: critic * 0.5 }));
    case 'important': return r(weighted({ hype: 2, laugh: 0.8, question: t.curiosity * 1.5, opinion: 1 }));
    case 'question': {
      // سؤال مفتوح (وش/ليش/مين…) ما يُجاب بـ«اي/لا»
      if (ev.open) return r(weighted({ answer_open: 2.4, opinion: ev.fromStreamer ? 0.3 : 1.4 + t.debate, echo: ev.topic ? 1.2 : 0, tease: tease * 0.3 }), { vars: { t: ev.topic || '' } });
      // نفس الشخص ما يناقض نفسه في نفس السؤال
      const yes = 1 - t.contrarian, no = t.contrarian + critic * 0.5;
      return r(weighted({ answer_yes: yes * 2, answer_no: no * 2, answer_meh: 0.8, opinion: 1 + t.debate * 0.5 }));
    }
    case 'chat': {
      if (ev.fromStreamer) {
        // كلام عادي من المذيع: يردون عليه هو، بشي له علاقة بكلامه
        if (canCurse && Math.random() < 0.15) return r('curse');
        return r(weighted({ ack: 2.2, echo: ev.topic ? 2.2 : 0, question: t.curiosity * 0.15, praise: (1 - critic) * 0.4, tease: tease * 0.5, opinion: t.debate * 0.15, laugh_rare: /ه{3,}|😂|lol/i.test(ev.text || '') ? 2 : 0.2 }), { vars: { t: ev.topic || '' } });
      }
      if (canCurse && Math.random() < 0.5) return r('curse');
      return r(weighted({ praise: (1 - critic) * 0.8 + t.hype * 0.5, tease: tease * 2, criticize: critic * 1.4, answer_meh: 0.6, question: t.curiosity * 1.5, laugh_rare: 0.4, opinion: t.debate, rude: rude * 0.5, respectful: (1 - rude) * 0.4, joke_sarcastic: sarcasm * 0.7 }));
    }
    case 'named': {
      const quiet = t.onlyWhenCalled || t.importantOnly || t.talk < 0.2;
      if (en && ev.arabic) return { intent: 'named', vars, suffix: pick(['sorry i dont understand arabic', 'english pls 😅', 'i didnt get that lol']), named: true };
      let suffix = '';
      if (ev.isQuestion) { const k = weighted({ answer_yes: 1 - t.contrarian, answer_no: t.contrarian + 0.2, answer_meh: 0.6, opinion: 1 }); suffix = phrase(persona, k, vars, null, { noEmoji: true }) || ''; }
      return { intent: quiet ? 'named_quiet' : 'named', vars, suffix, named: true };
    }
    case 'reply': {
      const other = ev.target; const aff = ctx.affinity(other.id);
      if (canCurse && rude > 0.5 && aff < 0) return r('curse');
      const agreeW = clamp(0.5 - t.contrarian * 0.6 + aff * 0.5), disW = clamp(t.contrarian * 0.9 - aff * 0.3 + 0.1);
      return r(weighted({ agree: agreeW * 2, disagree: disW * 2 + t.debate * 0.5, reply_viewer: 1, laugh: ev.targetIntent && /joke|laugh|fail/.test(ev.targetIntent) ? 1 : 0.2, rude: rude * 0.4 }), { vars: { n: other.username } });
    }
    case 'object': return null;
    case 'idle': {
      const ints = persona.interests || ['general'];
      if (ctx.memoryOn && ev.memory && Math.random() < 0.12) return r('remember', { vars: { e: ev.memory.text } });
      const w = { question: t.curiosity * 1.2, hype: t.hype * 0.8, bored: ctx.sinceEvent > 60000 ? 1.5 * critic + 0.3 : 0.1, tease: tease * 0.8, idle_general: 1 };
      for (const i of ints) w['idle_' + i] = (w['idle_' + i] || 0) + 1.6;
      return r(weighted(w));
    }
  }
  return null;
}

// يضيف كلمة تعلّمتها الشخصية في سياق صحيح (المدح مع المدح، السبّة مع الطقطقة…)
const lastSprinkle = new Map();
function sprinkleLearned(text, intent, words, allowInsult, pid) {
  if (!words || !words.length || Math.random() > 0.15) return text;
  if (Date.now() - (lastSprinkle.get(pid) || 0) < 45000) return text; // لا يكرر استخدام الكلمات المتعلمة بشكل مزعج
  const ctxCat = /praise|win|joke_good|hype/.test(intent) ? 'praise' : /curse|tease|fail|rude/.test(intent) ? 'insult' : /laugh|joke/.test(intent) ? 'joke' : 'neutral';
  if (ctxCat === 'insult' && !allowInsult) return text;
  if (ctxCat === 'neutral') return text;
  const cands = words.filter((w) => w.cat === ctxCat && w.status === 'confirmed');
  if (!cands.length) return text;
  lastSprinkle.set(pid, Date.now());
  const w = pick(cands); return Math.random() < 0.5 ? `${w.word} ${text}` : `${text} ${w.word}`;
}

module.exports = { decide, phrase, levelMultipliers, PRESETS, sprinkleLearned, hash };
