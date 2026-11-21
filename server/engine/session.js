// جلسة البث المباشر: إدارة الأدوار والتوقيت، الطرد والحظر، التعلم، الذاكرة، والعلاقات
const { db, getSetting } = require('../db');
const { RepeatGuard } = require('./repeat');
const { decide, phrase, levelMultipliers, sprinkleLearned, hash } = require('./local');
const { detectMentions } = require('./mentions');
const learning = require('./learning');
const memory = require('./memory');
const llm = require('./llm');
const { isSafe } = require('./safety');
const P = require('../personas');
const { BANKS } = require('../data/dialects');

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const REACTIONS = { laugh: ['😂', '🤣', '💀'], fail: ['😬', '💀', '🤦', '😂'], win: ['🔥', '👏', '🏆', '❤️'], joke: ['😂', '😐', '🙄', '🤣'], chat: ['❤️', '👍', '👀'], important: ['😮', '🔥', '👀'], game: ['🎮', '🔥'], question: ['🤔', '👀'], greet: ['👋', '❤️'], named: ['👀'] };
const JOKE_RE = /نكت|نكته|نكتة|مره وحده|مرة وحدة|مره واحد|مرة واحد|واحد محشش|محشش|مرة في واحد|مره في واحد|اسمعوا ذي|joke|knock knock/i;
const GREET_RE = /^(السلام|سلام|هلا|اهلا|أهلا|مرحبا|مساء|صباح|هاي|hi|hello|hey)\b/i;
const Q_RE = /(وش رأيكم|ايش رأيكم|شرايكم|شو رأيكم|ايه رأيكم|رأيكم|تتوقعون|توافقون|مين معي|what do you think|do you|should i|\?|؟)/i;
const YES_RE = /^(صح|ايه|اي|ايوه|أيوه|بالضبط|yes|yeah|yep|correct|تمام|صحيح|نعم)\b/i;
const NO_RE = /^(لا|غلط|no|nope|مو صح|مش صح)\b/i;

const sessions = new Map();
const FORCED = new Set(['learn', 'teach', 'learned', 'searched', 'ask', 'object', 'x']);

class LiveSession {
  constructor(stream, personas, settings, emit) {
    this.id = stream.id; this.stream = stream; this.s = settings; this.emit = emit;
    this.level = levelMultipliers(settings);
    this.guard = new RepeatGuard(settings.repetition != null ? +settings.repetition : 30);
    this.parts = new Map(); this.queue = []; this.recent = []; this.lastSent = 0; this.lastEventAt = Date.now();
    this.curseLog = []; this.seenObjects = new Map(); this.pendingWord = null; this.pendingConfirm = null; this.pendingObject = null;
    this.game = stream.game || ''; this.streamer = settings.streamerName || getSetting('streamerName', '') || '';
    this.memoryOn = settings.memory !== false && getSetting('memoryEnabled', true) !== false;
    this.researchOn = settings.research !== false;
    this.activity = 0.3 + clamp((settings.activity != null ? +settings.activity : 50) / 100) * 1.4;
    this.debate = clamp((settings.debate != null ? +settings.debate : 40) / 100);
    this.maxAudience = +settings.maxAudience || Math.max(personas.length + 10, 30);
    this.everPresent = new Set();
    const sorted = [...personas].sort((a, b) => (b.traits.talk || 0) - (a.traits.talk || 0));
    const nTalk = Math.round(sorted.length * clamp((settings.talkRatio != null ? +settings.talkRatio : 20) / 100));
    const nQuiet = Math.round(sorted.length * clamp((settings.quietRatio != null ? +settings.quietRatio : 30) / 100));
    sorted.forEach((p, i) => this.parts.set(p.id, { p, present: false, mutedUntil: 0, blocked: false, kicked: false, talkMult: i < nTalk ? 1.6 : i >= sorted.length - nQuiet ? 0.25 : 1, lastSpoke: 0, words: learning.personaWords(p.id) }));
    this.relCache = new Map();
  }

  start({ resumed = false } = {}) {
    this.resumed = resumed;
    this.timer = setInterval(() => this.tick(), 200);
    this.nextIdle = Date.now() + 8000;
    // الدخول يبدأ لما تفتح صفحة البث (begin)، ومع احتياط لو ما اتصلت الصفحة
    this.beginFallback = setTimeout(() => this.begin(), 12000);
  }
  // دخول تدريجي واضح: العدد يزيد قدامك ورسالة دخول لكل واحد
  begin() {
    if (this.begun || this.stopped) return; this.begun = true; clearTimeout(this.beginFallback);
    const ids = [...this.parts.keys()].filter((id) => !this.parts.get(id).present).sort(() => Math.random() - 0.5);
    const fast = this.resumed ? ids.length : Math.ceil(ids.length * 0.6);
    let t = 900;
    ids.forEach((id, i) => { setTimeout(() => this.join(id, true, i), t); t += i < fast ? rnd(700, 2600) : rnd(4000, 14000); });
    if (this.resumed) this.system('رجع الاتصال بالبث، الجمهور يرجع يدخل');
    if (this.game) setTimeout(() => this.record('game', this.game, 0.6, { game: this.game }), 40000);
    this.nextIdle = Date.now() + 7000;
  }
  stop() { clearInterval(this.timer); clearTimeout(this.beginFallback); this.stopped = true; }

  // ---------- أدوات ----------
  present() { return [...this.parts.values()].filter((x) => x.present && !x.kicked); }
  canSpeak(x) { return x && x.present && !x.kicked && !x.blocked && x.mutedUntil < Date.now(); }
  curseBudget() { const now = Date.now(); this.curseLog = this.curseLog.filter((t) => now - t < 30000); return this.curseLog.length < 2; }
  affinity(a, b) { const k = a + ':' + b; if (!this.relCache.has(k)) { const r = db.prepare('SELECT affinity FROM relations WHERE a=? AND b=?').get(a, b); this.relCache.set(k, r ? r.affinity : 0); } return this.relCache.get(k); }
  bumpRelation(a, b, delta, note) {
    db.prepare('INSERT INTO relations(a,b,affinity,interactions,last_note) VALUES(?,?,?,1,?) ON CONFLICT(a,b) DO UPDATE SET affinity=MAX(-1,MIN(1,affinity+?)), interactions=interactions+1, last_note=?').run(a, b, delta, note, delta, note);
    this.relCache.delete(a + ':' + b);
  }
  ctxFor(x) { return { level: this.level, streamer: this.streamer, game: this.game, memoryOn: this.memoryOn, curseBudget: () => this.curseBudget(), affinity: (other) => this.affinity(x.p.id, other), sinceEvent: Date.now() - this.lastEventAt }; }
  roster() {
    return [...this.parts.values()].map((x) => ({ id: x.p.id, username: x.p.username, avatar: x.p.avatar_url, gender: x.p.gender, flag: x.p.nat?.flag, nat: x.p.nat?.name, dialect: x.p.dialect_name, reputation: x.p.reputation, archetype: x.p.archetype_label, favorite: x.p.favorite,
      present: x.present, kicked: x.kicked, blocked: x.blocked, muted: x.mutedUntil > Date.now() ? Math.ceil((x.mutedUntil - Date.now()) / 1000) : 0, banned: x.p.status === 'banned', msgs: x.count || 0 }));
  }
  pushRoster() { this.emit({ type: 'roster', roster: this.roster(), viewers: this.present().length }); }
  system(text) { this.saveMsg(null, text, 'system'); this.emit({ type: 'message', msg: { id: 's' + Date.now() + Math.random(), kind: 'system', text, ts: Date.now() } }); }
  saveMsg(pid, text, kind, replyTo = null, meta = null) { return db.prepare('INSERT INTO messages(stream_id,ts,persona_id,text,kind,reply_to,meta) VALUES(?,?,?,?,?,?,?)').run(this.id, Date.now(), pid, text, kind, replyTo, meta ? JSON.stringify(meta) : null).lastInsertRowid; }
  record(type, text, importance, data = {}, personaId = null) {
    return memory.recordEvent({ streamId: this.id, type, text, importance, personaId, data: { game: this.game, ...data }, present: this.present().map((x) => x.p.id), memoryOn: this.memoryOn });
  }

  // ---------- الدخول ----------
  join(id, auto = false, order = 99) {
    const x = this.parts.get(id); if (!x || this.stopped) return;
    if (x.kicked && auto) return; if (x.p.status === 'banned') return;
    if (x.present) return;
    x.present = true; this.everPresent.add(id);
    this.emit({ type: 'join', pid: id, username: x.p.username, avatar: x.p.avatar_url, viewers: this.present().length });
    this.pushRoster();
    const t = x.p.traits;
    // أول الداخلين يسلمون غالباً عشان الدردشة تبدأ بسرعة
    const greetP = order < 4 ? 0.85 : 0.25 + t.talk * 0.5;
    if (!t.onlyWhenCalled && Math.random() < greetP) this.schedule(x, { kind: 'join', memory: this.memoryOn && x.p.streams_attended > 0 ? memory.recall(x.p.id, this.id, x.p.language) : null }, rnd(1500, 6000));
    else if (Math.random() < t.reactsNonText) setTimeout(() => this.react(x, pick(REACTIONS.greet)), rnd(1000, 4000));
  }
  addPersonaLive(p) {
    if (this.parts.has(p.id)) { const x = this.parts.get(p.id); x.kicked = false; this.join(p.id); return; }
    if (this.present().length >= this.maxAudience) { this.system(`وصلت للحد الأقصى للجمهور (${this.maxAudience})`); return false; }
    this.parts.set(p.id, { p, present: false, mutedUntil: 0, blocked: false, kicked: false, talkMult: 1, lastSpoke: 0, words: learning.personaWords(p.id) });
    this.join(p.id); return true;
  }

  // ---------- الجدولة ونظام الدور ----------
  schedule(x, ev, delay, opts = {}) {
    const item = { pid: x.p.id, ev, due: Date.now() + delay, priority: !!opts.priority, text: opts.text || null, regen: opts.regen, after: opts.after, replyTo: opts.replyTo, eventId: ev.eventId, typingSent: false };
    // تقدير وقت الكتابة: شخصية تكتب ببطء تظهر "يكتب..." أطول
    item.typingMs = Math.min(5000, 600 + (opts.estLen || 25) / (x.p.traits.speed || 5) * 1000);
    this.queue.push(item);
    x.pending = (x.pending || 0) + 1;
    return item;
  }
  tick() {
    const now = Date.now();
    const n = Math.max(1, this.present().length);
    const minGap = Math.max(220, 1400 / this.activity / Math.sqrt(n / 8));
    this.queue.sort((a, b) => (b.priority - a.priority) || (a.due - b.due));
    for (const it of this.queue) if (!it.typingSent && it.due - now < it.typingMs && it.due > now) { it.typingSent = true; this.emit({ type: 'typing', pid: it.pid, username: this.parts.get(it.pid)?.p.username }); }
    const idx = this.queue.findIndex((it) => it.due <= now && (it.priority || now - this.lastSent >= minGap));
    if (idx >= 0) { const it = this.queue.splice(idx, 1)[0]; const x = this.parts.get(it.pid); if (x) x.pending = Math.max(0, (x.pending || 1) - 1); this.deliver(it); }
    if (now >= this.nextIdle) { this.idle(); this.nextIdle = now + rnd(0.6, 1.6) * 9000 / this.activity / Math.sqrt(n / 6); }
    // بعض الشخصيات تغادر أو تنضم بشكل طبيعي
    if (this.s.dynamicJoins && Math.random() < 0.0015 && this.present().length < this.maxAudience) this.addRandom(1, true);
  }

  deliver(it) {
    const x = this.parts.get(it.pid);
    if (!this.canSpeak(x)) return;
    let text = it.text, intent = it.ev.intent;
    const forced = FORCED.has(it.ev.kind);
    if (text && forced && it.regen && !this.guard.check(text, x.p.id).ok) text = it.regen() || text; // إعادة صياغة بدل التكرار
    if (text && !forced && !this.guard.check(text, x.p.id).ok) text = null; // نص مولّد مسبقاً (LLM) صار مكرراً
    if (!text && forced) return;
    if (!text) {
      const d = it.ev.decided || decide(x.p, it.ev, this.ctxFor(x));
      if (!d) return;
      if (d.reaction) return this.react(x, d.reaction);
      intent = d.intent;
      text = phrase(x.p, d.intent, d.vars, this.guard, { suffix: d.suffix, long: d.long });
      if (!text) { if (Math.random() < x.p.traits.reactsNonText) this.react(x, pick(REACTIONS[it.ev.kind] || REACTIONS.chat)); return; }
      text = sprinkleLearned(text, d.intent, x.words, this.level.curse > 0.3, x.p.id);
      if (d.intent === 'curse') this.curseLog.push(Date.now());
    }
    if (!isSafe(text)) return;
    this.guard.record(text, x.p.id);
    this.sendMessage(x, text, { kind: it.ev.kind === 'named' ? 'named' : 'chat', intent, replyTo: it.replyTo, eventId: it.eventId });
    if (it.after) it.after(text, intent);
    this.maybeChain(x, text, intent, it.ev.depth || 0);
  }

  sendMessage(x, text, { kind = 'chat', intent = '', replyTo = null, eventId = null } = {}) {
    const id = this.saveMsg(x.p.id, text, kind, replyTo ? JSON.stringify(replyTo) : null, { intent });
    x.count = (x.count || 0) + 1; x.lastSpoke = Date.now();
    const col = { laugh: 'laughs', joke_good: 'laughs', criticize: 'criticisms', joke_bad: 'criticisms', tease: 'teases', curse: 'teases' }[intent];
    db.prepare(`UPDATE personas SET msg_count=msg_count+1${col ? `, ${col}=${col}+1` : ''} WHERE id=?`).run(x.p.id);
    if (eventId && /laugh|joke_good|fail|win|hype/.test(intent)) memory.bumpReaction(eventId);
    const msg = { id, ts: Date.now(), kind, pid: x.p.id, username: x.p.username, avatar: x.p.avatar_url, flag: x.p.nat?.flag, gender: x.p.gender, text, intent, replyTo };
    this.recent.push({ name: x.p.username, pid: x.p.id, text, intent }); if (this.recent.length > 60) this.recent.shift();
    this.emit({ type: 'message', msg });
  }
  react(x, emoji) { if (!this.canSpeak(x)) return; this.saveMsg(x.p.id, emoji, 'reaction'); this.emit({ type: 'reaction', pid: x.p.id, username: x.p.username, emoji }); }

  // تفاعل الشخصيات مع بعضها
  maybeChain(x, text, intent, depth) {
    if (depth >= 3) return;
    if (intent === 'ask_meaning') return; // يعالج في نظام التعلم
    const others = this.present().filter((o) => o !== x && this.canSpeak(o) && !o.p.traits.onlyWhenCalled && !(o.pending > 1));
    if (!others.length) return;
    const p = this.debate * (intent === 'disagree' || intent === 'opinion' || intent === 'criticize' ? 0.75 : 0.32);
    if (Math.random() > p) return;
    // يفضّل من لديهم علاقة سابقة
    const scored = others.map((o) => ({ o, s: Math.random() + Math.abs(this.affinity(o.p.id, x.p.id)) * 0.8 + o.p.traits.debate * 0.5 + (o.p.traits.importantOnly ? -2 : 0) })).sort((a, b) => b.s - a.s);
    const o = scored[0].o;
    const ev = { kind: 'reply', target: x.p, targetIntent: intent, depth: depth + 1 };
    this.schedule(o, ev, rnd(1500, 5000), {
      replyTo: { name: x.p.username, text: text.slice(0, 60) },
      after: (t, i) => this.bumpRelation(o.p.id, x.p.id, i === 'agree' ? 0.12 : i === 'disagree' ? -0.06 : i === 'curse' || i === 'rude' ? -0.1 : 0.04, `${i}: ${t.slice(0, 40)}`),
    });
  }

  // اختيار من يرد على حدث بحسب أهميته ونشاط كل شخصية
  dispatch(ev, importance, exclude = new Set()) {
    const ps = this.present().filter((x) => this.canSpeak(x) && !exclude.has(x.p.id));
    const n = ps.length; if (!n) return [];
    const cap = Math.max(1, Math.min(14, Math.ceil(n * (0.12 + 0.4 * importance) * this.activity)));
    const chosen = [];
    for (const x of ps.sort(() => Math.random() - 0.5)) {
      const t = x.p.traits;
      let prob;
      if (t.onlyWhenCalled) prob = importance >= 0.95 ? 0.05 : 0;
      else if (t.importantOnly) prob = importance >= 0.75 ? 0.3 : 0.01;
      else prob = clamp(t.talk * x.talkMult * this.activity * (0.25 + importance * 1.1));
      if ((x.pending || 0) > 1) prob *= 0.2;
      if (chosen.length < cap && Math.random() < prob) chosen.push(x);
      else if (Math.random() < t.reactsNonText * importance * 0.6) setTimeout(() => this.react(x, pick(REACTIONS[ev.kind] || REACTIONS.chat)), rnd(400, 3000));
    }
    chosen.forEach((x, i) => {
      const quick = ['fail', 'win', 'joke'].includes(ev.kind);
      const delay = rnd(quick ? 500 : 1200, quick ? 2500 : 4000) + (1 - importance) * rnd(0, 2500) + i * rnd(500, 1800);
      this.schedule(x, ev, delay);
    });
    if (llm.enabled() && chosen.length) this.llmFill(ev, chosen);
    return chosen;
  }

  // عند وجود مفتاح AI: توليد النصوص دفعة واحدة، والمحرك المحلي احتياطي
  async llmFill(ev, chosen, named = false) {
    try {
      const memories = {}; for (const x of chosen) { const m = memory.recall(x.p.id, this.id, x.p.language); if (m) memories[x.p.id] = [m.text]; }
      const evDesc = { kind: ev.kind, text: ev.text || '', game: this.game, joke_was_told_before: !!ev.oldJoke };
      const replies = await llm.generateReplies({ event: evDesc, personas: chosen.map((x) => ({ p: x.p, named, hint: ev.kind, words: x.words.map((w) => `${w.word}=${w.meaning}`) })), recent: this.recent.map((r) => `${r.name}: ${r.text}`), streamer: this.streamer, game: this.game, level: this.s, memories });
      for (const r of replies) {
        const it = this.queue.find((q) => q.pid === +r.id && q.ev === ev && !q.text);
        if (!it) continue;
        if (r.skip) { it.ev = { ...ev, decided: null }; it.text = null; it.skip = true; this.queue.splice(this.queue.indexOf(it), 1); continue; }
        if (r.reaction) { this.queue.splice(this.queue.indexOf(it), 1); const x = this.parts.get(it.pid); setTimeout(() => this.react(x, r.reaction), Math.max(0, it.due - Date.now())); continue; }
        if (r.text && isSafe(r.text)) it.text = String(r.text).slice(0, 300);
      }
    } catch (e) { this.lastLlmError = e.message; }
  }

  idle() {
    const ps = this.present().filter((x) => this.canSpeak(x) && !x.p.traits.onlyWhenCalled && !x.p.traits.importantOnly && !(x.pending > 0));
    if (!ps.length) return;
    // اختيار متحدث حسب نشاطه
    const tot = ps.reduce((a, x) => a + x.p.traits.talk * x.talkMult + 0.02, 0); let r = Math.random() * tot; let x = ps[0];
    for (const c of ps) if ((r -= c.p.traits.talk * c.talkMult + 0.02) <= 0) { x = c; break; }
    // أحياناً يرد على رسالة شخص آخر بدلاً من كلام عشوائي
    const last = [...this.recent].reverse().find((m) => m.pid !== x.p.id && m.pid);
    if (last && Math.random() < this.debate * 0.5) { const t = this.parts.get(last.pid); if (t) { this.schedule(x, { kind: 'reply', target: t.p, targetIntent: last.intent, depth: 1 }, rnd(300, 1500), { replyTo: { name: t.p.username, text: last.text.slice(0, 60) } }); return; } }
    const mem = this.memoryOn ? memory.recall(x.p.id, this.id, x.p.language) : null;
    this.schedule(x, { kind: 'idle', memory: mem }, rnd(200, 1200));
    if (llm.enabled()) this.llmFill(this.queue[this.queue.length - 1].ev, [x]);
  }

  // ---------- رسائل المذيع ----------
  async streamerSays(text, { voice = false } = {}) {
    text = String(text || '').trim().slice(0, 500); if (!text) return;
    this.lastEventAt = Date.now();
    // كلامك بالصوت ما يظهر في الدردشة ولا يُحفظ كرسالة — يُستخدم بصمت لفهم المناداة والأحداث فقط
    if (!voice) {
      this.saveMsg(null, text, 'streamer');
      this.emit({ type: 'message', msg: { id: 'u' + Date.now(), kind: 'streamer', text, ts: Date.now(), username: this.streamer || 'أنت' } });
    }
    const arabic = /[\u0600-\u06FF]/.test(text);

    // 1) تعليم كلمة / تأكيد تخمين / تعليم شيء
    if (this.pendingConfirm && Date.now() - this.pendingConfirm.ts < 120000) {
      if (YES_RE.test(text)) { const pc = this.pendingConfirm; this.pendingConfirm = null; return this.teachWord(pc.word, pc.meaning, pc.cat, 'confirmed-guess'); }
      if (NO_RE.test(text) && text.length < 12) { const pc = this.pendingConfirm; this.pendingConfirm = null; this.pendingWord = { word: pc.word, ts: Date.now(), asker: pc.asker }; const x = this.parts.get(pc.asker); if (x) this.schedule(x, { kind: 'x' }, 1500, { text: phrase(x.p, 'ask_meaning', { w: pc.word }, this.guard) || `طيب وش معنى ${pc.word}؟`, priority: true }); return; }
    }
    const teach = learning.parseTeaching(text);
    if (teach) return this.teachWord(teach.word, teach.meaning, null, 'user');
    if (this.pendingWord && Date.now() - this.pendingWord.ts < 180000 && !Q_RE.test(text) && text.length < 140) {
      const meaning = text.replace(/^(يعني|معناها|معناه|it means|means)\s*/i, '').trim();
      if (meaning && !detectMentions(text, this.present().map((x) => x.p)).length) { const w = this.pendingWord.word; this.pendingWord = null; return this.teachWord(w, meaning, null, 'user'); }
    }
    if (this.pendingObject && Date.now() - this.pendingObject.ts < 180000) {
      const name = learning.parseObjectTeaching(text);
      if (name) return this.teachObject(this.pendingObject.label, name);
    }

    // 2) المناداة بالاسم
    const mentioned = detectMentions(text, [...this.parts.values()].map((x) => x.p));
    const isQuestion = Q_RE.test(text);
    for (const pid of mentioned) {
      const x = this.parts.get(pid);
      if (!x) continue;
      if (x.kicked || x.p.status === 'banned') { this.system(`${x.p.username} ${x.p.status === 'banned' ? 'محظور' : 'مطرود'} — أعده من قائمة الجمهور أولاً`); continue; }
      if (!x.present) this.join(x.p.id); // كان في قائمة الجمهور ولم يدخل بعد: يدخل ويرد
      if (!this.canSpeak(x)) { this.system(`${x.p.username} ${x.blocked ? 'ممنوع من الكتابة' : 'مكتوم'} حالياً`); continue; }
      const ev = { kind: 'named', text, arabic, isQuestion, eventId: this.record('named', text, 0.65, {}, pid) };
      this.schedule(x, ev, rnd(1200, 2600), { priority: true, replyTo: { name: this.streamer || 'المذيع', text: text.slice(0, 60), streamer: true } });
      if (llm.enabled()) this.llmFill(ev, [x], true);
    }
    const exclude = new Set(mentioned);

    // 3) تصنيف الحدث
    let kind = 'chat', importance = 0.4;
    const ev = { text, arabic };
    if (JOKE_RE.test(text) && text.length > 15) {
      kind = 'joke'; importance = 0.75;
      const old = memory.findOldJoke(text, this.id);
      ev.oldJoke = !!old; if (old) ev.oldJokeSeenBy = new Set(db.prepare("SELECT persona_id FROM memories WHERE event_id=?").all(old.id).map((r) => r.persona_id));
      ev.quality = (hash(text.replace(/\s/g, '')) % 1000) / 1000 * 0.8 + (/[؟?!]/.test(text) ? 0.1 : 0) + Math.min(0.1, text.length / 1500);
      ev.eventId = this.record('joke', text, 0.7, { quality: ev.quality });
    } else if (GREET_RE.test(text)) { kind = 'greet'; importance = 0.55; }
    else if (isQuestion) { kind = 'question'; importance = mentioned.length ? 0.2 : 0.6; }
    ev.kind = kind;
    if (!mentioned.length || kind === 'joke') this.dispatch(ev, importance, exclude);

    // 4) الكلمات المجهولة
    this.checkUnknownWords(text);
  }

  action(type, text = '') {
    this.lastEventAt = Date.now();
    const labels = { fail: 'خسارة / غلطة', win: 'فوز', important: 'حدث مهم', joke: 'نكتة', game: 'بدأت لعبة' };
    if (type === 'game') { this.game = text || this.game; db.prepare('UPDATE streams SET game=? WHERE id=?').run(this.game, this.id); }
    if (type === 'joke') return this.streamerSays(text.startsWith('نكت') ? text : 'نكتة: ' + text);
    this.system(`⚡ ${labels[type] || type}${text ? ': ' + text : ''}`);
    const imp = { fail: 0.85, win: 0.85, important: 0.9, game: 0.7 }[type] || 0.6;
    const ev = { kind: type, text, eventId: this.record(type, text, imp, { game: this.game }) };
    this.dispatch(ev, imp);
  }

  // ---------- التعلم ----------
  checkUnknownWords(text) {
    const terms = learning.termsIn(text);
    for (const term of terms) {
      const ps = this.present().filter((x) => this.canSpeak(x));
      const knowers = ps.filter((x) => learning.knows(x.p, term));
      const unknown = ps.filter((x) => !learning.knows(x.p, term));
      if (!unknown.length) continue;
      const shared = learning.getWord(term.word);
      // من القاموس المشترك: بعضهم يعرفها من الآخرين بصمت
      if (shared && shared.status === 'confirmed') for (const x of unknown) if (Math.random() < 0.55) { learning.learn(x.p.id, shared.id, 'shared'); x.words = learning.personaWords(x.p.id); }
      const still = unknown.filter((x) => !learning.knows(x.p, term));
      if (!still.length) continue;
      const asker = still.sort((a, b) => b.p.traits.curiosity - a.p.traits.curiosity + rnd(-0.3, 0.3))[0];
      if (asker.p.traits.onlyWhenCalled && Math.random() < 0.8) continue;
      const w = term.matched || term.word;
      this.schedule(asker, { kind: 'learn' }, rnd(2000, 4500), { text: phrase(asker.p, 'ask_meaning', { w }, this.guard) || `وش يعني ${w}؟`, estLen: 20,
        after: () => this.answerMeaning(asker, term, w, knowers) });
      break; // سؤال واحد في كل مرة
    }
  }
  async answerMeaning(asker, term, w, knowers) {
    const k = knowers.filter((x) => this.canSpeak(x) && x !== asker).sort(() => Math.random() - 0.5)[0];
    if (k && term.meaning) {
      // شخصية تشرح لأخرى → تتعلم منها
      this.schedule(k, { kind: 'teach' }, rnd(2000, 4000), { replyTo: { name: asker.p.username, text: '' }, text: phrase(k.p, 'explain', { w, m: term.meaning }, this.guard) || `${w} يعني ${term.meaning}`,
        after: () => { const row = learning.upsertWord({ word: term.word, meaning: term.meaning, cat: term.cat, family: term.family, status: 'confirmed', source: term.ref ? 'reference' : 'user' }); learning.learn(asker.p.id, row.id, 'persona'); asker.words = learning.personaWords(asker.p.id);
          if (Math.random() < 0.6) this.schedule(asker, { kind: 'learned' }, rnd(1500, 3500), { text: phrase(asker.p, 'learned', { w, m: term.meaning }, this.guard), regen: () => phrase(asker.p, 'learned', { w, m: term.meaning }, this.guard) }); } });
      return;
    }
    // لا أحد يعرف: البحث في المصادر ثم سؤال المستخدم
    const res = await learning.research(term.word, '', { allowWeb: this.researchOn });
    if (res && res.status === 'confirmed') {
      this.schedule(asker, { kind: 'searched' }, rnd(3000, 6000), { text: (phrase(asker.p, 'searched', { w, m: res.meaning }, this.guard) || `دورت: ${w} = ${res.meaning}`).replace(/بس مو متأكد|بس مش متأكد|بس مب متأكد/, ''),
        after: () => { const row = learning.upsertWord({ word: term.word, meaning: res.meaning, cat: res.cat, family: res.family, status: 'confirmed', source: res.source }); for (const x of this.present()) if (!learning.knows(x.p, term) && Math.random() < 0.6) learning.learn(x.p.id, row.id, 'search'); learning.learn(asker.p.id, row.id, 'search'); asker.words = learning.personaWords(asker.p.id); this.emit({ type: 'learned', word: row }); } });
    } else if (res) {
      learning.upsertWord({ word: term.word, meaning: res.meaning, cat: res.cat, status: 'guess', source: res.source });
      this.pendingConfirm = { word: term.word, meaning: res.meaning, cat: res.cat, asker: asker.p.id, ts: Date.now() };
      this.schedule(asker, { kind: 'searched' }, rnd(3000, 6000), { text: phrase(asker.p, 'searched', { w, m: res.meaning }, this.guard) || `${w} يعني ${res.meaning}؟`, priority: true });
    } else {
      this.pendingWord = { word: term.word, ts: Date.now(), asker: asker.p.id };
      this.schedule(asker, { kind: 'ask' }, rnd(2500, 4000), { text: (asker.p.language === 'en' ? `${this.streamer || 'streamer'} what does ${w} mean?` : `${this.streamer ? this.streamer + ' ' : ''}${phrase(asker.p, 'ask_meaning', { w }, null) || 'وش يعني ' + w + '؟'}`), priority: true });
    }
  }
  teachWord(word, meaning, cat, source) {
    const row = learning.upsertWord({ word, meaning, cat, status: 'confirmed', source: 'user' });
    const ps = this.present().filter((x) => this.canSpeak(x));
    for (const x of ps) { learning.learn(x.p.id, row.id, 'user'); x.words = learning.personaWords(x.p.id); }
    this.record('word', `${word} = ${meaning}`, 0.7, { word, meaning, cat: row.cat });
    this.emit({ type: 'learned', word: row });
    this.system(`📚 تم حفظ الكلمة «${word}» (${learning.CAT_AR[row.cat]}): ${meaning}`);
    const responders = ps.filter((x) => !x.p.traits.onlyWhenCalled).sort(() => Math.random() - 0.5).slice(0, Math.min(3, ps.length));
    responders.forEach((x, i) => this.schedule(x, { kind: 'learned' }, rnd(1500, 3000) + i * rnd(1200, 2500), { text: phrase(x.p, 'learned', { w: word, m: meaning }, this.guard), regen: () => phrase(x.p, 'learned', { w: word, m: meaning }, this.guard) }));
    if (this.pendingWord && this.pendingWord.word === word) this.pendingWord = null;
  }

  // ---------- التعرف على الأشياء ----------
  async detections(objs = []) {
    const now = Date.now();
    for (const o of objs) {
      if (!o || !o.label || o.label === 'person') continue;
      const last = this.seenObjects.get(o.label) || 0;
      if (now - last < 60000) continue;
      this.seenObjects.set(o.label, now);
      const known = learning.getObject(o.label);
      const ps = this.present().filter((x) => this.canSpeak(x) && !x.p.traits.onlyWhenCalled);
      if (!ps.length) return;
      const ar = learning.OBJECT_AR[o.label] || o.label;
      if (known && known.value === o.label && ar !== o.label) known.value = ar; // اسم محفوظ بالإنجليزي قديماً
      if (known && known.status === 'confirmed') {
        this.emit({ type: 'highlight', bbox: o.bbox, label: o.label, guess: known.value, score: o.score, known: true });
        ps.sort(() => Math.random() - 0.5).slice(0, 2).forEach((x, i) => this.schedule(x, { kind: 'object' }, rnd(1500, 4000) + i * 2000, { text: phrase(x.p, 'object_known', { o: x.p.language === 'en' ? o.label : known.value }, this.guard), regen: () => phrase(x.p, 'object_known', { o: x.p.language === 'en' ? o.label : known.value }, this.guard) }));
        this.record('object', known.value, 0.5, { name: known.value, name_en: o.label });
        continue;
      }
      const ambiguous = require('../data/lexicon').AMBIGUOUS.has(o.label) || (o.score || 0) < 0.72;
      this.emit({ type: 'highlight', bbox: o.bbox, label: o.label, guess: ar, score: o.score });
      const asker = ps.sort((a, b) => b.p.traits.curiosity - a.p.traits.curiosity + rnd(-0.2, 0.2))[0];
      if (ambiguous) {
        this.pendingObject = { label: o.label, ts: now };
        learning.saveObject(o.label, ar, 'guess', 'vision');
        this.schedule(asker, { kind: 'object' }, rnd(1500, 3000), { text: phrase(asker.p, 'object_ask', { s: this.streamer }, this.guard), priority: true });
        const guesser = ps.find((x) => x !== asker);
        if (guesser) this.schedule(guesser, { kind: 'object' }, rnd(3500, 6000), { text: phrase(guesser.p, 'object_guess', { o: guesser.p.language === 'en' ? o.label : ar }, this.guard), regen: () => phrase(guesser.p, 'object_guess', { o: guesser.p.language === 'en' ? o.label : ar }, this.guard) });
        // يتعلمون بأنفسهم: لو ما صححتهم خلال ثواني، يعتمدون اللي شافوه ويحفظونه
        const label = o.label;
        setTimeout(async () => {
          if (this.stopped || !this.pendingObject || this.pendingObject.label !== label) return;
          this.pendingObject = null;
          const d = this.researchOn ? await learning.wikiSummary(label === 'remote' ? 'Remote control' : label).catch(() => null) : null;
          this.selfLearnObject(label, ar, d || null, asker);
        }, rnd(9000, 13000));
      } else {
        this.schedule(asker, { kind: 'object' }, rnd(2000, 4000), { text: phrase(asker.p, 'object_guess', { o: asker.p.language === 'en' ? o.label : ar }, this.guard), regen: () => phrase(asker.p, 'object_guess', { o: asker.p.language === 'en' ? o.label : ar }, this.guard) });
        learning.saveObject(o.label, ar, 'confirmed', 'self-vision');
        this.record('object', ar, 0.55, { name: ar, name_en: o.label });
      }
    }
  }
  // حفظ شيء تعلموه بأنفسهم من الكاميرا (بدون ما تعلمهم)
  selfLearnObject(label, name, desc, by) {
    learning.saveObject(label, name, 'confirmed', 'self-vision', desc || null);
    this.record('object', name, 0.6, { name, name_en: label });
    this.emit({ type: 'learned', object: { label, name } });
    const ps = this.present().filter((x) => this.canSpeak(x) && !x.p.traits.onlyWhenCalled);
    const x = (by && this.canSpeak(by) ? by : null) || ps[Math.floor(Math.random() * ps.length)];
    if (x) this.schedule(x, { kind: 'object' }, rnd(800, 2000), { text: phrase(x.p, 'object_learned', { o: x.p.language === 'en' ? label : name }, this.guard), regen: () => phrase(x.p, 'object_learned', { o: x.p.language === 'en' ? label : name }, this.guard) });
  }
  async snapshot(dataUrl, auto = false) {
    if (!llm.config()?.vision) { if (!auto) this.system('التعرف الذكي على الصور يحتاج مفتاح API يدعم الصور (الإعدادات). حالياً يُستخدم الكشف المحلي في المتصفح.'); return; }
    if (auto) { if (this.visionBusy || Date.now() - (this.lastVision || 0) < 30000) return; this.visionBusy = true; this.lastVision = Date.now(); }
    try {
      const r = await llm.recognizeImage(dataUrl); if (!r) return;
      const label = (r.name_en || 'object').toLowerCase();
      if (r.bbox) this.emit({ type: 'highlight', bbox: r.bbox, label, guess: r.name_ar });
      const known = learning.getObject(label);
      const ps = this.present().filter((x) => this.canSpeak(x) && !x.p.traits.onlyWhenCalled);
      const x = ps.sort((a, b) => b.p.traits.curiosity - a.p.traits.curiosity + rnd(-0.3, 0.3))[0]; if (!x) return;
      if (auto) {
        if (known && known.status === 'confirmed') { if (Math.random() < 0.35) this.schedule(x, { kind: 'object' }, 1500, { text: phrase(x.p, 'object_known', { o: known.value }, this.guard) }); return; }
        this.schedule(x, { kind: 'object' }, 1500, { text: phrase(x.p, 'object_guess', { o: r.name_ar || label }, this.guard) });
        if ((r.confidence || 0) >= 0.55) setTimeout(() => this.selfLearnObject(label, r.name_ar || label, r.description, ps.find((o) => o !== x)), rnd(3500, 6000));
        return;
      }
      if (known && known.status === 'confirmed') return this.schedule(x, { kind: 'object' }, 1500, { text: phrase(x.p, 'object_known', { o: known.value }, this.guard), regen: () => phrase(x.p, 'object_known', { o: known.value }, this.guard) });
      learning.saveObject(label, r.name_ar, 'guess', 'llm-vision');
      this.pendingObject = { label, ts: Date.now() };
      this.schedule(x, { kind: 'object' }, 1500, { text: (r.confidence || 0) > 0.75 ? phrase(x.p, 'object_guess', { o: r.name_ar }, this.guard) : phrase(x.p, 'object_ask', { s: this.streamer }, this.guard), priority: true });
    } catch (e) { if (!auto) this.system('تعذر تحليل الصورة: ' + e.message); } finally { if (auto) this.visionBusy = false; }
  }
  teachObject(label, name) {
    learning.saveObject(label, name, 'confirmed', 'user');
    this.pendingObject = null;
    this.record('object', name, 0.75, { name, name_en: label });
    this.system(`🧠 تم حفظ المعلومة: هذا «${name}» (معلومة مؤكدة)`);
    const ps = this.present().filter((x) => this.canSpeak(x) && !x.p.traits.onlyWhenCalled).sort(() => Math.random() - 0.5).slice(0, 2);
    ps.forEach((x, i) => this.schedule(x, { kind: 'object' }, rnd(1500, 3000) + i * 2000, { text: phrase(x.p, 'object_learned', { o: name }, this.guard), regen: () => phrase(x.p, 'object_learned', { o: name }, this.guard) }));
  }

  // ---------- الإدارة ----------
  moderate(action, pid, seconds) {
    const x = this.parts.get(+pid);
    if (!x && action !== 'readd') return;
    const name = x?.p.username;
    switch (action) {
      case 'kick': x.present = false; x.kicked = true; P.updatePersona(x.p.id, { allow_return: false }); x.p.allow_return = false; this.system(`🚪 تم طرد ${name} من البث`); break;
      case 'ban': x.present = false; x.kicked = true; P.updatePersona(x.p.id, { status: 'banned', allow_return: false }); x.p.status = 'banned'; this.system(`⛔ تم حظر ${name} نهائياً`); break;
      case 'unban': P.updatePersona(x.p.id, { status: 'active', allow_return: true }); x.p.status = 'active'; x.p.allow_return = true; this.system(`✅ تم فك الحظر عن ${name}`); break;
      case 'mute': x.mutedUntil = Date.now() + (+seconds || 60) * 1000; this.system(`🔇 تم إسكات ${name} لمدة ${+seconds || 60} ثانية`); break;
      case 'unmute': x.mutedUntil = 0; x.blocked = false; this.system(`🔊 ${name} يقدر يكتب الحين`); break;
      case 'block': x.blocked = true; this.system(`🚫 ${name} ممنوع من إرسال الرسائل`); break;
      case 'remove': x.present = false; this.system(`➖ تمت إزالة ${name} من البث الحالي`); break;
      case 'readd': if (x) { if (x.p.status === 'banned') { this.system(`${name} محظور، فك الحظر أولاً`); break; } x.kicked = false; x.present = false; P.updatePersona(x.p.id, { allow_return: true }); x.p.allow_return = true; this.join(x.p.id); this.system(`➕ تمت إعادة ${name}`); } else { const p = P.getPersona(+pid); if (p && p.status !== 'banned') this.addPersonaLive(p); } break;
    }
    this.queue = this.queue.filter((it) => this.canSpeak(this.parts.get(it.pid)) || it.pid !== +pid);
    this.pushRoster();
  }
  addRandom(count = 1, quiet = false) {
    let added = 0;
    for (let i = 0; i < count; i++) {
      if (this.present().length >= this.maxAudience) { if (!quiet) this.system(`وصلت للحد الأقصى (${this.maxAudience})`); break; }
      const p = P.insertPersona(P.createPersonaObject({ avatarMode: this.s.avatarMode, foreignChance: this.s.foreignChance != null ? +this.s.foreignChance / 100 : 0.04 }));
      this.addPersonaLive(p); added++;
    }
    return added;
  }

  end() {
    this.stop();
    const present = [...this.everPresent];
    const upd = db.prepare('UPDATE personas SET streams_attended=streams_attended+1, last_seen=? WHERE id=?');
    for (const id of present) upd.run(Date.now(), id);
    const msgs = db.prepare("SELECT COUNT(*) c FROM messages WHERE stream_id=? AND persona_id IS NOT NULL AND kind<>'reaction'").get(this.id).c;
    const top = db.prepare('SELECT type,text FROM events WHERE stream_id=? ORDER BY importance+reactions*0.1 DESC LIMIT 3').all(this.id);
    const TA = { joke: 'نكتة', fail: 'غلطة', win: 'فوز', game: 'لعبة', word: 'كلمة جديدة', object: 'شيء جديد', named: 'نداء', important: 'حدث مهم' };
    const summary = `${present.length} مشاهد، ${msgs} رسالة. ` + top.map((t) => `${TA[t.type] || t.type}: ${String(t.text).slice(0, 30)}`).join(' | ');
    db.prepare('UPDATE streams SET ended_at=?, summary=?, persona_ids=? WHERE id=?').run(Date.now(), summary, JSON.stringify(present), this.id);
    sessions.delete(this.id);
    return summary;
  }
}

module.exports = { LiveSession, sessions };
