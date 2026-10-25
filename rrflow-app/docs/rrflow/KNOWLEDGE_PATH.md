# Registered project knowledge

RRFLOW now has one knowledge path for the protected dashboard, local MCP tools,
CLI and trusted main-branch CI. HydraDB remains the authoritative store. This is
retrieval with reviewed guidance and saved evidence, not an autonomous coding
agent or a claim that a model has been trained.

## Use the dashboard

Open **Workspace → Connectome → Knowledge path**. Choose Personal or Shippin,
select a registered brain, and ask a project question. Each result shows the
registered binding, exact native source IDs, source commits when available,
sync dates, query request ID and saved run. The React Flow diagram explains
that provenance route; it does not invent a HydraDB semantic subgraph.

Choose **Review this context** to record owner vision or correct particular
passages. The explicit review stores an immutable decision and advances a native
revision guard. Ask again to inspect which exact passages were excluded and
which current instructions were included. Replacing a correction preserves its
history and cannot replace a vision decision. No rule is promoted by telemetry.

HydraDB sync timestamps are not original email/document dates. Source dates
remain unknown unless provenance provides them. The repository sync's legacy
`searchable` wire field means graph_creation/completed; the UI now labels it
as a processing checkpoint. Actual retrieval is checked separately.

## Connect a project without application edits

In the expandable connection panel, load an existing folder or GitHub repository
and explicitly select its existing database/collection. This registers a pointer;
it does not upload all project files or create/configure a connector. Configure
ingestion in Connections first. Use a dedicated collection for new projects.

The CLI accepts the same operation as JSON:

```json
{
  "project": { "kind": "github", "workspace": "shippin", "location": "owner/repository" },
  "projectSlug": "my-project",
  "displayName": "My project",
  "database": "shippin_cloud",
  "collection": "my-project",
  "expectedRegistryRevision": 1
}
```

Use the current revision returned by `pnpm knowledge list shippin`; stale saves
fail rather than overwrite. Run `pnpm knowledge connect /path/to/manifest.json`
from `rrflow-app` in WSL. Folder projects require a dedicated collection; mixed
default collections cannot identify their sources. A failed registry write can
leave the independently saved project pointer; refresh before retrying.

RRFLOW's existing public source binding is `rrflow_specialist` / default
collection, registered as `work/rrflow/knowledge`. Because this is legacy mixed
storage, query metadata filters by its GitHub repository and returned chunks
are checked again. A source without matching repository provenance is excluded.
New projects should use dedicated collections. No existing source was moved.

## CLI and MCP

With the local owner server running:

```sh
pnpm knowledge list shippin
pnpm knowledge query shippin work/rrflow/knowledge "What governs brain identity?"
node scripts/verify-knowledge.mjs
```

`RRFLOW_BASE_URL` defaults to `http://127.0.0.1:3100`. The client accepts loopback
HTTP only; remote authenticated client access is not implemented. Native provider
credentials stay in the server process, loaded from Infisical.

MCP clients launch `scripts/knowledge-mcp.mjs` using WSL Node. For this checkout:

```json
{
  "command": "wsl.exe",
  "args": ["-d", "Ubuntu", "--", "/home/devcontainers/.local/share/fnm/node-versions/v22.23.3/installation/bin/node", "/mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/knowledge-mcp.mjs"]
}
```

The three tools are `list_registered_brains`, `get_project_knowledge` and
`read_knowledge_run`. Querying saves a run and reports telemetry, so it is not
annotated as read-only. No tool promotes guidance or accepts a raw database
override. This configuration example does not mean an existing Claude/Codex
session has activated the server; configure/restart that client separately.

## CI and observation

Trusted main pushes start a loopback server, resolve the registered RRFLOW brain,
retrieve real context and verify its saved native read-back. Missing/empty
context fails the check; the existing learning capture records the actual step
outcome. Pull requests run fixture checks without credentials. Public CI logs
contain IDs/counts only, never retrieved passages. Source sync and CI can run
concurrently, so this check does not claim all retrieved content is the new commit.

Raindrop receives run/revision IDs, counts and review signals through the existing
integration. UI delivery status means acceptance, not evaluated improvement.
Corrections also send native HydraDB feedback using the original query request ID;
delivery failure is shown separately from the already-saved review.

## Limits and next integration

- Owner-reviewed SWAG vision is separate from external source claims. Automated
  OpenAI/Cloudflare release intake and reviewed commons sharing remain to build.
- Exclusion matches exact source content fingerprints. Changed passages require
  renewed review; this is not semantic contradiction detection.
- Session memories are explicitly unreviewed records. They are not practices.
- At most 100 review decisions and ten recent runs are read. Reconciliation is
  required at the review-history bound; no silent truncation promotes guidance.
- Personal/Work checks apply through this owner API. Broad native provider keys
  do not become separately authorized multi-user credentials through naming.
- The existing single-owner access controls and fixed public event expiry apply.
  This delivery does not redeploy Modelence or reopen the expired event.
