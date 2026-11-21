import { h, api, fmtDate, fmtDur, colorFor, toast } from './ui.js';
const TYPE_AR = { joke: '😂 نكتة', fail: '😵 غلطة', win: '🏆 فوز', game: '🎮 لعبة', word: '📚 كلمة جديدة', object: '🧠 شيء جديد', named: '💬 نداء', important: '⚡ حدث مهم', funny: '🤣 موقف' };
export async function renderStreams(app) {
  const list = await api('/api/streams');
  app.append(h('h1', {}, '🕘 البثوث السابقة'), list.length ? h('div', {}, list.map((s) => h('div', { class: 'card row' },
    h('div', { class: 'grow' }, h('h2', { style: { margin: 0 } }, s.live ? '🔴 ' : '', s.title, s.game ? h('span', { class: 'tag' }, '🎮 ' + s.game) : ''),
      h('div', { class: 'muted small' }, `${fmtDate(s.started_at)} · المدة ${s.ended_at ? fmtDur(s.ended_at - s.started_at) : 'شغال'} · ${s.persona_ids.length} شخصية · ${s.msgs} رسالة`), s.summary ? h('div', { class: 'small', style: { marginTop: '4px' } }, s.summary) : null),
    s.live ? h('a', { class: 'btn pri', href: '#/live/' + s.id }, 'ارجع للبث') : h('a', { class: 'btn', href: '#/stream/' + s.id }, 'مراجعة'),
    !s.live ? h('button', { class: 'btn red sm', onclick: async () => { if (confirm('حذف هذا البث وذكرياته؟')) { await api('/api/streams/' + s.id, undefined, 'DELETE'); location.reload(); } } }, 'حذف') : null))) : h('div', { class: 'card muted' }, 'لا توجد بثوث بعد.'));
}
export async function renderStream(app, id) {
  const s = await api('/api/streams/' + id);
  const byId = Object.fromEntries(s.people.map((p) => [p.id, p]));
  const filter = h('select', { onchange: draw }, h('option', { value: '' }, 'كل الرسائل'), h('option', { value: 'named' }, 'ردود النداء فقط'), h('option', { value: 'streamer' }, 'رسائلي فقط'), h('option', { value: 'system' }, 'أحداث النظام'));
  const log = h('div', { style: { maxHeight: '60vh', overflow: 'auto' } });
  function draw() {
    log.innerHTML = '';
    s.messages.filter((m) => m.kind !== 'reaction' && (!filter.value || m.kind === filter.value || (filter.value === 'streamer' && m.kind === 'voice'))).forEach((m) => {
      if (m.kind === 'system') return log.append(h('div', { class: 'msg system' }, m.text));
      if (!m.persona_id) return log.append(h('div', { class: 'msg streamer' }, h('b', {}, m.kind === 'voice' ? '🎙️ أنت: ' : '🎥 أنت: '), m.text));
      log.append(h('div', { class: 'msg ' + (m.kind === 'named' ? 'named' : '') }, h('img', { class: 'av', src: m.avatar_url }), h('span', { class: 'u', style: { color: colorFor(m.username) } }, m.username), ': ', h('span', { class: 't' }, m.text)));
    });
  }
  const reactions = s.messages.filter((m) => m.kind === 'reaction').length;
  app.append(h('h1', {}, `مراجعة: ${s.title}`), h('div', { class: 'muted', style: { marginBottom: '12px' } }, `${fmtDate(s.started_at)} · ${s.game || ''} · ${s.summary || ''} · ${reactions} رد فعل غير كتابي`),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, '⭐ أهم اللحظات'), s.highlights.length ? s.highlights.map((e) => h('div', { class: 'hl' }, h('b', {}, TYPE_AR[e.type] || e.type), ' — ', e.text || e.data?.game || '', h('div', { class: 'small muted' }, `${new Date(e.ts).toLocaleTimeString('ar')} · تفاعل ${e.reactions}${e.persona_id && byId[e.persona_id] ? ' · مع ' + byId[e.persona_id].username : ''}`))) : h('p', { class: 'muted' }, 'لا توجد لحظات مهمة مسجلة.'),
        h('h2', { style: { marginTop: '16px' } }, '👥 الحضور'), h('div', {}, s.people.map((p) => h('span', { class: 'tag' }, h('img', { src: p.avatar_url, class: 'av sm', style: { verticalAlign: 'middle' } }), ' ', p.username)))),
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow', style: { margin: 0 } }, '💬 سجل الدردشة'), filter), log)));
  draw();
}
