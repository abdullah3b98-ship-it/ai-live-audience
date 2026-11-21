import { h, api, toast, fmtDate } from './ui.js';
const CAT = { insult: 'سبّة', praise: 'مدح', joke: 'مزحة', neutral: 'عادية' };
const SRC = { user: 'منك', reference: 'قاموس مرجعي', web: 'بحث ويب', llm: 'ذكاء اصطناعي', vision: 'كاميرا (تخمين)', 'vision+web': 'كاميرا + ويب', 'llm-vision': 'رؤية AI' };
export async function renderMemory(app) {
  const st = await api('/api/settings');
  const memT = h('input', { type: 'checkbox', checked: st.memoryEnabled !== false, onchange: () => api('/api/settings', { memoryEnabled: memT.checked }).then(() => toast('تم')) });
  const resT = h('input', { type: 'checkbox', checked: st.researchEnabled !== false, onchange: () => api('/api/settings', { researchEnabled: resT.checked }).then(() => toast('تم')) });
  const words = h('div'), know = h('div'), mems = h('div');
  const w = h('input', { type: 'text', placeholder: 'الكلمة' }), m = h('input', { type: 'text', placeholder: 'المعنى' });
  const c = h('select', {}, h('option', { value: '' }, 'تصنيف تلقائي'), Object.entries(CAT).map(([k, v]) => h('option', { value: k }, v)));
  const lk = h('span', { class: 'small muted' });
  const kk = h('input', { type: 'text', placeholder: 'الشيء (بالإنجليزي مثل remote أو controller)' }), kv = h('input', { type: 'text', placeholder: 'اسمه الحقيقي' });
  const pf = h('select', { onchange: loadMems }, h('option', { value: '' }, 'كل الشخصيات'));
  app.append(h('h1', {}, '🧠 الذاكرة والقاموس والمعرفة'),
    h('div', { class: 'card' }, h('label', { class: 'toggle' }, memT, 'تفعيل الذاكرة طويلة المدى'), h('label', { class: 'toggle' }, resT, 'تفعيل البحث عن المعلومات المجهولة'),
      h('p', { class: 'muted small' }, 'الذاكرة مرتبطة بحسابك ومحفوظة في قاعدة البيانات. الشخصيات تتذكر فقط أحداثاً حدثت فعلاً. التخمينات تُعلَّم "تخمين" ولا تُعامل كحقيقة حتى تؤكدها.')),
    h('div', { class: 'card' }, h('h2', {}, '📚 قاموس الشخصيات (مشترك)'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, w), h('div', { class: 'grow' }, m), c, h('button', { class: 'btn pri', onclick: async () => { if (!w.value || !m.value) return toast('مطلوب'); await api('/api/words', { word: w.value, meaning: m.value, cat: c.value || null }); w.value = m.value = ''; loadWords(); } }, 'إضافة'),
        h('button', { class: 'btn', onclick: async () => { if (!w.value) return; lk.textContent = 'جاري البحث…'; const r = await api('/api/words/lookup', { word: w.value }); lk.textContent = r ? `${SRC[r.source] || r.source}: ${r.meaning} (${r.status === 'confirmed' ? 'موثوق' : 'تخمين'})` : 'لم يُعثر على معنى — علّمهم بنفسك'; if (r && !m.value) m.value = r.meaning; } }, '🔎 ابحث عن المعنى')), lk, words),
    h('div', { class: 'card' }, h('h2', {}, '🧩 المعرفة المكتسبة (أشياء ومعلومات)'), h('div', { class: 'row' }, h('div', { class: 'grow' }, kk), h('div', { class: 'grow' }, kv), h('button', { class: 'btn pri', onclick: async () => { await api('/api/knowledge', { key: kk.value, value: kv.value }); kk.value = kv.value = ''; loadKnow(); } }, 'إضافة كمؤكدة')), know),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow', style: { margin: 0 } }, '🗂️ ذكريات الشخصيات'), pf, h('button', { class: 'btn red', onclick: async () => { if (!confirm(pf.value ? 'مسح ذكريات هذه الشخصية؟' : 'مسح كل الذكريات؟')) return; await api('/api/memories' + (pf.value ? '?persona=' + pf.value : ''), undefined, 'DELETE'); loadMems(); } }, 'مسح الكل')), mems));
  async function loadWords() {
    const list = await api('/api/words'); words.innerHTML = '';
    words.append(list.length ? h('table', {}, h('tr', {}, ['الكلمة', 'المعنى', 'التصنيف', 'الحالة', 'المصدر', 'تعلّمها', ''].map((t) => h('th', {}, t))),
      list.map((x) => h('tr', {}, h('td', {}, h('b', {}, x.word)), h('td', {}, x.meaning), h('td', {}, CAT[x.cat] || x.cat), h('td', { class: 'status-' + x.status }, x.status === 'confirmed' ? '✔ مؤكدة' : '؟ تخمين'), h('td', { class: 'small' }, SRC[x.source] || x.source), h('td', {}, x.learners),
        h('td', {}, x.status !== 'confirmed' ? h('button', { class: 'btn sm green', onclick: async () => { await api(`/api/words/${x.id}/confirm`, {}); loadWords(); } }, 'تأكيد') : '', ' ', h('button', { class: 'btn sm red', onclick: async () => { await api('/api/words/' + x.id, undefined, 'DELETE'); loadWords(); } }, 'حذف'))))) : h('p', { class: 'muted' }, 'لم يتعلموا كلمات بعد.'));
  }
  async function loadKnow() {
    const list = await api('/api/knowledge'); know.innerHTML = '';
    know.append(list.length ? h('table', {}, h('tr', {}, ['الشيء', 'الاسم', 'الحالة', 'المصدر', 'تفاصيل', ''].map((t) => h('th', {}, t))),
      list.map((x) => h('tr', {}, h('td', {}, x.key), h('td', {}, h('b', {}, x.value)), h('td', { class: 'status-' + x.status }, x.status === 'confirmed' ? '✔ مؤكدة' : '؟ تخمين'), h('td', { class: 'small' }, SRC[x.source] || x.source), h('td', { class: 'small muted' }, (x.detail || '').slice(0, 120)),
        h('td', {}, x.status !== 'confirmed' ? h('button', { class: 'btn sm green', onclick: async () => { const v = prompt('الاسم الصحيح؟', x.value); if (v) { await api(`/api/knowledge/${x.id}/confirm`, { value: v }); loadKnow(); } } }, 'تأكيد') : '', ' ', h('button', { class: 'btn sm red', onclick: async () => { await api('/api/knowledge/' + x.id, undefined, 'DELETE'); loadKnow(); } }, 'حذف'))))) : h('p', { class: 'muted' }, 'لا توجد معرفة مكتسبة بعد.'));
  }
  async function loadMems() {
    const list = await api('/api/memories' + (pf.value ? '?persona=' + pf.value : '')); mems.innerHTML = '';
    mems.append(list.length ? h('table', {}, h('tr', {}, ['الشخصية', 'الذكرى', 'البث', 'الوقت', ''].map((t) => h('th', {}, t))),
      list.slice(0, 100).map((x) => h('tr', {}, h('td', {}, x.username), h('td', {}, x.text), h('td', { class: 'small' }, x.stream_title || ''), h('td', { class: 'small muted' }, fmtDate(x.ts)), h('td', {}, h('button', { class: 'btn sm red', onclick: async () => { await api('/api/memories/' + x.id, undefined, 'DELETE'); loadMems(); } }, 'مسح'))))) : h('p', { class: 'muted' }, 'لا توجد ذكريات.'));
    if (list.length > 100) mems.append(h('p', { class: 'muted small' }, `يُعرض آخر 100 من ${list.length} ذكرى. اختر شخصية لعرض ذكرياتها فقط.`));
  }
  const ps = await api('/api/personas'); ps.forEach((p) => pf.append(h('option', { value: p.id }, p.username)));
  loadWords(); loadKnow(); loadMems();
}
