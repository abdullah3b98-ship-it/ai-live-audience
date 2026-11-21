const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/#/personas'); await p.waitForTimeout(1000); await p.locator('.pgrid .pc').first().click(); await p.waitForTimeout(800);
  await p.goto('http://localhost:3000/#/memory'); await p.waitForTimeout(1500);
  console.log('modal left open:', await p.locator('.modal-bg').count());
  await p.screenshot({ path: path.join(__dirname, '..', 'screenshots', '09-memory-dictionary.png') });
  await b.close();
})();
