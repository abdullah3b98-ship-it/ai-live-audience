// اختبار المتصفح للنسخة المبسطة: دخول بكلمة مرور، بدء بث بضغطة، دخول الجمهور تدريجياً، الكاميرا والرؤية، مشاركة الشاشة، الصوت لا يظهر
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const PASS = process.env.APP_PASSWORD || '';
const OUT = process.env.SHOTS || path.join(__dirname, '..', 'screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cam = path.join(__dirname, 'cam.y4m');
if (!fs.existsSync(cam)) require('child_process').execSync(`ffmpeg -y -loglevel error -loop 1 -i "${path.join(__dirname, 'c3.jpg')}" -t 4 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p" -r 10 "${cam}"`);
const results = {};
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + cam, '--auto-select-desktop-capture-source=Entire screen', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 820 }, permissions: ['camera', 'microphone'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/');
  if (PASS) { await p.waitForSelector('input[name=password]'); await p.fill('input[name=password]', PASS); await p.click('button'); }
  await p.waitForSelector('#startBtn');
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#startBtn');
  await p.fill('[name=streamerName]', 'أبو سلطان'); await p.fill('[name=game]', 'FIFA 25');
  await p.click('.chip >> text=20');
  results.emojiInNav = await p.evaluate(() => /[\u{1F300}-\u{1FAFF}]/u.test(document.querySelector('#nav').textContent));
  results.svgIcons = await p.locator('svg.ic').count();
  await p.screenshot({ path: path.join(OUT, '01-setup-desktop.png') });
  // ابدأ مباشرة بدون تكوين يدوي
  await p.click('#startBtn');
  await p.waitForURL(/#\/live\/\d+/, { timeout: 30000 });
  const counts = [];
  for (const t of [2, 6, 12, 20]) { await sleep(t * 1000 - (counts.length ? [2, 6, 12, 20][counts.length - 1] * 1000 : 0)); counts.push(+(await p.locator('.ov-top .pill b').innerText())); }
  results.viewerCounts = counts;
  results.joinLines = await p.locator('.msg.join').count();
  results.personaMsgs = await p.locator('#chat .msg:not(.join):not(.system):not(.streamer)').count();
  // الكاميرا + الرؤية التلقائية
  await p.click('.controls >> text=الكاميرا'); await sleep(3000);
  results.visionPill = await p.locator('.ov-top .pill[title*="يشوف"]').isVisible();
  results.bbox = await p.waitForFunction(() => document.querySelector('.bbox')?.style.display === 'block', null, { timeout: 60000 }).then(() => true).catch(() => false);
  await sleep(8000);
  await p.screenshot({ path: path.join(OUT, '02-live-desktop.png') });
  // الكلام بالصوت لا يظهر (نرسل رسالة voice مباشرة عبر اتصال ثاني بنفس الكوكي)
  const id = +p.url().split('/').pop();
  const cookies = await ctx.cookies(); const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const WebSocket = require('ws');
  await new Promise((res) => { const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws?stream=' + id, { headers: { cookie } }); ws.on('open', () => { ws.send(JSON.stringify({ type: 'voice', text: 'الو الو تجربة' })); setTimeout(() => { ws.close(); res(); }, 4000); }); ws.on('error', (e) => { results.wsCookieErr = e.message; res(); }); });
  results.voiceShown = await p.locator('#chat >> text=الو الو تجربة').count();
  // مشاركة الشاشة
  await p.click('.controls >> text=مشاركة الشاشة'); await sleep(3000);
  results.screenShare = await p.evaluate(() => { const v = document.querySelector('.video-wrap video'); const t = v.srcObject && v.srcObject.getVideoTracks()[0]; return { screenClass: v.classList.contains('screen'), track: t ? t.label : null, live: t ? t.readyState : null }; });
  // قائمة المزيد
  await p.click('.controls button[title="المزيد"]'); await sleep(400);
  results.moreItems = await p.locator('.pop .btn').allInnerTexts();
  await p.keyboard.press('Escape'); await p.mouse.click(5, 300);
  results.personaMsgsAfter = await p.locator('#chat .msg:not(.join):not(.system):not(.streamer)').count();
  // جوال
  const mp = await ctx.newPage(); await mp.setViewportSize({ width: 390, height: 844 });
  await mp.goto(BASE + '/#/live/' + id); await sleep(5000);
  await mp.screenshot({ path: path.join(OUT, '03-live-mobile.png') });
  await mp.goto(BASE + '/#/'); await sleep(1500);
  await mp.screenshot({ path: path.join(OUT, '04-setup-mobile.png') });
  results.pageErrors = errs;
  console.log(JSON.stringify(results, null, 1));
  await b.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
