const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  for (const r of ['/', '/#/personas', '/#/streams', '/#/memory', '/#/settings']) { await p.goto('http://localhost:3000' + r); await p.waitForTimeout(800); }
  console.log('errors:', errs);
  await b.close();
})();
