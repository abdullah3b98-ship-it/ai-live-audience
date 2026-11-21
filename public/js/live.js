import { h, api, toast, colorFor, fmtDur, $, $$, modal } from './ui.js';
import { editPersona, personaCard } from './personas.js';

let L = null; // حالة البث الحالية
export function leaveLive() {
  if (!L) return;
  try { L.ws && L.ws.close(); } catch {}
  L.media && L.media.getTracks().forEach((t) => t.stop());
  L.rec && L.rec.stop && L.rec.state !== 'inactive' && L.rec.stop();
  L.speech && (L.speechOn = false, L.speech.stop());
  clearInterval(L.timer); clearInterval(L.detectTimer);
  L = null;
}

export async function renderLive(app, id) {
  leaveLive();
  const info = await api('/api/streams/' + id);
  if (!info.live) { app.append(h('div', { class: 'card' }, h('h2', {}, 'هذا البث انتهى'), h('a', { class: 'btn', href: '#/stream/' + id }, 'مراجعة البث'), ' ', h('a', { class: 'btn pri', href: '#/' }, 'بث جديد'))); return; }
  L = { id, roster: [], typing: new Map(), started: info.started_at, detections: [] };

  // ---------- عناصر المسرح ----------
  const video = h('video', { autoplay: true, muted: true, playsInline: true });
  const ph = h('div', { class: 'ph' }, h('div', { style: { fontSize: '40px' } }, '🎥'), h('p', {}, 'شغّل الكاميرا أو شارك الشاشة لبدء البث'), h('p', { class: 'small' }, 'يمكنك أيضاً البث بدون كاميرا والكتابة في الدردشة فقط'));
  const bbox = h('div', { class: 'bbox', style: { display: 'none' } }, h('span', {}, '؟'));
  const caption = h('div', { class: 'caption' });
  const floaters = h('div', { class: 'floaters' });
  const viewers = h('span', { class: 'pill' }, '👁 0'); const clock = h('span', { class: 'pill' }, '00:00:00'); const gameP = h('span', { class: 'pill' }, info.game ? '🎮 ' + info.game : '');
  const wrap = h('div', { class: 'video-wrap' }, ph, video, bbox, caption, floaters, h('div', { class: 'ov-top' }, h('span', { class: 'live-badge' }, 'LIVE'), viewers, clock, gameP));
  video.style.display = 'none';

  const camBtn = h('button', { class: 'btn', onclick: startCam }, '📷 الكاميرا');
  const scrBtn = h('button', { class: 'btn', onclick: startScreen }, '🖥️ مشاركة الشاشة');
  const micBtn = h('button', { class: 'btn', onclick: toggleSpeech }, '🎙️ النداء الصوتي');
  const langSel = h('select', { style: { width: 'auto' } }, h('option', { value: 'ar-SA' }, 'عربي'), h('option', { value: 'en-US' }, 'English'));
  const detBtn = h('button', { class: 'btn', onclick: toggleDetect }, '🔍 كشف الأشياء');
  const askBtn = h('button', { class: 'btn', onclick: snapshotAsk }, '❓ وش هذا؟');
  const recBtn = h('button', { class: 'btn', onclick: toggleRec }, '⏺ تسجيل');
  const endBtn = h('button', { class: 'btn red', onclick: endStream }, '⏹ إنهاء البث');
  const controls = h('div', { class: 'controls' }, camBtn, scrBtn, micBtn, langSel, detBtn, askBtn, recBtn, endBtn);
  const qa = (a, label, needText) => h('button', { class: 'btn sm', onclick: () => { let t = ''; if (needText) { t = prompt(needText) || ''; if (!t && a !== 'important') return; } send({ type: 'action', action: a, text: t }); } }, label);
  const quick = h('div', { class: 'controls' }, h('span', { class: 'muted small', style: { alignSelf: 'center' } }, 'أحداث سريعة:'), qa('fail', '😵 خسرت / غلطت'), qa('win', '🏆 فزت'), qa('joke', '😂 نكتة', 'اكتب النكتة'), qa('important', '⚡ حدث مهم', 'وش صار؟ (اختياري)'), qa('game', '🎮 لعبة جديدة', 'اسم اللعبة'));

  // ---------- الجانب: دردشة / جمهور / أدوات ----------
  const chat = h('div', { id: 'chat' });
  const typing = h('div', { class: 'typing' });
  const input = h('input', { type: 'text', placeholder: 'اكتب للجمهور… (@اسم لمناداة شخصية، أو "كلمة يعني معنى" لتعليمهم)', onkeydown: (e) => { if (e.key === 'Enter') sendChat(); } });
  const chatPane = h('div', { class: 'pane on', style: { padding: 0, display: 'flex', flexDirection: 'column' } }, h('div', { style: { flex: 1, overflowY: 'auto' }, id: 'chatScroll' }, chat), typing, h('div', { class: 'chatbox' }, input, h('button', { class: 'btn pri', onclick: sendChat }, 'إرسال')));
  const rosterPane = h('div', { class: 'pane' });
  const toolsPane = h('div', { class: 'pane' });
  const panes = [chatPane, rosterPane, toolsPane];
  const tabBtns = ['💬 الدردشة', '👥 الجمهور', '🛠️ أدوات'].map((t, i) => h('button', { class: i ? '' : 'on', onclick: () => { panes.forEach((p, j) => { p.classList.toggle('on', i === j); p.style.display = i === j ? (j === 0 ? 'flex' : 'block') : 'none'; }); tabBtns.forEach((b, j) => b.classList.toggle('on', i === j)); if (i === 1) drawRoster(); } }, t));
  panes.forEach((p, j) => (p.style.display = j === 0 ? 'flex' : 'none'));
  const side = h('div', { class: 'side' }, h('div', { class: 'tabs' }, tabBtns), ...panes);
  app.append(h('div', { class: 'studio' }, h('div', { class: 'stage' }, wrap, controls, quick), side));

  // أدوات
  const tw = h('input', { type: 'text', placeholder: 'الكلمة' }), tm = h('input', { type: 'text', placeholder: 'المعنى' });
  const tc = h('select', {}, [['', 'تصنيف تلقائي'], ['insult', 'سبّة'], ['praise', 'مدح'], ['joke', 'مزحة'], ['neutral', 'كلمة عادية']].map(([k, v]) => h('option', { value: k }, v)));
  const objSel = h('select', {}, h('option', { value: '' }, '— آخر شيء ظهر بالكاميرا —'));
  const objName = h('input', { type: 'text', placeholder: 'اسمه الحقيقي، مثلاً: يد بلايستيشن 5' });
  const objCustom = h('input', { type: 'text', placeholder: 'أو اكتب اسم الشيء بالإنجليزي (مثل controller)' });
  const addN = h('input', { type: 'number', value: 1, min: 1, max: 20, style: { width: '70px' } });
  const maxN = h('input', { type: 'number', value: info.settings.maxAudience || 40, min: 1, max: 300, style: { width: '80px' } });
  toolsPane.append(
    h('h3', {}, '📚 علّمهم كلمة'), h('div', { class: 'row' }, h('div', { class: 'grow' }, tw), h('div', { class: 'grow' }, tm)), h('div', { class: 'row', style: { marginTop: '6px' } }, tc, h('button', { class: 'btn pri', onclick: () => { if (!tw.value || !tm.value) return toast('اكتب الكلمة والمعنى'); send({ type: 'teach_word', word: tw.value.trim(), meaning: tm.value.trim(), cat: tc.value || null }); tw.value = tm.value = ''; } }, 'حفظ الكلمة')),
    h('p', { class: 'muted small' }, 'أو اكتب في الدردشة: «زقنبي يعني شخص مزعج». إذا سألوك عن كلمة، ردك التالي يُحفظ كمعنى.'),
    h('h3', {}, '🧠 علّمهم شيء ظهر بالكاميرا'), objSel, objCustom, objName, h('button', { class: 'btn pri', style: { marginTop: '6px' }, onclick: () => { const label = objCustom.value.trim().toLowerCase() || objSel.value; if (!label || !objName.value) return toast('اختر الشيء واكتب اسمه'); send({ type: 'teach_object', label, name: objName.value.trim() }); objName.value = objCustom.value = ''; } }, 'حفظ كمعلومة مؤكدة'),
    h('p', { class: 'muted small' }, 'أو قل في الدردشة/المايك بعد سؤالهم: «هذا اسمه يد بلايستيشن».'),
    h('h3', {}, '➕ شخصيات أثناء البث'), h('div', { class: 'row' }, addN, h('button', { class: 'btn', onclick: () => send({ type: 'add_random', count: +addN.value }) }, 'إضافة عشوائية'), h('button', { class: 'btn', onclick: addFromLibrary }, 'من المكتبة')),
    h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'small muted' }, 'الحد الأقصى:'), maxN, h('button', { class: 'btn sm', onclick: () => send({ type: 'set_max', max: +maxN.value }) }, 'تطبيق')),
    h('h3', {}, 'ℹ️ كيف تنادي شخصية؟'), h('p', { class: 'muted small' }, 'اكتب @الاسم أو "يا الاسم" أو اضغط على اسمها في الدردشة. بالصوت: فعّل 🎙️ وقل "يا لونا" — يتعرف حتى على الأسماء الإنجليزية المنطوقة بالعربي والإيموجي (يا قهوة ☕).'));

  // آخر الرسائل عند فتح الصفحة
  for (const m of info.messages.filter((m) => m.kind !== 'reaction').slice(-60)) {
    const rt = m.reply_to ? JSON.parse(m.reply_to) : null;
    addMsg(m.persona_id ? { kind: m.kind, pid: m.persona_id, username: m.username, avatar: m.avatar_url, text: m.text, replyTo: rt } : { kind: m.kind, text: m.text, username: m.kind === 'system' ? '' : 'أنت' });
  }
  // ---------- WebSocket ----------
  connect();
  function connect() {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?stream=' + id);
    L.ws = ws;
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
    ws.onclose = () => { if (L && L.id === id && !L.ended) setTimeout(() => L && connect(), 1500); };
  }
  function send(o) { if (L.ws && L.ws.readyState === 1) L.ws.send(JSON.stringify(o)); else toast('غير متصل… يعاد الاتصال'); }
  function sendChat() { const t = input.value.trim(); if (!t) return; send({ type: 'chat', text: t }); input.value = ''; }

  function onMsg(m) {
    if (m.type === 'message') addMsg(m.msg);
    else if (m.type === 'roster') { L.roster = m.roster; viewers.textContent = '👁 ' + m.viewers; if (rosterPane.classList.contains('on')) drawRoster(); }
    else if (m.type === 'typing') { L.typing.set(m.pid, { name: m.username, t: Date.now() }); drawTyping(); }
    else if (m.type === 'reaction') floatEmoji(m.emoji);
    else if (m.type === 'highlight') showBox(m);
    else if (m.type === 'join') {}
    else if (m.type === 'learned') toast(`📚 تعلموا: ${m.word.word}`);
    else if (m.type === 'ended') { L.ended = true; toast('انتهى البث'); }
  }
  function addMsg(msg) {
    if (msg.pid) { L.typing.delete(msg.pid); drawTyping(); }
    const sc = $('#chatScroll'); const atBottom = !sc || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    let el;
    if (msg.kind === 'system') el = h('div', { class: 'msg system' }, msg.text);
    else if (msg.kind === 'streamer' || msg.kind === 'voice') el = h('div', { class: 'msg ' + msg.kind }, h('span', { class: 'u', style: { color: 'var(--green)' } }, (msg.kind === 'voice' ? '🎙️ ' : '🎥 ') + (msg.username || 'أنت')), ': ', h('span', { class: 't' }, msg.text));
    else {
      const rq = msg.replyTo ? h('span', { class: 'rq' }, msg.replyTo.streamer ? `↩ يرد عليك: «${msg.replyTo.text}»` : `↩ رداً على ${msg.replyTo.name}${msg.replyTo.text ? ': ' + msg.replyTo.text : ''}`) : null;
      el = h('div', { class: 'msg ' + (msg.kind === 'named' ? 'named' : '') }, rq, h('img', { class: 'av', src: msg.avatar, alt: '' }), msg.flag ? msg.flag + ' ' : '', h('span', { class: 'u', style: { color: colorFor(msg.username) }, onclick: (e) => personaMenu(msg.pid, e) }, msg.username), ': ', h('span', { class: 't' }, msg.text));
    }
    chat.append(el); while (chat.children.length > 400) chat.firstChild.remove();
    if (sc && atBottom) sc.scrollTop = sc.scrollHeight;
  }
  function drawTyping() {
    const now = Date.now(); for (const [k, v] of L.typing) if (now - v.t > 7000) L.typing.delete(k);
    const n = [...L.typing.values()].map((v) => v.name);
    typing.textContent = n.length ? (n.length > 3 ? `${n.slice(0, 2).join('، ')} و${n.length - 2} آخرين يكتبون…` : `${n.join('، ')} ${n.length > 1 ? 'يكتبون' : 'يكتب'}…`) : '';
  }
  function floatEmoji(e) { const s = h('span', { style: { left: Math.random() * 70 + 'px' } }, e); floaters.append(s); setTimeout(() => s.remove(), 3300); }
  function showBox(m) {
    if (m.bbox) { const [x, y, w, hh] = m.bbox; Object.assign(bbox.style, { display: 'block', right: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${hh * 100}%` }); bbox.firstChild.textContent = (m.known ? '✓ ' : '؟ ') + (m.guess || m.label); clearTimeout(L.boxT); L.boxT = setTimeout(() => (bbox.style.display = 'none'), 9000); }
    if (m.label && ![...objSel.options].some((o) => o.value === m.label)) objSel.append(h('option', { value: m.label, selected: true }, `${m.guess || m.label} (${m.label})`));
    else if (m.label) objSel.value = m.label;
  }
  function drawRoster() {
    rosterPane.innerHTML = '';
    const pres = L.roster.filter((r) => r.present), out = L.roster.filter((r) => !r.present && !r.banned), ban = L.roster.filter((r) => r.banned);
    const item = (r) => h('div', { class: 'ritem' }, h('img', { class: 'av sm', src: r.avatar }), h('div', { class: 'grow' }, h('div', { class: 'nm' }, (r.flag || '') + ' ' + r.username, r.favorite ? ' ★' : ''), h('div', { class: 'small muted' }, `${r.reputation} · ${r.dialect}${r.muted ? ` · 🔇 ${r.muted}ث` : ''}${r.blocked ? ' · 🚫 ممنوع' : ''} · ${r.msgs} رسالة`)), h('button', { class: 'btn sm', onclick: (e) => personaMenu(r.id, e) }, '⋯'));
    rosterPane.append(h('h3', {}, `الموجودون الآن (${pres.length})`), ...pres.map(item),
      h('h3', {}, `مطرودون / خارج البث (${out.length})`), out.length ? out.map((r) => h('div', { class: 'ritem' }, h('img', { class: 'av sm', src: r.avatar }), h('div', { class: 'grow nm' }, r.username, h('span', { class: 'small muted' }, r.kicked ? ' (مطرود)' : ' (لم يدخل / أزيل)')), h('button', { class: 'btn sm green', onclick: () => send({ type: 'mod', action: 'readd', pid: r.id }) }, 'إعادة'))) : h('p', { class: 'muted small' }, 'لا أحد'),
      h('h3', {}, `المحظورون (${ban.length})`), ban.length ? ban.map((r) => h('div', { class: 'ritem' }, h('img', { class: 'av sm', src: r.avatar }), h('div', { class: 'grow nm' }, r.username), h('button', { class: 'btn sm', onclick: () => send({ type: 'mod', action: 'unban', pid: r.id }) }, 'فك الحظر'))) : h('p', { class: 'muted small' }, 'لا أحد'));
  }
  function personaMenu(pid, e) {
    e.stopPropagation(); $$('.pop').forEach((p) => p.remove());
    const r = L.roster.find((x) => x.id === pid); if (!r) return;
    const act = (a, label, cls = '', extra = {}) => h('button', { class: 'btn sm ' + cls, onclick: () => { send({ type: 'mod', action: a, pid, ...extra }); pop.remove(); } }, label);
    const pop = h('div', { class: 'pop' }, h('div', { class: 'row' }, h('img', { class: 'av', src: r.avatar }), h('div', {}, h('b', {}, r.username), h('div', { class: 'small muted' }, `${r.flag || ''} ${r.nat} · ${r.dialect}`), h('div', { class: 'small muted' }, r.archetype))),
      h('button', { class: 'btn sm', onclick: () => { input.value = '@' + r.username + ' '; input.focus(); pop.remove(); } }, '💬 ناديه / منشن'),
      r.present ? [act('mute', '🔇 إسكات 60 ثانية', '', { seconds: 60 }), act('mute', '🔇 إسكات 5 دقائق', '', { seconds: 300 }), r.muted || r.blocked ? act('unmute', '🔊 السماح بالكتابة', 'green') : act('block', '🚫 منعه من الرسائل'), act('remove', '➖ إزالته من البث الحالي'), act('kick', '🚪 طرد', 'red')] : act('readd', '➕ إعادة إضافته', 'green'),
      r.banned ? act('unban', '✅ فك الحظر', 'green') : act('ban', '⛔ حظر نهائي', 'red'),
      h('button', { class: 'btn sm', onclick: () => { editPersona(pid); pop.remove(); } }, '👤 الملف الشخصي'));
    document.body.append(pop);
    const x = Math.min(e.clientX, innerWidth - 260), y = Math.min(e.clientY, innerHeight - pop.offsetHeight - 10);
    Object.assign(pop.style, { left: Math.max(5, x) + 'px', top: Math.max(5, y) + 'px' });
    setTimeout(() => document.addEventListener('click', function f(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', f); } }), 0);
  }
  async function addFromLibrary() {
    const inIds = new Set(L.roster.filter((r) => r.present).map((r) => r.id));
    const all = (await api('/api/personas')).filter((p) => !inIds.has(p.id) && p.status !== 'banned');
    const g = h('div', { class: 'pgrid' }, all.map((p) => personaCard(p, { onClick: () => { send({ type: 'add_persona', pid: p.id }); toast('تمت إضافة ' + p.username); } })));
    modal('إضافة شخصية من المكتبة (المفضلة أولاً)', all.length ? g : h('p', {}, 'لا توجد شخصيات متاحة'));
  }

  // ---------- الوسائط ----------
  async function startCam() {
    try { setMedia(await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true }), false); toast('الكاميرا شغالة'); }
    catch (e) { toast('تعذر تشغيل الكاميرا: ' + e.message); }
  }
  async function startScreen() {
    try { setMedia(await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }), true); }
    catch (e) { toast('تعذرت مشاركة الشاشة: ' + e.message); }
  }
  function setMedia(stream, screen) {
    L.media && L.media.getTracks().forEach((t) => t.stop());
    L.media = stream; video.srcObject = stream; video.classList.toggle('screen', screen); video.style.display = 'block'; ph.style.display = 'none';
  }
  function toggleSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast('المتصفح لا يدعم التعرف على الصوت (استخدم Chrome أو Edge)');
    if (L.speechOn) { L.speechOn = false; L.speech.stop(); micBtn.classList.remove('pri'); micBtn.textContent = '🎙️ النداء الصوتي'; return; }
    const sr = new SR(); sr.lang = langSel.value; sr.continuous = true; sr.interimResults = true;
    sr.onresult = (ev) => {
      let fin = '', interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) (ev.results[i].isFinal ? (fin += ev.results[i][0].transcript) : (interim += ev.results[i][0].transcript));
      caption.style.display = 'block'; caption.textContent = fin || interim;
      clearTimeout(L.capT); L.capT = setTimeout(() => (caption.style.display = 'none'), 3500);
      if (fin.trim()) send({ type: 'voice', text: fin.trim() });
    };
    sr.onerror = (e) => { if (e.error === 'not-allowed') { toast('اسمح باستخدام المايك'); L.speechOn = false; } };
    sr.onend = () => { if (L && L.speechOn) try { sr.start(); } catch {} };
    L.speech = sr; L.speechOn = true; sr.start(); micBtn.classList.add('pri'); micBtn.textContent = '🎙️ يسمعك الآن…';
  }
  async function toggleDetect() {
    if (L.detectTimer) { clearInterval(L.detectTimer); L.detectTimer = null; detBtn.classList.remove('pri'); detBtn.textContent = '🔍 كشف الأشياء'; return; }
    if (!L.media) return toast('شغّل الكاميرا أولاً');
    detBtn.textContent = '⏳ تحميل نموذج الرؤية…';
    try {
      if (!window.cocoSsd) { await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'); await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'); }
      L.model = L.model || await window.cocoSsd.load();
    } catch (e) { detBtn.textContent = '🔍 كشف الأشياء'; return toast('تعذر تحميل نموذج الرؤية (يحتاج إنترنت)'); }
    detBtn.classList.add('pri'); detBtn.textContent = '🔍 الكشف شغال';
    L.detectTimer = setInterval(async () => {
      if (!video.videoWidth) return;
      const preds = await L.model.detect(video);
      const W = video.videoWidth, H = video.videoHeight, mirror = !video.classList.contains('screen');
      const objs = preds.filter((p) => p.class !== 'person' && p.score > 0.35).map((p) => { const [x, y, w, hh] = p.bbox; const nx = mirror ? x / W : 1 - (x + w) / W; return { label: p.class, score: +p.score.toFixed(2), bbox: [nx, y / H, w / W, hh / H] }; });
      if (objs.length) send({ type: 'detect', objects: objs });
    }, 2500);
  }
  function snapshotAsk() {
    if (!L.media || !video.videoWidth) return toast('شغّل الكاميرا أولاً');
    const c = document.createElement('canvas'); const s = 512 / Math.max(video.videoWidth, video.videoHeight); c.width = video.videoWidth * s; c.height = video.videoHeight * s;
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    send({ type: 'snapshot', dataUrl: c.toDataURL('image/jpeg', 0.8) }); toast('أُرسلت لقطة للجمهور');
  }
  function toggleRec() {
    if (L.rec && L.rec.state === 'recording') { L.rec.stop(); return; }
    if (!L.media) return toast('شغّل الكاميرا أو الشاشة أولاً');
    const chunks = []; const rec = new MediaRecorder(L.media);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { const a = h('a', { href: URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })), download: `stream-${id}.webm` }); a.click(); recBtn.classList.remove('red'); recBtn.textContent = '⏺ تسجيل'; };
    rec.start(1000); L.rec = rec; recBtn.classList.add('red'); recBtn.textContent = '⏹ إيقاف التسجيل';
  }
  async function endStream() {
    if (!confirm('إنهاء البث؟ ستُحفظ الذكريات وأهم اللحظات.')) return;
    await api(`/api/streams/${id}/end`, {}); L.ended = true; leaveLive(); location.hash = '#/stream/' + id;
  }
  L.timer = setInterval(() => { clock.textContent = fmtDur(Date.now() - L.started); drawTyping(); }, 1000);
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
