// خادم وهمي متوافق مع OpenAI لاختبار مسار الذكاء الاصطناعي بدون مفتاح حقيقي
const http = require('http');
let n = 0;
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    if (req.headers.authorization !== 'Bearer test-key') { res.writeHead(401); return res.end(JSON.stringify({ error: { message: 'bad key' } })); }
    const b = JSON.parse(body || '{}'); const user = b.messages?.find((m) => m.role === 'user')?.content;
    let content = 'تمام';
    try { const u = JSON.parse(user); if (u.personas) content = JSON.stringify({ replies: u.personas.map((p) => ({ id: p.id, text: `[LLM#${++n}] ${p.named ? 'هلا، تقصدني؟' : 'رد'} من ${p.name} (${p.dialect})` })) }); } catch {}
    if (/الكلمة:/.test(user || '')) content = JSON.stringify({ meaning: 'معنى من النموذج', category: 'neutral', confident: false });
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
}).listen(3999, () => console.log('mock llm on 3999'));
