#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Read-only preflight. Building, starting, authentication and deploying are deliberate separate steps.
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--runtime', '--artifact']);
try {
  assert([...args].every(arg => allowed.has(arg)), 'Usage: node scripts/modelence-validate.mjs [--runtime] [--artifact]');
  const config = JSON.parse(await readFile(path.join(root, 'modelence.config.json'), 'utf8'));
  assert.equal(config.$schema, 'https://cloud.modelence.com/schema/modelence.config.json?version=1');
  assert.deepEqual(Object.keys(config).sort(), ['$schema', 'env', 'resources']);
  const resources = Object.values(config.resources);
  assert.equal(resources.length, 1, 'Deploy only the existing Node service; no additional database resources.');
  const app = resources[0];
  assert.equal(app.type, 'service');
  assert.equal(app.image, 'node-22-slim');
  assert.equal(app.root, 'rrflow-app');
  assert.equal(app.static, undefined, 'Next.js needs its server, not a static SPA mount.');
  assert.deepEqual(app.build.commands, ['corepack enable && pnpm install --frozen-lockfile', 'pnpm build']);
  assert.deepEqual(app.start.commands, ['pnpm --filter @rrflow/app exec next start --hostname 0.0.0.0 --port "$PORT"']);
  const requiredSecrets = ['RRFLOW_WORKSPACE_PASSWORD', 'RRFLOW_SESSION_SECRET', 'HYDRA_DB_API_KEY', 'RAINDROP_WRITE_KEY'];
  for (const [name, declaration] of Object.entries(config.env)) {
    assert(!name.startsWith('MODELENCE_') && name !== 'PORT', `${name} is reserved by Modelence.`);
    assert.deepEqual(declaration.scopes, ['runtime'], `${name} must be runtime-only.`);
    assert(['text', 'secret'].includes(declaration.type), `${name} has an unsupported declaration.`);
    if (declaration.type === 'secret') assert(!Object.hasOwn(declaration, 'value'), `${name} must never contain a committed secret value.`);
  }
  for (const name of requiredSecrets) {
    assert.equal(config.env[name]?.type, 'secret', `${name} must be declared as a secret.`);
    assert.notEqual(config.env[name]?.required, false, `${name} must be required for this hosted workspace.`);
  }
  assert.equal(config.env.RRFLOW_ACCESS_MODE.value, 'public', 'Hosted workspace access must fail closed.');
  assert.equal(config.env.RRFLOW_DEMO_EXPIRES_AT?.type, 'text', 'Declare the publication cutoff as runtime text.');
  assert.equal(config.env.RRFLOW_DEMO_EXPIRES_AT?.required, true, 'The publication cutoff must be required.');
  assert(!Object.hasOwn(config.env.RRFLOW_DEMO_EXPIRES_AT, 'value'), 'Set the publication cutoff at actual publication; do not commit a date.');
  const appRoot = path.join(root, app.root);
  const pkg = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.packageManager, 'pnpm@10.26.0');
  await access(path.join(appRoot, 'pnpm-lock.yaml'));
  console.log('PASS: RRFLOW Modelence service, commands, fail-closed mode and runtime-only secret declarations.');
  if (args.has('--artifact')) {
    await access(path.join(appRoot, 'apps/rrflow/.next/BUILD_ID'));
    console.log('PASS: standard Next.js production BUILD_ID exists (does not prove HTTP readiness).');
  }
  if (args.has('--runtime')) {
    const values = Object.fromEntries(Object.entries(config.env).map(([name, declaration]) => [name, process.env[name] || declaration.value]));
    const missing = Object.entries(config.env).filter(([name, declaration]) => declaration.required !== false && !values[name]).map(([name]) => name);
    assert.equal(missing.length, 0, `Missing runtime variables: ${missing.join(', ')}`);
    assert(values.RRFLOW_WORKSPACE_PASSWORD.length >= 16, 'Workspace password must be at least 16 characters.');
    assert(values.RRFLOW_SESSION_SECRET.length >= 32, 'Session secret must be at least 32 characters.');
    const cutoff = values.RRFLOW_DEMO_EXPIRES_AT;
    const cutoffMs = Date.parse(cutoff);
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(cutoff) && Number.isFinite(cutoffMs) && new Date(cutoffMs).toISOString() === (cutoff.includes('.') ? cutoff : cutoff.replace('Z', '.000Z')), 'RRFLOW_DEMO_EXPIRES_AT must be a valid UTC ISO timestamp.');
    assert(cutoffMs > Date.now(), 'Initial publication requires a future RRFLOW_DEMO_EXPIRES_AT; preserve the original cutoff on later releases.');
    const origin = new URL(values.RRFLOW_PUBLIC_ORIGIN || process.env.SITE_URL || '');
    assert(origin.protocol === 'https:' && !origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === '/', 'Hosted public origin must be a clean HTTPS origin.');
    assert(/^[0-9]+$/.test(process.env.PORT || '') && Number(process.env.PORT) > 0 && Number(process.env.PORT) <= 65535, 'Modelence must inject a valid PORT.');
    for (const scope of ['PERSONAL', 'WORK']) {
      assert(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(values[`QDRANT_${scope}_COLLECTION`] ?? 'rrflow_sources'), `QDRANT_${scope}_COLLECTION must be a bounded collection name.`);
      if (!values[`QDRANT_${scope}_URL`]) continue;
      const endpoint = new URL(values[`QDRANT_${scope}_URL`]);
      assert(endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && endpoint.pathname === '/', `QDRANT_${scope}_URL must be a clean HTTPS origin.`);
      assert(values[`QDRANT_${scope}_API_KEY`], `QDRANT_${scope}_API_KEY is required with its external URL.`);
    }
    if (values.QDRANT_PERSONAL_URL && values.QDRANT_WORK_URL) assert(new URL(values.QDRANT_PERSONAL_URL).origin !== new URL(values.QDRANT_WORK_URL).origin || (values.QDRANT_PERSONAL_COLLECTION ?? 'rrflow_sources') !== (values.QDRANT_WORK_COLLECTION ?? 'rrflow_sources'), 'Personal and Work must use distinct collections when sharing a Qdrant service.');
    console.log('PASS: runtime presence and format checks; no secret values printed or provider calls made.');
  }
  console.log('Not performed: dependency installation, build, HTTP smoke test, authentication or deployment.');
} catch (error) {
  // Assertion messages contain names and rules only. Never print assertion values or URL parse input.
  console.error(`Modelence preflight failed: ${error?.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : 'A file or configuration value is missing or invalid.'}`);
  process.exitCode = 1;
}
