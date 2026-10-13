import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const emitter = pathToFileURL(resolve('../../scripts/capture-ci.mjs')).href;
const schemaFile = pathToFileURL(resolve('../../scripts/learning-evidence.schema.json')).href;
const run = (body: string) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';
  import { createHash } from 'node:crypto';
  import { createLearningEvidence, publishLearningEvidence, canCaptureInEnvironment, schemaPath } from ${JSON.stringify(emitter)};
  const schemaText = readFileSync(new URL(${JSON.stringify(schemaFile)}), 'utf8');
  const commit = 'a'.repeat(40); const captureCommit = 'b'.repeat(40);
  const base = { commit, captureCommit, schemaText, at: '2026-10-12T22:00:00Z' };
  const report = tests => ({ config: { rootDir: '/repo/rrflow-app/apps/rrflow/tests' }, stats: { startTime: '2026-10-12T21:59:00Z' }, suites: [{ file: 'workspace.spec.ts', specs: tests.map((test, index) => ({ title: 'Check ' + index, file: 'workspace.spec.ts', line: index + 10, tests: [test] })) }], errors: [] });
  ${body}
`], { encoding: 'utf8', timeout: 30_000 }));

test('learning capture preserves actual outcomes, bounded provenance and missing-report uncertainty', () => {
  const result = run(`
    const credential = 'fixture-private-value';
    const input = report([
      { status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', stdout: [{ text: 'PRIVATE_LOG' }] }] },
      { status: 'unexpected', expectedStatus: 'passed', results: [{ status: 'failed', error: { message: credential } }] },
      { status: 'flaky', expectedStatus: 'passed', results: [{ status: 'failed' }, { status: 'passed' }] },
      { status: 'skipped', expectedStatus: 'skipped', results: [] },
      { status: 'expected', expectedStatus: 'failed', results: [{ status: 'failed' }] },
      { status: 'expected', expectedStatus: 'passed', results: [] }
    ]);
    input.suites[0].specs[1].title = 'Protect ' + credential;
    const evidence = createLearningEvidence({ ...base, report: input, reportState: 'read', secrets: [credential] });
    assert.equal(evidence.conclusion, 'failed');
    assert.deepEqual(evidence.checks.map(check => check.status), ['passed', 'failed', 'failed', 'skipped', 'passed', 'unknown']);
    assert.equal(evidence.kind, 'local-verification'); assert.equal(evidence.runUrl, null);
    assert.equal(evidence.checks[0].sourcePath, 'rrflow-app/apps/rrflow/tests/workspace.spec.ts');
    assert.ok(evidence.checks[0].rule.sourceUrl.includes('/' + commit + '/'));
    assert.ok(evidence.checks[0].rule.sourceUrl.endsWith('#L10'));
    assert.ok(evidence.schema.sourceUrl.includes('/' + captureCommit + '/'));
    assert.equal(evidence.schema.sha256, createHash('sha256').update(schemaText).digest('hex'));
    assert.ok(!JSON.stringify(evidence).includes(credential)); assert.ok(!JSON.stringify(evidence).includes('PRIVATE_LOG'));
    assert.equal(createLearningEvidence({ ...base, report: { bad: true }, reportState: 'read' }).conclusion, 'unknown');
    assert.equal(createLearningEvidence({ ...base, report: report([]), reportState: 'read' }).conclusion, 'unknown');
    const missing = createLearningEvidence({ ...base, runId: '123', steps: { install: { outcome: 'failure', conclusion: 'success' } } });
    assert.equal(missing.conclusion, 'failed'); assert.equal(missing.checks.find(check => check.rule.id === 'ci:install').status, 'failed');
    assert.equal(missing.checks.find(check => check.rule.id === 'playwright:report').status, 'unknown');
    const untracked = createLearningEvidence({ ...base, report: input, reportState: 'read', trackedTests: new Set() });
    assert.equal(untracked.checks[0].sourcePath, null);
    assert.ok(untracked.checks[0].rule.sourceUrl.endsWith('#/$defs/playwrightOutcome'));
    assert.deepEqual(Object.keys(evidence), ['version', 'id', 'kind', 'repository', 'commit', 'runUrl', 'at', 'conclusion', 'checks', 'schema', 'capture']);
    console.log(JSON.stringify({ verified: true }));
  `);
  expect(result.verified).toBe(true);
});

test('learning capture labels historical runs as imports and separates observed and schema revisions', () => {
  const result = run(`
    const githubRun = { databaseId: 123, headSha: commit, createdAt: '2026-10-01T10:00:00Z', url: 'https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/123', conclusion: 'failure', jobs: [{ name: 'verify', conclusion: 'failure', steps: [{ name: 'TypeScript', conclusion: 'failure', number: 1 }, { name: 'Build', conclusion: 'skipped', number: 2 }] }] };
    const evidence = createLearningEvidence({ ...base, githubRun });
    assert.equal(evidence.capture.mode, 'imported-ci'); assert.equal(evidence.kind, 'ci');
    assert.equal(evidence.at, '2026-10-01T10:00:00.000Z'); assert.equal(evidence.commit, commit);
    assert.equal(evidence.conclusion, 'failed'); assert.deepEqual(evidence.checks.map(check => check.status), ['failed', 'failed', 'failed', 'skipped']);
    assert.ok(evidence.checks.every(check => check.rule.sourceUrl.includes(captureCommit)));
    assert.ok(evidence.schema.sourceUrl.includes(captureCommit));
    const passingRun = { ...githubRun, conclusion: 'success', jobs: [{ name: 'verify', conclusion: 'success', steps: [{ name: 'Tests', conclusion: 'success', number: 1 }] }] };
    assert.equal(createLearningEvidence({ ...base, githubRun: passingRun }).conclusion, 'passed');
    assert.throws(() => createLearningEvidence({ ...base, githubRun: { ...githubRun, url: 'https://example.com/run' } }));
    assert.throws(() => createLearningEvidence({ ...base, githubRun: { ...githubRun, headSha: captureCommit } }));
    console.log(JSON.stringify({ verified: true }));
  `);
  expect(result.verified).toBe(true);
});

test('learning capture writes canonical evidence, excludes raw telemetry and preserves success on delivery failure', () => {
  const result = run(`
    const evidence = createLearningEvidence({ ...base, report: report([{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] }]), reportState: 'read' });
    const calls = [];
    const env = { HYDRA_DB_API_KEY: 'fixture-hydra-key', RAINDROP_WRITE_KEY: 'fixture-rain-key', RRFLOW_INGEST_LEARNING: '1' };
    const fetch = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/byog/query')) return new Response(JSON.stringify({ success: true, data: [{ id: evidence.id }], meta: { request_id: 'fixture-native-id' } }), { status: 200 });
      if (url.endsWith('/context/ingest')) return new Response(JSON.stringify({ success: true, data: { failed_count: 0, results: [{ id: evidence.id, status: 'queued' }] } }), { status: 200 });
      return new Response('{}', { status: 200 });
    };
    const result = await publishLearningEvidence(evidence, { fetch, env });
    assert.equal(result.stored, true); assert.equal(result.retrieval, 'accepted_indexing_unverified'); assert.equal(result.raindrop, 'accepted');
    const graph = JSON.parse(calls[0].init.body);
    assert.equal(graph.database, 'rrflow_specialist'); assert.equal(graph.collection, 'rrflow_learning');
    assert.ok(graph.query.includes('e.at = $at')); assert.equal(graph.params.at, evidence.at);
    assert.deepEqual(JSON.parse(graph.params.state), evidence);
    const ingested = JSON.parse(calls[1].init.body.get('app_knowledge'))[0];
    assert.equal(ingested.additional_metadata.review_status, 'unreviewed');
    const telemetry = JSON.parse(calls[2].init.body)[0];
    assert.equal(telemetry.properties.checks, 1); assert.equal(telemetry.properties.passed, 1);
    assert.ok(!JSON.stringify(telemetry).includes('workspace.spec.ts'));
    assert.ok(!JSON.stringify(telemetry).includes('fixture-hydra-key'));
    const partial = await publishLearningEvidence(evidence, { env, fetch: async (url, init) => url.endsWith('/byog/query') ? fetch(url, init) : new Response('{}', { status: 503 }) });
    assert.equal(partial.stored, true); assert.equal(partial.retrieval, 'failed'); assert.equal(partial.raindrop, 'failed');
    const denied = { ...env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'EonsofStupid/rrflow-hydradb' };
    let attempted = false;
    const ignored = await publishLearningEvidence(evidence, { env: denied, fetch: async () => { attempted = true; throw new Error('Must not contact a service'); } });
    assert.equal(ignored.reason, 'untrusted_event'); assert.equal(attempted, false);
    assert.equal(canCaptureInEnvironment({ ...denied, GITHUB_EVENT_NAME: 'push' }), true);
    assert.equal(canCaptureInEnvironment({ ...denied, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/other' }), false);
    assert.equal((await publishLearningEvidence(evidence, { env: {} })).reason, 'not_configured');
    await assert.rejects(publishLearningEvidence(evidence, { env, fetch: async () => new Response('{}', { status: 500 }) }), /HydraDB did not confirm/);
    await assert.rejects(publishLearningEvidence({ ...evidence, rawLogs: 'must never be stored' }, { env, fetch }), /unsupported fields/);
    console.log(JSON.stringify({ verified: true }));
  `);
  expect(result.verified).toBe(true);
});

test('learning capture CI keeps fixture coverage and isolates credentials to trusted main capture', () => {
  const result = run(`
    const workflow = readFileSync(${JSON.stringify(resolve('../../../.github/workflows/ci.yml'))}, 'utf8');
    assert.ok(workflow.includes('tests/organization.spec.ts')); assert.ok(workflow.includes('tests/learning-capture.spec.ts'));
    assert.ok(workflow.includes('--reporter=list,json')); assert.ok(workflow.includes('PLAYWRIGHT_JSON_OUTPUT_FILE:'));
    assert.ok(workflow.includes("always() && github.event_name == 'push' && github.ref == 'refs/heads/main'"));
    const split = workflow.split('name: Capture actual verification outcomes into HydraDB');
    assert.equal(split.length, 2); assert.ok(!split[0].includes('secrets.HYDRA_DB_API_KEY'));
    assert.ok(split[1].includes('continue-on-error: true')); assert.ok(split[1].includes('toJSON(steps)'));
    console.log(JSON.stringify({ verified: true }));
  `);
  expect(result.verified).toBe(true);
});
