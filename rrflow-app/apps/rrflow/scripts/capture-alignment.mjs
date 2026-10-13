import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(process.env.RRFLOW_SCREENSHOT_URL || 'http://127.0.0.1:3100');
  await page.getByRole('button', { name: 'Context inbox', exact: true }).click();
  await page.getByRole('region', { name: 'Context organization' }).getByText(/items in this sample/).waitFor();
  await page.evaluate(() => { document.documentElement.classList.add('dark'); window.scrollTo(0, 0); });
  await page.screenshot({ path: '../../../submission/screenshots/13-context-inbox-live.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Learning trail', exact: true }).click();
  await page.getByRole('heading', { name: /For failure-state UI checks/ }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../../../submission/screenshots/14-learning-trail-live.png', animations: 'disabled' });
  const trail = page.getByRole('region', { name: 'Learning trail' });
  const failure = trail.locator('article').filter({ has: page.locator('header') }).filter({ hasText: '435647cd' });
  await failure.getByText('Where does the evidence schema come from?', { exact: true }).click();
  await failure.locator('summary').filter({ hasText: 'Playwright sync, connector, and refresh checks' }).click();
  await failure.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../../../submission/screenshots/15-learning-rule-evidence-live.png', animations: 'disabled' });
  console.log(JSON.stringify({ captured: 3, sourceTitlesHidden: true, learning: 'native CI imports and reviewed lesson' }));
} finally { await browser.close(); }
