import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { knowledgeClient } from './knowledge-client.mjs';

// Public RRFLOW project only. Raw context never goes to CI logs or artifacts.
let stage = 'trusted main-branch push';
try {
  if (process.env.GITHUB_ACTIONS === 'true' && (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_REPOSITORY?.toLowerCase() !== 'eonsofstupid/rrflow-hydradb')) throw new Error('Live knowledge verification requires this repository’s main-branch push.');
  const client = knowledgeClient();
  stage = 'registered project retrieval';
  const result = await client.query({ workspace: 'shippin', brain: 'work/rrflow/knowledge', question: 'What reviewed guidance and source evidence should govern changes to RRFLOW brain identity and context alignment?' });
  const run = result.run;
  assert.equal(run.workspace, 'shippin');
  assert.equal(run.brain.canonicalName, 'work/rrflow/knowledge');
  assert(run.requestId && run.evidence.length + run.guidance.length > 0, 'The native query returned no usable project context.');
  stage = 'saved read-back';
  const saved = await client.readRun({ workspace: run.workspace, brainId: run.brain.id, runId: run.id });
  stage = 'saved comparison';
  assert(isDeepStrictEqual(saved.run, run), 'Fresh HydraDB read did not match the returned context.');
  const summary = { runId: run.id, queryId: run.requestId, brainRevision: run.brain.revision, guidanceRevision: run.policyRevision, sourcePassages: run.evidence.length, reviewedInstructions: run.guidance.length, correctedPassagesExcluded: run.excluded.length, raindrop: result.observation.status, savedReadVerified: true };
  console.log(JSON.stringify(summary));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Registered RRFLOW knowledge path\n\n${Object.entries(summary).map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\nThis checks retrieval and saved provenance, not model quality or automatic learning.\n`);
} catch { console.error(`Knowledge verification failed during ${stage}. Inspect the protected dashboard and native receipts; source content is excluded from this log.`); process.exitCode = 1; }
