import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const recordings = path.join(root, 'submission/demo-media/recordings');
const screenshots = path.join(root, 'submission/screenshots');
const publicOrigin = process.env.RRFLOW_CAPTURE_PUBLIC_URL || 'http://localhost:3000';
const workspaceOrigin = process.env.RRFLOW_CAPTURE_WORKSPACE_URL || 'http://127.0.0.1:3102';
await mkdir(recordings, { recursive: true });
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = JSON.parse(await readFile(path.join(recordings, 'capture-manifest.json'), 'utf8').catch(() => '[]'));
const currentResults = [];
const pause = (page, ms) => page.waitForTimeout(ms);
const demoReady = async page => {
  await page.goto(`${publicOrigin}/demo`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('region', { name: 'Public learning evidence', exact: true }).waitFor({ timeout: 45_000 });
};
const shot = async (page, name) => {
  if (process.env.RRFLOW_CAPTURE_TAG) name = name.replace('.png', `-${process.env.RRFLOW_CAPTURE_TAG}.png`);
  const destination = path.join(screenshots, name);
  try { await access(destination); throw new Error(`Refusing to overwrite screenshot ${name}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await page.screenshot({ path: destination, animations: 'disabled' });
};
const capture = async (name, seconds, action, protectedView = false) => {
  if (process.env.RRFLOW_CAPTURE_ONLY && !name.startsWith(process.env.RRFLOW_CAPTURE_ONLY)) return;
  if (process.env.RRFLOW_CAPTURE_TAG) name += `-${process.env.RRFLOW_CAPTURE_TAG}`;
  const destination = path.join(recordings, `${name}.webm`);
  try { await access(destination); throw new Error(`Refusing to overwrite recording ${name}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: recordings, size: { width: 1920, height: 1080 } }, colorScheme: 'dark' });
  if (protectedView) await context.addInitScript(() => {
    const cover = () => {
      if (!document.documentElement) return false;
      const style = document.createElement('style'); style.id = 'recording-privacy-cover'; style.textContent = 'body{opacity:0!important}'; document.documentElement.append(style); return true;
    };
    if (!cover()) { const observer = new MutationObserver(() => { if (cover()) observer.disconnect(); }); observer.observe(document, { childList: true }); }
  });
  const page = await context.newPage();
  const start = Date.now();
  const evidence = { file: `${name}.webm`, requestedSeconds: seconds, capturedAt: new Date().toISOString(), recording: 'Actual local production UI at normal speed', protectedWorkspace: protectedView, status: 'pending', events: [] };
  try {
    const readyAt = await action(page, evidence);
    evidence.suggestedTrimStartSeconds = Math.round(((readyAt || start) - start) / 100) / 10;
    await pause(page, Math.max(1500, seconds * 1000 - (Date.now() - (readyAt || start))));
    evidence.status = 'captured';
  } catch (error) {
    evidence.status = 'failed'; evidence.error = error.message.split('\n')[0];
    console.error(`${name}: ${evidence.error}`);
  } finally {
    evidence.durationSeconds = Math.round((Date.now() - start) / 100) / 10;
    const video = page.video();
    await context.close();
    await video.saveAs(destination);
    await video.delete();
    results.push(evidence);
    currentResults.push(evidence);
    await writeFile(path.join(recordings, 'capture-manifest.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(evidence));
  }
};

try {
  await Promise.all([
    capture('01-entry', 20, async (page, evidence) => {
      await page.goto(publicOrigin, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Explore the demo', exact: true }).waitFor({ timeout: 30_000 });
      const ready = Date.now(); await pause(page, 5000);
      await shot(page, '16-public-event-entrance.png');
      await page.getByRole('link', { name: 'Explore the demo', exact: true }).click();
      await page.getByRole('region', { name: 'Published demo event' }).waitFor();
      await pause(page, 4000);
      evidence.events.push('Public entrance and actual event countdown; curated data disclosure; no login performed.');
      return ready;
    }),
    capture('02-source-preview', 37, async (page, evidence) => {
      await demoReady(page); const ready = Date.now();
      const card = page.getByRole('region', { name: 'Shippin work', exact: true }).getByRole('button').filter({ hasText: 'RRFLOW: the public project overview' });
      await card.scrollIntoViewIfNeeded(); await pause(page, 3000); await card.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: 'Why this placement?' }).waitFor();
      await shot(page, '17-public-source-placement.png'); await pause(page, 7000);
      const sourceUrl = await dialog.getByRole('link', { name: 'Read the original source' }).getAttribute('href');
      if (!sourceUrl?.startsWith('https://github.com/EonsofStupid/rrflow-hydradb/')) throw new Error('Expected explicitly public repository provenance.');
      evidence.publicSource = sourceUrl;
      await dialog.getByRole('button', { name: 'Needs your judgment', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Preview moved to Needs your judgment' }).waitFor(); await pause(page, 6000);
      await page.getByRole('region', { name: 'Needs your judgment', exact: true }).getByRole('button').filter({ hasText: 'RRFLOW: the public project overview' }).click();
      await pause(page, 3000); await page.getByRole('dialog').getByRole('button', { name: 'Shippin work', exact: true }).click();
      await pause(page, 6000);
      evidence.events.push('Opened public source, native curated placement explanation and pinned provenance link; moved preview to review then Shippin. Preview only, no saved-workspace claim.');
      return ready;
    }),
    capture('04-learning-evidence', 48, async (page, evidence) => {
      await demoReady(page); const ready = Date.now();
      const learning = page.getByRole('region', { name: 'Public learning evidence', exact: true });
      await learning.scrollIntoViewIfNeeded(); await pause(page, 5000);
      await shot(page, '18-public-learning-evidence.png');
      for (const label of ['Inspect the failed GitHub run', 'Read the source assertion', 'Inspect the passing GitHub run']) {
        const link = learning.getByRole('link', { name: label, exact: true });
        await link.hover(); await pause(page, 8500);
        evidence.events.push({ label, url: await link.getAttribute('href') });
      }
      evidence.events.push('Actual public curated failure/correction/follow-up evidence shown; links exposed, no generated results or causation claim.');
      return ready;
    }),
  ]);
  await Promise.all([
    capture('03-protected-work-graph', 30, async (page, evidence) => {
      await page.goto(`${workspaceOrigin}/workspace`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Connectome', exact: true }).click();
      const map = page.getByRole('region', { name: 'Living connectome' });
      await map.getByRole('button', { name: 'Shippin context', exact: true }).click();
      await page.getByRole('button', { name: 'Inspect TypeScript', exact: true }).waitFor({ timeout: 45_000 });
      await page.addStyleTag({ content: 'section[aria-label="Living connectome"] > div:last-of-type {display:none!important}' });
      await map.getByRole('region', { name: 'Knowledge relationship graph', exact: true }).evaluate(element => element.scrollIntoView({ block: 'center' }));
      await page.evaluate(() => {
        document.getElementById('recording-privacy-cover')?.remove();
        const label = document.createElement('div'); label.textContent = 'Owner workspace · Shippin engineering knowledge · local production recording';
        Object.assign(label.style, { position: 'fixed', left: '24px', bottom: '22px', zIndex: '99999', background: '#14221d', color: '#d8eee1', padding: '12px 18px', border: '1px solid #699d82', borderRadius: '10px', font: '14px system-ui' }); document.body.append(label);
      });
      const ready = Date.now();
      evidence.cues = [{ seconds: 0, action: 'Shippin native relationship graph visible.' }];
      const cue = action => evidence.cues.push({ seconds: Math.round((Date.now() - ready) / 100) / 10, action });
      await pause(page, 4000); await shot(page, '19-protected-shippin-graph.png');
      await page.getByRole('button', { name: 'Inspect TypeScript', exact: true }).click();
      await page.getByRole('dialog').getByRole('link', { name: 'Open original research' }).waitFor();
      cue('TypeScript source dialog loaded with original research link.');
      await shot(page, '22-protected-typescript-source.png');
      await pause(page, 9000);
      await page.keyboard.press('Escape'); cue('Returned to native relationship graph.'); await pause(page, 4000);
      await page.getByRole('button', { name: 'Zoom into relationships' }).click(); cue('Zoom control used.'); await pause(page, 2000);
      await page.getByRole('button', { name: 'Fit all relationships' }).click(); cue('Fit all relationships control used.');
      evidence.authentication = 'Local owner exception, not a password-authenticated hosted session';
      evidence.events.push('Actual Shippin scope selected under a privacy cover before reveal; latest-context card list hidden; TypeScript graph node opened actual native research details. No password recorded and no placement saved.');
      return ready;
    }, true),
    capture('05-native-hydra-receipt', 22, async (page, evidence) => {
      await demoReady(page); const ready = Date.now();
      await page.getByText('Inspect this read', { exact: true }).click();
      await page.locator('footer').scrollIntoViewIfNeeded(); await pause(page, 4000);
      const receipt = await page.locator('footer code').innerText();
      if (!receipt || receipt.includes('No native request')) throw new Error('Native HydraDB request receipt not available.');
      evidence.nativeRequestId = receipt;
      await shot(page, '20-public-hydradb-receipt.png');
      evidence.events.push('Actual public snapshot read receipt and updated time. HydraDB only; no Raindrop acceptance was claimed or simulated.');
      return ready;
    }),
    capture('06-close', 15, async (page, evidence) => {
      await demoReady(page); const ready = Date.now();
      await page.getByRole('region', { name: 'Published demo event' }).scrollIntoViewIfNeeded();
      await pause(page, 3000); await shot(page, '21-public-event-countdown.png');
      evidence.events.push('Actual event countdown and curated knowledge map; editor adds verified deployment URL only after deployment succeeds.');
      return ready;
    }),
  ]);
} finally { await browser.close(); }
if (currentResults.some(result => result.status !== 'captured')) process.exitCode = 1;
