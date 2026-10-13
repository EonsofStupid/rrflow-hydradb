import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const directory = path.join(root, 'submission/demo-media/recordings/lifecycle');
const origin = process.env.RRFLOW_CAPTURE_WORKSPACE_URL || 'http://127.0.0.1:3100';
const repository = 'EonsofStupid/rrflow-hydradb';
const placementKey = 'f579a1b18e9bcf5ff0fb63f7ffc2be920dd9f4701fc948c587f2e0fb18f24a92';
const placementTitle = `${repository} / rrflow-app/apps/rrflow/src/lib/access.ts`;
await mkdir(directory, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8').catch(() => '[]'));
const current = [];
const browser = await chromium.launch({ headless: true });
const hold = (page, seconds) => page.waitForTimeout(seconds * 1000);
const navigate = async (page, title, endpoint) => {
  const response = page.waitForResponse(value => new URL(value.url()).pathname === endpoint && !new URL(value.url()).search && value.request().method() === 'GET', { timeout: 60_000 });
  await page.getByRole('button', { name: title, exact: true }).click();
  const result = await response;
  if (!result.ok()) throw new Error(`${endpoint} returned HTTP ${result.status()}`);
  return result.json();
};
const isolateSection = async (page, label) => page.addStyleTag({ content: `main > :not(.page-heading):not(section[aria-label="${label}"]){display:none!important}` });
const capture = async (name, usableSeconds, action) => {
  if (process.env.RRFLOW_CAPTURE_ONLY && !process.env.RRFLOW_CAPTURE_ONLY.split(',').some(prefix => name.startsWith(prefix))) return;
  const tag = process.env.RRFLOW_CAPTURE_TAG ? `-${process.env.RRFLOW_CAPTURE_TAG}` : '';
  const destination = path.join(directory, `${name}${tag}.webm`);
  try { await access(destination); throw new Error(`Refusing to overwrite ${name}${tag}.webm`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: directory, size: { width: 1920, height: 1080 } }, colorScheme: 'dark' });
  await context.addInitScript(() => {
    const install = () => { if (!document.documentElement) return false; const style = document.createElement('style'); style.id = 'capture-privacy-cover'; style.textContent = 'body{opacity:0!important}'; document.documentElement.append(style); return true; };
    if (!install()) { const observer = new MutationObserver(() => { if (install()) observer.disconnect(); }); observer.observe(document, { childList: true }); }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const began = Date.now();
  let readyAt = null;
  const evidence = { file: path.basename(destination), capturedAt: new Date().toISOString(), usableSeconds, status: 'pending', authentication: 'Local owner exception; actual production app and cloud services', privacy: 'Personal content covered before navigation; unrelated source regions hidden before reveal', cues: [], native: {}, writes: [] };
  const cue = action => evidence.cues.push({ seconds: Math.round((Date.now() - readyAt) / 100) / 10, action });
  const reveal = async () => { await page.evaluate(() => document.getElementById('capture-privacy-cover')?.remove()); readyAt = Date.now(); cue('Actual safe workspace view revealed; two-second editing handle.'); await hold(page, 2); };
  const shot = async suffix => { await hold(page, 0.4); const file = `${name}${tag}-${suffix}.png`; await page.screenshot({ path: path.join(directory, file) }); evidence.screenshots ??= []; evidence.screenshots.push(file); };
  try {
    await page.goto(`${origin}/workspace`, { waitUntil: 'domcontentloaded' });
    await page.getByText('HydraDB connected', { exact: true }).waitFor({ timeout: 45_000 });
    await action({ page, evidence, cue, reveal, shot });
    if (!readyAt) throw new Error('Capture never revealed an approved view.');
    await hold(page, Math.max(2, usableSeconds + 4 - (Date.now() - readyAt) / 1000));
    evidence.status = 'captured';
    evidence.suggestedTrimStartSeconds = Math.round(((readyAt - began) / 1000 + 2) * 10) / 10;
  } catch (error) { evidence.status = 'failed'; evidence.error = error.message.slice(0, 2000); }
  finally {
    evidence.durationSeconds = Math.round((Date.now() - began) / 100) / 10;
    const video = page.video(); await context.close(); await video.saveAs(destination); await video.delete();
    manifest.push(evidence); current.push(evidence);
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify(evidence));
  }
};

try {
  await Promise.all([
    capture('01-native-graph', 37, async ({ page, evidence, cue, reveal, shot }) => {
      await page.getByRole('button', { name: 'Connectome', exact: true }).click();
      const map = page.getByRole('region', { name: 'Living connectome' });
      await map.getByRole('button', { name: 'Shippin context', exact: true }).click();
      const graph = map.getByRole('region', { name: 'Knowledge relationship graph', exact: true });
      await expect(graph.locator('.react-flow__edge')).toHaveCount(7, { timeout: 45_000 });
      await page.addStyleTag({ content: 'section[aria-label="Living connectome"] > div:last-of-type{display:none!important}' });
      await graph.scrollIntoViewIfNeeded(); await reveal(); await shot('graph'); await hold(page, 5);
      await graph.getByRole('button', { name: 'Inspect TypeScript', exact: true }).click();
      const dialog = page.getByRole('dialog'); await dialog.getByRole('link', { name: 'Open original research' }).waitFor();
      cue('Actual TypeScript research and original source pointer loaded.');
      evidence.native = { nodes: 6, relationships: 7, originalSourcePointer: await dialog.getByRole('link', { name: 'Open original research' }).getAttribute('href'), sourcePointerOpenedExternally: false };
      await shot('typescript'); await hold(page, 5);
      await dialog.locator('summary').filter({ hasText: 'Configuration and Toolchain' }).click(); cue('Opened actual Configuration and Toolchain research questions.'); await shot('avenue'); await hold(page, 8);
      await page.keyboard.press('Escape'); cue('Returned to relationship graph.');
      await graph.getByRole('button', { name: 'Inspect relationship: TypeScript builds on Engineering core', exact: true }).focus(); await page.keyboard.press('Enter'); cue('Inspected recorded TypeScript to Engineering core direction.'); await hold(page, 5);
      await graph.getByRole('button', { name: 'Zoom into relationships' }).click(); await hold(page, 2); await graph.getByRole('button', { name: 'Fit all relationships' }).click(); cue('Real zoom and fit controls.');
    }),
    capture('02-cloud-work-source', 35, async ({ page, evidence, cue, reveal, shot }) => {
      const snapshot = await navigate(page, 'Connections', '/api/qdrant');
      const work = snapshot.sources.find(source => source.scope === 'work');
      if (!work?.connected || !work.points.every(point => point.sourceUrl?.startsWith(`https://github.com/${repository}/`))) throw new Error('Work sources are unavailable or not verified public repository documents.');
      await isolateSection(page, 'Qdrant source libraries');
      await page.addStyleTag({ content: 'article[aria-label="Personal Qdrant source"]{display:none!important}' });
      const card = page.getByRole('article', { name: 'Work Qdrant source' }); await card.scrollIntoViewIfNeeded();
      evidence.native = { scope: work.scope, database: work.database, collection: work.collection, location: work.location, connected: work.connected, points: work.points.map(point => ({ id: point.id, title: point.title, sourceUrl: point.sourceUrl, hydraId: point.hydraId, indexingStatus: point.indexingStatus })) };
      await reveal(); await shot('destination'); await hold(page, 6);
      await card.locator('summary').filter({ hasText: 'Read source and provenance' }).first().click(); cue('Expanded the actual public Work document and source provenance.'); await shot('provenance'); await hold(page, 12);
      await card.getByRole('link', { name: 'Open original public document' }).first().hover(); cue('Public original document pointer shown; fixed HydraDB Work destination retained.'); await hold(page, 6);
      await card.locator('summary').filter({ hasText: 'Read source and provenance' }).first().click(); cue('Returned to actual indexing status and last import times.');
    }),
    capture('03-code-sync', 40, async ({ page, evidence, cue, reveal, shot }) => {
      const snapshot = await navigate(page, 'Connections', '/api/repository-sync');
      if (!snapshot.state) throw new Error('No native workflow checkpoint.');
      const state = snapshot.state; evidence.native = { commit: state.commit, phase: state.phase, total: state.total, searchable: state.searchable, completed: state.completed, runUrl: state.runUrl, raindrop: state.raindrop, requestIds: state.requestIds };
      await isolateSection(page, 'GitHub knowledge sync'); const panel = page.getByRole('region', { name: 'GitHub knowledge sync' }); await panel.scrollIntoViewIfNeeded();
      await reveal(); await shot('checkpoint'); await hold(page, 7);
      await panel.getByRole('link', { name: 'Open GitHub sync workflow' }).hover(); cue('Pinned actual GitHub workflow link and native checkpoint shown.'); await hold(page, 7);
      const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/repository-sync'); await panel.getByRole('button', { name: 'Check sync now' }).click(); await response; await panel.getByRole('button', { name: 'Check sync now' }).waitFor(); cue('Read-only native checkpoint refresh completed.'); await hold(page, 5);
      await panel.locator('summary').filter({ hasText: 'Sync evidence and native request IDs' }).click(); cue('Expanded actual source-sync request IDs and accepted Raindrop event.'); await shot('evidence');
    }),
  ]);
  await Promise.all([
    capture('04-development-learning', 48, async ({ page, evidence, cue, reveal, shot }) => {
      const snapshot = await navigate(page, 'Learning trail', '/api/learning');
      if (!snapshot.evidence.every(run => run.repository === repository)) throw new Error('Learning view contains unapproved repository evidence.');
      await page.addStyleTag({ content: 'section[aria-label="Learning trail"] aside > section:nth-child(2){display:none!important}' });
      const trail = page.getByRole('region', { name: 'Learning trail', exact: true });
      const latest = trail.locator('article').filter({ hasText: 'Captured automatically from CI' }).first();
      await latest.scrollIntoViewIfNeeded(); await reveal(); await shot('automatic-ci'); await hold(page, 6);
      const latestEvidence = snapshot.evidence.find(run => run.capture.mode === 'automatic-ci');
      evidence.native = { evidenceId: latestEvidence.id, commit: latestEvidence.commit, runUrl: latestEvidence.runUrl, captureMode: latestEvidence.capture.mode, schema: latestEvidence.schema };
      await latest.locator('summary').filter({ hasText: 'Where does the evidence schema come from?' }).click(); cue('Opened versioned evidence schema and SHA-256.'); await shot('schema'); await hold(page, 8);
      const check = latest.locator('summary').filter({ hasText: 'React Flow graph inspects returned relationships' }); await check.click(); await check.scrollIntoViewIfNeeded(); cue('Opened actual passing graph regression check and pinned source assertion.'); await shot('source-check'); await hold(page, 10);
      const lesson = trail.locator('aside article').filter({ hasText: 'For failure-state UI checks' }); await lesson.locator('summary').filter({ hasText: 'Trace this lesson' }).click(); await lesson.scrollIntoViewIfNeeded(); cue('Inspected existing reviewed ambiguous-alert failure, correction, and passing follow-up.'); await shot('reviewed-lesson');
    }),
    capture('05-human-confirmation', 35, async ({ page, evidence, cue, reveal, shot }) => {
      if (process.env.RRFLOW_CAPTURE_CONFIRM_PUBLIC_SOURCE !== '1') throw new Error('One-source confirmation requires explicit invocation flag.');
      await page.getByRole('button', { name: 'Context inbox', exact: true }).click();
      const response = page.waitForResponse(value => value.url().includes('/api/organization?database=rrflow_specialist'));
      await page.getByLabel('Source workspace', { exact: true }).selectOption('rrflow_specialist');
      const snapshot = await (await response).json(); const item = snapshot.items.find(value => value.key === placementKey);
      if (!item || item.source.title !== placementTitle || item.destination !== 'shippin' || item.decision || !snapshot.decisionsAvailable) throw new Error('Exact authorized source is missing, changed, or already confirmed. No write performed.');
      let sent = false;
      await page.route('**/api/organization', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        const body = route.request().postDataJSON();
        if (sent || body.database !== 'rrflow_specialist' || body.key !== placementKey || body.destination !== 'shippin' || body.note !== '' || body.expectedUpdatedAt !== null) return route.abort('blockedbyclient');
        sent = true; evidence.writes.push({ action: 'Explicitly authorized single human confirmation', database: body.database, key: body.key, destination: body.destination });
        await route.continue();
      });
      const organizer = page.getByRole('region', { name: 'Context organization', exact: true });
      const index = snapshot.items.slice(0, 40).filter(value => value.destination === 'shippin' || value.destination === 'personal' || value.destination === 'review').findIndex(value => value.key === placementKey);
      const itemButtons = organizer.locator('button[class*="item_"]');
      if (await itemButtons.count() !== Math.min(40, snapshot.items.length)) throw new Error('Context item selector did not match the bounded native sample.');
      // Privacy-only marker: the actual UI reveals only the approved public row.
      await itemButtons.nth(index).evaluate(element => element.setAttribute('data-recording-source', 'approved'));
      await page.addStyleTag({ content: 'section[aria-label="Context organization"] button[class*="item_"]:not([data-recording-source="approved"]){display:none!important}' });
      await organizer.getByRole('button', { name: 'Show source titles', exact: true }).click();
      await itemButtons.nth(index).click();
      const dialog = page.getByRole('dialog'); await dialog.getByRole('heading', { name: 'Give this context a home.' }).waitFor();
      await expect(dialog.getByRole('radio', { name: 'Shippin work', exact: true })).toBeChecked();
      await reveal(); await shot('explanation'); await hold(page, 6);
      const savedResponse = page.waitForResponse(value => new URL(value.url()).pathname === '/api/organization' && value.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Save placement', exact: true }).click();
      const saved = await savedResponse; const body = await saved.json();
      if (!saved.ok() || body.decision?.key !== placementKey || body.decision?.destination !== 'shippin') throw new Error('The single confirmation did not return the expected saved decision; do not retry.');
      evidence.native = { key: placementKey, sourceId: item.source.id, title: placementTitle, decision: body.decision, telemetry: body.telemetry, requestIds: body.requestIds ?? [] };
      cue('Human confirmation saved in HydraDB; actual Raindrop status displayed.');
      await organizer.getByRole('status').filter({ hasText: 'Confirmed as Shippin work' }).waitFor(); await shot('saved'); await hold(page, 8);
      const refreshed = page.waitForResponse(value => value.url().includes('/api/organization?database=rrflow_specialist')); await organizer.getByRole('button', { name: 'Refresh context inbox', exact: true }).click();
      const after = await (await refreshed).json(); const confirmed = after.items.find(value => value.key === placementKey);
      if (confirmed?.decision?.updatedAt !== body.decision.updatedAt || confirmed.destination !== 'shippin') throw new Error('Saved confirmation did not survive the native refresh.');
      cue('Native refresh returned the persisted confirmation.'); await hold(page, 3);
      const refreshedIndex = after.items.slice(0, 40).findIndex(value => value.key === placementKey); await itemButtons.nth(refreshedIndex).click(); await dialog.waitFor();
      await expect(dialog).toContainText('Your saved decision takes precedence'); cue('Reopened saved decision; original source remains in its Shippin database.'); await shot('persisted');
      evidence.native.persistedAfterRefresh = true;
    }),
    capture('06-retrieve-reviewed-lesson', 35, async ({ page, evidence, cue, reveal, shot }) => {
      await page.goto(`${origin}/explore`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /^rrflow_specialist/ }).click();
      await page.getByRole('tab', { name: 'Query Lab', exact: true }).click();
      await page.getByLabel('query', { exact: true }).fill('For failure-state UI checks, scope the assertion to the intended region and error message');
      await page.getByRole('button', { name: 'rrflow_lessons', exact: true }).click();
      await page.getByRole('radiogroup', { name: 'type', exact: true }).getByRole('radio', { name: 'knowledge', exact: true }).click();
      await page.getByRole('radiogroup', { name: 'mode', exact: true }).getByRole('radio', { name: 'fast', exact: true }).click();
      await page.getByLabel('max_results', { exact: true }).fill('5');
      for (const label of ['graph_context', 'forceful', 'temporal']) await page.getByLabel(label, { exact: true }).uncheck();
      await page.locator('label').filter({ has: page.locator('span').getByText('query', { exact: true }) }).locator('textarea').evaluate(element => element.scrollIntoView({ block: 'center' }));
      await reveal(); await shot('scoped-query'); await hold(page, 5);
      const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/explore/rrflow_specialist/query' && value.request().method() === 'POST');
      await page.getByRole('button', { name: 'Run (fast)', exact: true }).click();
      const result = await response; const body = await result.json();
      const approved = 'reviewed-lesson:e55bf51095223b807ca8925591b296461811d830836ede2018275e94ec08f59d';
      if (!result.ok() || body.chunks.length !== 1 || body.chunks[0].id !== approved) throw new Error('Retrieval did not return exactly the previously reviewed public lesson.');
      evidence.native = { requestId: body.requestId, latencyMs: body.latencyMs, request: body.request, chunks: body.chunks.map(chunk => ({ id: chunk.id, title: chunk.title, url: chunk.url })) };
      cue('Actual HydraDB query returned the reviewed lesson as future-work context; no AI answer was generated.');
      const article = page.locator('article').filter({ hasText: 'Reviewed lesson: Playwright sync, connector, and refresh checks' });
      await article.scrollIntoViewIfNeeded(); await shot('retrieved-lesson'); await hold(page, 5);
      if (!body.llmPrompt?.includes('Human-reviewed diagnosis:') || !body.llmPrompt.includes('Practice for future work:')) throw new Error('Reviewed lesson contents were not returned in the native context.');
      await article.getByRole('button', { name: /^Show llm_prompt/ }).click();
      const prompt = article.locator('pre'); await prompt.scrollIntoViewIfNeeded();
      await prompt.evaluate(element => { element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) * 0.58); });
      cue('Expanded actual retrieved context showing the human-reviewed diagnosis, correction, and future practice.');
      await shot('lesson-contents'); await hold(page, 12);
      await article.getByText(/request_id /).hover(); cue('Actual native request ID and scoped collection remain visible.');
    }),
    capture('07-raindrop-delivery', 23, async ({ page, evidence, cue, reveal, shot }) => {
      const snapshot = await navigate(page, 'Connections', '/api/repository-sync');
      if (snapshot.state?.raindrop?.status !== 'accepted') throw new Error('No accepted real workflow delivery is available.');
      evidence.native = { observedAt: snapshot.checkedAt, commit: snapshot.state.commit, raindrop: snapshot.state.raindrop, requestIds: snapshot.state.requestIds };
      await isolateSection(page, 'GitHub knowledge sync'); const panel = page.getByRole('region', { name: 'GitHub knowledge sync' });
      await panel.locator('summary').filter({ hasText: 'Sync evidence and native request IDs' }).click();
      await panel.getByText('Raindrop observation', { exact: true }).scrollIntoViewIfNeeded(); await reveal(); await shot('accepted'); await hold(page, 6);
      await panel.getByText(`Raindrop event: ${snapshot.state.raindrop.eventId}`, { exact: true }).hover(); cue('Existing actual accepted workflow event and native request evidence held for inspection.'); await hold(page, 7);
      await panel.getByRole('link', { name: 'Open GitHub sync workflow' }).hover(); cue('Associated public workflow provenance shown.');
    }),
  ]);
} finally { await browser.close(); }
if (current.some(value => value.status !== 'captured')) process.exitCode = 1;
