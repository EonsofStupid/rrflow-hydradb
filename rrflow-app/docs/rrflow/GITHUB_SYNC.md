# GitHub knowledge synchronization

The repository's `Sync repository to HydraDB` workflow runs on pushes to `main` and manual dispatch. It runs `node scripts/github-sync.mjs` from `rrflow-app/`. GitHub Actions credentials are encrypted secrets; no credential is written to the source tree.

The script reads only committed, allowlisted app source and app documentation. Its stable source identity is repository plus app-relative path. Citations and metadata use the actual repository-relative path, including `rrflow-app/`. Private research inputs, local settings, dependencies, test output and environment files are outside the sync scope.

The script calls HydraDB directly: native `POST /context/ingest` with `upsert=true`, `GET /context/status`, strict `DELETE /context`, and native Cypher `POST /byog/query`. The canonical manifest and progress checkpoint live in `rrflow_specialist/rrflow_sync`; no separate database tracks application state. The native GitHub connector currently indexes issues and comments; this push workflow supplies committed source files.

A queued upload is not searchable evidence. The workflow polls each source and records searchable only for `graph_creation` or `completed`. Deleted paths are retired only after current sources become searchable. Partial attempts retain their manifest so a retry can update or retire their sources. Corrupt manifests fail closed before writes. Transient deletion failures receive bounded retries. Source layout changes refresh citation metadata without changing stable IDs.

Raindrop receives a `github_repository_sync` event with commit, source counts and native request IDs. Its delivery is reported separately from knowledge readiness. A Raindrop failure fails the workflow while preserving the successful HydraDB checkpoint, so rerunning can retry delivery.

The Connections dashboard reads the checkpoint every 30 seconds while visible. It distinguishes source commit time, workflow update time, last successful sync and the time the UI checked HydraDB. Native request details and a workflow link support diagnosis and reruns. A failed refresh keeps the previous status visible with a warning.

Verification uses Playwright. The isolated fixture creates a temporary nested Git repository and simulates native provider responses to exercise add, no-op, edit, deletion retry, indexing failure/retry, malformed responses and corrupt checkpoints. It uses no live credentials. Browser tests exercise progress, readiness, Raindrop acceptance and read failures.
