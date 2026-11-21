// طبقة مزوّد الذكاء الاصطناعي القابلة للتبديل. تعمل بدون مفتاح عبر المحرك المحلي.
const { getSetting } = require('../db');
const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', env: 'OPENAI_API_KEY', vision: true },
  xai: { baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini', env: 'XAI_API_KEY', vision: false },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', env: 'OPENROUTER_API_KEY', vision: true },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', env: 'GROQ_API_KEY', vision: false },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-haiku-latest', env: 'ANTHROPIC_API_KEY', vision: true },
  custom: { baseUrl: '', model: '', env: 'LLM_API_KEY', vision: false },
};

function detectEnv() {
  for (const [k, p] of Object.entries(PROVIDERS)) if (process.env[p.env]) return { provider: k, apiKey: process.env[p.env], model: process.env.LLM_MODEL || p.model, baseUrl: process.env.LLM_BASE_URL || p.baseUrl, fromEnv: true };
  return null;
}
function config() {
  const s = getSetting('llm', null);
  if (s && s.provider && s.provider !== 'local' && (s.apiKey || PROVIDERS[s.provider]?.env && process.env[PROVIDERS[s.provider].env])) {
    const d = PROVIDERS[s.provider] || {};
    return { provider: s.provider, apiKey: s.apiKey || process.env[d.env], model: s.model || d.model, baseUrl: s.baseUrl || d.baseUrl, vision: s.vision != null ? s.vision : d.vision };
  }
  if (s && s.provider === 'local') return null;
  const env = detectEnv();
  return env ? { ...env, vision: PROVIDERS[env.provider].vision } : null;
}
const enabled = () => !!config();

let inflight = 0; const stamps = [];
async function chat(messages, { json = false, maxTokens = 700, temperature = 0.95, timeout = 15000 } = {}) {
  const c = config(); if (!c) throw new Error('no-llm');
  const now = Date.now(); while (stamps.length && now - stamps[0] > 60000) stamps.shift();
  if (stamps.length >= (+process.env.LLM_RPM || 30) || inflight >= 3) throw new Error('rate-limited');
  stamps.push(now); inflight++;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    if (c.provider === 'anthropic') {
      const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
      const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: Array.isArray(m.content) ? m.content.map((p) => (p.type === 'image_url' ? { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.image_url.url.split(',')[1] } } : p)) : m.content }));
      const r = await fetch(c.baseUrl.replace(/\/$/, '') + '/messages', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: c.model, max_tokens: maxTokens, temperature, system: sys, messages: rest }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || 'anthropic ' + r.status);
      return d.content.map((p) => p.text || '').join('');
    }
    const body = { model: c.model, messages, temperature, max_tokens: maxTokens };
    if (json) body.response_format = { type: 'json_object' };
    const r = await fetch(c.baseUrl.replace(/\/$/, '') + '/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + c.apiKey }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error?.message || 'llm ' + r.status);
    return d.choices?.[0]?.message?.content || '';
  } finally { clearTimeout(to); inflight--; }
}
function parseJson(s) { const m = String(s).match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }

const LEVEL_DESC = { respectful: 'محترمون جداً بلا أي ألفاظ', normal: 'عاديون', sarcastic: 'ساخرون', rude: 'بعضهم قليل أدب', heavy_tease: 'طقطقة قوية على المذيع', light_curse: 'مسموح بسب خفيف جداً من بعض الشخصيات فقط', mixed: 'مستويات مختلفة حسب كل شخصية' };

// توليد ردود لعدة شخصيات دفعة واحدة
async function generateReplies({ event, personas, recent, streamer, game, level, memories }) {
  const people = personas.map((x) => ({
    id: x.p.id, name: x.p.username, gender: x.p.gender === 'f' ? 'female' : 'male', nationality: x.p.nat?.name, dialect: x.p.dialect_name, language: x.p.language === 'en' ? 'English ONLY, does not understand Arabic' : 'Arabic dialect',
    personality: x.p.archetype_label, reputation: x.p.reputation, traits: Object.fromEntries(Object.entries(x.p.traits).filter(([k]) => typeof x.p.traits[k] === 'number').map(([k, v]) => [k, Math.round(v * 100) / 100])),
    style: { emoji: x.p.style.emoji, length: x.p.style.length, punctuation: x.p.style.punctuation, mixEnglish: x.p.style.mixEnglish > 0, arabizi: x.p.style.arabizi },
    known_dialects: x.p.known_families, intent_hint: x.hint, named: !!x.named, memories: (memories[x.p.id] || []).slice(0, 4), learned_words: (x.words || []).slice(0, 8),
  }));
  const sys = `أنت محرك جمهور بث مباشر واقعي (مثل Twitch/TikTok Live). تكتب رسائل دردشة قصيرة لشخصيات مستقلة.
قواعد صارمة:
- كل شخصية تكتب بلهجتها الحقيقية (ليست فصحى مع كلمة عامية) وبأسلوبها (طول الرسالة، الإيموجي، الترقيم، الاختصارات، خلط الإنجليزية).
- الأجانب يكتبون بالإنجليزية فقط ولا يفهمون العربية؛ إذا كان الكلام عربياً قد يقولون إنهم لم يفهموا.
- لا تكرر نفس العبارات بين الشخصيات. لا تجعل الجميع يضحكون. النكتة السيئة لا يضحك عليها أحد مجاملة.
- لا تتظاهر بتذكر أحداث غير موجودة في memories.
- إذا كانت كلمة من لهجة لا تعرفها الشخصية (known_dialects) فلتسأل عن معناها بدل التظاهر بالفهم.
- من نودي باسمه (named=true) يرد مباشرة على المذيع ويعرف أنه المقصود.
- مستوى الجرأة: ${LEVEL_DESC[level.politeness] || 'عادي'}، طقطقة ${level.tease}/100، سب خفيف ${level.curse}/100. ممنوع: إهانات تمييزية، تهديدات، محتوى جنسي.
- يمكن للشخصية أن تختار عدم الكتابة (skip) أو رد فعل بإيموجي فقط (reaction).
أعد JSON فقط: {"replies":[{"id":رقم,"text":"..."} أو {"id":رقم,"reaction":"😂"} أو {"id":رقم,"skip":true}]}`;
  const user = JSON.stringify({ streamer, game, event, recent_chat: recent.slice(-15), personas: people });
  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true });
  const j = parseJson(out); return (j && j.replies) || [];
}

async function explainWord(word, context) {
  const out = await chat([{ role: 'system', content: 'أنت خبير لهجات عربية وعامية الإنترنت. أعد JSON فقط: {"meaning":"...","category":"insult|praise|joke|neutral","dialect":"...","confident":true|false}' }, { role: 'user', content: `الكلمة: ${word}\nالسياق: ${context}` }], { json: true, temperature: 0.2, maxTokens: 200 });
  return parseJson(out);
}

async function recognizeImage(dataUrl) {
  const c = config(); if (!c || !c.vision) throw new Error('no-vision');
  const out = await chat([{ role: 'system', content: 'You see one frame from a live stream (camera or shared screen). Identify the most notable object or thing in it (prefer what the person is holding or showing; for a screen, what is on it, e.g. a game name). Return JSON only: {"name_ar":"short Arabic name","name_en":"short English name","description":"one short Arabic sentence","confidence":0-1,"bbox":[x,y,w,h] normalized 0-1 or null}' }, { role: 'user', content: [{ type: 'text', text: 'What is this?' }, { type: 'image_url', image_url: { url: dataUrl } }] }], { json: true, temperature: 0.1, maxTokens: 200 });
  return parseJson(out);
}

function publicConfig() {
  const s = getSetting('llm', {}) || {}; const c = config(); const env = detectEnv();
  return { provider: s.provider || (env ? env.provider : 'local'), model: s.model || '', baseUrl: s.baseUrl || '', hasKey: !!(s.apiKey), keyPreview: s.apiKey ? s.apiKey.slice(0, 4) + '…' + s.apiKey.slice(-4) : '', active: c ? { provider: c.provider, model: c.model, vision: !!c.vision } : null, envDetected: env ? env.provider : null, providers: Object.keys(PROVIDERS), defaults: PROVIDERS };
}

module.exports = { enabled, config, chat, generateReplies, explainWord, recognizeImage, publicConfig, PROVIDERS };
