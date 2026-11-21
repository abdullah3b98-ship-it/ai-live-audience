import { $, $$, h, api, meta } from './ui.js';
import { renderSetup } from './setup.js';
import { renderLive, leaveLive } from './live.js';
import { renderPersonas } from './personas.js';
import { renderStreams, renderStream } from './history.js';
import { renderMemory } from './memory.js';
import { renderSettings } from './settings.js';
import { ic } from './icons.js';
$$('#nav a').forEach((a) => a.prepend(ic(a.dataset.i, 17)));

async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, page, id] = hash.split('/');
  const app = $('#app');
  if (page !== 'live') leaveLive();
  $$('.modal-bg, .pop').forEach((el) => el.remove());
  app.innerHTML = '';
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === (page || 'setup') || (page === 'stream' && a.dataset.r === 'streams')));
  try {
    if (!page) await renderSetup(app);
    else if (page === 'live') await renderLive(app, +id);
    else if (page === 'personas') await renderPersonas(app);
    else if (page === 'streams') await renderStreams(app);
    else if (page === 'stream') await renderStream(app, +id);
    else if (page === 'memory') await renderMemory(app);
    else if (page === 'settings') await renderSettings(app);
    else app.append(h('p', {}, 'الصفحة غير موجودة'));
  } catch (e) { console.error(e); app.append(h('div', { class: 'card' }, 'حدث خطأ: ' + e.message)); }
  updateLiveLink();
}
export async function updateLiveLink() {
  const m = await meta(true).catch(() => null);
  const el = $('#liveLink'); el.innerHTML = '';
  if (m && m.activeStreams.length && !location.hash.startsWith('#/live')) el.append(h('a', { href: '#/live/' + m.activeStreams[0] }, ic('radio', 16), h('span', {}, 'ارجع للبث')));
}
window.addEventListener('hashchange', route);
route();
