# RRFLOW shared team brief

October 24 knowledge-path delivery: [implementation and native evidence](research/KNOWLEDGE_PATH_DELIVERY.md). Codex owns the registered knowledge service/API, Connectome path UI, local MCP/CLI and trusted-CI adapters, corresponding tests and source-date/sync wording. The real public RRFLOW repository is registered as `work/rrflow/knowledge` against existing sources. Isolated native verification proved a reviewed correction affects the next retrieval, with concurrency and scope guards. Both builds and the final 71-case regression passed; intermediate native readiness failures are retained in the handoff. Production owner guidance remains empty until actual review. Claude's SDK/freshness proposal, plugin configuration and owned app modules remain separate and untouched; his acknowledgment covers the previous identity delivery, not this new handoff. Modelence remains held.

October 24 identity continuation: [persistent brain identity delivery](research/BRAIN_IDENTITY_DELIVERY.md). Codex owns the scoped registry contract/service/API, Atlas registration/rename UI and reserved database guard. Claude's updated handoff records Jesse's choice of a dedicated `rrflow_registry` database, separate Personal/Work collections and a future reviewed `commons` scope. Codex aligned the new identity service and provisioned the dedicated registry after a count-only comparison; no existing identities needed migration. Native concurrency, fresh read-back and cleanup passed. Existing source databases/connections remain intact. Claude owns the freshness work, experiments and proposed capture migration; those files remain untouched. Final verification/publication evidence follows in the Codex handoff; no acknowledgment of this latest integration is claimed.

October 24 Source Atlas continuation: [delivery scope and verification](research/SOURCE_ATLAS_DELIVERY.md). Codex owns the new read-only Atlas inside Connectome, draft naming validation, its tests and CI inclusion. Existing native storage and routing are unchanged. Claude's freshness proposal remains separate and untouched; the latest Atlas handoff has no acknowledgment yet.

October 24 resumption: see [the current audit and cleanup checklist](coordination/RESUME_2026-10-24.md) and [the SWAG vision, decision and brain identity proposal](research/BRAIN_REGISTRY_DESIGN.md). Infisical is restored. Claude acknowledged the resume audit and owns a separate freshness/integration companion proposal; Codex owns the connection cleanup and verification. The collaboration-board binary is pending. The latest Codex implementation handoff is not yet acknowledged. Current checks and proposals are separate from the October 12–13 implementation history below.

Updated October 12, 2026. Codex and the existing Claude Code session work in the same active application: `rrflow-app/apps/rrflow`. Claude acknowledged this base in `coordination/CLAUDE_REPLY.md`.

## Product decisions

1. RRFLOW is the configurable engineering specialist for Jesse's shippin.cloud, shippin.ai, and shipping.buzz work.
2. RRFLOW supplies methodical reasoning and oversight using HydraDB's native capabilities. Avoid abstractions that merely rename a native API.
3. HydraDB owns authoritative knowledge, relationships, source revisions, runs, and future prompt promotion state. Do not add a second application database.
4. The intended connectome opens relevant knowledge avenues during inference. Current delivery provides native discipline graph exploration and deterministic plan routing; progressive model inference remains to build.
5. Playwright is the test and demonstration runner. No Jest in the active app.
6. Use the clean Digo starter, TypeScript, fast loading, responsive light/dark glass UI, and understandable goals, progress, findings, and evidence.
7. Required engineering checks need actual execution evidence. Research questions and model opinions cannot mark unrun checks as passed.
8. The research library includes Engineering core (SWEBOK-aligned), Rust, Go, React, Next.js, and TypeScript. Draft rules retain source provenance and unreviewed pass polarity.
9. Later infrastructure scope includes tailnet, dedicated Cisco servers, Proxmox WI/TX/VA, and homelab. These are supplied labels, not verified inventory.
10. Raindrop observes real interactions and supports candidate evaluation. Active prompt/rule revisions remain canonical in HydraDB; no automatic prompt promotion without evidence.
11. Secrets come from Infisical into server process memory. Never put values in code, browser data, screenshots, research, or handoffs.
12. Codex and Claude separate file ownership, exchange contracts, and review one combined experience.

## Current application and evidence

- Current release adds a password-protected owner workspace, a separate curated public event with a fixed cutoff, React Flow/Motion drill-down, provider-specific Connectome views, and Qdrant Cloud collections. Root verification passed TypeScript, lint and 53 Playwright cases; the opt-in live import was verified separately through the actual UI. Three Personal and three Work cloud sources were accepted and read back from their correct HydraDB destinations; a fresh native check on October 13 at 03:40 UTC reports all six indexing states completed. Both the three-minute film and the separate 4:50 lifecycle film are complete. The latter uses native Higgsfield editing, real UI footage, and 35 captions; see `submission/demo-media/lifecycle/README.md`. Modelence is live at https://rrflow-mv63m3vynl0-prod.cloud.modelence.app. Eight hosted Playwright access checks passed, including browser login/logout and a native public HydraDB read. The public cutoff is fixed at `2026-10-14T03:24:33.967Z`; preserve it on redeployment. Hosted Qdrant credentials still need environment configuration; local Cloud connections are verified. See `rrflow-app/docs/rrflow/MODELENCE_DEPLOYMENT.md`.

- Clean upstream: https://github.com/digohq/app-starter at `7c528e1407aeea502423b393f793f5b17c6caf4e`, branch `feat/rrflow-brains`.
- `rrflow-app/apps/rrflow` is the only active pnpm application. Digo's original apps/packages are preserved as inactive source reference. Rejected `app-starter/` feature commits were not imported.
- All Node dependencies and application execution use Ubuntu WSL. Launch from PowerShell with `rrflow-app/scripts/start-local.ps1`; use `-Mode start` after a production build.
- Local production URL: http://127.0.0.1:3100. The hosted service provides a single-owner password gate and a time-limited curated public event; multi-user SaaS identity and tenant authorization remain to build.
- Native hosted graph in `seniordev/rrflow`: 6 disciplines, 65 avenues, 304 draft questions, 7 discipline relationships. UI import/reimport, source drill-down, plan save/reload/retry/deletion are exercised with Playwright.
- Managed specialist databases: `rrflow_specialist`, `shippin_cloud`, `shippin_ai`, `shipping_buzz`, `seniordev`. Live readiness, counts, memory feed, and selected-brain hybrid retrieval come from HydraDB.
- Graph identity: database + collection + label + ext_id. Managed content identity: database + type + native ID. Do not assume BYOG node IDs and managed retrieval IDs are interchangeable.
- A single initial Workspace probe was written to default-tenant/rrflow before the team aligned on seniordev. No research was imported there; it is not an active second store.
- Production build and root pnpm verify passed, including 26 Playwright scenarios in 46.0 seconds. Overview now includes native HydraDB status, generated context, Raindrop delivery and feedback, lessons, and recall. Light/dark accessibility and mobile/desktop layout checks passed. See implementation evidence for the latest combined release.
- Native Raindrop cloud setup and real event/feedback read-back are verified for rrflow-hydradb. Both Infisical names match; the launcher uses canonical RAINDROP_WRITE_KEY. See implementation evidence for event and native request IDs.

## File ownership

| Owner | Files and responsibility |
| --- | --- |
| Codex | Main dashboard, discipline/source/review contracts and routes, `knowledge.ts`, app/root configuration, launcher, Playwright, `TEAM.md`, `WORKPLAN.md`, `TOOLING.md`, implementation evidence |
| Claude | `mesh.ts`, `mesh-contracts.ts`, `raindrop.ts`, mesh/recall/feedback routes, `components/live/**`, `/live` preview, `dogfood/**`, Claude/plugin configuration |
| Both | Native interfaces, canonical ownership, UI terminology, final integration review and truthful demonstration |

Codex owns the port-3100 production rebuild/restart. After Claude delivered the Raindrop slice, Codex completed the announced final integration fixes on mesh/live/raindrop and the small explorer lint fix. Current results and exact changes are in coordination/CODEX_REPLY.md; these files return to Claude after validation.

## Coordination and remaining work

The acknowledged coordination channel is separate files: Claude writes `CLAUDE_REPLY.md`; Codex writes `CODEX_REPLY.md`. A written handoff does not prove it was read. Do not claim an automatic direct messaging channel.

Claude's workspace watcher feeds selected non-secret coordination/research documents into the company brain; raw research inputs are excluded. This is development dogfooding, not a second app state store. The shared HydraDB agent plugin configuration points at seniordev; Claude reports its plugin installed. Codex plugin activation is not verified.

Next: expand verified retrieval and saved plans into evidence-producing engineering work, evaluated prompt revisions, and infrastructure discovery. See [WORKPLAN.md](WORKPLAN.md), [TOOLING.md](TOOLING.md), [implementation evidence](research/IMPLEMENTATION_EVIDENCE.md), and [research index](research/README.md). The hackathon's official scoring weights remain unverified; do not claim all judging points achieved.

## Added product direction: brain-driven UI

Jesse requests A2UI tooltips/modals from brains, clear quality-of-life status, and useful Raindrop feedback with fast loading. Codex owns `lib/brain-ui*.ts`, `components/brain-ui/**`, `/api/brain-ui/**`, and its Playwright tests. Native engineering graph reads generate the first interface; no model execution is implied. Claude delivered transparency/receipt integration at 14:53. Codex found and fixed the error-notification entry outcome edge case during integration. See research/A2UI_DELIVERY.md for the exact boundary and sources.

## Product alignment — personal life and Shippin work
RRFLOW's primary scope is Jesse's personal and work context, explicitly separated. Gmail, repositories, ambitions, lessons, and development practices feed a growing, inspectable connectome. Automatic classification must propose a scope and preserve human corrections; it is not yet complete. Engineering expertise is a specialist within this broader life/work system. Latest sources, memories, and workflow routes belong inside the connectome. Digo/app-starter is the credited foundation. See research/DEVPOST_ALIGNED.md for submission wording with honest capability boundaries.

The user explicitly assigns existing HydraDB default-tenant to Personal. Its Gmail/GitHub sources remain there. Shippin databases stay separate. The dashboard supports creation of additional native databases with Personal/Shippin membership saved in HydraDB. This assignment is a workspace boundary, not a claim that individual emails have been automatically classified.
