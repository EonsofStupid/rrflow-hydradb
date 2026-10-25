# Registered project knowledge path — October 24, 2026

This milestone connects the protected RRFLOW dashboard, a local MCP server, CLI
and trusted CI to the same registered-brain retrieval service. HydraDB stores
canonical brain identity, immutable context runs and reviewed decisions. There
is no second application database or editable search-card layer.

## Delivered behavior

- **Connectome → Knowledge path** resolves an explicit Personal/Work brain,
  checks its current native assignment and expected revision, retrieves source
  documents or explicitly unreviewed session records, and saves the exact bundle.
- The UI shows its provenance route, source IDs, exact source commits when
  available, known/unknown source dates, separate sync dates and query receipts.
  Motion respects reduced-motion preferences; both themes and mobile are tested.
- Owner vision and corrections are distinct decisions. Reviewed corrections
  exclude matching content fingerprints on later runs. Replacements preserve
  history; a correction cannot replace a vision entry. A concurrent review must
  win the native expected-revision guard. Drafts survive rejected saves.
- Native retrieval receives bounded current guidance as `additional_context`;
  the saved bundle retains all current guidance. Source text is evidence, not
  permission to change instructions or invoke tools.
- The connection panel and JSON manifest bind an existing project to existing
  source storage without app edits. It does not bulk ingest repository contents.
  New projects should use dedicated collections. Legacy GitHub mixed storage is
  filtered by repository and validated again on returned chunks.
- The official MCP SDK exposes list/query/read tools, with no review or raw
  database-override tool. Query is correctly marked as a write because it saves
  audit evidence and emits telemetry. Existing agent sessions are not silently
  reconfigured. Claude's configuration files remain his responsibility.
- Trusted main-branch CI retrieves through the same owner API and verifies a
  fresh saved read. Its actual outcome enters existing CI learning evidence.
  PR tests have no provider credentials. Public logs contain only IDs/counts.
- Raindrop receives metadata and review signals through the existing integration.
  Acceptance is shown separately from evaluated improvement. A correction can
  send HydraDB feedback tied to its original query; failure does not undo the
  committed review. Live owner correction feedback awaits an actual owner review.

## Native evidence

Real public RRFLOW registration:

- Project: `project-05c7ee6529d6fbef02967762`.
- Brain: `brain-65552bef-4a52-4337-a3cb-cd2e68c6daf0`.
- Address: `work/rrflow/knowledge`; revision 1.
- Existing binding: `rrflow_specialist` / default collection; no source migration.
- Registration request: `e4dd74ce-e882-42c1-9d2a-69eb80c25b31`.
- First run: `2dde78ce-e375-42bf-bc3f-afe155214053`; query
  `3abe242f-6606-4362-91ea-2f710965d04c`; six source passages, guidance revision 0,
  saved read verified and Raindrop accepted.

An isolated native test used a uniquely named temporary registry collection,
the real service and actual public repository retrieval. It returned four
passages, accepted exactly one of two concurrent reviews, then excluded all
four matching passages and included the accepted instruction on the next query.
Fresh read-back matched, stale review failed and Personal could not resolve
the Work brain. Decisions were labeled `playwright-verification` rather than
production owner guidance. No negative native relevance feedback was sent for
this artificial verification correction.

- First native query: `48d74425-8d64-4c22-a710-0be4c76bfa4d`.
- Corrected next query: `c1499bcf-ab57-444e-ab8b-5bec0afa8ac2`.
- Cleanup confirmed zero remaining temporary nodes:
  `68aff5f2-9a91-4fc2-b0b4-6a57694968b2`.

Live MCP query `e9ddcb40-e9d0-4930-8ad5-1dd14d92ddce` returned seven passages
and exact saved read-back. Live browser query
`a546a937-b665-4ca8-b36a-94be352e5d3c` returned seven passages with no page errors;
one local run including screenshot completed in about 1.4 seconds. This is an
observation, not a latency guarantee. Both Raindrop deliveries were accepted.

## Boundaries and coordination

Original source timestamps remain unknown unless explicit source provenance
supplies them. Observation times and native ingest times are not source dates.
Sync labels now say graph processing reached rather than promise retrieval
visibility. The legacy `searchable` wire field is preserved for compatibility.

The React Flow diagram explains the route used, not an invented entity graph.
Native managed graph context remains off here pending cross-collection relation
scope verification. Claude's SDK/freshness work, plugin migration, mesh and
Raindrop implementation are untouched. The resource-update OpenAPI contract
examined exposes ACL and custom instructions, not generic project metadata
stamping; the exact evidence is in the Codex handoff.

SWAG vision intake is explicit owner review. Automated provider release intake,
reviewed commons sharing, semantic contradiction handling and autonomous prompt
promotion remain future work. This is a tested review-driven learning loop,
not proof of autonomous model improvement. No production owner decisions were
fabricated. Modelence and the expired public access cutoff remain unchanged.

## Final local validation

Both production builds passed. Root `pnpm verify` passed TypeScript, lint and
**71 Playwright cases**, with one optional native Qdrant import skipped and no
retries. Two earlier runs encountered native fetch/readiness timeouts; they are
not counted as passes. After builds finished, the unchanged live assertions
passed in the complete 1.4-minute regression. The failures and native receipts
remain recorded in the handoff for Claude's transport/freshness work.

The final CI provenance adjustment adds the repository identifier to ingested
verification observations so the project filter can admit future CI evidence.
Its four capture tests and TypeScript check passed separately after the full
regression. It changes no application bundle. All **708** app/CI/deployment
inputs match the Linux verification copy; manifest SHA256
`5c45cb51c6bb6297f23bd25490413d1a1c44326c48b8dddb186a61e014dd3432`.

The shared checkout's `.next-knowledge-path` build passed live UI and MCP
checks on staging port 3101: query `88c73151-09ac-48ab-bda2-54a21d3aa528`
through MCP with exact saved read-back, and query
`fe46d804-8c76-405e-b4ba-64bb730f8328` through the browser, both returning
seven passages with accepted Raindrop delivery. Browser page errors: zero.
Its cold startup was delayed by Windows-mounted WSL file I/O; the working
page query completed in about 1.4 seconds. The same build replaces port 3100.

Usage and client contract: [KNOWLEDGE_PATH.md](../rrflow-app/docs/rrflow/KNOWLEDGE_PATH.md).
Publication checks follow this commit; do not infer GitHub success from local results.
