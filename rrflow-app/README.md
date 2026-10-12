# RRFLOW

A local context workspace for Jesse's personal and Shippin projects, with a dedicated engineering specialist, adapted from [Digo app-starter](https://github.com/digohq/app-starter) at `7c528e1407aeea502423b393f793f5b17c6caf4e`.

The active app is **`apps/rrflow`**. It reuses Digo's Next.js/TypeScript/Tailwind structure, shadcn/Radix button and dialog components, design-token conventions, and bundled Lexend font. The MIT license is preserved. Original `apps/web`, `apps/api`, and `packages` remain upstream references; they are excluded from the active pnpm workspace and do not run. The active app uses neither Prisma/Postgres/Redis nor Jest.

## Run on this workstation

Use Ubuntu WSL for all Node dependencies. Do not share node_modules between Windows Node and Linux Node.

From PowerShell in this `rrflow-app` directory (Git is rooted one level above):

```powershell
wsl -d Ubuntu -- bash /mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/wsl-run.sh install --frozen-lockfile
./scripts/start-local.ps1
```

Open **http://127.0.0.1:3100**. The launcher retrieves `hydradb_apy_key` and `RAINDROP_WRITE_KEY` from Infisical project `rrflow-hydradb`, environment `dev`, in the parent workspace. It passes them as server environment variables into WSL and sets `RAINDROP_PROJECT_ID=rrflow-hydradb`; it never writes a key file. The server binds only to loopback. The private research input is `../research/inputs/brain-sources.json`, excluded by the root Git ignore rules; it must not be published as part of the app.

For the production build:

```powershell
wsl -d Ubuntu -- bash /mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/wsl-run.sh build
# Stop the dev server before using the same port for production.
./scripts/start-local.ps1 -Mode start
```

The WSL helper currently names this workstation's Node 22.23.3 installation. Adapt that one path when moving machines. Development uses Webpack polling because Windows edits on `/mnt/d` did not reliably invalidate WSL Turbopack routes.

To compile without replacing the running server's build files, use a separate output directory. Switch servers only after the build succeeds:

```powershell
wsl -d Ubuntu -- env RRFLOW_DIST_DIR=.next-presentation bash /mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/wsl-run.sh build
# Stop the previous port-3100 server before launching this build.
./scripts/start-local.ps1 -Mode start -BuildDirectory .next-presentation
```

## What works

- Overview combines live HydraDB status, generated knowledge avenues, source revisions, Raindrop delivery receipts and feedback, lessons, and retrieval. Select **Build my workspace**, inspect its context, then choose **This helps** or **Missing context** on the same dashboard.
- Light/dark dashboard, native graph exploration, discipline search, source/question drill-down, responsive layout.
- Connectome with typed lessons/practices/sources, source evidence, native graph relationships, search, filters, and visible refresh times. Context avenues sit inside the connectome. Native HydraDB graph/context and Digo app-starter are directly linked.
- Existing folder or GitHub project selection, with Personal/Shippin scope, bounded metadata snapshots saved in HydraDB, exact GitHub commit references, and project-aware knowledge selection. It never executes discovered scripts.
- Native HydraDB connector catalog and setup, resource selection and sync controls. Organization-wide webhook controls expose scope before changes. Provider mutations are tested using fixtures; no new live connector or receiver is silently configured.
- GitHub pushes synchronize committed public source into HydraDB; the dashboard reports indexing progress and Raindrop acceptance. See [source sync details](docs/rrflow/GITHUB_SYNC.md).
- UI-driven, idempotent import of six research drafts: Engineering core (SWEBOK-aligned), Rust, Go, React, Next.js, TypeScript.
- Native hosted Cypher in **seniordev / rrflow** owns source revisions, discipline nodes, avenues, questions, and review plans. Source content is immutable per content hash. Plans link to the exact avenue revisions they used.
- A deterministic review planner composes core + selected discipline + TypeScript for React/Next.js, persists the plan, reloads it, and can delete it from the UI. Missing evidence stays pending.
- The Specialist brains view reads live readiness, indexed-passage/memory counts, lessons, and native hybrid retrieval from the five allowlisted HydraDB databases built by Claude.
- Native Raindrop reporting for specialist retrieval and user feedback, scoped to `rrflow-hydradb`, with bounded delivery and visible per-event status. A real browser-driven event and its feedback were read back in Raindrop. Fast/Deep retrieval is an explicit choice; no generated answer, experiment, or automatic improvement is claimed.
- Secrets stay server-side. API routes reject non-loopback hostnames and cross-site access. These restrictions are intentional until real account access exists.

## State and evidence

The discipline graph and managed company memories are distinct native HydraDB surfaces. They are not claimed to share internal node IDs. Explicit identity is `(database, collection, label, ext_id)` for graph records, and `(database, type, native ID)` for managed content. Active data is not dual-written to another app database. Browser state is transient; the theme preference is local presentation state.

Graph paths are native `EXTENDS`, `COMPOSES`, `HAS_AVENUE`, `ASKS`, and `USES_AVENUE` relationships. A saved plan proves routing and persistence, **not** code execution, model judgment, or passing engineering checks. Research drafts have unreviewed pass polarity and unverified technology-version claims. The core is SWEBOK-aligned research, not a licensed copy or certified coverage of the full SWEBOK.

Native request IDs are available in the workspace response, source drawer, and specialist view. No telemetry or screenshots include the HydraDB credential.

## Verify

Start the server, then run:

```powershell
wsl -d Ubuntu -- bash /mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/wsl-run.sh --filter @rrflow/app exec playwright install chromium
wsl -d Ubuntu -- bash /mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/wsl-run.sh verify
```

`verify` runs TypeScript, ESLint, and Playwright. Tests exercise real UI imports, native persistence/retry/deletion, source links, both themes, axe accessibility, mobile layout, input rejection, cross-site rejection, provider failure, and real recall. The initial import test intentionally writes the versioned research into the configured HydraDB collection. Run tests against an authorized workspace. Browser artifacts are ignored by Git.

## Still to build

Automatic personal/work classification, a correction inbox, public SaaS authentication/tenant authorization, provider-independent launch configuration, evidence-producing AI supervision, progressive inference, Raindrop replay/prompt comparison/promotion, and live infrastructure inventory. The UI labels those boundaries. No infrastructure or prompts have been changed by this app.

Team decisions and file ownership live in the parent workspace's `TEAM.md` and `coordination/` files.
