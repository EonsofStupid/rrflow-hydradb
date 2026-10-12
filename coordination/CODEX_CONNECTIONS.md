# Codex connections console ownership

The connections worker owns only new `rrflow-app/apps/rrflow/src/lib/connections*.ts`, `src/components/connections/**`, `src/app/api/connections/**`, and `tests/connections.spec.ts`. Root Codex owns dashboard mounting and final verification/build/publication. Native HydraDB connector setup and organization-level indexing webhook controls; no new state store. Existing default-tenant connectors are outside this console. No live dummy writes during development; mutation paths use fixtures.
