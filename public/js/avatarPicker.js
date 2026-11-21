import { h, api, modal, toast, meta } from './ui.js';
// اختيار صورة: مكتبة / رفع / توليد
export async function pickAvatar({ gender, name } = {}) {
  const m = await meta();
  return new Promise(async (resolve) => {
    let done = false;
    const finish = (r) => { done = true; dlg.close(); resolve(r); };
    const lib = h('div', { class: 'avgrid' });
    const catSel = h('select', { onchange: () => loadLib() }, h('option', { value: '' }, 'كل الفئات'), Object.entries(m.avatarCategories).map(([k, v]) => h('option', { value: k }, v)), h('option', { value: 'upload' }, 'مرفوعة'), h('option', { value: 'ai' }, 'مولّدة بالذكاء الاصطناعي'));
    let all = [];
    const loadLib = () => { lib.innerHTML = ''; all.filter((a) => !catSel.value || a.category === catSel.value).forEach((a) => lib.append(h('img', { src: a.url, title: a.label, loading: 'lazy', onclick: () => finish({ url: a.url, category: a.category }) }))); };
    all = await api('/api/avatars'); 
    const file = h('input', { type: 'file', accept: 'image/*' });
    const up = h('button', { class: 'btn pri', onclick: async () => { if (!file.files[0]) return toast('اختر صورة'); const fd = new FormData(); fd.append('file', file.files[0]); const r = await api('/api/avatars/upload', fd); finish(r); } }, 'رفع');
    const prompt = h('input', { type: 'text', placeholder: 'وصف الصورة: قطة سوداء، كوب قهوة، شخصية خيالية، منظر بحر…' });
    const gcat = h('select', {}, h('option', { value: '' }, 'حسب الوصف'), Object.entries(m.avatarCategories).map(([k, v]) => h('option', { value: k }, v)));
    const prev = h('div', { class: 'row' });
    const aiOk = m.llm.active && m.llm.active.provider === 'openai';
    const gen = h('button', { class: 'btn pri', onclick: async () => { gen.disabled = true; try { const r = await api('/api/avatars/generate', { prompt: prompt.value, category: gcat.value || undefined, gender, name, useAI: aiOk }); prev.innerHTML = ''; prev.append(h('img', { src: r.url, class: 'av lg' }), h('button', { class: 'btn green', onclick: () => finish(r) }, 'استخدم هذه'), h('span', { class: 'muted small' }, r.ai ? 'مولدة بالذكاء الاصطناعي' : 'مولدة محلياً (أضف مفتاح OpenAI في الإعدادات للتوليد بالذكاء الاصطناعي)')); } finally { gen.disabled = false; } } }, 'توليد');
    const dlg = modal('اختيار صورة الحساب', h('div', {},
      h('h3', {}, 'من المكتبة'), h('div', { class: 'row' }, catSel), h('div', { style: { maxHeight: '260px', overflow: 'auto', margin: '8px 0' } }, lib),
      h('h3', {}, 'رفع صورة شخصية'), h('div', { class: 'row' }, file, up),
      h('h3', {}, 'توليد صورة رمزية'), h('div', { class: 'row' }, h('div', { class: 'grow' }, prompt), gcat, gen), prev,
      h('p', { class: 'muted small' }, 'ملاحظة: صور "الممثلين" هنا بورتريهات فنية مولّدة وليست صور مشاهير حقيقيين.')), { onClose: () => !done && resolve(null) });
    loadLib();
  });
}
