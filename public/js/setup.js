import { h, api, modal, toast, meta, slider, $, $$ } from './ui.js';
import { personaCard, editPersona } from './personas.js';
import { pickAvatar } from './avatarPicker.js';
import { ic } from './icons.js';

const DEF = { title: 'بث مباشر', game: '', streamerName: '', mode: 'random', total: 20, girls: 10, boys: 10, girlsRatio: 50, returningRatio: 60, includeFavorites: true, foreignChance: 4,
  avatarMode: 'mixed', namesMode: 'random', politeness: 'mixed', tease: 50, curse: 30, activity: 60, quietRatio: 30, talkRatio: 20, repetition: 25, debate: 40, maxAudience: 60, dynamicJoins: true, memory: true, research: true, handpicked: [], natWeights: null };
const PRESET_AR = { respectful: 'محترم', normal: 'عادي', sarcastic: 'ساخر', heavy_tease: 'طقطقة', light_curse: 'سب خفيف', rude: 'قليل أدب', mixed: 'مزيج' };
const SIZES = [10, 20, 40, 80];
const MIX = [['random', 'عشوائي'], ['more_f', 'بنات أكثر'], ['more_m', 'أولاد أكثر'], ['half', 'نص نص']];
const STYLES = [['mixed', 'مزيج'], ['respectful', 'محترم'], ['normal', 'عادي'], ['heavy_tease', 'طقطقة']];

export async function renderSetup(app) {
  const m = await meta();
  const saved = JSON.parse(localStorage.getItem('audienceSettings') || 'null') || {};
  let s = { ...DEF, ...saved, streamerName: saved.streamerName ?? m.streamerName };
  let preview = [];
  const form = h('form', { onsubmit: (e) => e.preventDefault(), oninput: () => { read(); syncMode(); preview = []; drawPreview(); } });
  const v = (n) => form.querySelector(`[name=${n}]`);
  const radio = (name, val, label) => h('label', {}, h('input', { type: 'radio', name, value: val, checked: s[name] === val }), label);
  const num = (name, label, min = 0, max = 200) => h('label', { class: 'f' }, label, h('input', { type: 'number', name, value: s[name], min, max }));
  const tog = (name, label) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', name, checked: !!s[name] }), label);
  const chips = (items, cur, onPick) => h('div', { class: 'chips' }, items.map(([k, l]) => h('button', { type: 'button', class: 'chip' + (k === cur() ? ' on' : ''), onclick: (e) => { onPick(k); $$('.chip', e.target.parentNode).forEach((c) => c.classList.toggle('on', c === e.target)); read(); preview = []; drawPreview(); } }, l)));
  const mixNow = () => (s.mode === 'ratio' ? (s.girlsRatio >= 65 ? 'more_f' : s.girlsRatio <= 35 ? 'more_m' : 'half') : s.mode === 'random' ? 'random' : '');

  // ---------- الأساسي (قصير) ----------
  const sizeIn = h('input', { type: 'number', name: 'total', value: s.total, min: 1, max: 200, class: 'mini' });
  const basics = h('div', { class: 'card setup-main' },
    h('div', { class: 'row' },
      h('label', { class: 'f grow' }, 'اسمك (ينادونك فيه)', h('input', { type: 'text', name: 'streamerName', value: s.streamerName || '', placeholder: 'مثلاً: أبو سلطان' })),
      h('label', { class: 'f grow' }, 'وش بتبث؟ (اختياري)', h('input', { type: 'text', name: 'game', value: s.game, placeholder: 'FIFA، Fortnite، سوالف…' }))),
    h('div', { class: 'opt' }, h('span', { class: 'ol' }, ic('users', 16), 'عدد الجمهور'), chips(SIZES.map((n) => [n, String(n)]), () => s.total, (n) => { s.total = n; sizeIn.value = n; if (s.mode === 'counts' || s.mode === 'manual') s.mode = 'random'; }), sizeIn),
    h('div', { class: 'opt' }, h('span', { class: 'ol' }, ic('shuffle', 16), 'التركيبة'), chips(MIX, mixNow, (k) => { if (k === 'random') s.mode = 'random'; else { s.mode = 'ratio'; s.girlsRatio = k === 'more_f' ? 70 : k === 'more_m' ? 30 : 50; } syncForm(); })),
    h('div', { class: 'opt' }, h('span', { class: 'ol' }, ic('chat', 16), 'الأسلوب'), chips(STYLES, () => s.politeness, (k) => { s.politeness = k; syncForm(); })),
    h('div', { class: 'start-row' }, h('button', { class: 'btn pri big', id: 'startBtn', onclick: start }, ic('radio', 20), 'ابدأ البث'), h('span', { class: 'muted small' }, m.llm.active ? `ذكاء: ${m.llm.active.provider}` : 'يعمل بالمحرك المحلي — أضف مفتاح من الإعدادات لردود أذكى')));

  // ---------- معاينة الجمهور (اختياري) ----------
  const pv = h('div', { class: 'pgrid' });
  const stats = h('div', { class: 'stats' });
  const handInfo = h('span', { class: 'muted small' });
  const previewBox = h('details', { class: 'card fold' }, h('summary', {}, ic('eye', 16), 'عاين وعدّل الجمهور قبل البث'),
    h('div', { class: 'row', style: { margin: '10px 0' } },
      h('button', { type: 'button', class: 'btn', onclick: doPreview }, ic('refresh', 16), 'كوّن الجمهور'),
      h('button', { type: 'button', class: 'btn', onclick: () => addOne('f') }, ic('plus', 16), 'بنت'), h('button', { type: 'button', class: 'btn', onclick: () => addOne('m') }, ic('plus', 16), 'ولد'),
      h('button', { type: 'button', class: 'btn', onclick: handpick }, ic('userPlus', 16), 'اختيار من المكتبة'), handInfo),
    stats, h('div', { style: { height: '8px' } }), pv);
  previewBox.addEventListener('toggle', () => { if (previewBox.open && !preview.length) doPreview(); });

  // ---------- متقدم (مطوي) ----------
  const natBox = h('div', { class: 'row' }, Object.entries(m.nationalities).filter(([, n]) => !n.foreign).map(([k, n]) => h('label', { class: 'f', style: { minWidth: '90px', width: '90px' } }, n.flag + ' ' + n.name, h('input', { type: 'number', min: 0, max: 100, step: 0.5, 'data-nat': k, value: s.natWeights?.[k] ?? n.weight }))));
  const countsBox = h('div', { class: 'row' }, num('girls', 'عدد البنات'), num('boys', 'عدد الأولاد'));
  const ratioBox = h('div', {}, slider('نسبة البنات %', 'girlsRatio', s.girlsRatio, 0, 100, 1, '%'));
  const templatesBox = h('div', { class: 'row' });
  const adv = h('details', { class: 'card fold' }, h('summary', {}, ic('sliders', 16), 'إعدادات متقدمة'),
    h('div', { class: 'grid2', style: { marginTop: '12px' } },
      h('div', {}, h('h3', {}, 'التركيبة بالتفصيل'),
        h('div', { class: 'seg' }, radio('mode', 'random', 'عشوائي'), radio('mode', 'counts', 'عدد محدد'), radio('mode', 'ratio', 'نسبة'), radio('mode', 'manual', 'كلهم من اختياري')),
        countsBox, ratioBox,
        slider('الوجوه المألوفة', 'returningRatio', s.returningRatio, 0, 100, 1, '%'), slider('دخول أجانب', 'foreignChance', s.foreignChance, 0, 30, 1, '%'),
        tog('includeFavorites', 'أضف المفضلين أولاً'),
        h('details', {}, h('summary', {}, 'توزيع الجنسيات'), natBox)),
      h('div', {}, h('h3', {}, 'الأسلوب والنشاط'),
        h('div', { class: 'seg' }, Object.entries(PRESET_AR).map(([k, l]) => radio('politeness', k, l))),
        slider('الطقطقة', 'tease', s.tease), slider('السب الخفيف', 'curse', s.curse), slider('النشاط', 'activity', s.activity),
        slider('الهادئين', 'quietRatio', s.quietRatio, 0, 100, 1, '%'), slider('كثيري الكلام', 'talkRatio', s.talkRatio, 0, 100, 1, '%'),
        slider('التكرار', 'repetition', s.repetition), slider('النقاش بينهم', 'debate', s.debate)),
      h('div', {}, h('h3', {}, 'الأسماء والصور'),
        h('div', { class: 'seg' }, radio('namesMode', 'random', 'أسماء عشوائية'), radio('namesMode', 'manual', 'أعدلها بنفسي')),
        h('div', { class: 'seg', style: { marginTop: '6px' } }, radio('avatarMode', 'mixed', 'صور مزيج'), radio('avatarMode', 'people', 'أغلبها أشخاص'), radio('avatarMode', 'random', 'عشوائية'), radio('avatarMode', 'none', 'بدون صور'))),
      h('div', {}, h('h3', {}, 'البث'),
        h('label', { class: 'f' }, 'عنوان البث', h('input', { type: 'text', name: 'title', value: s.title })),
        h('div', { class: 'row' }, num('maxAudience', 'الحد الأقصى', 1, 300), tog('dynamicJoins', 'يدخل ناس جدد أثناء البث')),
        tog('memory', 'يتذكرون البثوث السابقة'), tog('research', 'يبحثون عن الكلمات والأشياء الجديدة بأنفسهم'),
        h('h3', {}, 'قوالب'), templatesBox,
        h('div', { class: 'row' }, h('input', { type: 'text', id: 'tplName', placeholder: 'اسم القالب', class: 'grow', style: { width: 'auto', flex: '1' } }), h('button', { class: 'btn', type: 'button', onclick: saveTemplate }, ic('save', 16), 'حفظ')))));
  form.append(basics, previewBox, adv);
  app.append(h('h1', {}, 'بث جديد'), form);

  function read() {
    for (const k of Object.keys(DEF)) { const el = v(k); if (!el) continue; if (el.type === 'checkbox') s[k] = el.checked; else if (el.type === 'radio') s[k] = form.querySelector(`[name=${k}]:checked`)?.value ?? s[k]; else s[k] = el.type === 'number' || el.type === 'range' ? +el.value : el.value; }
    s.natWeights = Object.fromEntries($$('[data-nat]', natBox).map((i) => [i.dataset.nat, +i.value]));
    if (s.mode === 'counts') s.total = s.girls + s.boys + (s.handpicked?.length || 0) || s.total;
    localStorage.setItem('audienceSettings', JSON.stringify(s));
  }
  function syncForm() {
    const set = (n, val) => { const els = form.querySelectorAll(`[name=${n}]`); els.forEach((el) => { if (el.type === 'radio') el.checked = el.value === val; else { el.value = val; el.dispatchEvent(new Event('input')); } }); };
    set('mode', s.mode); set('politeness', s.politeness); const gr = v('girlsRatio'); if (gr) { gr.value = s.girlsRatio; gr.nextSibling.textContent = s.girlsRatio + '%'; }
    syncMode();
  }
  function syncMode() {
    countsBox.style.display = s.mode === 'counts' ? '' : 'none'; ratioBox.style.display = s.mode === 'ratio' ? '' : 'none';
    handInfo.textContent = s.handpicked.length ? `تم اختيار ${s.handpicked.length}` : '';
  }
  async function loadTemplates() {
    const t = await api('/api/templates'); templatesBox.innerHTML = '';
    if (!t.length) templatesBox.append(h('span', { class: 'muted small' }, 'لا توجد قوالب'));
    t.forEach((x) => templatesBox.append(h('span', { class: 'tag', style: { cursor: 'pointer', fontSize: '13px' } }, h('span', { onclick: () => { localStorage.setItem('audienceSettings', JSON.stringify({ ...DEF, ...x.settings })); toast('تم تحميل القالب: ' + x.name); app.innerHTML = ''; renderSetup(app); } }, x.name), ' ', h('b', { onclick: async () => { await api('/api/templates/' + x.id, undefined, 'DELETE'); loadTemplates(); } }, '×'))));
  }
  async function saveTemplate() { read(); const n = $('#tplName').value.trim() || `قالب ${new Date().toLocaleDateString('ar')}`; await api('/api/templates', { name: n, settings: s }); toast('تم حفظ القالب'); loadTemplates(); }
  async function handpick() {
    const all = (await api('/api/personas')).filter((p) => p.status !== 'banned');
    const sel = new Set(s.handpicked); const g = h('div', { class: 'pgrid' });
    const q = h('input', { type: 'search', placeholder: 'بحث…', oninput: draw });
    function draw() { g.innerHTML = ''; all.filter((p) => !q.value || p.username.toLowerCase().includes(q.value.toLowerCase())).forEach((p) => g.append(personaCard(p, { selected: sel.has(p.id), onClick: () => { sel.has(p.id) ? sel.delete(p.id) : sel.add(p.id); draw(); } }))); }
    const dlg = modal('اختيار من المكتبة', h('div', {}, h('div', { class: 'row' }, h('div', { class: 'grow' }, q), h('button', { class: 'btn pri', onclick: () => { s.handpicked = [...sel]; localStorage.setItem('audienceSettings', JSON.stringify(s)); syncMode(); dlg.close(); toast(`تم اختيار ${sel.size}`); preview = []; doPreview(); } }, ic('check', 16), 'تم')), h('div', { style: { height: '10px' } }), all.length ? g : h('p', { class: 'muted' }, 'المكتبة فارغة. أول بث بيكوّن لك شخصيات تنحفظ هنا.')));
    draw();
  }
  async function doPreview() {
    read(); if (s.mode === 'manual' && !s.handpicked.length) return toast('اختر شخصيات من المكتبة أولاً');
    preview = await api('/api/audience/preview', s); drawPreview();
  }
  async function addOne(g) { read(); if (!preview.length) await doPreview(); preview.push(await api('/api/audience/one', { gender: g, avatarMode: s.avatarMode, foreignChance: s.foreignChance })); drawPreview(); }
  function drawPreview() {
    pv.innerHTML = ''; stats.innerHTML = '';
    if (!preview.length) { pv.append(h('p', { class: 'muted small' }, 'اضغط «كوّن الجمهور» لمعاينته، أو ابدأ البث مباشرة ويتكوّن تلقائياً.')); return; }
    const f = preview.filter((p) => p.gender === 'f').length; const nats = {};
    preview.forEach((p) => { const k = (p.nat?.flag || '') + ' ' + (p.nat?.name || ''); nats[k] = (nats[k] || 0) + 1; });
    stats.append(h('span', { class: 'tag' }, `الإجمالي ${preview.length}`), h('span', { class: 'tag' }, `بنات ${f}`), h('span', { class: 'tag' }, `أولاد ${preview.length - f}`), h('span', { class: 'tag' }, `جدد ${preview.filter((p) => p.tmp).length}`), h('span', { class: 'tag' }, `مألوفين ${preview.filter((p) => !p.tmp).length}`), ...Object.entries(nats).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('span', { class: 'tag' }, `${k} ${n}`)));
    preview.forEach((p, i) => pv.append(personaCard(p, {
      editableName: true, onName: (val) => (p.username = val.trim() || p.username),
      onAvatar: async () => { const r = await pickAvatar({ gender: p.gender, name: p.username }); if (r) { p.avatar_url = r.url; p.avatar_category = r.category; drawPreview(); } },
      actions: [h('button', { type: 'button', title: 'استبدال', onclick: async (e) => { e.stopPropagation(); preview[i] = await api('/api/audience/one', { gender: p.gender, avatarMode: s.avatarMode, foreignChance: s.foreignChance }); drawPreview(); } }, ic('refresh', 14)),
        !p.tmp ? h('button', { type: 'button', title: 'تعديل', onclick: (e) => { e.stopPropagation(); editPersona(p.id); } }, ic('pencil', 14)) : null,
        h('button', { type: 'button', title: 'إزالة', onclick: (e) => { e.stopPropagation(); preview.splice(i, 1); drawPreview(); } }, ic('x', 14))],
    })));
  }
  async function start() {
    read(); const b = $('#startBtn'); b.disabled = true;
    try {
      if (!preview.length) { if (s.mode === 'manual' && !s.handpicked.length) s.mode = 'random'; preview = await api('/api/audience/preview', s); }
      const r = await api('/api/streams/start', { title: s.title || 'بث مباشر', game: s.game, settings: s, personas: preview });
      location.hash = '#/live/' + r.id;
    } catch (e) { toast('تعذر بدء البث: ' + e.message); } finally { b.disabled = false; }
  }
  syncMode(); drawPreview(); loadTemplates();
}
