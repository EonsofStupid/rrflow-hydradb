# GitHub synchronization worker ownership

Codex worker repository_sync owns scripts/github-sync.mjs, lib/repository-sync*.ts, components/repository-sync/**, app/api/repository-sync/**, tests/repository-sync.spec.ts and its isolated fixture harness, docs/rrflow/GITHUB_SYNC.md. Parent Codex owns workflows, README, dashboard integration, production build/restart, final validation and public commit/push. No production writes by this worker. Canonical checkpoint remains HydraDB rrflow_specialist/rrflow_sync; application reads it directly.
