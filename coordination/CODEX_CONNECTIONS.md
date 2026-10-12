# Codex connections console ownership

The connections worker owns only new `rrflow-app/apps/rrflow/src/lib/connections*.ts`, `src/components/connections/**`, `src/app/api/connections/**`, and `tests/connections.spec.ts`. Root Codex owns dashboard mounting and final verification/build/publication. Native HydraDB connector setup and organization-level indexing webhook controls; no new state store. Existing default-tenant connectors are outside this console. No live dummy writes during development; mutation paths use fixtures.

## Delivered source freeze

Export: `ConnectionsConsole` from `rrflow-app/apps/rrflow/src/components/connections/connections-console.tsx`.
Native server/API/contracts: `src/lib/connections.ts`, `src/lib/connections-contracts.ts`, `src/app/api/connections/route.ts`.
Playwright: `tests/connections.spec.ts` (mocked external mutations, real route invalid-input/cross-origin boundary checks).

Implemented provider catalog and credential requirements, create account -> discover -> select sources -> configure/start sync, native status/source detail, pause/resume/sync now, 30-second visible-tab overview refresh. Only the five managed RRFLOW databases appear or can be targeted. Existing default-tenant Gmail is untouched. GitHub explicitly says issues/comments; no code-sync overclaim.

Webhook UI explicitly labels its organization-wide scope and outbound direction. Native registration, atomic signing secret generation, explicit test, recent delivery history. Public HTTPS validation includes DNS/address rejection of local/private ranges. Secret appears masked with explicit copy, only in current view; none stored by app, no receipt logging. Existing signing secret is preserved unless explicitly checking regeneration. Credentials clear after create attempt. No webhook or connector mutation was made during development.

Live read-only evidence: GitHub provider returned issues + issue_comments and access_token credential schema; GET /webhooks/indexing returned registered:false, request e79f82e4-2ea9-4819-9778-8133f6826aa7.

Validation: focused app typecheck passed before test addition; focused ESLint and second typecheck run reported separately to root. Root owns final build and combined Playwright on rebuilt port 3100. No fixtures count as real connector creation/delivery evidence.

Limits: provider credential JSON branch is for nested schemas; native HydraDB performs final credential validation. No OAuth popup implemented. Sync requests are not labeled indexed/completed. No automatic personal/work classification or Gmail access has been implemented here. User must provide the desired provider credential in the local UI and a real public webhook receiver to create those connections.

## Database manager ownership

New user steering: default-tenant is Personal. This supersedes earlier outside-RRFLOW presentation for that database. Connections worker now owns only new `src/lib/databases*.ts`, `src/components/databases/**`, `src/app/api/databases/**`, `tests/databases.spec.ts`. Root integrates and updates old connector scope separately. Native registry: rrflow_specialist / rrflow, label DatabaseWorkspace, ext_id=database name, workspace=personal|shippin. Built-in mappings remain explicit; no existing database membership overwrite. No live create during development.

## Database manager delivered

Export `DatabaseManager` from `rrflow-app/apps/rrflow/src/components/databases/database-manager.tsx`; `/api/databases` GET returns `{databases:[{name,workspace,ready,status,graph,knowledge,memories}],checkedAt,receipts,warnings?}`. `DatabaseSummary` is exported from `lib/databases-contracts.ts`.

GET reads native database catalog, registry, then actual native provisioning readiness in batches of six. `ready` is only the native `infra.ready_for_ingestion` boolean; HTTP success cannot mark readiness. Existing default-tenant is explicitly Personal; company + service databases are Shippin; seniordev is practice. Saved registry assignments load for new databases. Failed registry reads show a warning and preserve built-in scopes; unknown scopes remain unassigned.

POST requires user's new lowercase database name and Personal/Shippin choice. Checks native existing/failed databases first. Reserves chosen membership with `MERGE ... ON CREATE SET` in rrflow_specialist/rrflow, then calls native `POST /databases` with `{database:name}` and standard managed settings. It never overwrites existing assignments or databases. If the registry write fails, no create call follows. If native creation fails, the reserved intent remains canonical in HydraDB for a same-name/scope retry; it is not shown as a database unless native catalog confirms existence. An existing database is never recreated on retry.

UI creates only on explicit submission; shows provisioning state, Personal/Shippin scope, last read time, 30-second visible-tab refresh and per-brain graph/knowledge/memory readiness. Creation banner follows later refreshed readiness. Root integrates manager under Connections and dedicated Databases navigation. No live new database was created during development.

Validation: root reported typecheck pass with new files. Focused initial lint passed; final lint rerun pending. Three Playwright scenarios delivered: fixture creation/provisioning-to-ready/accessibility/mobile; invalid-input/cross-origin rejections; real protected-existing-database rejection proving only a native catalog GET and unchanged Personal scope. Root runs these against rebuilt production output. A discarded direct server module fixture attempt failed at server-only import; no implementation defect or native mutation resulted, and the temporary test harness was removed.
Initial focused database ESLint completed successfully (exit 0); final rerun session 1164 was still running at 15:59.

Final focused database ESLint rerun completed successfully (exit 0). Production source is frozen; combined build and Playwright remain root-owned.
