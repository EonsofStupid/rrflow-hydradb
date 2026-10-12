# RRFLOW implementation evidence — October 12, 2026

## Source and ownership

Clean Digo clone: `rrflow-app`, branch `feat/rrflow-brains`, upstream commit `7c528e1407aeea502423b393f793f5b17c6caf4e`. Rejected old feature commits are absent. The active app is `apps/rrflow`; original Digo source is retained as inactive reference. Codex owns the main UI, discipline graph, review planner, and verification. Claude acknowledged the shared base and owns mesh, live components, and workspace dogfood sync.

## Runtime evidence so far

- Infisical key obtained from the existing project, not the key pasted into chat. Credential never persisted in the app repo or sent to the browser.
- First native graph contract write: default-tenant/rrflow, Workspace `shippin`, request `d91fe621-4f22-4b55-94e5-bcf609e802a0`. Only this task-owned probe was written there. Initial imports were rejected at the app origin guard before reaching HydraDB.
- Team aligned the active graph owner with `seniordev`, collection `rrflow`. Successful UI import creates **6 disciplines, 65 avenues, 304 questions, 7 inter-discipline relationships**. The app now reads and writes there only.
- GET workspace native evidence: `a31af8cf-9da5-4023-9477-125180442177`, `298549aa-ad43-4a56-ae17-0280b3d7a2a0`, `c1987408-506a-42f2-afab-34fe281e4b8f`.
- Source counts: core 13 avenues / 67 questions; Rust 12 / 53; Go 10 / 57; React 9 / 46; Next.js 11 / 38; TypeScript 10 / 43.
- Source/question drill-down, reimport idempotency, persisted review reload/retry/deletion all pass in production Playwright runs. Two task-owned plans left by earlier interrupted tests were deleted by their exact UUIDs; no user plans were removed.
- Light-mode contrast failures detected by axe were corrected. Focused Playwright rerun passed both themes' accessibility scans, theme persistence, mobile layout, invalid-input rejection, and cross-site write rejection.
- Production build passed through compilation, type checking, page generation, and final route output. Root `pnpm verify` passed TypeScript, ESLint, and seven Playwright scenarios. Final rerun passed after the card/layout, mobile overflow, and Improvement-copy fixes: seven tests in 17.9 seconds, no retries.
- Raindrop native cloud setup succeeded for `rrflow-hydradb`. WSL CLI 0.1.21 reused Jesse's successful OAuth sign-in. Infisical `RAINDROP_WRITE_KEY` and `raindrop_apikey` both match its write key, compared without printing values. The launcher uses the canonical `RAINDROP_WRITE_KEY`. Root generated `.env` is absent; both providers' credentials are injected into server process memory.

## Raindrop read-back verified

Observed in the actual Raindrop UI, project `rrflow-hydradb`, on October 12:
- `rrflow_setup` and live `workspace_sync` events arrived.
- Event `0d426672-9f38-482b-a765-cf6551c84482` came from Playwright driving the RRFLOW UI. It contains the actual question “Why does infisical secrets get fail in Git Bash?” and five retrieved source excerpts, attributed to this local workspace's operator `jesse`.
- Details show `kind=retrieval`, `recall_mode=fast`, `outcome=evidence_returned`, `hit_count=5`, native HydraDB request `cc06272c-0c50-4c25-9d9e-c663fe699b16`, and measured query latency 341 ms. This is one local observation, not a benchmark.
- The same event displays signal `answer_helpful` after the browser submitted feedback. Read-back proves arrival beyond HTTP acceptance.
- [Verified event](https://app.raindrop.ai/events?org=ea2ca283&project=rrflow-hydradb&event=0d426672-9f38-482b-a765-cf6551c84482&tab=overview).

Instrumentation awaits bounded native HTTP acceptance and exposes failures while preserving the retrieved result. It records retrieval mode as metadata, without inventing an LLM model name. Search depth is chosen explicitly. No automatic negative verdict is emitted merely because search returned no matches. Prompt replay, measured improvement, and promotion remain unimplemented.

## Native boundaries

The discipline graph uses hosted BYOG/Cypher. Claude's company knowledge and lesson feed use native managed ingestion/list/query. Cross-surface identity sharing is not claimed. Sources and plan state remain in HydraDB; no second app database was introduced. Raindrop retrieval/feedback delivery is verified. Actual model execution, evidence-producing code execution, public identity, and infrastructure discovery remain to build.

## Local issues fixed

- A bounded credential leak check compared both actual secrets in memory against 75 source/test/client-bundle text files (37 compiled browser files). No exact values matched; root `.env` was absent. Values were never printed.
- One local HTTP observation before the final CSS-only fix: HTML response 80 ms, real workspace response 350 ms. This measures this workstation's warm responses, not browser rendering, cold start, or an external performance benchmark.

- Next normalized request.url to localhost while the browser used 127.0.0.1. Same-origin checks now validate loopback Host and compare Origin with that host.
- Windows edits under /mnt/d did not invalidate WSL Turbopack routes. Development switched to Webpack with one-second file polling; production uses the same bundler. The previous server was stopped explicitly after Windows Ctrl-C left its WSL child alive.
