import { h, api, modal, toast, meta, slider, $, $$ } from './ui.js';
import { personaCard, editPersona } from './personas.js';
import { pickAvatar } from './avatarPicker.js';

const DEF = { title: 'بث مباشر', game: '', streamerName: '', mode: 'random', total: 20, girls: 10, boys: 10, girlsRatio: 50, returningRatio: 60, includeFavorites: true, foreignChance: 4,
  avatarMode: 'mixed', namesMode: 'random', politeness: 'mixed', tease: 50, curse: 30, activity: 55, quietRatio: 30, talkRatio: 20, repetition: 25, debate: 40, maxAudience: 40, dynamicJoins: true, memory: true, research: true, handpicked: [], natWeights: null };
const PRESET_AR = { respectful: 'محترم جداً', normal: 'عادي', sarcastic: 'ساخر', rude: 'قليل أدب', heavy_tease: 'طقطقة قوية', light_curse: 'سب خفيف', mixed: 'جمهور عشوائي بمستويات مختلفة' };

export async function renderSetup(app) {
  const m = await meta();
  let s = { ...DEF, ...(JSON.parse(localStorage.getItem('audienceSettings') || 'null') || {}), streamerName: JSON.parse(localStorage.getItem('audienceSettings') || '{}').streamerName ?? m.streamerName };
  let preview = [];
  const form = h('form', { onsubmit: (e) => e.preventDefault(), oninput: () => { read(); syncMode(); } });
  const v = (n) => form.querySelector(`[name=${n}]`);
  const radio = (name, val, label) => h('label', {}, h('input', { type: 'radio', name, value: val, checked: s[name] === val }), label);
  const num = (name, label, min = 0, max = 200) => h('label', { class: 'f' }, label, h('input', { type: 'number', name, value: s[name], min, max }));
  const tog = (name, label) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', name, checked: !!s[name] }), label);

  const handInfo = h('span', { class: 'muted small' });
  const natBox = h('div', { class: 'row' }, Object.entries(m.nationalities).filter(([, n]) => !n.foreign).map(([k, n]) => h('label', { class: 'f', style: { minWidth: '90px', width: '90px' } }, n.flag + ' ' + n.name, h('input', { type: 'number', min: 0, max: 100, step: 0.5, 'data-nat': k, value: s.natWeights?.[k] ?? n.weight }))));
  const countsBox = h('div', { class: 'row' }, num('girls', '👧 عدد البنات'), num('boys', '👦 عدد الأولاد'));
  const ratioBox = h('div', {}, slider('نسبة البنات %', 'girlsRatio', s.girlsRatio, 0, 100, 1, '%'));
  const templatesBox = h('div', { class: 'row' });

  form.append(
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, '📺 معلومات البث'),
        h('label', { class: 'f' }, 'عنوان البث', h('input', { type: 'text', name: 'title', value: s.title })),
        h('div', { class: 'row' }, h('label', { class: 'f grow' }, 'اللعبة / المحتوى', h('input', { type: 'text', name: 'game', value: s.game, placeholder: 'مثلاً: FIFA, Fortnite, سوالف' })),
          h('label', { class: 'f grow' }, 'اسمك (تناديك به الشخصيات)', h('input', { type: 'text', name: 'streamerName', value: s.streamerName || '', placeholder: 'مثلاً: أبو سلطان' }))),
        h('h3', {}, '💾 قوالب الجمهور'), templatesBox,
        h('div', { class: 'row' }, h('input', { type: 'text', id: 'tplName', placeholder: 'اسم القالب', class: 'grow', style: { width: 'auto', flex: '1' } }), h('button', { class: 'btn', type: 'button', onclick: saveTemplate }, 'حفظ الإعدادات كقالب'))),
      h('div', { class: 'card' }, h('h2', {}, '👥 تركيبة الجمهور'),
        h('div', { class: 'seg' }, radio('mode', 'random', '🎲 الجميع عشوائي'), radio('mode', 'counts', '🔢 عدد البنات والأولاد'), radio('mode', 'ratio', '📊 نسبة معينة'), radio('mode', 'manual', '✋ كلهم من اختياري')),
        h('div', { class: 'row', style: { marginTop: '10px' } }, num('total', 'إجمالي عدد الشخصيات', 1, 200), h('button', { type: 'button', class: 'btn', onclick: handpick }, '✋ اختيار شخصيات بعينها'), handInfo),
        countsBox, ratioBox,
        slider('نسبة الوجوه المألوفة', 'returningRatio', s.returningRatio, 0, 100, 1, '%'),
        slider('احتمال دخول أجانب', 'foreignChance', s.foreignChance, 0, 30, 1, '%'),
        tog('includeFavorites', '★ أضف الشخصيات المفضلة أولاً'),
        h('details', {}, h('summary', {}, 'توزيع الجنسيات (أوزان)'), h('p', { class: 'muted small' }, 'الأغلبية من السعودية ومصر ولبنان والعراق. يضاف تذبذب عشوائي طبيعي في كل بث.'), natBox))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, '🎭 مستوى الأدب والجرأة'),
        h('div', { class: 'seg' }, Object.entries(PRESET_AR).map(([k, l]) => radio('politeness', k, l))),
        slider('مستوى الطقطقة', 'tease', s.tease), slider('مستوى السب الخفيف', 'curse', s.curse),
        h('p', { class: 'muted small' }, 'لن يسب الجميع طوال الوقت: فقط بعض الشخصيات ذات الطباع المناسبة وبحد أقصى للتكرار. لا إهانات تمييزية ولا تهديدات ولا محتوى جنسي.')),
      h('div', { class: 'card' }, h('h2', {}, '💬 النشاط والدردشة'),
        slider('مستوى النشاط', 'activity', s.activity), slider('نسبة الهادئين', 'quietRatio', s.quietRatio, 0, 100, 1, '%'), slider('نسبة كثيري الكلام', 'talkRatio', s.talkRatio, 0, 100, 1, '%'),
        slider('السماح بالتكرار', 'repetition', s.repetition), slider('النقاش بين الشخصيات', 'debate', s.debate),
        h('div', { class: 'row' }, num('maxAudience', 'الحد الأقصى أثناء البث', 1, 300), tog('dynamicJoins', 'دخول شخصيات جديدة تلقائياً')))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, '🖼️ الأسماء والصور'),
        h('div', { class: 'seg' }, radio('namesMode', 'random', 'أسماء عشوائية'), radio('namesMode', 'manual', 'أسماء يدوية (عدّلها في المعاينة)')),
        h('h3', {}, 'صور الحسابات'), h('div', { class: 'seg' }, radio('avatarMode', 'mixed', 'مزيج واقعي'), radio('avatarMode', 'people', 'أغلبها صور أشخاص'), radio('avatarMode', 'random', 'أغلبها عشوائية'), radio('avatarMode', 'none', 'بدون صور'))),
      h('div', { class: 'card' }, h('h2', {}, '🧠 الذكاء'),
        tog('memory', 'تفعيل الذاكرة طويلة المدى (تذكر البثوث السابقة)'), tog('research', 'تفعيل البحث عن المعلومات المجهولة (قاموس مرجعي + ويكاموس)'),
        h('p', { class: 'muted small' }, m.llm.active ? `✅ مزود الذكاء الاصطناعي: ${m.llm.active.provider} (${m.llm.active.model})` : '⚙️ يعمل الآن بالمحرك المحلي بدون إنترنت. أضف مفتاح API من الإعدادات لردود أذكى.'))));

  const pv = h('div', { class: 'pgrid' });
  const stats = h('div', { class: 'stats' });
  const startBtn = h('button', { class: 'btn pri big', onclick: start, disabled: true }, '🔴 ابدأ البث');
  app.append(h('h1', {}, '🎬 إعداد الجمهور قبل البث'), form,
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow', style: { margin: 0 } }, 'معاينة الجمهور'),
      h('button', { class: 'btn', onclick: () => addOne('f') }, '+ بنت'), h('button', { class: 'btn', onclick: () => addOne('m') }, '+ ولد'),
      h('button', { class: 'btn pri', onclick: doPreview }, '🎲 كوّن الجمهور'), startBtn), stats, h('div', { style: { height: '10px' } }), pv));

  function read() {
    for (const k of Object.keys(DEF)) { const el = v(k); if (!el) continue; if (el.type === 'checkbox') s[k] = el.checked; else if (el.type === 'radio') s[k] = form.querySelector(`[name=${k}]:checked`)?.value; else s[k] = el.type === 'number' || el.type === 'range' ? +el.value : el.value; }
    s.natWeights = Object.fromEntries($$('[data-nat]', natBox).map((i) => [i.dataset.nat, +i.value]));
    if (s.mode === 'counts') s.total = s.girls + s.boys + (s.handpicked?.length || 0) || s.total;
    localStorage.setItem('audienceSettings', JSON.stringify(s));
  }
  function syncMode() {
    countsBox.style.display = s.mode === 'counts' ? '' : 'none'; ratioBox.style.display = s.mode === 'ratio' ? '' : 'none';
    v('total').disabled = s.mode === 'counts' || s.mode === 'manual'; if (s.mode === 'counts') v('total').value = s.total;
    handInfo.textContent = s.handpicked.length ? `تم اختيار ${s.handpicked.length} شخصية يدوياً` : '';
  }
  async function loadTemplates() {
    const t = await api('/api/templates'); templatesBox.innerHTML = '';
    if (!t.length) templatesBox.append(h('span', { class: 'muted small' }, 'لا توجد قوالب محفوظة'));
    t.forEach((x) => templatesBox.append(h('span', { class: 'tag', style: { cursor: 'pointer', fontSize: '13px' } }, h('span', { onclick: () => { localStorage.setItem('audienceSettings', JSON.stringify({ ...DEF, ...x.settings })); toast('تم تحميل القالب: ' + x.name); app.innerHTML = ''; renderSetup(app); } }, '📋 ' + x.name), ' ', h('b', { onclick: async () => { await api('/api/templates/' + x.id, undefined, 'DELETE'); loadTemplates(); } }, '×'))));
  }
  async function saveTemplate() { read(); const n = $('#tplName').value.trim() || `قالب ${new Date().toLocaleDateString('ar')}`; await api('/api/templates', { name: n, settings: s }); toast('تم حفظ القالب'); loadTemplates(); }
  async function handpick() {
    const all = (await api('/api/personas')).filter((p) => p.status !== 'banned');
    const sel = new Set(s.handpicked); const g = h('div', { class: 'pgrid' });
    const q = h('input', { type: 'search', placeholder: 'بحث…', oninput: draw });
    function draw() { g.innerHTML = ''; all.filter((p) => !q.value || p.username.toLowerCase().includes(q.value.toLowerCase())).forEach((p) => g.append(personaCard(p, { selected: sel.has(p.id), onClick: () => { sel.has(p.id) ? sel.delete(p.id) : sel.add(p.id); draw(); } }))); }
    const dlg = modal('اختيار شخصيات بعينها', h('div', {}, h('p', { class: 'muted small' }, 'المفضلة تظهر أولاً. اختر من تريد ثم اضغط تم.'), h('div', { class: 'row' }, h('div', { class: 'grow' }, q), h('button', { class: 'btn pri', onclick: () => { s.handpicked = [...sel]; localStorage.setItem('audienceSettings', JSON.stringify(s)); syncMode(); dlg.close(); toast(`تم اختيار ${sel.size}`); } }, 'تم')), h('div', { style: { height: '10px' } }), all.length ? g : h('p', { class: 'muted' }, 'المكتبة فارغة. كوّن جمهوراً أو أنشئ شخصيات أولاً.')));
    draw();
  }
  async function doPreview() {
    read(); if (s.mode === 'manual' && !s.handpicked.length) return toast('اختر شخصيات أولاً (✋)');
    preview = await api('/api/audience/preview', s); drawPreview();
  }
  async function addOne(g) { read(); preview.push(await api('/api/audience/one', { gender: g, avatarMode: s.avatarMode, foreignChance: s.foreignChance })); drawPreview(); }
  function drawPreview() {
    pv.innerHTML = ''; startBtn.disabled = !preview.length;
    const f = preview.filter((p) => p.gender === 'f').length; const nats = {};
    preview.forEach((p) => { const k = (p.nat?.flag || '') + ' ' + (p.nat?.name || ''); nats[k] = (nats[k] || 0) + 1; });
    stats.innerHTML = ''; stats.append(h('span', { class: 'tag' }, `الإجمالي ${preview.length}`), h('span', { class: 'tag' }, `👧 ${f}`), h('span', { class: 'tag' }, `👦 ${preview.length - f}`), h('span', { class: 'tag' }, `جديدة ${preview.filter((p) => p.tmp).length}`), h('span', { class: 'tag' }, `مألوفة ${preview.filter((p) => !p.tmp).length}`), ...Object.entries(nats).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('span', { class: 'tag' }, `${k} ${n}`)));
    preview.forEach((p, i) => pv.append(personaCard(p, {
      editableName: s.namesMode === 'manual' || true, onName: (val) => (p.username = val.trim() || p.username),
      onAvatar: async () => { const r = await pickAvatar({ gender: p.gender, name: p.username }); if (r) { p.avatar_url = r.url; p.avatar_category = r.category; drawPreview(); } },
      actions: [h('button', { title: 'استبدال', onclick: async (e) => { e.stopPropagation(); preview[i] = await api('/api/audience/one', { gender: p.gender, avatarMode: s.avatarMode, foreignChance: s.foreignChance }); drawPreview(); } }, '🎲'),
        !p.tmp ? h('button', { title: 'تعديل', onclick: (e) => { e.stopPropagation(); editPersona(p.id); } }, '✏️') : null,
        h('button', { title: 'إزالة', onclick: (e) => { e.stopPropagation(); preview.splice(i, 1); drawPreview(); } }, '✕')],
    })));
  }
  async function start() {
    read(); startBtn.disabled = true;
    try { const r = await api('/api/streams/start', { title: s.title, game: s.game, settings: s, personas: preview }); location.hash = '#/live/' + r.id; } finally { startBtn.disabled = false; }
  }
  syncMode(); loadTemplates();
}
