import { h, api, toast, colorFor, fmtDur, $, $$, modal, meta } from './ui.js';
import { editPersona, personaCard } from './personas.js';
import { ic } from './icons.js';

let L = null; // حالة البث الحالية
export function leaveLive() {
  if (!L) return;
  L.closed = true;
  try { L.ws && L.ws.close(); } catch {}
  L.media && L.media.getTracks().forEach((t) => t.stop());
  L.rec && L.rec.stop && L.rec.state !== 'inactive' && L.rec.stop();
  L.speech && (L.speechOn = false, L.speech.stop());
  clearInterval(L.timer); clearInterval(L.detectTimer); clearInterval(L.snapTimer); clearInterval(L.beat);
  L = null;
}
const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const btn = (icon, label, onclick, cls = '', title = '') => h('button', { class: 'btn ' + cls, onclick, title: title || label }, ic(icon), label ? h('span', { class: 'lbl' }, label) : null);

export async function renderLive(app, id) {
  leaveLive();
  const [info, m] = await Promise.all([api('/api/streams/' + id), meta()]);
  if (!info.live) { app.append(h('div', { class: 'card center' }, h('h2', {}, 'هذا البث انتهى'), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('a', { class: 'btn', href: '#/stream/' + id }, ic('history'), 'مراجعة البث'), h('a', { class: 'btn pri', href: '#/' }, ic('radio'), 'بث جديد')))); return; }
  const visionKey = !!(m.llm.active && m.llm.active.vision);
  L = { id, roster: [], typing: new Map(), started: info.started_at, visionOn: true, retry: 0 };

  // ---------- المسرح ----------
  const video = h('video', { autoplay: true, muted: true, playsInline: true });
  const ph = h('div', { class: 'ph' }, ic('video', 44), h('p', {}, 'شغّل الكاميرا أو شارك الشاشة'), h('p', { class: 'small muted' }, 'الجمهور يشوف اللي قدام الكاميرا ويتعلم منه بنفسه'));
  const bbox = h('div', { class: 'bbox', style: { display: 'none' } }, h('span', {}, ''));
  const floaters = h('div', { class: 'floaters' });
  const vCount = h('b', {}, '0');
  const viewers = h('span', { class: 'pill' }, ic('eye', 15), vCount);
  const clock = h('span', { class: 'pill' }, '00:00:00');
  const net = h('span', { class: 'pill warn', style: { display: 'none' } }, ic('wifiOff', 15), 'يعاد الاتصال…');
  const micPill = h('span', { class: 'pill', style: { display: 'none' }, title: 'يسمع اسمك بالصوت (ما يظهر كلامك)' }, ic('mic', 15));
  const visPill = h('span', { class: 'pill', style: { display: 'none' }, title: 'الجمهور يشوف الكاميرا' }, ic('scan', 15));
  const wrap = h('div', { class: 'video-wrap' }, ph, video, bbox, floaters,
    h('div', { class: 'ov-top' }, h('span', { class: 'live-badge' }, 'LIVE'), viewers, clock, info.game ? h('span', { class: 'pill gamep' }, ic('game', 15), info.game) : null, h('span', { class: 'grow' }), visPill, micPill, net));
  video.style.display = 'none';

  const camBtn = btn('video', 'الكاميرا', startCam);
  const scrBtn = btn('monitor', 'مشاركة الشاشة', startScreen);
  const moreBtn = btn('more', '', (e) => moreMenu(e), '', 'المزيد');
  const endBtn = btn('stop', 'إنهاء', endStream, 'red');
  const controls = h('div', { class: 'controls' }, camBtn, scrBtn, h('span', { class: 'grow' }), moreBtn, endBtn);

  // ---------- الجانب: دردشة / جمهور ----------
  const chat = h('div', { id: 'chat' });
  const typing = h('div', { class: 'typing' });
  const input = h('input', { type: 'text', placeholder: 'اكتب للجمهور… (@اسم لمناداة شخص)', onkeydown: (e) => { if (e.key === 'Enter') sendChat(); } });
  const evBtn = h('button', { class: 'btn icon', title: 'حدث سريع', onclick: (e) => eventsMenu(e) }, ic('zap'));
  const chatPane = h('div', { class: 'pane on chatpane' }, h('div', { class: 'scroll', id: 'chatScroll' }, chat), typing, h('div', { class: 'chatbox' }, evBtn, input, h('button', { class: 'btn pri icon', title: 'إرسال', onclick: sendChat }, ic('send'))));
  const rosterPane = h('div', { class: 'pane' });
  const panes = [chatPane, rosterPane];
  const tabCount = h('span', { class: 'cnt' }, '0');
  const tabBtns = [h('span', {}, ic('chat', 16), 'الدردشة'), h('span', {}, ic('users', 16), 'الجمهور ', tabCount)].map((t, i) => h('button', { class: i ? '' : 'on', onclick: () => { panes.forEach((p, j) => p.classList.toggle('on', i === j)); tabBtns.forEach((b, j) => b.classList.toggle('on', i === j)); if (i === 1) drawRoster(); } }, t));
  const side = h('div', { class: 'side' }, h('div', { class: 'tabs' }, tabBtns), ...panes);
  app.append(h('div', { class: 'studio' }, h('div', { class: 'stage' }, wrap, controls), side));

  // آخر الرسائل عند فتح الصفحة (بدون كلامك الصوتي)
  for (const x of info.messages.filter((x) => x.kind !== 'reaction' && x.kind !== 'voice').slice(-60)) {
    const rt = x.reply_to ? JSON.parse(x.reply_to) : null;
    addMsg(x.persona_id ? { kind: x.kind, pid: x.persona_id, username: x.username, avatar: x.avatar_url, text: x.text, replyTo: rt } : { kind: x.kind, text: x.text, username: x.kind === 'system' ? '' : 'أنت' });
  }

  // ---------- الاتصال ----------
  connect();
  L.beat = setInterval(() => { fetch('/api/ping').catch(() => {}); send({ type: 'ping' }, true); }, 45000);
  function connect() {
    if (!L || L.closed) return;
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?stream=' + id);
    L.ws = ws;
    ws.onopen = () => { L.retry = 0; net.style.display = 'none'; };
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
    ws.onclose = () => { if (!L || L.closed || L.ended || L.id !== id) return; net.style.display = ''; const d = Math.min(8000, 800 * 2 ** L.retry++); setTimeout(connect, d); };
  }
  function send(o, quiet) { if (L && L.ws && L.ws.readyState === 1) L.ws.send(JSON.stringify(o)); else if (!quiet) toast('غير متصل… يعاد الاتصال'); }
  function sendChat() { const t = input.value.trim(); if (!t) return; send({ type: 'chat', text: t }); input.value = ''; }

  function onMsg(x) {
    if (x.type === 'message') addMsg(x.msg);
    else if (x.type === 'roster') { L.roster = x.roster; setCount(x.viewers); if (rosterPane.classList.contains('on')) drawRoster(); }
    else if (x.type === 'typing') { L.typing.set(x.pid, { name: x.username, t: Date.now() }); drawTyping(); }
    else if (x.type === 'reaction') floatEmoji(x.emoji);
    else if (x.type === 'highlight') showBox(x);
    else if (x.type === 'join') { addJoin(x); if (x.viewers != null) setCount(x.viewers); }
    else if (x.type === 'learned') { if (x.object) toast(`الجمهور تعلّم: ${x.object.name}`); else if (x.word) toast(`الجمهور تعلّم كلمة: ${x.word.word}`); }
    else if (x.type === 'ended') { L.ended = true; showEnded(); }
  }
  function setCount(n) { vCount.textContent = n; tabCount.textContent = n; }
  function scrollKeep(fn) { const sc = $('#chatScroll'); const atBottom = !sc || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80; fn(); while (chat.children.length > 400) chat.firstChild.remove(); if (sc && atBottom) sc.scrollTop = sc.scrollHeight; }
  function addJoin(x) { scrollKeep(() => chat.append(h('div', { class: 'msg join' }, ic('door', 13), h('img', { class: 'av', src: x.avatar || '', alt: '' }), h('span', { class: 'u', style: { color: colorFor(x.username) } }, x.username), ' دخل البث'))); }
  function addMsg(msg) {
    if (msg.pid) { L.typing.delete(msg.pid); drawTyping(); }
    let el;
    if (msg.kind === 'system') el = h('div', { class: 'msg system' }, msg.text);
    else if (msg.kind === 'streamer') el = h('div', { class: 'msg streamer' }, h('span', { class: 'u', style: { color: 'var(--green)' } }, msg.username || 'أنت'), ': ', h('span', { class: 't' }, msg.text));
    else if (msg.kind === 'voice') return; // كلامك بالصوت ما ينعرض
    else {
      const rq = msg.replyTo ? h('span', { class: 'rq' }, msg.replyTo.streamer ? `↩ يرد عليك: «${msg.replyTo.text}»` : `↩ رداً على ${msg.replyTo.name}${msg.replyTo.text ? ': ' + msg.replyTo.text : ''}`) : null;
      el = h('div', { class: 'msg ' + (msg.kind === 'named' ? 'named' : '') }, rq, h('img', { class: 'av', src: msg.avatar, alt: '' }), msg.flag ? msg.flag + ' ' : '', h('span', { class: 'u', style: { color: colorFor(msg.username) }, onclick: (e) => personaMenu(msg.pid, e) }, msg.username), ': ', h('span', { class: 't' }, msg.text));
    }
    scrollKeep(() => chat.append(el));
  }
  function drawTyping() {
    const now = Date.now(); for (const [k, v] of L.typing) if (now - v.t > 7000) L.typing.delete(k);
    const n = [...L.typing.values()].map((v) => v.name);
    typing.textContent = n.length ? (n.length > 3 ? `${n.slice(0, 2).join('، ')} و${n.length - 2} آخرين يكتبون…` : `${n.join('، ')} ${n.length > 1 ? 'يكتبون' : 'يكتب'}…`) : '';
  }
  function floatEmoji(e) { const s = h('span', { style: { left: Math.random() * 70 + 'px' } }, e); floaters.append(s); setTimeout(() => s.remove(), 3300); }
  function showBox(x) {
    if (!x.bbox || !L.media) return; const [bx, by, bw, bh] = x.bbox;
    Object.assign(bbox.style, { display: 'block', right: `${bx * 100}%`, top: `${by * 100}%`, width: `${bw * 100}%`, height: `${bh * 100}%` });
    bbox.firstChild.textContent = (x.known ? '✓ ' : '؟ ') + (x.guess || x.label);
    clearTimeout(L.boxT); L.boxT = setTimeout(() => (bbox.style.display = 'none'), 9000);
  }
  function showEnded() {
    wrap.append(h('div', { class: 'ended' }, h('h2', {}, 'انتهى البث'), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('a', { class: 'btn', href: '#/stream/' + id }, ic('history'), 'المراجعة'), h('a', { class: 'btn pri', href: '#/' }, ic('radio'), 'بث جديد'))));
  }

  // ---------- القوائم ----------
  function popAt(e, ...kids) {
    e.stopPropagation(); $$('.pop').forEach((p) => p.remove());
    const pop = h('div', { class: 'pop' }, ...kids); document.body.append(pop);
    const r = e.currentTarget ? e.currentTarget.getBoundingClientRect() : { left: e.clientX, top: e.clientY, bottom: e.clientY };
    let x = Math.min(r.left, innerWidth - pop.offsetWidth - 8), y = r.bottom + 6; if (y + pop.offsetHeight > innerHeight - 8) y = Math.max(8, r.top - pop.offsetHeight - 6);
    Object.assign(pop.style, { left: Math.max(8, x) + 'px', top: y + 'px' });
    setTimeout(() => document.addEventListener('click', function f(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', f); } }), 0);
    return pop;
  }
  const item = (icon, label, fn, cls = '') => h('button', { class: 'btn sm ' + cls, onclick: () => { $$('.pop').forEach((p) => p.remove()); fn(); } }, ic(icon, 16), label);
  function moreMenu(e) {
    popAt(e,
      item(L.visionOn ? 'eye' : 'scan', L.visionOn ? 'الجمهور يشوف الكاميرا (شغّال)' : 'خل الجمهور يشوف الكاميرا', toggleVision, L.visionOn ? 'on' : ''),
      visionKey ? item('sparkles', 'خلهم يعلقون على اللقطة الحين', () => snapshot(false)) : null,
      item(L.speechOn ? 'micOff' : 'mic', L.speechOn ? 'إيقاف سماع اسمك بالصوت' : 'سماع اسمك بالصوت (بدون عرض كلامك)', toggleSpeech, L.speechOn ? 'on' : ''),
      item('rec', L.rec && L.rec.state === 'recording' ? 'إيقاف التسجيل وحفظه' : 'تسجيل البث', toggleRec, L.rec && L.rec.state === 'recording' ? 'on' : ''));
  }
  function eventsMenu(e) {
    const qa = (icon, a, label, ask) => item(icon, label, () => { let t = ''; if (ask) { t = prompt(ask) || ''; if (!t && a !== 'important') return; } send({ type: 'action', action: a, text: t }); });
    popAt(e, h('div', { class: 'small muted', style: { padding: '2px 4px 6px' } }, 'حدث سريع يتفاعل معه الجمهور'),
      qa('frown', 'fail', 'خسرت / غلطت'), qa('trophy', 'win', 'فزت'), qa('laugh', 'joke', 'نكتة', 'اكتب النكتة'), qa('zap', 'important', 'حدث مهم', 'وش صار؟ (اختياري)'), qa('game', 'game', 'لعبة جديدة', 'اسم اللعبة'));
  }
  function drawRoster() {
    rosterPane.innerHTML = '';
    const pres = L.roster.filter((r) => r.present), out = L.roster.filter((r) => !r.present && !r.banned), ban = L.roster.filter((r) => r.banned);
    const row = (r) => h('div', { class: 'ritem' }, h('img', { class: 'av sm', src: r.avatar }), h('div', { class: 'grow' }, h('div', { class: 'nm' }, (r.flag || '') + ' ' + r.username), h('div', { class: 'small muted' }, `${r.dialect}${r.muted ? ` · مكتوم ${r.muted}ث` : ''}${r.blocked ? ' · ممنوع' : ''} · ${r.msgs} رسالة`)), h('button', { class: 'btn sm icon', onclick: (e) => personaMenu(r.id, e) }, ic('more', 16)));
    rosterPane.append(
      h('div', { class: 'row', style: { marginBottom: '8px' } }, h('button', { class: 'btn sm', onclick: () => send({ type: 'add_random', count: 1 }) }, ic('userPlus', 16), '+1'), h('button', { class: 'btn sm', onclick: () => send({ type: 'add_random', count: 5 }) }, ic('userPlus', 16), '+5'), h('button', { class: 'btn sm', onclick: addFromLibrary }, ic('users', 16), 'من المكتبة')),
      h('h3', {}, `الموجودون (${pres.length})`), ...pres.map(row),
      out.length ? [h('h3', {}, `خارج البث (${out.length})`), out.map((r) => h('div', { class: 'ritem' }, h('img', { class: 'av sm', src: r.avatar }), h('div', { class: 'grow nm' }, r.username, h('span', { class: 'small muted' }, r.kicked ? ' (مطرود)' : ' (لم يدخل بعد)')), h('button', { class: 'btn sm green', onclick: () => send({ type: 'mod', action: 'readd', pid: r.id }) }, 'إعادة')))] : null,
      ban.length ? [h('h3', {}, `المحظورون (${ban.length})`), ban.map((r) => h('div', { class: 'ritem' }, h('img', { class: 'av sm', src: r.avatar }), h('div', { class: 'grow nm' }, r.username), h('button', { class: 'btn sm', onclick: () => send({ type: 'mod', action: 'unban', pid: r.id }) }, 'فك الحظر')))] : null);
  }
  function personaMenu(pid, e) {
    const r = L.roster.find((x) => x.id === pid); if (!r) return;
    const act = (icon, a, label, cls = '', extra = {}) => item(icon, label, () => send({ type: 'mod', action: a, pid, ...extra }), cls);
    popAt(e, h('div', { class: 'row', style: { marginBottom: '6px' } }, h('img', { class: 'av', src: r.avatar }), h('div', {}, h('b', {}, r.username), h('div', { class: 'small muted' }, `${r.flag || ''} ${r.nat} · ${r.dialect}`))),
      item('chat', 'ناديه', () => { input.value = '@' + r.username + ' '; input.focus(); }),
      r.present ? [act('mute', 'mute', 'إسكات دقيقة', '', { seconds: 60 }), r.muted || r.blocked ? act('mic', 'unmute', 'السماح بالكتابة', 'green') : act('ban', 'block', 'منعه من الرسائل'), act('userMinus', 'remove', 'إزالته من البث'), act('logout', 'kick', 'طرد', 'red')] : act('userPlus', 'readd', 'إعادة إضافته', 'green'),
      r.banned ? act('check', 'unban', 'فك الحظر', 'green') : act('ban', 'ban', 'حظر نهائي', 'red'),
      item('user', 'الملف الشخصي', () => editPersona(pid)));
  }
  async function addFromLibrary() {
    const inIds = new Set(L.roster.filter((r) => r.present).map((r) => r.id));
    const all = (await api('/api/personas')).filter((p) => !inIds.has(p.id) && p.status !== 'banned');
    modal('إضافة من المكتبة', all.length ? h('div', { class: 'pgrid' }, all.map((p) => personaCard(p, { onClick: () => { send({ type: 'add_persona', pid: p.id }); toast('تمت إضافة ' + p.username); } }))) : h('p', {}, 'لا توجد شخصيات متاحة'));
  }

  // ---------- الوسائط ----------
  async function startCam() {
    if (!navigator.mediaDevices?.getUserMedia) return toast('الكاميرا تحتاج اتصال آمن (https) ومتصفح حديث', 5000);
    const vid = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
    try { let st; try { st = await navigator.mediaDevices.getUserMedia({ video: vid, audio: true }); } catch (e) { if (e.name === 'NotAllowedError') throw e; st = await navigator.mediaDevices.getUserMedia({ video: vid }); } setMedia(st, false); }
    catch (e) { toast(e.name === 'NotAllowedError' ? 'اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح' : 'تعذر تشغيل الكاميرا: ' + e.message, 5000); }
  }
  async function startScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return toast(isMobile() ? 'متصفح الجوال ما يدعم مشاركة الشاشة. افتح الموقع من الكمبيوتر (Chrome أو Edge أو Safari) أو استخدم الكاميرا.' : 'متصفحك ما يدعم مشاركة الشاشة. جرّب Chrome أو Edge.', 7000);
    }
    let st;
    try { st = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true }); }
    catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'AbortError') return toast('تم إلغاء مشاركة الشاشة');
      try { st = await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch (e2) { return toast('تعذرت مشاركة الشاشة: ' + (e2.message || e2.name), 5000); }
    }
    const tr = st.getVideoTracks()[0]; if (tr) tr.addEventListener('ended', () => { if (L && L.media === st) clearMedia(); });
    setMedia(st, true); toast('الشاشة تنعرض للجمهور');
  }
  function setMedia(stream, screen) {
    L.media && L.media !== stream && L.media.getTracks().forEach((t) => t.stop());
    L.media = stream; video.srcObject = stream; video.classList.toggle('screen', screen); video.style.display = 'block'; ph.style.display = 'none';
    camBtn.classList.toggle('on', !screen); scrBtn.classList.toggle('on', screen);
    video.play?.().catch(() => {});
    if (L.visionOn) startVision();
  }
  function clearMedia() { L.media && L.media.getTracks().forEach((t) => t.stop()); L.media = null; video.style.display = 'none'; ph.style.display = ''; camBtn.classList.remove('on'); scrBtn.classList.remove('on'); stopVision(); }
  // الجمهور يشوف: كشف محلي للأشياء + لقطات للذكاء الاصطناعي إذا فيه مفتاح يدعم الصور
  async function startVision() {
    if (!L.media || L.detectTimer || L.loadingModel) return;
    visPill.style.display = '';
    if (visionKey && !L.snapTimer) { L.snapTimer = setInterval(() => snapshot(true), 35000); setTimeout(() => snapshot(true), 6000); }
    L.loadingModel = true;
    try {
      if (!window.cocoSsd) { await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'); await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'); }
      L.model = L.model || await window.cocoSsd.load();
    } catch (e) { L.loadingModel = false; if (!visionKey) toast('تعذر تحميل نموذج الرؤية (يحتاج إنترنت)'); return; }
    L.loadingModel = false;
    if (!L || !L.visionOn || !L.media) return;
    L.detectTimer = setInterval(async () => {
      if (!L || !video.videoWidth || L.detecting) return; L.detecting = true;
      try {
        const preds = await L.model.detect(video);
        const W = video.videoWidth, H = video.videoHeight, mirror = !video.classList.contains('screen');
        const objs = preds.filter((p) => p.class !== 'person' && p.score > 0.35).map((p) => { const [x, y, w, hh] = p.bbox; const nx = mirror ? x / W : 1 - (x + w) / W; return { label: p.class, score: +p.score.toFixed(2), bbox: [nx, y / H, w / W, hh / H] }; });
        if (objs.length) send({ type: 'detect', objects: objs }, true);
      } finally { if (L) L.detecting = false; }
    }, 2500);
  }
  function stopVision() { clearInterval(L.detectTimer); clearInterval(L.snapTimer); L.detectTimer = L.snapTimer = null; visPill.style.display = 'none'; }
  function toggleVision() { L.visionOn = !L.visionOn; if (L.visionOn) { if (L.media) startVision(); else toast('شغّل الكاميرا أو الشاشة'); } else stopVision(); }
  function snapshot(auto) {
    if (!L || !L.media || !video.videoWidth) { if (!auto) toast('شغّل الكاميرا أولاً'); return; }
    const c = document.createElement('canvas'); const s = 512 / Math.max(video.videoWidth, video.videoHeight); c.width = video.videoWidth * s; c.height = video.videoHeight * s;
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    send({ type: 'snapshot', auto, dataUrl: c.toDataURL('image/jpeg', 0.75) }, auto);
  }
  function toggleSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast('المتصفح لا يدعم التعرف على الصوت (استخدم Chrome أو Edge)', 4000);
    if (L.speechOn) { L.speechOn = false; L.speech.stop(); micPill.style.display = 'none'; return; }
    const sr = new SR(); sr.lang = /[a-z]/i.test(m.streamerName || '') && !/[\u0600-\u06FF]/.test(m.streamerName || '') ? 'en-US' : 'ar-SA'; sr.continuous = true; sr.interimResults = false;
    sr.onresult = (ev) => { let fin = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; if (fin.trim()) send({ type: 'voice', text: fin.trim() }, true); };
    sr.onerror = (e) => { if (e.error === 'not-allowed') { toast('اسمح باستخدام المايك'); L.speechOn = false; micPill.style.display = 'none'; } };
    sr.onend = () => { if (L && L.speechOn) try { sr.start(); } catch {} };
    L.speech = sr; L.speechOn = true; sr.start(); micPill.style.display = ''; toast('يسمع اسمك بالصوت — كلامك ما يظهر في الدردشة');
  }
  function toggleRec() {
    if (L.rec && L.rec.state === 'recording') { L.rec.stop(); return; }
    if (!L.media) return toast('شغّل الكاميرا أو الشاشة أولاً');
    const chunks = []; const rec = new MediaRecorder(L.media);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { h('a', { href: URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })), download: `stream-${id}.webm` }).click(); toast('تم حفظ التسجيل'); };
    rec.start(1000); L.rec = rec; toast('بدأ التسجيل');
  }
  async function endStream() {
    if (!confirm('إنهاء البث؟')) return;
    await api(`/api/streams/${id}/end`, {}); L.ended = true; leaveLive(); location.hash = '#/stream/' + id;
  }
  L.timer = setInterval(() => { clock.textContent = fmtDur(Date.now() - L.started); drawTyping(); }, 1000);
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
