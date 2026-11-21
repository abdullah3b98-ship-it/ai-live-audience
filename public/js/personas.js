import { h, api, modal, toast, meta, slider, fmtDate, $ } from './ui.js';
import { pickAvatar } from './avatarPicker.js';

export function personaCard(p, { onClick, actions = [], selected, editableName, onName, onAvatar } = {}) {
  const img = h('img', { class: 'av', src: p.avatar_url, alt: '', onclick: onAvatar ? (e) => { e.stopPropagation(); onAvatar(); } : null, title: onAvatar ? 'تغيير الصورة' : '' });
  const name = editableName ? h('input', { class: 'name', value: p.username, onclick: (e) => e.stopPropagation(), onchange: (e) => onName(e.target.value) }) : h('div', { class: 'name', title: p.username }, p.username);
  return h('div', { class: 'pc' + (selected ? ' sel' : '') + (p.status === 'banned' ? ' banned' : ''), onclick: onClick },
    h('div', { class: 'acts' }, actions),
    h('div', { class: 'top' }, img, h('div', { style: { minWidth: 0 } }, name, h('div', { class: 'small muted' }, (p.gender === 'f' ? '♀ بنت' : '♂ ولد'), ' · ', p.nat?.flag || '', ' ', p.nat?.name || ''))),
    h('div', { class: 'small' }, h('span', { class: 'tag' }, p.dialect_name), h('span', { class: 'tag' }, '⭐ ' + p.reputation)),
    h('div', { class: 'small muted', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.archetype_label),
    p.favorite || p.status === 'banned' || p.streams_attended ? h('div', { class: 'small' }, p.favorite ? h('span', { class: 'fav' }, '★ مفضلة ') : '', p.status === 'banned' ? h('span', { style: { color: '#ff8a80' } }, '⛔ محظور ') : '', !p.allow_return && p.status !== 'banned' ? h('span', { class: 'muted' }, '🚪 مطرود ') : '', p.streams_attended ? h('span', { class: 'muted' }, `· حضر ${p.streams_attended} بث`) : '') : null);
}

export async function renderPersonas(app) {
  const m = await meta();
  let list = await api('/api/personas');
  const q = h('input', { type: 'search', placeholder: 'بحث بالاسم…', oninput: draw });
  const fg = h('select', { onchange: draw }, h('option', { value: '' }, 'الكل'), h('option', { value: 'f' }, 'بنات'), h('option', { value: 'm' }, 'أولاد'));
  const fn = h('select', { onchange: draw }, h('option', { value: '' }, 'كل الجنسيات'), Object.entries(m.nationalities).map(([k, v]) => h('option', { value: k }, v.flag + ' ' + v.name)));
  const fs = h('select', { onchange: draw }, h('option', { value: '' }, 'كل الحالات'), h('option', { value: 'fav' }, '★ المفضلة'), h('option', { value: 'banned' }, '⛔ المحظورين'), h('option', { value: 'kicked' }, '🚪 المطرودين'));
  const grid = h('div', { class: 'pgrid' });
  const count = h('span', { class: 'muted' });
  function draw() {
    grid.innerHTML = '';
    const f = list.filter((p) => (!q.value || p.username.toLowerCase().includes(q.value.toLowerCase())) && (!fg.value || p.gender === fg.value) && (!fn.value || p.nationality === fn.value)
      && (!fs.value || (fs.value === 'fav' && p.favorite) || (fs.value === 'banned' && p.status === 'banned') || (fs.value === 'kicked' && !p.allow_return && p.status !== 'banned')));
    count.textContent = `${f.length} شخصية`;
    f.forEach((p) => grid.append(personaCard(p, { onClick: () => editPersona(p.id, reload), actions: [h('button', { title: 'مفضلة', class: p.favorite ? 'fav' : '', onclick: async (e) => { e.stopPropagation(); await api('/api/personas/' + p.id, { favorite: !p.favorite }, 'PUT'); reload(); } }, p.favorite ? '★' : '☆')] })));
  }
  async function reload() { list = await api('/api/personas'); draw(); }
  const ng = h('select', {}, h('option', { value: '' }, 'جنس عشوائي'), h('option', { value: 'f' }, 'بنت'), h('option', { value: 'm' }, 'ولد'));
  app.append(h('h1', {}, '👥 مكتبة الشخصيات'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, q), fg, fn, fs, count),
      h('div', { class: 'row', style: { marginTop: '10px' } }, ng,
        h('button', { class: 'btn pri', onclick: async () => { const p = await api('/api/personas', { gender: ng.value || undefined }); await reload(); editPersona(p.id, reload); } }, '+ شخصية جديدة'),
        h('button', { class: 'btn', onclick: async () => { await api('/api/personas/generate', { count: 10, gender: ng.value || undefined }); reload(); toast('تم توليد 10 شخصيات'); } }, '🎲 توليد 10 عشوائياً'))),
    grid);
  draw();
}

export async function editPersona(id, onSaved) {
  const m = await meta();
  const p = await api('/api/personas/' + id);
  const st = { ...p };
  const avatar = h('img', { class: 'av lg', src: p.avatar_url, onclick: async () => { const r = await pickAvatar({ gender: st.gender, name: st.username }); if (r) { st.avatar_url = r.url; st.avatar_category = r.category; avatar.src = r.url; } } });
  const name = h('input', { type: 'text', value: p.username });
  const gender = h('select', {}, h('option', { value: 'f', selected: p.gender === 'f' }, 'بنت'), h('option', { value: 'm', selected: p.gender === 'm' }, 'ولد'));
  const nat = h('select', { onchange: () => { const d = m.nationalities[nat.value].dialects[0]; dial.value = d; } }, Object.entries(m.nationalities).map(([k, v]) => h('option', { value: k, selected: k === p.nationality }, v.flag + ' ' + v.name)));
  const dial = h('select', {}, Object.entries(m.dialects).map(([k, v]) => h('option', { value: k, selected: k === p.dialect }, v)));
  const arch = h('select', {}, Object.entries(m.archetypes).map(([k, v]) => h('option', { value: k, selected: k === p.archetype }, v)));
  const TR = { talk: 'كثرة الكلام', humor: 'صعوبة الإضحاك', rude: 'قلة الأدب', curse: 'السب الخفيف', tease: 'الطقطقة', critic: 'الانتقاد', sarcasm: 'السخرية', contrarian: 'المخالفة', debate: 'حب النقاش', curiosity: 'الفضول', hype: 'الحماس' };
  const trWrap = h('div', {}, Object.entries(TR).map(([k, l]) => slider(l, 'tr_' + k, Math.round((p.traits[k] || 0) * 100))));
  const onlyCalled = h('input', { type: 'checkbox', checked: !!p.traits.onlyWhenCalled }), importantOnly = h('input', { type: 'checkbox', checked: !!p.traits.importantOnly });
  const S = p.style;
  const emo = h('select', {}, [['never', 'لا يستخدم إيموجي أبداً'], ['rare', 'نادراً'], ['sometimes', 'أحياناً'], ['often', 'كثيراً']].map(([k, v]) => h('option', { value: k, selected: S.emoji === k }, v)));
  const len = h('select', {}, [['tiny', 'قصيرة جداً'], ['short', 'قصيرة'], ['medium', 'متوسطة'], ['long', 'طويلة']].map(([k, v]) => h('option', { value: k, selected: S.length === k }, v)));
  const chk = (k, l) => { const c = h('input', { type: 'checkbox', checked: !!S[k], 'data-k': k }); return h('label', { class: 'toggle' }, c, l); };
  const styleChecks = h('div', {}, chk('punctuation', 'يستخدم علامات الترقيم'), chk('abbreviations', 'يستخدم اختصارات'), chk('arabizi', 'يكتب عربيزي (3 و 7)'), chk('taAsHa', 'يكتب ة → ه'), chk('dropHamza', 'يتجاهل الهمزات'), chk('numbers', 'يستخدم أرقام'));
  const mixEn = slider('خلط الإنجليزية', 'mixEn', Math.round((S.mixEnglish || 0) * 100));
  const FAM = { gulf: 'خليجي/سعودي', egyptian: 'مصري', levant: 'شامي', iraqi: 'عراقي', english: 'إنجليزي', white: 'عربي عام' };
  const famBox = h('div', { class: 'row' }, Object.entries(FAM).map(([k, v]) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.known_families.includes(k), 'data-f': k }), v)));
  const INT = { games: 'ألعاب', memes: 'ميمز', football: 'كورة', food: 'أكل', music: 'موسيقى', general: 'عام' };
  const intBox = h('div', { class: 'row' }, Object.entries(INT).map(([k, v]) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.interests.includes(k), 'data-i': k }), v)));
  const fav = h('input', { type: 'checkbox', checked: p.favorite }), banned = h('input', { type: 'checkbox', checked: p.status === 'banned' }), allow = h('input', { type: 'checkbox', checked: p.allow_return });
  const bio = h('textarea', { rows: 2, placeholder: 'ملاحظات / خلفية الشخصية' }, p.bio || '');
  const mems = h('div', {});
  const drawMems = (rows) => { mems.innerHTML = ''; if (!rows.length) mems.append(h('p', { class: 'muted small' }, 'لا توجد ذكريات بعد — تُحفظ فقط من أحداث حقيقية في البث.')); rows.forEach((r) => mems.append(h('div', { class: 'row small', style: { borderBottom: '1px solid var(--line)', padding: '4px 0' } }, h('span', { class: 'grow' }, `• ${r.text}`), h('span', { class: 'muted' }, r.stream_title || ''), h('button', { class: 'btn sm red', onclick: async () => { await api('/api/memories/' + r.id, undefined, 'DELETE'); drawMems(rows.filter((x) => x !== r)); } }, 'مسح')))); };
  drawMems(p.memories);
  const save = async () => {
    const traits = { ...p.traits }; for (const k of Object.keys(TR)) traits[k] = +dlg.el.querySelector(`[name=tr_${k}]`).value / 100;
    traits.onlyWhenCalled = onlyCalled.checked; traits.importantOnly = importantOnly.checked;
    const style = { ...S, emoji: emo.value, length: len.value, mixEnglish: +dlg.el.querySelector('[name=mixEn]').value / 100 };
    styleChecks.querySelectorAll('input').forEach((c) => (style[c.dataset.k] = c.checked));
    const body = { username: name.value.trim() || p.username, gender: gender.value, nationality: nat.value, dialect: dial.value, traits, style, avatar_url: st.avatar_url, avatar_category: st.avatar_category, bio: bio.value, favorite: fav.checked, status: banned.checked ? 'banned' : 'active', allow_return: allow.checked,
      known_families: [...famBox.querySelectorAll('input:checked')].map((c) => c.dataset.f), interests: [...intBox.querySelectorAll('input:checked')].map((c) => c.dataset.i) };
    if (arch.value !== p.archetype) { body.archetype = arch.value; delete body.traits; }
    await api('/api/personas/' + id, body, 'PUT'); toast('تم الحفظ'); dlg.close(); onSaved && onSaved();
  };
  const dlg = modal('تعديل الشخصية', h('div', {},
    h('div', { class: 'row' }, avatar, h('div', { class: 'grow' }, h('div', { class: 'row' }, h('label', { class: 'f grow' }, 'اسم المستخدم', name), h('label', { class: 'f' }, 'الجنس', gender)),
      h('div', { class: 'small muted', style: { marginTop: '6px' } }, `⭐ السمعة: ${p.reputation} · حضر ${p.streams_attended} بث · ${p.msg_count} رسالة · ضحك ${p.laughs} · انتقد ${p.criticisms} · طقطق ${p.teases}`))),
    h('p', { class: 'muted small' }, 'اضغط على الصورة لتغييرها (مكتبة / رفع / توليد). الجنسية واللهجة ثابتة عبر البثوث ولا تتغير إلا إذا غيرتها هنا.'),
    h('div', { class: 'grid2' },
      h('div', {}, h('h3', {}, 'الهوية'), h('label', { class: 'f' }, 'الجنسية', nat), h('label', { class: 'f' }, 'اللهجة / اللغة', dial), h('label', { class: 'f' }, 'نمط الشخصية', arch),
        h('h3', {}, 'المعرفة الثقافية (اللهجات التي يفهمها تلقائياً)'), famBox, h('h3', {}, 'الاهتمامات'), intBox),
      h('div', {}, h('h3', {}, 'الطباع'), trWrap, h('label', { class: 'toggle' }, onlyCalled, 'لا يكتب إلا إذا نودي باسمه'), h('label', { class: 'toggle' }, importantOnly, 'لا يتدخل إلا في الأحداث المهمة'))),
    h('div', { class: 'grid2' }, h('div', {}, h('h3', {}, 'أسلوب الكتابة'), h('label', { class: 'f' }, 'الإيموجي', emo), h('label', { class: 'f' }, 'طول الرسائل', len), mixEn, styleChecks),
      h('div', {}, h('h3', {}, 'الحالة'), h('label', { class: 'toggle' }, fav, '★ مفضلة (تُضاف بسهولة لأي بث)'), h('label', { class: 'toggle' }, allow, 'مسموح يرجع تلقائياً للبثوث'), h('label', { class: 'toggle' }, banned, '⛔ محظور نهائياً'), bio,
        h('h3', {}, 'كلمات تعلمها'), h('div', {}, p.words.length ? p.words.map((w) => h('span', { class: 'tag' }, `${w.word} = ${w.meaning}`)) : h('span', { class: 'muted small' }, 'لا شيء بعد')),
        h('h3', {}, 'علاقاته مع الشخصيات'), h('div', {}, p.relations.length ? p.relations.map((r) => h('span', { class: 'tag' }, `${r.username} ${r.affinity > 0.15 ? '🤝' : r.affinity < -0.1 ? '⚔️' : '·'} (${r.interactions})`)) : h('span', { class: 'muted small' }, 'لا توجد تفاعلات بعد')))),
    h('h3', {}, 'الذاكرة طويلة المدى'), mems,
    h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn pri', onclick: save }, 'حفظ'), h('button', { class: 'btn red', onclick: async () => { if (confirm('حذف الشخصية نهائياً؟')) { await api('/api/personas/' + id, undefined, 'DELETE'); dlg.close(); onSaved && onSaved(); } } }, 'حذف الشخصية'))));
}
