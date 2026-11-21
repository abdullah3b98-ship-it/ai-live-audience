// أدوات واجهة مشتركة
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } } else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export async function api(url, body, method) {
  const opt = { method: method || (body ? 'POST' : 'GET'), headers: {} };
  if (body instanceof FormData) opt.body = body; else if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt); const d = await r.json().catch(() => ({}));
  if (!r.ok) { toast(d.error || 'خطأ'); throw new Error(d.error || r.status); }
  return d;
}
export function toast(t, ms = 2600) { const el = h('div', {}, t); $('#toast').append(el); setTimeout(() => el.remove(), ms); }
export function modal(title, body, { onClose } = {}) {
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
  const close = () => { bg.remove(); onClose && onClose(); };
  bg.append(h('div', { class: 'modal' }, h('button', { class: 'x', onclick: close }, '×'), h('h2', {}, title), body));
  document.body.append(bg); return { close, el: bg };
}
export const colorFor = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.codePointAt(0)) >>> 0; return `hsl(${x % 360} 75% 68%)`; };
export function slider(label, name, val, min = 0, max = 100, step = 1, suffix = '') {
  const out = h('output', {}, val + suffix);
  const inp = h('input', { type: 'range', name, min, max, step, value: val, oninput: () => (out.textContent = inp.value + suffix) });
  return h('div', { class: 'slider' }, h('span', {}, label), inp, out);
}
export const fmtDate = (t) => (t ? new Date(t).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDur = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
let META = null;
export async function meta(force) { if (!META || force) META = await api('/api/meta'); return META; }
