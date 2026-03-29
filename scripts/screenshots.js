const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = process.env.GRAFANA_URL || 'https://grafana.85.215.177.78.nip.io';
const USER = 'admin';
const PASS = 'admin';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const PAGES = [
  {
    name: 'cluster-overview',
    path: '/d/k8s-cluster-overview/kubernetes-cluster-overview?orgId=1&from=now-3h&to=now&kiosk',
    width: 1600,
    height: 1000,
    delay: 15000,
  },
  {
    name: 'node-metrics',
    path: '/d/node-metrics/node-metrics-deep-dive?orgId=1&from=now-3h&to=now',
    width: 1600,
    height: 900,
    delay: 15000,
  },
  {
    name: 'pod-workloads',
    path: '/d/pod-workloads/pod-and-workload-metrics?orgId=1&from=now-3h&to=now',
    width: 1600,
    height: 900,
    delay: 15000,
  },
  {
    name: 'plugin-config',
    path: '/plugins/tamcore-llmanalysis-app',
    width: 1280,
    height: 960,
    delay: 4000,
  },
  {
    name: 'plugin-analyze',
    path: '/a/tamcore-llmanalysis-app',
    width: 1280,
    height: 800,
    delay: 4000,
  },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const page = await browser.newPage();

  // Login
  console.log('Logging in…');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.type('input[name="user"]', USER);
  await page.type('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  // Dismiss any welcome/news modals
  await page.evaluate(() => {
    document.querySelectorAll('[aria-label="Close"]').forEach((el) => el.click());
    document.querySelectorAll('button').forEach((btn) => {
      if (btn.textContent.includes('Skip')) btn.click();
    });
  });
  await new Promise((r) => setTimeout(r, 1000));

  for (const entry of PAGES) {
    console.log(`Capturing ${entry.name}…`);
    await page.setViewport({ width: entry.width, height: entry.height });
    await page.goto(`${BASE_URL}${entry.path}`, { waitUntil: 'networkidle2', timeout: 30000 });
    // Wait for panels to render
    await new Promise((r) => setTimeout(r, entry.delay));
    // Dismiss modals again
    await page.evaluate(() => {
      document.querySelectorAll('[aria-label="Close"]').forEach((el) => el.click());
    });
    await new Promise((r) => setTimeout(r, 500));
    const outPath = path.join(OUT_DIR, `${entry.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`  → ${outPath}`);
  }

  // Capture panel menu extension screenshot
  console.log('Capturing panel-menu-extension…');
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(`${BASE_URL}/d/k8s-cluster-overview/kubernetes-cluster-overview?orgId=1`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 10000));

  try {
    // Find and click the panel menu button (kebab icon) for "Cluster CPU Usage"
    const menuBtn = await page.$('[data-testid="data-testid Panel menu Cluster CPU Usage"]');
    if (menuBtn) {
      await menuBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      // Look for "More..." or "Extensions" submenu to find our link
      const moreBtn = await page.evaluateHandle(() => {
        const items = document.querySelectorAll('[role="menuitem"]');
        for (const item of items) {
          if (item.textContent.includes('More') || item.textContent.includes('Extension')) {
            return item;
          }
        }
        return null;
      });

      if (moreBtn && moreBtn.asElement()) {
        await moreBtn.asElement().click();
        await new Promise((r) => setTimeout(r, 1000));
      }
    } else {
      // Fallback: find any panel menu trigger
      const allMenuBtns = await page.$$('[aria-label="Menu for panel"]');
      if (allMenuBtns.length > 0) {
        await allMenuBtns[0].click();
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    await page.screenshot({
      path: path.join(OUT_DIR, 'panel-menu-extension.png'),
      fullPage: false,
    });
    console.log('  → panel-menu-extension.png');
  } catch (err) {
    console.log('  ⚠ Could not capture panel menu:', err.message);
  }

  await browser.close();
  console.log('Done!');
})();
