const puppeteer = require('puppeteer');
const path = require('path');

const BASE = 'http://localhost:53904';
const DIR = path.join(__dirname, '..', 'docs', 'screenshots');

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.type('input[name="user"]', 'admin');
  await page.type('input[name="password"]', 'admin');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForResponse(r => r.url().includes('/api/login') && r.status() === 200).catch(() => {}),
  ]);
  await new Promise(r => setTimeout(r, 3000));
}

async function waitForChatResponse(page, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const streaming = await page.evaluate(() => {
      const btns = document.querySelectorAll('button[type="submit"]');
      for (const b of btns) {
        if (b.textContent?.includes('Thinking') || b.textContent?.includes('Analyzing')) return true;
      }
      return false;
    });
    if (!streaming) {
      // Double-check there's actual assistant content
      const hasContent = await page.evaluate(() => {
        const msgs = document.querySelectorAll('[data-role="assistant"]');
        for (const m of msgs) {
          if (m.textContent && m.textContent.length > 30) return true;
        }
        return false;
      });
      if (hasContent) return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await login(page);

  // 1. Cluster overview dashboard with real data
  console.log('1. Dashboard overview...');
  await page.goto(`${BASE}/d/k8s-cluster-overview/kubernetes-cluster-overview`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(DIR, 'cluster-overview.png') });
  console.log('   Done');

  // 2. Panel menu extension
  console.log('2. Panel menu extension...');
  const cpuPanel = await page.$('[data-viz-panel-key="panel-7"]');
  if (cpuPanel) {
    await cpuPanel.hover();
    await new Promise(r => setTimeout(r, 800));
    const menuBtn = await cpuPanel.$('button[aria-label*="Menu for panel"]');
    if (menuBtn) {
      await menuBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const items = await page.$$('[role="menuitem"]');
      for (const item of items) {
        const t = await item.evaluate(el => el.textContent?.trim());
        if (t === 'Extensions') { await item.hover(); await new Promise(r => setTimeout(r, 1000)); break; }
      }
      await page.screenshot({ path: path.join(DIR, 'panel-menu-extension.png') });
    }
    await page.keyboard.press('Escape');
  }
  console.log('   Done');

  // 3. Analyze page with a REAL LLM conversation
  console.log('3. Analyze page with real LLM response...');
  await page.goto(`${BASE}/a/tamcore-llmanalysis-app/analyze`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  // Fill in context JSON with real cluster data
  const contextJson = JSON.stringify({
    panel: {
      title: "Cluster CPU Usage",
      queries: ["sum(rate(node_cpu_seconds_total{mode!='idle'}[5m])) / sum(rate(node_cpu_seconds_total[5m])) * 100"],
      fields: ["Time", "Value"],
      data: [["2026-03-29T10:00:00Z", "23.5"], ["2026-03-29T10:05:00Z", "27.1"], ["2026-03-29T10:10:00Z", "31.8"], ["2026-03-29T10:15:00Z", "45.2"], ["2026-03-29T10:20:00Z", "38.7"]],
      timeRange: { from: "now-1h", to: "now" }
    }
  });

  // Clear and fill the textarea
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.click({ clickCount: 3 });
    await textarea.type(contextJson);
  }

  const promptInput = await page.$('input[placeholder*="What does"]');
  if (promptInput) {
    await promptInput.type('Analyze this CPU usage pattern. Is the spike at 10:15 concerning?');
  }

  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    console.log('   Waiting for LLM response...');
    await waitForChatResponse(page, 60000);
    await new Promise(r => setTimeout(r, 2000));
  }
  await page.screenshot({ path: path.join(DIR, 'plugin-analyze.png') });
  console.log('   Done');

  // 4. Dashboard Chat — the new feature!
  console.log('4. Dashboard Chat with real LLM response...');
  await page.goto(`${BASE}/a/tamcore-llmanalysis-app/dashboard-chat`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  // Select the cluster overview dashboard
  const dashSelect = await page.$('[class*="grafana-select"]') || await page.$('input[aria-autocomplete]');
  if (dashSelect) {
    await dashSelect.click();
    await new Promise(r => setTimeout(r, 500));
    // Type to search
    await page.keyboard.type('Kubernetes');
    await new Promise(r => setTimeout(r, 1000));
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 3000));
  }

  // Check if dashboard loaded (look for the welcome message)
  const welcomeMsg = await page.evaluate(() => {
    const msgs = document.querySelectorAll('[data-role="assistant"]');
    for (const m of msgs) {
      if (m.textContent?.includes('Loaded')) return m.textContent;
    }
    return null;
  });
  console.log('   Dashboard loaded:', welcomeMsg ? 'yes' : 'no');

  // Type a question
  const chatInput = await page.$('input[placeholder*="Ask about"]') || await page.$('input:not([disabled])');
  if (chatInput) {
    await chatInput.type('What are the main metrics being monitored? Any panels that could indicate issues?');
    const sendBtn = await page.$('button[type="submit"]:not([disabled])');
    if (sendBtn) {
      await sendBtn.click();
      console.log('   Waiting for LLM response...');
      await waitForChatResponse(page, 60000);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  await page.screenshot({ path: path.join(DIR, 'dashboard-chat.png') });
  console.log('   Done');

  // 5. Plugin configuration page
  console.log('5. Plugin config...');
  await page.goto(`${BASE}/plugins/tamcore-llmanalysis-app`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(DIR, 'plugin-config.png') });
  console.log('   Done');

  await browser.close();
  console.log('\nAll screenshots captured!');
})().catch(e => { console.error(e); process.exit(1); });
