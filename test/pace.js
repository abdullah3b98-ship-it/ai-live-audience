// يقيس: سرعة رد الجمهور على المذيع (كتابة/صوت) + عدد الرسائل بالدقيقة حسب حجم الجمهور
const WebSocket = require('ws');
const B = process.env.BASE || 'http://localhost:3300';
const SIZES = (process.env.SIZES || '3,10,30').split(',').map(Number);
const WIN = +(process.env.WIN || 75000);
const j = (u, b) => fetch(B + u, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(n) {
  const settings = { total: n, mode: 'random', politeness: 'mixed', tease: 50, curse: 30, activity: 60, debate: 50, streamerName: 'عبدالله' };
  const prev = await j('/api/audience/preview', settings);
  const { id } = await j('/api/streams/start', { title: 'pace', game: 'فورتنايت', settings, personas: prev });
  const ws = new WebSocket(B.replace('http', 'ws') + '/ws?stream=' + id);
  const msgs = []; let joins = 0;
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.type === 'message' && m.msg.pid) msgs.push({ ...m.msg, at: Date.now() }); if (m.type === 'join') joins++; });
  await new Promise((r) => ws.on('open', r));
  const send = (o) => ws.send(JSON.stringify(o));
  await sleep(Math.min(40000, 8000 + n * 900));
  // 1) قياس الإيقاع بدون كلام المذيع
  const t0 = Date.now(); await sleep(WIN);
  const idle = msgs.filter((m) => m.at >= t0).length; const perMin = idle / (WIN / 60000);
  // 2) قياس الرد على المذيع
  const tests = [['chat', 'السلام عليكم يا شباب'], ['voice', 'كيفكم عساكم طيبين'], ['chat', 'وش أحسن سلاح في فورتنايت برأيكم؟'], ['voice', 'اليوم بنلعب سكواد مع الشباب'], ['chat', 'شكرا على المتابعة يا حلوين']];
  const res = [];
  for (const [type, text] of tests) {
    const s = Date.now(); send({ type, text }); await sleep(9000);
    const after = msgs.filter((m) => m.at >= s && m.at < s + 9000);
    const toMe = after.filter((m) => m.replyTo && m.replyTo.streamer || m.toStreamer);
    const first = after[0];
    res.push({ type, text, firstMs: first ? first.at - s : null, inWin: after.length, replies: after.slice(0, 4).map((m) => `${m.username}: ${m.text}`) });
  }
  await j(`/api/streams/${id}/end`, {}); ws.close();
  return { n, joins, perMin: +perMin.toFixed(1), res };
}
(async () => { for (const n of SIZES) { const r = await run(n); console.log(JSON.stringify(r, null, 1)); } process.exit(0); })();
