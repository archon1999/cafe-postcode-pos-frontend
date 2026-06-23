const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const login = await fetch('http://127.0.0.1:8000/api/v1/pos/auth/pin-login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_id: 'bf4e5bb4-fc17-486a-b332-f67fc75af5f0', pin: '6221' }),
  }).then((r) => r.json());

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2048, height: 1024 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4200/pin-login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    localStorage.setItem('pos.session.v1', JSON.stringify({
      token: session.token,
      user: session.user,
      restaurantContext: session.restaurantContext,
    }));
    localStorage.setItem('pos.theme.v1', 'light');
    localStorage.setItem('pos.locale.v1', 'uz');
  }, login);
  await page.goto('http://127.0.0.1:4200/cashier/builder', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'output/playwright/light-mode/cashier-builder-light.png', fullPage: true });
  const colors = await page.evaluate(() => {
    const sample = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = getComputedStyle(el);
      return { backgroundColor: style.backgroundColor, color: style.color, boxShadow: style.boxShadow };
    };
    return {
      body: getComputedStyle(document.body).backgroundImage,
      tab: sample('button'),
      menuCard: sample('[role="button"]'),
      rightPanel: sample('main > div > div > div:nth-child(2)'),
    };
  });
  console.log(JSON.stringify(colors, null, 2));
  await browser.close();
})();
