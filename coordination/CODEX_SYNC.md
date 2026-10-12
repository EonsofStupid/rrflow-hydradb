# GitHub synchronization worker ownership

Codex worker repository_sync owns scripts/github-sync.mjs, lib/repository-sync*.ts, components/repository-sync/**, app/api/repository-sync/**, tests/repository-sync.spec.ts and its isolated fixture harness, docs/rrflow/GITHUB_SYNC.md. Parent Codex owns workflows, README, dashboard integration, production build/restart, final validation and public commit/push. No production writes by this worker. Canonical checkpoint remains HydraDB rrflow_specialist/rrflow_sync; application reads it directly.

## Delivery

Stable implementation: `rrflow-app/scripts/github-sync.mjs`; `rrflow-app/apps/rrflow/src/lib/repository-sync{,-contracts}.ts`; `components/repository-sync/repository-sync.tsx`; `app/api/repository-sync/route.ts`; `tests/repository-sync.spec.ts`; `tests/helpers/repository-sync-fixture.mjs`; `rrflow-app/docs/rrflow/GITHUB_SYNC.md`.

`RepositorySync` is exported for the parent Connections integration. The panel reads canonical HydraDB status, refreshes every 30 seconds while visible, shows actual source/checked/workflow times, processing/readiness/failure counts, Raindrop delivery and native receipts. No credentials reach the browser. A failed refresh preserves prior status with a visible warning.

Nested-root correction: native stable source IDs stay app-relative, while GitHub citations and metadata paths include Git's sourceRoot prefix (`rrflow-app/`). Existing checkpoints without sourceRoot force one refresh of all source metadata on the next workflow run; content identity remains unchanged.

Pure Playwright behavior verification passed: 1 test, 3.7 seconds. It creates only an isolated temporary Git fixture, mocks provider transport and tests add, no-op, edit, delete/retry, failed indexing/retry, malformed status, corrupt checkpoint and foreign manifest. No live writes, builds, server restarts, commits or pushes by this worker. Parent owns combined build, full checks, browser fixture test and release.
