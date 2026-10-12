# RRFLOW shared team brief

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

- Clean upstream: https://github.com/digohq/app-starter at `7c528e1407aeea502423b393f793f5b17c6caf4e`, branch `feat/rrflow-brains`.
- `rrflow-app/apps/rrflow` is the only active pnpm application. Digo's original apps/packages are preserved as inactive source reference. Rejected `app-starter/` feature commits were not imported.
- All Node dependencies and application execution use Ubuntu WSL. Launch from PowerShell with `rrflow-app/scripts/start-local.ps1`; use `-Mode start` after a production build.
- Running URL: http://127.0.0.1:3100. This is a local single-user slice; public SaaS identity and tenant authorization remain to build.
- Native hosted graph in `seniordev/rrflow`: 6 disciplines, 65 avenues, 304 draft questions, 7 discipline relationships. UI import/reimport, source drill-down, plan save/reload/retry/deletion are exercised with Playwright.
- Managed specialist databases: `rrflow_specialist`, `shippin_cloud`, `shippin_ai`, `shipping_buzz`, `seniordev`. Live readiness, counts, memory feed, and selected-brain hybrid retrieval come from HydraDB.
- Graph identity: database + collection + label + ext_id. Managed content identity: database + type + native ID. Do not assume BYOG node IDs and managed retrieval IDs are interchangeable.
- A single initial Workspace probe was written to default-tenant/rrflow before the team aligned on seniordev. No research was imported there; it is not an active second store.
- Production build and root pnpm verify passed, including 25 Playwright scenarios. Light/dark and specialist-view automated axe checks passed. Mobile and desktop layout checks passed. See implementation evidence for the latest combined release.
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
