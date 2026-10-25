import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const repository = 'EonsofStupid/rrflow-hydradb';
export const database = 'rrflow_specialist';
export const collection = 'rrflow_learning';
export const schemaPath = 'rrflow-app/scripts/learning-evidence.schema.json';
const schemaFile = new URL('./learning-evidence.schema.json', import.meta.url);
const scriptFolder = path.dirname(fileURLToPath(import.meta.url));
const stepNames = { corepack: 'Enable package manager', install: 'Install locked dependencies', typecheck: 'TypeScript check', lint: 'Lint', build: 'Production build', playwright_setup: 'Install Playwright browser', playwright: 'Playwright checks', knowledge_path: 'Registered project knowledge retrieval and saved provenance' };
const digest = value => createHash('sha256').update(value).digest('hex');
const commitPattern = /^[a-f0-9]{40}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const cleanText = (input, secrets = []) => {
  let text = String(input || '').replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\b(?:sk_live_[\w.-]+|gh[pousr]_[\w]+|github_pat_[\w]+|sk-proj-[\w-]+)\b/g, '[credential removed]')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[authorization removed]')
    .replace(/(?:password|token|api[_-]?key|secret)\s*[:=]\s*[^\s,;]+/gi, '[credential field removed]');
  for (const secret of secrets) if (secret && secret.length >= 6) text = text.split(secret).join('[credential removed]');
  return text.trim().slice(0, 250) || 'Unnamed verification check';
};
const sourceLink = (commit, source, line) => `https://github.com/${repository}/blob/${commit}/${source.split('/').map(encodeURIComponent).join('/')}${line ? `#L${line}` : ''}`;
const statusOf = value => value === 'success' ? 'passed' : ['failure', 'timed_out'].includes(value) ? 'failed' : value === 'skipped' ? 'skipped' : 'unknown';
const outcomeLabel = value => ['success', 'failure', 'timed_out', 'skipped', 'cancelled', 'neutral', 'action_required', 'stale', 'startup_failure', 'expected', 'unexpected', 'flaky', 'passed', 'failed', 'timedOut', 'interrupted'].includes(value) ? value : 'unavailable';
const conclusionOf = checks => checks.some(check => check.status === 'failed') ? 'failed' : checks.some(check => check.status === 'unknown') || !checks.some(check => check.status === 'passed') ? 'unknown' : 'passed';
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const testSource = (file, rootDir) => {
  if (typeof file !== 'string') return null;
  let candidate = file.replaceAll('\\', '/');
  const root = typeof rootDir === 'string' ? rootDir.replaceAll('\\', '/').replace(/\/$/, '') : '';
  if (root && candidate.startsWith(`${root}/`)) candidate = candidate.slice(root.length + 1);
  if (candidate.startsWith('tests/')) candidate = candidate.slice(6);
  if (candidate.startsWith('rrflow-app/apps/rrflow/tests/')) candidate = candidate.slice('rrflow-app/apps/rrflow/tests/'.length);
  if (!candidate || candidate.startsWith('/') || candidate.includes(':') || candidate.split('/').some(part => !part || part === '..' || part.startsWith('.')) || !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(candidate)) return null;
  return `rrflow-app/apps/rrflow/tests/${candidate}`;
};

/** Pure evidence assembly. Report errors, stdout, attachments and runtime values never enter the record. */
export function createLearningEvidence({ report = null, reportState = 'missing', steps = {}, githubRun = null, commit, captureCommit, schemaText, runId = null, runAttempt = '1', at = new Date().toISOString(), secrets = [], trackedTests = null } = {}) {
  if (!commitPattern.test(commit) || !commitPattern.test(captureCommit)) throw new Error('Observed and capture commits must be full Git commit IDs.');
  if (typeof schemaText !== 'string' || JSON.parse(schemaText)?.properties?.version?.const !== 1) throw new Error('The learning schema is unavailable or unsupported.');
  const schemaUrl = sourceLink(captureCommit, schemaPath);
  const checks = [];
  const addRule = (id, name, status, explanation, sourcePath = null, line = null, ruleSource = `${schemaUrl}#/$defs/stepOutcome`) => {
    const title = cleanText(name, secrets);
    checks.push({ name: title, status, sourcePath, line, rule: { id, title, sourceUrl: ruleSource, explanation } });
  };
  let mode = runId ? 'automatic-ci' : 'local-verification';
  let runUrl = runId && /^\d+$/.test(String(runId)) ? `https://github.com/${repository}/actions/runs/${runId}` : null;
  let observedAt = validDate(report?.stats?.startTime) || validDate(at);
  if (!observedAt) throw new Error('Capture time must be a valid timestamp.');
  if (githubRun) {
    if (!object(githubRun) || githubRun.headSha !== commit || !/^\d+$/.test(String(githubRun.databaseId)) || githubRun.url !== `https://github.com/${repository}/actions/runs/${githubRun.databaseId}` || !Array.isArray(githubRun.jobs)) throw new Error('The imported GitHub run is not a complete run from this repository.');
    mode = 'imported-ci'; runUrl = githubRun.url; observedAt = validDate(githubRun.createdAt) || observedAt;
    addRule('github:run', 'GitHub workflow conclusion', statusOf(githubRun.conclusion), `Imported GitHub run conclusion: ${outcomeLabel(githubRun.conclusion)}. This is retrospective evidence, not an automatically captured event.`);
    for (const [index, job] of githubRun.jobs.entries()) {
      if (checks.length >= 900) break;
      addRule(`github:job:${index}`, job.name || `Job ${index + 1}`, statusOf(job.conclusion), `GitHub reported this job conclusion as ${outcomeLabel(job.conclusion)}. No diagnosis is inferred.`);
      if (!Array.isArray(job.steps)) continue;
      for (const [stepIndex, step] of job.steps.entries()) {
        if (checks.length >= 900) break;
        addRule(`github:job:${index}:step:${stepIndex}`, step.name || `Step ${stepIndex + 1}`, statusOf(step.conclusion), `GitHub reported this step conclusion as ${outcomeLabel(step.conclusion)}. The original run is linked above; raw logs were not imported.`);
      }
    }
    if (checks.length >= 900) addRule('github:bounded-import', 'Additional GitHub steps', 'unknown', 'The import reached its 900-check limit; additional steps were not inspected.');
  } else {
    for (const [id, name] of Object.entries(stepNames)) {
      if (!runId && !Object.hasOwn(steps, id)) continue;
      const outcome = object(steps[id]) ? steps[id].outcome : steps[id];
      addRule(`ci:${id}`, name, statusOf(outcome), `Recorded step outcome before continue-on-error: ${outcomeLabel(outcome)}. A missing or cancelled step does not count as passed.`, '.github/workflows/ci.yml');
    }
    if (reportState === 'read' && object(report) && Array.isArray(report.suites)) {
      let visited = 0; let tests = 0; let limited = false; let malformed = false;
      const visit = (suites, depth = 0) => {
        if (depth > 20) { limited = true; return; }
        for (const suite of suites) {
          if (++visited > 5000 || checks.length >= 900) { limited = true; return; }
          if (!object(suite)) { malformed = true; continue; }
          for (const spec of Array.isArray(suite.specs) ? suite.specs : []) {
            if (!object(spec) || !Array.isArray(spec.tests)) { malformed = true; continue; }
            for (const test of spec.tests) {
              if (checks.length >= 900) { limited = true; return; }
              tests++;
              if (!object(test)) { malformed = true; continue; }
              const results = Array.isArray(test.results) ? test.results : [];
              const last = results.at(-1);
              const status = test.status === 'skipped' ? 'skipped'
                : ['unexpected', 'flaky'].includes(test.status) ? 'failed'
                  : test.status === 'expected' && last && last.status !== 'skipped' && last.status === (test.expectedStatus || 'passed') ? 'passed' : 'unknown';
              let source = testSource(spec.file || suite.file, report.config?.rootDir);
              if (source && cleanText(source, secrets) !== source) source = null;
              if (source && trackedTests && !trackedTests.has(source)) source = null;
              const line = source && Number.isInteger(spec.line) && spec.line > 0 ? spec.line : null;
              const name = `${spec.title || 'Playwright check'}${test.projectName ? ` (${test.projectName})` : ''}`;
              const id = `playwright:${digest(`${source}:${line}:${spec.title}:${test.projectName || ''}`).slice(0, 24)}`;
              const explanation = test.status === 'flaky' ? 'Playwright reported a flaky retry. This remains a failed stability observation even if a later attempt passed.' : `Playwright reported ${outcomeLabel(test.status)}; expected result ${outcomeLabel(test.expectedStatus || 'passed')}; last executed result ${outcomeLabel(last?.status)}. No error cause is inferred.`;
              addRule(id, name, status, explanation, source, line, source ? sourceLink(commit, source, line) : `${schemaUrl}#/$defs/playwrightOutcome`);
            }
          }
          if (Array.isArray(suite.suites)) visit(suite.suites, depth + 1);
        }
      };
      visit(report.suites);
      if (Array.isArray(report.errors) && report.errors.length) addRule('playwright:runner', 'Playwright runner errors', 'failed', `The report contains ${report.errors.length} runner error entries. Their content is deliberately excluded.`, null, null, `${schemaUrl}#/$defs/playwrightOutcome`);
      if (!tests || malformed || limited) addRule('playwright:coverage', 'Playwright report coverage', 'unknown', !tests ? 'No executed test entries were available in this report.' : limited ? 'The bounded report reader omitted additional tests.' : 'Some report entries were malformed.', null, null, `${schemaUrl}#/$defs/playwrightOutcome`);
    } else addRule('playwright:report', 'Playwright report availability', 'unknown', reportState === 'missing' ? 'The JSON report is absent. Earlier CI steps may have stopped the test run; no tests are assumed to have passed.' : 'The JSON report is unreadable or has an unsupported shape; no test result was inferred.', null, null, `${schemaUrl}#/$defs/playwrightOutcome`);
  }
  const evidence = {
    version: 1, id: `learning-${digest(JSON.stringify({ repository, commit, mode, run: githubRun?.databaseId || runId, runAttempt, checks })).slice(0, 32)}`,
    kind: mode === 'local-verification' ? 'local-verification' : 'ci', repository, commit, runUrl,
    at: observedAt, conclusion: conclusionOf(checks), checks,
    schema: { version: '1.0', path: schemaPath, sha256: digest(schemaText), sourceUrl: schemaUrl },
    capture: { mode, tool: 'Playwright + GitHub Actions' },
  };
  assertLearningEvidence(evidence);
  return evidence;
}

export function assertLearningEvidence(evidence) {
  const hasKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  if (!hasKeys(evidence, ['version', 'id', 'kind', 'repository', 'commit', 'runUrl', 'at', 'conclusion', 'checks', 'schema', 'capture']) || !hasKeys(evidence.schema, ['version', 'path', 'sha256', 'sourceUrl']) || !hasKeys(evidence.capture, ['mode', 'tool'])) throw new Error('Learning evidence contains missing or unsupported fields.');
  if (evidence?.version !== 1 || !/^learning-[a-f0-9]{32}$/.test(evidence.id) || evidence.repository !== repository || !commitPattern.test(evidence.commit) || !validDate(evidence.at) || !['ci', 'local-verification'].includes(evidence.kind) || !['passed', 'failed', 'unknown'].includes(evidence.conclusion) || !Array.isArray(evidence.checks) || !evidence.checks.length || evidence.checks.length > 1000) throw new Error('Learning evidence does not match its versioned schema.');
  if (evidence.runUrl !== null && !new RegExp(`^https://github.com/${repository}/actions/runs/\\d+$`).test(evidence.runUrl)) throw new Error('Learning evidence run URL is outside this repository.');
  if (!['automatic-ci', 'local-verification', 'imported-ci'].includes(evidence.capture?.mode) || evidence.capture.tool !== 'Playwright + GitHub Actions' || (evidence.kind === 'local-verification') !== (evidence.capture.mode === 'local-verification')) throw new Error('Learning evidence capture mode is inconsistent.');
  if (evidence.schema?.version !== '1.0' || evidence.schema.path !== schemaPath || !/^[a-f0-9]{64}$/.test(evidence.schema.sha256) || !new RegExp(`^https://github.com/${repository}/blob/[a-f0-9]{40}/${schemaPath}$`).test(evidence.schema.sourceUrl)) throw new Error('Learning schema provenance is invalid.');
  for (const check of evidence.checks) {
    if (!hasKeys(check, ['name', 'status', 'sourcePath', 'line', 'rule']) || !hasKeys(check.rule, ['id', 'title', 'sourceUrl', 'explanation'])) throw new Error('A learning check contains unsupported fields.');
    if (!['passed', 'failed', 'skipped', 'unknown'].includes(check.status) || typeof check.name !== 'string' || !check.name.length || check.name.length > 250 || (check.sourcePath !== null && typeof check.sourcePath !== 'string') || (check.line !== null && (!Number.isInteger(check.line) || check.line < 1)) || !check.rule?.id || !check.rule.title || !check.rule.explanation || !check.rule.sourceUrl?.startsWith(`https://github.com/${repository}/blob/`)) throw new Error('A learning check has invalid provenance or status.');
    if (typeof check.rule.id !== 'string' || check.rule.id.length > 100 || typeof check.rule.title !== 'string' || check.rule.title.length > 250 || typeof check.rule.explanation !== 'string' || check.rule.explanation.length > 1000) throw new Error('A learning rule exceeds the versioned schema limits.');
  }
  if (evidence.conclusion !== conclusionOf(evidence.checks)) throw new Error('Learning conclusion disagrees with the observed checks.');
}

export const canCaptureInEnvironment = env => env.GITHUB_ACTIONS !== 'true' || (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main' && env.GITHUB_REPOSITORY?.toLowerCase() === repository.toLowerCase());

/** Native writes only. Retrieval ingestion is optional; acceptance never implies verified indexing. */
export async function publishLearningEvidence(evidence, { fetch: request = globalThis.fetch, env = process.env } = {}) {
  assertLearningEvidence(evidence);
  if (!canCaptureInEnvironment(env)) return { stored: false, reason: 'untrusted_event', retrieval: 'not_requested', raindrop: 'not_sent' };
  if (!env.HYDRA_DB_API_KEY) return { stored: false, reason: 'not_configured', retrieval: 'not_requested', raindrop: 'not_sent' };
  const headers = { Authorization: `Bearer ${env.HYDRA_DB_API_KEY}`, 'API-Version': '2', 'Content-Type': 'application/json' };
  const response = await request('https://api.hydradb.com/byog/query', { method: 'POST', signal: AbortSignal.timeout(35_000), headers, body: JSON.stringify({ database, collection, query: 'MERGE (e:LearningEvidence {ext_id: $id}) SET e.state = $state, e.at = $at RETURN e.ext_id AS id', params: { id: evidence.id, at: evidence.at, state: JSON.stringify(evidence) } }) });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || !Array.isArray(body?.data) || !body.data.some(row => row.id === evidence.id)) throw new Error(`HydraDB did not confirm the learning record (HTTP ${response.status}).`);
  const result = { stored: true, id: evidence.id, requestId: response.headers.get('x-request-id') || body?.meta?.request_id || null, retrieval: 'not_requested', raindrop: 'not_configured' };
  if (env.RRFLOW_INGEST_LEARNING === '1') {
    try {
      const form = new FormData(); form.set('database', database); form.set('type', 'knowledge'); form.set('upsert', 'true');
      form.set('app_knowledge', JSON.stringify([{ id: evidence.id, title: `Unreviewed ${evidence.capture.mode} observation: ${evidence.conclusion}`, type: 'verification_observation', url: evidence.runUrl || evidence.schema.sourceUrl, timestamp: evidence.at, content: { text: JSON.stringify(evidence) }, additional_metadata: { repository: evidence.repository, review_status: 'unreviewed', source_system: 'verification', evidence_id: evidence.id, commit: evidence.commit, schema_sha256: evidence.schema.sha256, capture_mode: evidence.capture.mode } }]));
      const ingestion = await request('https://api.hydradb.com/context/ingest', { method: 'POST', signal: AbortSignal.timeout(25_000), headers: { Authorization: headers.Authorization, 'API-Version': '2' }, body: form });
      const data = await ingestion.json().catch(() => null);
      const item = data?.data?.results?.find(item => item.id === evidence.id);
      result.retrieval = ingestion.ok && data?.success === true && !data.data.failed_count && item && !item.error && ['queued', 'processing', 'completed'].includes(item.status) ? 'accepted_indexing_unverified' : 'failed';
    } catch { result.retrieval = 'failed'; }
  }
  if (env.RAINDROP_WRITE_KEY) {
    try {
      const tracked = await request('https://api.raindrop.ai/v1/events/track', { method: 'POST', signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${env.RAINDROP_WRITE_KEY}`, 'Content-Type': 'application/json', 'X-Raindrop-Project-Id': env.RAINDROP_PROJECT_ID || 'rrflow-hydradb' }, body: JSON.stringify([{ event_id: evidence.id, user_id: evidence.capture.mode === 'automatic-ci' ? 'rrflow-github' : 'rrflow-verification', event: 'verification_evidence_captured', properties: { evidence_id: evidence.id, conclusion: evidence.conclusion, capture_mode: evidence.capture.mode, commit: evidence.commit, schema_sha256: evidence.schema.sha256, checks: evidence.checks.length, passed: evidence.checks.filter(check => check.status === 'passed').length, failed: evidence.checks.filter(check => check.status === 'failed').length, skipped: evidence.checks.filter(check => check.status === 'skipped').length, unknown: evidence.checks.filter(check => check.status === 'unknown').length } }]) });
      result.raindrop = tracked.ok ? 'accepted' : 'failed';
    } catch { result.raindrop = 'failed'; }
  }
  return result;
}

const readJsonFile = filename => {
  if (statSync(filename).size > 20_000_000) throw new Error('The verification report exceeds the 20 MB capture limit.');
  return JSON.parse(readFileSync(filename, 'utf8'));
};
const git = (...args) => execFileSync('git', args, { cwd: scriptFolder, encoding: 'utf8', maxBuffer: 4_000_000 }).trim();

export async function captureFromCli(args = process.argv.slice(2), env = process.env) {
  if (!canCaptureInEnvironment(env)) return { stored: false, reason: 'untrusted_event' };
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!['--report', '--github-run'].includes(args[index]) || !args[index + 1] || options[args[index]]) throw new Error('Usage: capture-ci.mjs --report <Playwright JSON> OR --github-run <gh run view JSON>.');
    options[args[index]] = args[index + 1];
  }
  if (!!options['--report'] === !!options['--github-run']) throw new Error('Choose one Playwright report or one historical GitHub run JSON.');
  const captureCommit = git('rev-parse', 'HEAD');
  const schemaText = readFileSync(schemaFile, 'utf8');
  let committedSchema;
  try { committedSchema = execFileSync('git', ['show', `${captureCommit}:${schemaPath}`], { cwd: scriptFolder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { throw new Error('Commit the capture schema before publishing evidence so its source URL resolves to the exact schema.'); }
  if (digest(committedSchema) !== digest(schemaText)) throw new Error('The capture schema differs from HEAD. Commit it before publishing evidence.');
  let report = null; let reportState = 'missing'; let githubRun = null;
  if (options['--github-run']) githubRun = readJsonFile(options['--github-run']);
  else { try { report = readJsonFile(options['--report']); reportState = 'read'; } catch (error) { reportState = error?.code === 'ENOENT' ? 'missing' : 'malformed'; } }
  let steps = {};
  if (env.RRFLOW_CI_STEPS_JSON) { try { steps = JSON.parse(env.RRFLOW_CI_STEPS_JSON); if (!object(steps)) steps = {}; } catch { steps = {}; } }
  const commit = githubRun?.headSha || (env.GITHUB_ACTIONS === 'true' ? env.GITHUB_SHA : captureCommit);
  const root = git('rev-parse', '--show-toplevel');
  const trackedTests = githubRun ? null : new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', 'rrflow-app/apps/rrflow/tests'], { cwd: root, encoding: 'utf8', maxBuffer: 2_000_000 }).trim().split('\n'));
  const evidence = createLearningEvidence({ report, reportState, steps, githubRun, commit, captureCommit, schemaText, runId: env.GITHUB_ACTIONS === 'true' ? env.GITHUB_RUN_ID : null, runAttempt: env.GITHUB_RUN_ATTEMPT || '1', secrets: [env.HYDRA_DB_API_KEY, env.RAINDROP_WRITE_KEY, env.GITHUB_TOKEN], trackedTests });
  const result = await publishLearningEvidence(evidence, { env });
  return { ...result, conclusion: evidence.conclusion, mode: evidence.capture.mode, checks: evidence.checks.length, schemaSha256: evidence.schema.sha256 };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  captureFromCli().then(result => {
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Captured verification evidence\n\nCanonical record: ${result.stored ? 'saved in HydraDB' : `not saved (${result.reason})`}. Retrieval: ${result.retrieval || 'not requested'}. Raindrop: ${result.raindrop || 'not sent'}. Accepted ingestion does not establish completed indexing or an approved lesson.\n`);
    if (!result.stored && process.env.GITHUB_ACTIONS === 'true') console.log('::warning::Verification evidence was not stored; the original CI result is unchanged.');
  }).catch(error => {
    // Exception text can contain filesystem paths or third-party content. Keep CI output bounded.
    const known = [
      ['Commit the capture schema', 'schema_not_committed', 'Commit the capture schema before publishing source-linked evidence.'],
      ['The capture schema differs', 'schema_not_committed', 'The schema on disk differs from HEAD; commit the schema before capture.'],
      ['HydraDB did not confirm', 'hydradb_write_unconfirmed', 'HydraDB did not confirm the canonical write. Check service status and server credentials.'],
      ['The imported GitHub run', 'invalid_import', 'Import the complete gh run view JSON for this repository.'],
      ['Usage:', 'invalid_arguments', 'Use --report <Playwright JSON> or --github-run <gh run view JSON>.'],
      ['Choose one Playwright report', 'invalid_arguments', 'Choose exactly one Playwright report or historical GitHub run.'],
    ].find(([prefix]) => error instanceof Error && error.message.startsWith(prefix));
    console.error(JSON.stringify({ stored: false, reason: known?.[1] || 'capture_failed', message: known?.[2] || 'Verification capture failed; check configuration and connectivity. The application and original verification results are unchanged.' }));
    process.exitCode = 1;
  });
}
