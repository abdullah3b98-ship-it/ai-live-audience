// اختبار شامل عبر المتصفح مع كاميرا وهمية + لقطات شاشة
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const SHOT = (n) => path.join(__dirname, '..', 'screenshots', n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// كاميرا وهمية من صورة (يد تمسك ريموت) — تُنشأ تلقائياً عبر ffmpeg إذا لم تكن موجودة
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'cam.y4m'))) require('child_process').execSync(`ffmpeg -y -loglevel error -loop 1 -i "${path.join(__dirname, 'c3.jpg')}" -t 4 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p" -r 10 "${path.join(__dirname, 'cam.y4m')}"`);
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + path.join(__dirname, 'cam.y4m'), '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'لا شي' : undefined));
  await p.goto(BASE + '/');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  // 1) تركيبة الجمهور: 15 بنت و5 أولاد
  await p.fill('[name=title]', 'بث تجريبي - فيفا');
  await p.fill('[name=game]', 'FIFA 25');
  await p.fill('[name=streamerName]', 'أبو سلطان');
  await p.click('text=عدد البنات والأولاد');
  await p.fill('[name=girls]', '15'); await p.fill('[name=boys]', '5');
  await p.click('text=كوّن الجمهور');
  await p.waitForSelector('.pgrid .pc');
  const stats = await p.locator('.stats').innerText();
  console.log('STATS:', stats.replace(/\n/g, ' | '));
  await p.fill('#tplName', '15 بنت و5 أولاد');
  await p.click('text=حفظ الإعدادات كقالب'); await sleep(500);
  await p.addStyleTag({ content: '.topbar{position:static!important}' }); await p.screenshot({ path: SHOT('01-setup-desktop.png'), fullPage: true });
  // 2) بدء البث
  await p.click('text=ابدأ البث');
  await p.waitForURL(/#\/live\/\d+/);
  const liveUrl = p.url();
  await p.click('text=📷 الكاميرا'); await sleep(9000);
  const fullShot = async (pg, file) => { await pg.addStyleTag({ content: '.topbar{position:static!important}' }); await pg.screenshot({ path: SHOT(file), fullPage: true }); };
  const say = async (t, wait = 5000) => { await p.fill('.chatbox input', t); await p.press('.chatbox input', 'Enter'); await sleep(wait); };
  await say('السلام عليكم يا جماعة كيفكم', 7000);
  await say('مره واحد محشش شاف مطب قال الشارع منتفخ ليش؟', 8000);
  await p.click('text=😵 خسرت / غلطت'); await sleep(6000);
  // مناداة شخصية موجودة
  const someone = await p.evaluate(async () => { const id = location.hash.split('/')[2]; const s = await (await fetch('/api/streams/' + id + '/state')).json(); const q = s.roster.find((r) => r.present && r.archetype.includes('نودي')) || s.roster.find((r) => r.present); return q.username; });
  console.log('CALLING:', someone);
  await say(`@${someone} وش رأيك باللعب اليوم؟`, 6000);
  await say('والله الحارس اليوم دلخ', 12000);
  await say('زقنبي يعني شخص مزعج وثقيل دم', 6000);
  // كشف الأشياء من الكاميرا (نموذج COCO-SSD في المتصفح)
  await p.click('text=🔍 كشف الأشياء');
  await p.waitForFunction(() => document.querySelector('.bbox') && document.querySelector('.bbox').style.display === 'block', null, { timeout: 60000 }).then(() => console.log('BBOX shown')).catch(() => console.log('no bbox'));
  await sleep(6000);
  await p.screenshot({ path: SHOT('02-live-desktop.png') });
  await say('هذا اسمه ريموت المكيف', 6000);
  // 3) الجمهور والإدارة
  await p.click('.tabs button:nth-child(2)'); await sleep(500);
  const first = p.locator('.pane.on .ritem .btn').first(); await first.click(); await sleep(300);
  await p.screenshot({ path: SHOT('03-moderation-menu.png') });
  await p.click('.pop >> text=🚪 طرد'); await sleep(1200);
  const roster = await p.locator('.pane.on').innerText();
  console.log('KICKED SECTION OK:', /مطرود/.test(roster));
  await p.click('.tabs button:nth-child(1)');
  // 4) الجوال
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await m.newPage(); await mp.goto(liveUrl); await sleep(6000);
  await mp.screenshot({ path: SHOT('04-live-mobile.png') });
  const mset = await m.newPage(); await mset.goto(BASE + '/'); await sleep(1200);
  await mset.screenshot({ path: SHOT('05-setup-mobile.png') });
  await m.close();
  // 5) إنهاء البث ومراجعته
  await p.click('text=⏹ إنهاء البث'); await p.waitForURL(/#\/stream\/\d+/); await sleep(1500);
  await p.screenshot({ path: SHOT('06-stream-review.png'), fullPage: false });
  // 6) الشخصيات والذاكرة والإعدادات
  await p.goto(BASE + '/#/personas'); await sleep(1200);
  await p.screenshot({ path: SHOT('07-personas.png') });
  await p.locator('.pgrid .pc').first().click(); await sleep(1200);
  await p.screenshot({ path: SHOT('08-persona-editor.png') });
  await p.goto(BASE + '/#/memory'); await sleep(1500);
  await p.screenshot({ path: SHOT('09-memory-dictionary.png') });
  await p.goto(BASE + '/#/settings'); await sleep(800);
  await p.screenshot({ path: SHOT('10-settings.png') });
  console.log('PAGE ERRORS:', errs);
  await b.close();
})();
