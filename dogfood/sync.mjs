#!/usr/bin/env node
// Dogfood sync: keeps the team's real working documents in the company brain
// (HydraDB database `rrflow_specialist`) so RRFLOW learns from how it is built.
//
//   node dogfood/sync.mjs           sync changed documents once
//   node dogfood/sync.mjs --watch   keep syncing every 30 seconds
//
// The HydraDB key is read from Infisical into memory only and never printed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = join(ROOT, 'dogfood', '.state.json');
const DATABASE = 'rrflow_specialist';
const WATCH_INTERVAL_MS = 30_000;

/** Which documents count as company knowledge, and what kind each one is. */
const SOURCES = [
  { path: 'TEAM.md', kind: 'decision' },
  { path: 'WORKPLAN.md', kind: 'plan' },
  { path: 'TOOLING.md', kind: 'setup' },
  { path: 'AGENTS.md', kind: 'instructions' },
  { dir: 'coordination', kind: 'coordination' },
  { dir: 'research', kind: 'research' }, // top level only; research/inputs holds third-party source copies
];

// A document that looks like it carries a credential is never sent anywhere.
const SECRET_PATTERNS = [
  /sk_(live|test)_[A-Za-z0-9._-]{16,}/,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9._\-/+]{24,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const listDocuments = () => SOURCES.flatMap(source => {
  if (source.path) return existsSync(join(ROOT, source.path)) ? [{ rel: source.path, kind: source.kind }] : [];
  const dir = join(ROOT, source.dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith('.md') && statSync(join(dir, name)).isFile())
    .map(name => ({ rel: posix.join(source.dir, name), kind: source.kind }));
});

const idFor = rel => `workspace:${rel}`;

/** Markdown links between workspace documents become HydraDB relations (the connectome's cross-links). */
const linkedIds = (rel, text, known) => {
  const ids = new Set();
  for (const match of text.matchAll(/\]\(([^)#\s]+\.md)(#[^)]*)?\)/g)) {
    const target = posix.normalize(posix.join(posix.dirname(rel), match[1]));
    if (known.has(target) && target !== rel) ids.add(idFor(target));
  }
  return [...ids];
};

const readSecret = name => {
  try {
    return execFileSync('infisical', [
      'secrets', 'get', name, '--env=dev', '--path=/',
      '--domain=https://app.infisical.com/api', '--plain', '--silent',
    ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
  } catch {
    return '';
  }
};

const readKey = () => {
  const key = readSecret('hydradb_apy_key');
  if (!key) throw new Error('Infisical returned no HydraDB key. Run `infisical login` and retry.');
  return key;
};

/** Each sync is also reported to Raindrop (project rrflow-hydradb); skipped quietly without a write key. */
const reportToRaindrop = async (writeKey, result) => {
  if (!writeKey || !result.sent) return;
  await fetch('https://api.raindrop.ai/v1/events/track', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${writeKey}`, 'Content-Type': 'application/json', 'X-Raindrop-Project-Id': 'rrflow-hydradb' },
    body: JSON.stringify([{
      event_id: `workspace-sync-${result.requestId}`,
      user_id: 'rrflow-dogfood',
      event: 'workspace_sync',
      properties: { brain: DATABASE, documents_sent: result.sent, documents: result.documents, hydradb_request_id: result.requestId },
    }]),
  }).catch(() => undefined);
};

const loadState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {});

const syncOnce = async key => {
  const documents = listDocuments();
  const known = new Set(documents.map(doc => doc.rel));
  const state = loadState();
  const changed = [];
  for (const doc of documents) {
    const text = readFileSync(join(ROOT, doc.rel), 'utf8');
    const hash = createHash('sha256').update(text).digest('hex');
    if (state[doc.rel] === hash) continue;
    if (SECRET_PATTERNS.some(pattern => pattern.test(text))) {
      console.warn(`skipped ${doc.rel}: it looks like it contains a credential`);
      continue;
    }
    const relations = linkedIds(doc.rel, text, known);
    changed.push({
      doc, hash,
      item: {
        id: idFor(doc.rel),
        title: `${doc.rel} — ${text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? doc.rel}`,
        type: 'workspace_doc',
        url: `file:///${relative('/', join(ROOT, doc.rel)).replace(/\\/g, '/')}`,
        timestamp: statSync(join(ROOT, doc.rel)).mtime.toISOString(),
        content: { text },
        tenant_metadata: { kind: doc.kind, source_system: 'workspace', service: 'all' },
        additional_metadata: { path: doc.rel, sha256: hash },
        ...(relations.length ? { relations: { ids: relations, properties: { relation: 'links_to' } } } : {}),
      },
    });
  }
  if (!changed.length) return { sent: 0 };

  const form = new FormData();
  form.set('type', 'knowledge');
  form.set('database', DATABASE);
  form.set('upsert', 'true');
  form.set('app_knowledge', JSON.stringify(changed.map(entry => entry.item)));
  const response = await fetch('https://api.hydradb.com/context/ingest', {
    method: 'POST', body: form, signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${key}`, 'API-Version': '2' },
  });
  const body = await response.json().catch(() => ({}));
  const requestId = response.headers.get('x-request-id') ?? body?.meta?.request_id ?? 'none';
  if (!response.ok || body.success === false) {
    throw new Error(`HydraDB rejected the sync (${response.status}, request ${requestId}): ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
  }
  // Remember a document only after HydraDB accepted it, so a failure is retried next time.
  for (const entry of changed) state[entry.doc.rel] = entry.hash;
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  return { sent: changed.length, requestId, documents: changed.map(entry => entry.doc.rel) };
};

const run = async () => {
  const key = readKey();
  const raindropKey = readSecret('RAINDROP_WRITE_KEY');
  const report = async () => {
    try {
      const result = await syncOnce(key);
      await reportToRaindrop(raindropKey, result);
      const at = new Date().toLocaleTimeString();
      console.log(result.sent
        ? `${at} sent ${result.sent} changed document(s) to ${DATABASE} (request ${result.requestId}): ${result.documents.join(', ')}`
        : `${at} no document changes`);
    } catch (error) {
      console.error(`${new Date().toLocaleTimeString()} sync failed: ${error.message}`);
      process.exitCode = 1;
    }
  };
  await report();
  if (process.argv.includes('--watch')) setInterval(report, WATCH_INTERVAL_MS);
};

await run();
