# Project tooling and clean baseline

## Current implementation checkpoint — October 12

Active app: `rrflow-app/apps/rrflow`; run and verification instructions are in `rrflow-app/README.md`. The current app runs on loopback port 3100 from `.next`, launched with `-Mode start -BuildDirectory .next -QdrantCloud`. Production build and root pnpm verify passed with 53 Playwright cases, followed by three repeated graph checks and a real public-mode login/logout smoke check. The six Qdrant Cloud sources have been imported into their separate HydraDB destinations. The workspace root is the single Git repository; earlier setup notes below are historical.

Both credentials are verified in Infisical Cloud, project `rrflow-hydradb`, environment `dev`, root path `/`:
- `hydradb_apy_key` → server `HYDRA_DB_API_KEY`.
- `RAINDROP_WRITE_KEY` → server `RAINDROP_WRITE_KEY`. Claude stored this canonical name; it matches the existing `raindrop_apikey` exactly.

Native `raindrop cloud setup --local --project rrflow-hydradb` succeeded with WSL CLI 0.1.21. Jesse completed the CLI OAuth sign-in. Its returned write key was compared in memory with Infisical `raindrop_apikey` and matches exactly. The setup-generated root `.env` is absent; `.gitignore` now excludes `.env*`. Existing HydraDB MCP configuration survived setup. Credentials are injected through the PowerShell launcher into the WSL process; no key is required in an app file. Project ID is explicitly `rrflow-hydradb`.

Raindrop event delivery and feedback read-back are now verified in the actual project UI; see the recorded event and native HydraDB request IDs in implementation evidence. Replay, prompt evaluation, and promotion remain to build. Runtime app graph data belongs to `seniordev/rrflow`. Detailed evidence: `research/IMPLEMENTATION_EVIDENCE.md`.

The earlier setup notes below are historical, including their earlier unverified/write-not-performed statements.

## Verified Infisical and HydraDB access

Verified October 12, 2026 after Jesse authorized using the available Infisical
access for the HydraDB cloud key.

- Active Infisical profile: `https://app.infisical.com/api`, organization
  `DevPULSE`, project `rrflow-hydradb`.
- Project ID: `5efd9650-d015-4618-87d6-9ecdb167410e`.
- The native `infisical init` command created the root `.infisical.json`
  binding. It contains project configuration only, not secret values.
- The HydraDB credential was retrieved from environment `dev`, root path `/`,
  under the exact existing secret name `hydradb_apy_key`. Preserve that spelling
  when requesting it; no secret was renamed or copied into a source file.
- Fetch credentials into process memory or inject them into a server process.
  Never print secret values, write a plaintext `.env` from them, or put them
  in browser code. Specify the recorded Infisical domain and environment.

Earlier notes anticipated a self-hosted Infisical URL. The profile and project
actually available and verified now are on Infisical Cloud. No secret migration
was performed. This record supersedes the earlier pending URL/project status.

| Read-only check | Observed result | Request ID |
| --- | --- | --- |
| HydraDB `GET /databases`, `API-Version: 2` | Authenticated successfully; one database, `default-tenant`; no failed databases reported | `e77d4e1b-3222-4df9-ad63-266b2ce57124` |
| HydraDB `GET /databases/status?database=default-tenant` | Scheduler and graph ready; knowledge and memory vector stores ready; `ready_for_ingestion: true` | `8ae11b9b-4bfd-4888-a349-aa68727f6239` |

Requests used `https://api.hydradb.com` with the key in an authorization header.
Credential values were kept in process memory and suppressed from outputs.
No database was created or modified, and no project/private data was ingested.
The existing `default-tenant` is an observed available database, not a newly
chosen production isolation strategy. Graph/context identity, write semantics,
retrieval, MCP connectivity, and workload performance remain unverified.

## Raindrop

Raindrop is configured as a project-local assistant tool for monitoring and
evaluation work. No application telemetry has been enabled or sent.

- Claude Code: `.mcp.json`, HTTP server `https://mcp.raindrop.ai/mcp`.
- Codex: `.codex/config.toml`, the same HTTP server.
- Official skills: `raindrop-setup` and `raindrop-investigate` under
  `.agents/skills/` for Codex and `.claude/skills/` for Claude Code.
- Skill source: `https://github.com/raindrop-ai/skills`, pinned at
  `d0e21c3fac39744130252380d20ef0affdb1943e`. Both copies use the same revision.

Launch agents from this workspace root. Codex discovers the skills on the next
turn; restart if they do not appear. Project MCP configuration requires a trusted
project. Claude currently reports that enabling the project MCP needs approval:
start `claude`, use `/mcp`, select `raindrop`, and authenticate when prompted.

For Codex, use `/mcp` in a new trusted project session. The standalone MCP command
did not discover the local config in this setup. This explicit override was
verified and starts OAuth without adding a global MCP server:

```powershell
codex -c 'mcp_servers.raindrop.url="https://mcp.raindrop.ai/mcp"' mcp login raindrop
```

Codex OAuth sign-in succeeded. Claude authentication and a live MCP tool call
remain unverified. In the connected client, list available projects and select
the actual hackathon project before querying or writing data. Do not silently use `default`
or `*`. The remote project has not been selected or created.

Runtime credentials should come from the verified Infisical project above.
Raindrop runtime credentials and instrumentation have not been verified by the
HydraDB access check. Keep write keys and Query API credentials distinct.
OAuth for assistant access does not instrument the app.

References: [MCP](https://www.raindrop.ai/docs/mcp/overview.md),
[skills](https://www.raindrop.ai/docs/integrations/skills.md),
[projects](https://www.raindrop.ai/docs/platform/projects.md).

## Clean upstream

The user wants a fresh implementation base and does not want the previous
implementation carried forward. Preserve the existing checkout until the
replacement is established; do not merge its feature commits into the new base.

Verified local Git facts on October 12, 2026:

- `app-starter/` is a Git repository; the workspace root is not.
- Its `origin` is `https://github.com/digohq/app-starter.git`.
- Live upstream `main` is `7c528e1407aeea502423b393f793f5b17c6caf4e`.
- Local `main` has two additional commits: `fcb7f05` (radar brain) and
  `13a6a9d` (README). The tracked worktree was clean when inspected.

The intended replacement upstream URL is pending. If the original starter is
selected, create a fresh checkout from its upstream commit and give our own
repository the `origin` remote, with Digo as `upstream`. If a new empty codebase
is selected, start it separately. Do not push product work to Digo's repository.
Do not add private research to a public repository as part of synchronization.

## Problem statements

Use [the verified event brief and problem template](research/HACKATHON_ALIGNMENT.md)
to review each problem statement before committing to a UI or implementation.
