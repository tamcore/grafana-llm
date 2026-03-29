const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = process.env.GRAFANA_URL || 'https://grafana.85.215.177.78.nip.io';
const USER = 'admin';
const PASS = 'admin';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const PAGES = [
  {
    name: 'cluster-overview',
    path: '/d/bfhgtzow3ug3ka/kubernetes-cluster-overview?orgId=1&kiosk',
    width: 1600,
    height: 1000,
    delay: 8000,
  },
  {
    name: 'node-metrics',
    path: '/d/afhgu1eiunkzke/node-metrics-deep-dive?orgId=1&kiosk',
    width: 1600,
    height: 1200,
    delay: 8000,
  },
  {
    name: 'pod-workloads',
    path: '/d/efhgu2yrfuubkc/pod-and-workload-metrics?orgId=1&kiosk',
    width: 1600,
    height: 1100,
    delay: 8000,
  },
  {
    name: 'plugin-config',
    path: '/a/tamcore-llmanalysis-app/?tab=configuration',
    width: 1280,
    height: 800,
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

  await browser.close();
  console.log('Done!');
})();
