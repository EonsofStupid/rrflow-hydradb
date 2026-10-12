import 'server-only';
import { createHash } from 'node:crypto';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { BrainId } from './contracts';
import type { ServiceReceipt } from './mesh-contracts';
import { projectContextSchema, projectSummarySchema, type ProjectContext, type ProjectContextInput } from './project-context-contracts';

const database = process.env.HYDRA_DB_DATABASE || 'seniordev';
const collection = process.env.HYDRA_DB_COLLECTION || 'rrflow';
const maxFiles = 400;
const maxManifests = 12;
const maxManifestBytes = 48_000;
const excluded = /^(?:\..*|node_modules|vendor|target|dist|build|coverage|out|test-results|playwright-report|research|inputs|secrets?|credentials?|certs?|keys?|\.next)$/i;
const sensitive = /(?:^|[._-])(?:secret|secrets|credential|credentials|password|token|tokens|private|passwd|shadow|id_rsa|id_ed25519)(?:[._-]|$)|\.(?:pem|key|p12|pfx|env|sqlite|db)$/i;
const allowedExtensions = /\.(?:tsx?|jsx?|rs|go|json|toml|mod|sum|ya?ml|css|scss|html|md|txt|graphql|proto|sh|ps1|py|sql)$/i;
const manifestNames = new Set(['package.json', 'Cargo.toml', 'go.mod']);
const checkNames = new Set(['lint', 'test', 'test:e2e', 'e2e', 'type-check', 'typecheck', 'type-check:all', 'check', 'build', 'verify']);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const safePath = (value: string) => value.split('/').every(part => part && part !== '..' && !excluded.test(part) && !sensitive.test(part) && !/[\x00-\x1f\x7f]/.test(part));
const isProjectFile = (value: string) => safePath(value) && (allowedExtensions.test(value) || /(?:^|\/)(?:Dockerfile|Makefile)$/.test(value));
const manifestPath = (value: string) => value.split('/').length <= 5 && manifestNames.has(path.posix.basename(value));

/** An explicit Windows drive path resolves to the same mounted folder when Next runs in WSL. */
export const normalizeProjectFolder = (input: string) => {
  if (/[\x00-\x1f]/.test(input) || /^\\\\/.test(input)) throw new Error('Use an absolute local folder path; network shares are not supported.');
  const normalized = process.platform === 'linux' && /^[a-z]:[\\/]/i.test(input)
    ? `/mnt/${input[0].toLowerCase()}/${input.slice(3).replaceAll('\\', '/')}` : input;
  if (!path.isAbsolute(normalized)) throw new Error('Enter an absolute project folder, such as D:\\localdev\\my-project or /home/me/my-project.');
  const resolved = path.resolve(normalized);
  if (resolved === path.parse(resolved).root || /^\/mnt\/[a-z]$/.test(resolved)) throw new Error('Choose a project folder, not an entire drive.');
  return resolved;
};

export const parseGithubProject = (input: string) => {
  let repository = input;
  if (input.startsWith('https://')) {
    let url: URL;
    try { url = new URL(input); } catch { throw new Error('Enter a GitHub repository URL or owner/repository.'); }
    if (url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash) throw new Error('Use a github.com repository URL without credentials, query strings, or fragments.');
    repository = url.pathname.replace(/^\/+|\/+$/g, '');
  }
  repository = repository.replace(/\.git$/, '');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repository) || repository.endsWith('/..') || repository.endsWith('/.')) throw new Error('Enter owner/repository or https://github.com/owner/repository. Select the repository root.');
  return repository;
};

type Inspection = { files: string[]; contents: Map<string, string>; revision?: string; updatedAt: string | null; truncated: boolean; warnings: string[] };

const inspectFolder = async (root: string): Promise<Inspection> => {
  let rootInfo;
  try { rootInfo = await lstat(root); } catch { throw new Error('That folder is unavailable to the RRFLOW server. Check the path and its permissions.'); }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Choose a real project directory; symbolic-link roots are not supported.');
  const resolvedRoot = await realpath(root);
  const result: Inspection = { files: [], contents: new Map(), updatedAt: null, truncated: false, warnings: [] };
  let visited = 0;
  let newest = 0;
  const pending = [''];
  while (pending.length && visited < 2500 && result.files.length < maxFiles) {
    const relative = pending.shift()!;
    let entries;
    try { entries = await readdir(path.join(resolvedRoot, relative), { withFileTypes: true }); }
    catch { result.warnings.push(`Could not list ${relative || 'the project folder'}.`); continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      visited += 1;
      if (visited > 2500 || result.files.length >= maxFiles) { result.truncated = true; break; }
      const candidate = relative ? `${relative}/${entry.name}` : entry.name;
      if (!safePath(candidate) || entry.isSymbolicLink()) continue;
      const absolute = path.join(resolvedRoot, candidate);
      const actual = await realpath(absolute).catch(() => '');
      if (!actual || !actual.startsWith(`${resolvedRoot}${path.sep}`)) continue;
      if (entry.isDirectory()) {
        if (candidate.split('/').length < 5) pending.push(candidate); else result.truncated = true;
        continue;
      }
      if (!entry.isFile() || !isProjectFile(candidate)) continue;
      result.files.push(candidate);
      const info = await lstat(absolute).catch(() => null);
      if (!info?.isFile() || info.isSymbolicLink()) continue;
      newest = Math.max(newest, info.mtimeMs);
      if (!manifestPath(candidate) || result.contents.size >= maxManifests) continue;
      if (info.size > maxManifestBytes) { result.warnings.push(`Skipped oversized manifest ${candidate}.`); continue; }
      // O_NOFOLLOW also closes the final-component symlink race on the WSL host.
      const handle = await open(absolute, process.platform === 'linux' ? 0x20000 : 'r').catch(() => null);
      if (!handle) { result.warnings.push(`Could not safely read ${candidate}.`); continue; }
      try {
        const current = await handle.stat();
        if (!current.isFile() || current.size > maxManifestBytes) continue;
        const buffer = Buffer.alloc(maxManifestBytes + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        if (bytesRead > maxManifestBytes) continue;
        result.contents.set(candidate, buffer.subarray(0, bytesRead).toString('utf8'));
      } finally { await handle.close(); }
    }
  }
  if (pending.length) result.truncated = true;
  result.updatedAt = newest ? new Date(newest).toISOString() : null;
  return result;
};

const githubJson = async (endpoint: string): Promise<unknown> => {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const response = await fetch(`https://api.github.com${endpoint}`, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(response.status === 404 ? 'GitHub could not find this repository. For a private repository, configure GITHUB_TOKEN on the server.' : response.status === 403 || response.status === 429 ? 'GitHub access is denied or rate-limited. Check the server token or retry later.' : `GitHub could not read the repository (${response.status}).`);
  if (Number(response.headers.get('content-length') || 0) > 6_000_000) throw new Error('GitHub returned more metadata than this project preview can safely load.');
  if (!response.body) throw new Error('GitHub returned no repository metadata.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > 6_000_000) throw new Error('This repository tree exceeds the preview limit. Select a smaller repository.'); chunks.push(item.value); } }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const inspectGithub = async (repository: string): Promise<Inspection> => {
  const commit = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/), commit: z.object({ committer: z.object({ date: z.string() }).nullable() }) }).parse(await githubJson(`/repos/${repository}/commits/HEAD`));
  const tree = z.object({ truncated: z.boolean(), tree: z.array(z.object({ path: z.string(), type: z.string(), mode: z.string(), sha: z.string(), size: z.number().optional() })) }).parse(await githubJson(`/repos/${repository}/git/trees/${commit.sha}?recursive=1`));
  const candidates = tree.tree.filter(item => item.type === 'blob' && item.mode !== '120000' && isProjectFile(item.path));
  candidates.sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
  const files = candidates.slice(0, maxFiles).map(item => item.path);
  const result: Inspection = { files, contents: new Map(), revision: commit.sha, updatedAt: commit.commit.committer?.date || null, truncated: tree.truncated || candidates.length > maxFiles, warnings: [] };
  const manifests = candidates.filter(item => files.includes(item.path) && manifestPath(item.path)).slice(0, maxManifests);
  await Promise.all(manifests.map(async item => {
    if (!item.size || item.size > maxManifestBytes || !/^[a-f0-9]{40}$/.test(item.sha)) { result.warnings.push(`Skipped oversized or empty manifest ${item.path}.`); return; }
    const blob = z.object({ encoding: z.literal('base64'), content: z.string(), size: z.number().max(maxManifestBytes) }).parse(await githubJson(`/repos/${repository}/git/blobs/${item.sha}`));
    const content = Buffer.from(blob.content, 'base64');
    if (content.length <= maxManifestBytes) result.contents.set(item.path, content.toString('utf8'));
  }));
  return result;
};

const summarize = (input: ProjectContextInput, location: string, data: Inspection): ProjectContext => {
  const stack = new Set<BrainId>();
  const technologies = new Set<string>();
  const manifests: ProjectContext['manifests'] = [];
  const checks: ProjectContext['checks'] = [];
  for (const [file, content] of [...data.contents.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const found: string[] = []; const commands: string[] = [];
    if (file.endsWith('package.json')) {
      let manifest: { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown>; scripts?: Record<string, unknown>; packageManager?: unknown };
      try { manifest = JSON.parse(content); if (!manifest || typeof manifest !== 'object') throw new Error('not an object'); }
      catch { data.warnings.push(`Could not parse ${file}; its contents were not stored.`); continue; }
      const dependencies = new Set([...Object.keys(manifest.dependencies || {}), ...Object.keys(manifest.devDependencies || {})]);
      for (const [dependency, brain] of [['next', 'nextjs'], ['react', 'react'], ['typescript', 'typescript']] as const) if (dependencies.has(dependency)) { stack.add(brain); found.push(dependency); }
      for (const dependency of ['@playwright/test', 'vitest', 'eslint', 'tailwindcss', 'zod', 'express', '@nestjs/core']) if (dependencies.has(dependency)) found.push(dependency);
      const manager = typeof manifest.packageManager === 'string' ? manifest.packageManager.split('@')[0] : data.files.includes('pnpm-lock.yaml') || data.files.includes('pnpm-workspace.yaml') ? 'pnpm' : data.files.includes('yarn.lock') ? 'yarn' : 'npm';
      const runner = ['pnpm', 'yarn', 'npm', 'bun'].includes(manager) ? manager : 'npm';
      for (const name of Object.keys(manifest.scripts || {})) if (checkNames.has(name)) commands.push(`${runner} run ${name}`);
    } else if (file.endsWith('Cargo.toml')) {
      stack.add('rust'); found.push('rust'); commands.push('cargo check', 'cargo test');
      for (const dependency of ['tokio', 'axum', 'serde', 'actix-web']) if (new RegExp(`^\\s*${dependency}\\s*=`, 'm').test(content)) found.push(dependency);
    } else if (file.endsWith('go.mod')) { stack.add('go'); found.push('go'); commands.push('go test ./...', 'go vet ./...'); }
    for (const technology of found) technologies.add(technology);
    manifests.push({ path: file, technologies: found, checks: commands });
    for (const command of commands) checks.push({ directory: path.posix.dirname(file), command, status: 'not_run' });
  }
  if (data.files.some(file => /\.tsx?$/.test(file))) stack.add('typescript');
  if (data.files.some(file => /\.rs$/.test(file))) stack.add('rust');
  if (data.files.some(file => /\.go$/.test(file))) stack.add('go');
  const topics = new Set<string>(technologies);
  for (const [pattern, words] of [
    [/(?:^|\/)(?:api|routes|server)(?:\/|\.)/, ['api', 'server', 'validation', 'data']],
    [/(?:test|spec)\./, ['testing', 'verification']],
    [/(?:^|\/)(?:components|ui|pages|app)(?:\/|\.)/, ['components', 'interface', 'accessibility']],
    [/(?:auth|session)/, ['authentication', 'authorization']],
    [/(?:schema|contracts)/, ['types', 'validation', 'contracts']],
  ] as const) if (data.files.some(file => pattern.test(file))) for (const word of words) topics.add(word);
  if (!manifests.length) data.warnings.push('No supported package.json, Cargo.toml, or go.mod was readable in the bounded preview. File extensions still inform specialist selection.');
  if (data.truncated) data.warnings.push('This is a bounded preview: up to 400 paths, 12 manifests, and five folder levels. Some project content is outside this snapshot.');
  const revision = data.revision || hash(JSON.stringify({ files: [...data.files].sort(), manifests, stack: [...stack].sort(), topics: [...topics].sort() }));
  return projectContextSchema.parse({
    id: `project-${hash(`${input.kind}:${location}`).slice(0, 24)}`, kind: input.kind,
    name: input.kind === 'github' ? location : path.basename(location), location,
    ...(input.kind === 'github' ? { url: `https://github.com/${location}` } : {}),
    revision, revisionKind: input.kind === 'github' ? 'git_commit' : 'metadata_fingerprint',
    loadedAt: new Date().toISOString(), sourceUpdatedAt: data.updatedAt,
    stack: [...stack], files: data.files, manifests, checks, topics: [...topics], warnings: [...new Set(data.warnings)].slice(0, 20),
    bounds: { listedFiles: data.files.length, inspectedManifests: manifests.length, truncated: data.truncated },
  });
};

const projectQuery = async <T>(query: string, params: Record<string, unknown>, schema: z.ZodType<T>, receipts: ServiceReceipt[], action: string): Promise<T> => {
  if (!process.env.HYDRA_DB_API_KEY) throw new Error('HydraDB is unavailable. Start RRFLOW through the Infisical launcher.');
  const receipt: ServiceReceipt = { service: 'HydraDB', action, method: 'POST', endpoint: '/byog/query', database, httpStatus: null, outcome: 'failed', requestId: null, latencyMs: null, at: new Date().toISOString() };
  const started = performance.now();
  try {
    const response = await fetch('https://api.hydradb.com/byog/query', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(35_000), headers: { Authorization: `Bearer ${process.env.HYDRA_DB_API_KEY}`, 'API-Version': '2', 'Content-Type': 'application/json' }, body: JSON.stringify({ database, collection, query, params }) });
    receipt.httpStatus = response.status; receipt.requestId = response.headers.get('x-request-id');
    if (!response.ok) throw new Error(`HydraDB could not complete the project operation (${response.status}).`);
    const body = z.object({ success: z.literal(true), data: schema, meta: z.object({ request_id: z.string().optional() }).optional() }).parse(await response.json());
    receipt.requestId = body.meta?.request_id || receipt.requestId; receipt.outcome = 'ok'; return body.data;
  } catch (error) { receipt.error = error instanceof z.ZodError ? 'HydraDB returned unexpected project data.' : error instanceof Error ? error.message : 'Project context could not be saved.'; throw new Error(receipt.error); }
  finally { receipt.latencyMs = Math.round(performance.now() - started); receipts.push(receipt); }
};

export const inspectAndSaveProject = async (input: ProjectContextInput, receipts: ServiceReceipt[]) => {
  const location = input.kind === 'folder' ? normalizeProjectFolder(input.location) : parseGithubProject(input.location);
  const context = summarize(input, location, input.kind === 'folder' ? await inspectFolder(location) : await inspectGithub(location));
  const snapshotId = `${context.id}:${context.revision}`;
  // Graph records are authoritative; the browser holds only the selected project ID.
  await projectQuery(`MERGE (w:Workspace {ext_id: $workspace})
    MERGE (p:Project {ext_id: $id})
    MERGE (s:ProjectContext {ext_id: $snapshotId})
    SET s.payload = $payload, s.revision = $revision, s.loaded_at = $loadedAt,
      p.name = $name, p.kind = $kind, p.location = $location, p.revision = $revision,
      p.loaded_at = $loadedAt, p.stack = $stack, p.active_snapshot = $snapshotId
    MERGE (w)-[:HAS_PROJECT]->(p) MERGE (p)-[:HAS_CONTEXT]->(s)
    RETURN p.ext_id AS id`, {
    workspace: 'shippin', id: context.id, snapshotId, payload: JSON.stringify(context), revision: context.revision,
    loadedAt: context.loadedAt, name: context.name, kind: context.kind, location, stack: context.stack,
  }, z.array(z.object({ id: z.string() })).min(1), receipts, 'Saved project context and source revision');
  return context;
};

export const loadProjectContext = async (id: string, receipts: ServiceReceipt[]) => {
  const rows = await projectQuery(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_PROJECT]->(p:Project {ext_id: $id})-[:HAS_CONTEXT]->(s:ProjectContext)
    WHERE s.ext_id = p.active_snapshot RETURN s.payload AS payload LIMIT 1`, { workspace: 'shippin', id }, z.array(z.object({ payload: z.string() })), receipts, 'Read saved project context');
  if (!rows.length) throw new Error('The saved project was not found. Load its folder or GitHub repository again.');
  return projectContextSchema.parse(JSON.parse(rows[0].payload));
};

export const listProjectContexts = (receipts: ServiceReceipt[]) => projectQuery(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_PROJECT]->(p:Project)
  RETURN p.ext_id AS id, p.kind AS kind, p.name AS name, p.location AS location,
    p.revision AS revision, p.loaded_at AS loadedAt, p.stack AS stack
  ORDER BY p.loaded_at DESC LIMIT 25`, { workspace: 'shippin' }, z.array(projectSummarySchema), receipts, 'Read saved project pointers');
