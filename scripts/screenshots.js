const puppeteer = require('puppeteer');
const path = require('path');

const GRAFANA_URL = 'http://localhost:53904';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

async function login(page) {
  await page.goto(`${GRAFANA_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type('input[name="user"]', 'admin');
  await page.type('input[name="password"]', 'admin');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForResponse(r => r.url().includes('/api/login') && r.status() === 200).catch(() => {}),
  ]);
  await new Promise(r => setTimeout(r, 3000));
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await login(page);

  // 1. Dashboard overview
  console.log('Capturing dashboard overview...');
  await page.goto(`${GRAFANA_URL}/d/k8s-cluster-overview/kubernetes-cluster-overview`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'cluster-overview.png') });

  // 2. Panel menu with Extensions submenu
  console.log('Capturing panel menu extension...');
  const cpuPanel = await page.$('[data-viz-panel-key="panel-7"]');
  if (cpuPanel) {
    await cpuPanel.hover();
    await new Promise(r => setTimeout(r, 800));
    const menuBtn = await cpuPanel.$('button[aria-label*="Menu for panel"]');
    if (menuBtn) {
      await menuBtn.click();
      await new Promise(r => setTimeout(r, 800));
      // Hover Extensions submenu
      const menuItems = await page.$$('[role="menuitem"]');
      for (const item of menuItems) {
        const text = await item.evaluate(el => el.textContent?.trim());
        if (text === 'Extensions') {
          await item.hover();
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      }
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'panel-menu-extension.png') });
    }
  }

  // 3. Plugin analyze page
  console.log('Capturing plugin analyze page...');
  await page.goto(`${GRAFANA_URL}/a/tamcore-llmanalysis-app/analyze`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'plugin-analyze.png') });

  // 4. Plugin config page
  console.log('Capturing plugin config page...');
  await page.goto(`${GRAFANA_URL}/plugins/tamcore-llmanalysis-app`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'plugin-config.png') });

  // 5. More apps sidebar showing LLM Analysis
  console.log('Capturing sidebar...');
  await page.goto(`${GRAFANA_URL}/`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const moreApps = await page.$('[aria-label*="More apps"]');
  if (moreApps) {
    await moreApps.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sidebar-llm.png') });
  }

  await browser.close();
  console.log('All screenshots captured!');
})().catch(e => { console.error(e); process.exit(1); });
