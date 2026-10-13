// Prepare only explicitly reviewed footage. Run with WSL Node; never reads app secrets.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const media = dirname(here);
const captures = JSON.parse(readFileSync(join(media, 'recordings/lifecycle/manifest.json'), 'utf8'));
const retrievalName = process.argv[2];
if (!retrievalName || !/^06-[a-z-]+\.webm$/.test(retrievalName)) throw new Error('Pass the exact reviewed successful retrieval filename.');
const retrieval = captures.find(x => x.file === retrievalName && x.status === 'captured');
if (!retrieval) throw new Error('Retrieval capture is not successful.');
const mapping = [
  ['intro.mp4', 'rrflow-concept-intro-web.mp4'],
  ['entry.webm', 'recordings/01-entry.webm'],
  ['preview.webm', 'recordings/02-source-preview.webm'],
  ['close.webm', 'recordings/06-close.webm'],
  ['confirmation.webm', 'recordings/lifecycle/05-human-confirmation.webm'],
  ['graph.webm', 'recordings/lifecycle/01-native-graph-ready.webm'],
  ['qdrant.webm', 'recordings/lifecycle/02-cloud-work-source-ready.webm'],
  ['sync.webm', 'recordings/lifecycle/03-code-sync-ready.webm'],
  ['learning.webm', 'recordings/lifecycle/04-development-learning.webm'],
  ['retrieval.webm', `recordings/lifecycle/${retrievalName}`],
  ['raindrop.webm', 'recordings/lifecycle/07-raindrop-delivery.webm'],
];
mkdirSync(join(here, 'inputs'), { recursive: true });
const inputs = mapping.map(([file, source]) => {
  const path = join(media, source);
  if (!existsSync(path)) throw new Error(`Missing source: ${source}`);
  if (source.includes('recordings/lifecycle/')) {
    const capture = captures.find(x => source.endsWith(x.file));
    if (capture?.status !== 'captured') throw new Error(`Unsuccessful source: ${source}`);
  }
  copyFileSync(path, join(here, 'inputs', file));
  return { file, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), reviewed: true, original: source };
});
const c = (start, end, text, position = 'bottom') => ({ start, end, text, position });
const scene = (id, duration, file, from, label, loop, captions, extras = {}) => ({
  id, duration, label, loop, reviewed: true, captionsReviewed: true,
  provenance: id === 'intro' ? 'Higgsfield concept illustration' : ['entry','preview','close'].includes(id) ? 'Curated public demo · local recording' : 'Owner workspace · local production',
  shots: [{ file, from, duration }], captions, ...extras,
});
const manifest = {
  version: 1, reviewed: true, finalReviewApproved: false, targetSeconds: 290,
  editorial: 'Silent captioned film. Actual UI at recorded speed. No synthetic narrator. Source cuts and editorial overlays do not change app results.',
  hostedEvent: { url: 'https://rrflow-mv63m3vynl0-prod.cloud.modelence.app', verifiedAt: '2026-10-13T03:35:00Z', evidence: 'Root hosted Playwright smoke: 8 checks passed; public six-source native HydraDB read; private API 401; login/logout and CSRF verified.', expiresAt: '2026-10-14T03:24:33.967Z' },
  inputs,
  scenes: [
    scene('intro', 8, 'intro.mp4', 0, 'Concept illustration', 'user', [
      c(.4, 7.6, 'Your context. Your work. Your next attempt.\nConnected through evidence.'),
    ]),
    scene('entry', 15, 'entry.webm', .3, '01 · Use RRFLOW · public walkthrough', 'user', [
      c(.4, 6.8, 'Personal life and Shippin work.\nOne clear view, with separate boundaries.'),
      c(7, 14.7, 'This public walkthrough uses fictional Personal examples\nand already-public work sources.'),
    ]),
    scene('preview', 27, 'preview.webm', 1, '01 · Inspect the source · public preview', 'user', [
      c(.3, 8.4, 'Open a source. Understand why it belongs here.\nKeep the original revision within reach.'),
      c(8.6, 18.8, 'Try another home and inspect the result.\nThis public action is a preview for this visit.'),
      c(19, 26.8, 'The distinction matters:\na preview and a saved decision are different.'),
    ]),
    scene('confirmation', 35, 'confirmation.webm', 4.5, '02 · Confirm a real placement · public Work source', 'user', [
      c(.3, 7.4, 'This access-control source belongs to Shippin work.\nA person confirms the correct suggestion.', 'top'),
      c(8.2, 16.3, 'Saved in HydraDB. Raindrop accepted the review event.\nThe original source stays in its database.', 'top'),
      c(17.1, 25.1, 'Refresh, then reopen.\nThe human confirmation is still there.', 'top'),
      c(25.4, 34.8, 'This decision applies to this source.\nIt does not silently create a rule for everything.', 'top'),
    ], { previewAt: 24 }),
    scene('graph', 28, 'graph.webm', 2.8, '03 · Explore the specialist · native HydraDB graph', 'user', [
      c(.3, 6.9, 'Six engineering disciplines. Seven recorded relationships.\nOpen the knowledge behind a specialist.', 'top'),
      c(7.7, 12.5, 'TypeScript opens its research origin\nand source-backed avenues.'),
      c(13.4, 20.7, 'Inspect the questions before relying on them.\nDraft research remains explicitly marked as draft.'),
      c(21.8, 27.8, 'A relationship is inspectable evidence,\nwith a direction and an origin.', 'top'),
    ], { previewAt: 17 }),
    scene('qdrant', 24, 'qdrant.webm', 3.7, '04 · Connect existing sources · Qdrant Cloud to HydraDB', 'user', [
      c(.3, 6.1, 'Existing Work context comes from Qdrant Cloud.\nThe destination is the Shippin HydraDB database.'),
      c(6.7, 16.5, 'Inspect the source and its public revision.\nIts identity stays attached to the imported knowledge.'),
      c(17, 23.8, 'These three Work records are indexed in HydraDB.\nThe interface shows each record’s last import.'),
    ], { shots: [{ file: 'qdrant.webm', from: 3.7, duration: 10 }, { file: 'qdrant.webm', from: 22.7, duration: 14 }], previewAt: 19 }),
    scene('sync', 40, 'sync.webm', 2.9, '05 · Develop RRFLOW · code becomes shared knowledge', 'development', [
      c(.3, 7.2, 'Now use the same discipline to build RRFLOW.\nMain-branch changes trigger configured source sync.'),
      c(7.8, 15, 'The checkpoint links the public workflow and commit.\nHydraDB owns the recorded synchronization state.'),
      c(15.7, 23.5, 'This read shows 111 searchable sources,\nwith 103 finished through every indexing stage.', 'top'),
      c(23.8, 31.6, 'This incremental run found zero changed files.\nIt did not freshly ingest all 111 sources.', 'top'),
      c(31.9, 39.8, 'Source changes, checks and native request IDs\nremain available for inspection.', 'top'),
    ], { previewAt: 25 }),
    scene('learning', 48, 'learning.webm', 2.9, '06 · Capture automatically · review the lesson', 'development', [
      c(.3, 5.8, 'The latest CI observation was captured automatically.\nForty-one actual checks, tied to commit 06c7de09.'),
      c(6.4, 13.7, 'Open the versioned evidence schema.\nIt records outcomes; it does not invent a diagnosis.'),
      c(14.6, 23.8, 'Inspect the passing graph regression check\nand its pinned source assertion.', 'top'),
      c(24.9, 32.5, 'An earlier, imported CI case became a reviewed lesson:\na broad alert selector matched two messages.'),
      c(32.8, 40.6, 'The reviewed correction targets the intended alert.\nA linked later run passed that same check.'),
      c(40.9, 47.8, 'The failure, correction and follow-up stay together.\nA person reviewed this lesson; code was not fixed autonomously.'),
    ], { previewAt: 35 }),
    scene('retrieval', 35, 'retrieval.webm', retrieval.suggestedTrimStartSeconds, '07 · Retrieve the lesson · context for the next change', 'development', [
      c(.3, 8.3, 'Ask for the reviewed failure-state UI practice.\nSearch only the saved lesson collection.'),
      c(8.6, 16.8, 'HydraDB returns the reviewed lesson as one result.\nThe diagnosis and correction travel with it.'),
      c(17.1, 25.2, 'The practice is specific: scope the alert check\nto its intended region and error message.'),
      c(25.5, 34.8, 'The next developer can inspect and reuse this context.\nRetrieval is demonstrated; an automatic code change is not.'),
    ], { previewAt: 23 }),
    scene('raindrop', 23, 'raindrop.webm', 2.9, '08 · Observe the loop · actual Raindrop delivery', 'development', [
      c(.3, 6, 'Raindrop accepted the workflow event: HTTP 200.\nThe recorded event identity is visible.', 'top'),
      c(6.5, 14.5, 'Native request IDs connect this status\nto the same synchronization evidence.', 'top'),
      c(14.8, 22.8, 'Delivery, saved evidence and reviewed practice are distinct.\nAn accepted event alone does not prove improved quality.', 'top'),
    ], { previewAt: 10 }),
    scene('close', 7, 'close.webm', 1, 'RRFLOW · inspect, decide, remember, improve', 'development', []),
  ],
};
const selected = captures.filter(x => x.status === 'captured' && mapping.some(([, source]) => source.endsWith(x.file)));
writeFileSync(join(here, 'capture-evidence.json'), JSON.stringify({ captures: selected, privacyReview: 'Only curated public examples, public Work source context, engineering research and service receipts. No credentials, personal inbox or secret provider fields.' }, null, 2));
writeFileSync(join(here, 'edit-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ seconds: manifest.scenes.reduce((n, x) => n + x.duration, 0), sources: inputs.length, captions: manifest.scenes.reduce((n, x) => n + x.captions.length, 0) }));
