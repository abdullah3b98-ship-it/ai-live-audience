import { h, api, toast, meta } from './ui.js';
export async function renderSettings(app) {
  const st = await api('/api/settings'); const L = st.llm;
  const name = h('input', { type: 'text', value: st.streamerName || '', placeholder: 'اسمك في البث' });
  const prov = h('select', { onchange: fillDefaults }, h('option', { value: 'local' }, 'المحرك المحلي (بدون إنترنت / بدون مفتاح)'), L.providers.map((p) => h('option', { value: p, selected: L.provider === p }, { openai: 'OpenAI', xai: 'xAI (Grok)', openrouter: 'OpenRouter', groq: 'Groq', anthropic: 'Anthropic (Claude)', custom: 'مخصص (متوافق مع OpenAI)' }[p] || p)));
  if (L.provider === 'local') prov.value = 'local';
  const model = h('input', { type: 'text', value: L.model, placeholder: 'اسم النموذج' });
  const base = h('input', { type: 'text', value: L.baseUrl, placeholder: 'Base URL (اختياري)' });
  const key = h('input', { type: 'password', placeholder: L.hasKey ? `محفوظ: ${L.keyPreview} — اتركه فارغاً للإبقاء عليه` : 'الصق مفتاح API هنا', autocomplete: 'off' });
  const status = h('div', { class: 'small' });
  const showStatus = (l) => { status.innerHTML = ''; status.append(l.active ? h('span', { style: { color: 'var(--green)' } }, `✅ مفعّل: ${l.active.provider} · ${l.active.model}${l.active.vision ? ' · يدعم الصور' : ''}`) : h('span', { class: 'muted' }, '⚙️ يعمل الآن بالمحرك المحلي (قوالب لهجات + قواعد) — كل الميزات تعمل بدون مفتاح.'), l.envDetected ? h('div', { class: 'muted' }, `تم اكتشاف مفتاح في متغيرات البيئة: ${l.envDetected}`) : null); };
  function fillDefaults() { const d = L.defaults[prov.value]; if (d) { model.placeholder = d.model || 'اسم النموذج'; base.placeholder = d.baseUrl || 'Base URL'; } }
  fillDefaults(); showStatus(L);
  app.append(h('h1', {}, '⚙️ الإعدادات'),
    h('div', { class: 'card' }, h('h2', {}, 'عام'), h('label', { class: 'f' }, 'اسمك (تناديك به الشخصيات)', name), h('button', { class: 'btn pri', style: { marginTop: '8px' }, onclick: async () => { await api('/api/settings', { streamerName: name.value }); const s = JSON.parse(localStorage.getItem('audienceSettings') || '{}'); s.streamerName = name.value; localStorage.setItem('audienceSettings', JSON.stringify(s)); toast('تم الحفظ'); } }, 'حفظ')),
    h('div', { class: 'card' }, h('h2', {}, '🤖 مزود الذكاء الاصطناعي'),
      h('p', { class: 'muted small' }, 'التطبيق يعمل بالكامل بدون مفتاح. عند إضافة مفتاح، تُولَّد الردود بنموذج لغوي مع بقاء نظام الأدوار والتوقيت ومنع التكرار والسلامة محلياً، ويرجع للمحرك المحلي تلقائياً عند أي خطأ.'),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, 'المزود', prov), h('label', { class: 'f' }, 'النموذج', model), h('label', { class: 'f' }, 'Base URL', base), h('label', { class: 'f' }, 'مفتاح API', key)),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn pri', onclick: async () => { const r = await api('/api/settings', { llm: { provider: prov.value, model: model.value, baseUrl: base.value, apiKey: key.value ? key.value : '__keep__' } }); key.value = ''; showStatus(r.llm); meta(true); toast('تم الحفظ'); } }, 'حفظ'),
        h('button', { class: 'btn', onclick: async () => { const r = await api('/api/settings/test-llm', {}); toast(r.ok ? 'الاتصال ناجح: ' + r.reply : 'فشل: ' + r.error, 4000); } }, 'اختبار الاتصال'),
        h('button', { class: 'btn red', onclick: async () => { const r = await api('/api/settings', { llm: { provider: 'local', apiKey: '' } }); showStatus(r.llm); toast('تم حذف المفتاح'); } }, 'حذف المفتاح')), status));
}
