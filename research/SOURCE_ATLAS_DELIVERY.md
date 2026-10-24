# Source Atlas delivery — October 24, 2026

Follow-on implementation: [persistent logical brain registration](BRAIN_IDENTITY_DELIVERY.md) adds explicit owner writes below the native database cards. The read-only inspection and draft-planner behavior described below remains available; the new registration section has its own verified write contract.

## What is implemented

Open **Connectome → Source Atlas** in the owner workspace. The lazily loaded view composes the existing protected APIs; HydraDB remains the authoritative store. No new database, SDK layer, project assignment, provider connection or migration was introduced.

- Separate Personal, Shippin work and engineering practice views, populated from the current native database catalog and verified workspace assignments.
- Database cards show ingestion readiness independently from connector state. Native names are preserved. Existing mesh labels are display labels only.
- Drill into a database's configured connector defaults, collection, last sync attempt, last successful sync and active-resource count. Resource overrides are explicitly outside this summary; the existing connection mutation guards still validate them before sync/resume/configure.
- Read named collections, then stored sources or memories, then original record content and native request receipts. Inferred content is separately labeled. Each list is bounded to its first page of 12 records, with the returned total or an explicit unknown total. This is a bounded inspection view, not a complete inventory or a freshness assertion.
- Saved folder/GitHub project pointers retain their original location, revision and snapshot date. The view does not infer project-to-brain ownership from a repository or database name. Missing assignments are visible.
- The Work view reads RRFLOW's actual repository sync checkpoint: commit, source update, latest phase, searchable count, completed count, failed count, last successful sync and Raindrop delivery status. These states are not conflated with successful evaluation or autonomous improvement.
- An owner-visible reconciliation section lists unassigned native databases and unresolved connectors. Inspection does not change their placement.
- The proposed name planner validates `<personal|work>/<project-slug>/<purpose>` with a shared strict TypeScript/Zod contract. Purposes are knowledge, practice, catalog and intake. Invalid case, whitespace, path separators, repeated hyphens and unknown fields are rejected. This is a draft planner: persistence, uniqueness, stable IDs, rename aliases and revision checks remain future work.

SWAG remains the user's versioned vision and decision context. This delivery does not activate provider watches, ingestion of OpenAI/Cloudflare releases, model inference or automatic rule promotion. The conceptual record separation remains in `BRAIN_REGISTRY_DESIGN.md`.

## Data and interaction boundaries

Data loads on opening the Atlas and on explicit refresh; this view does not claim a background synchronization job. A new scope, collection, record type or refresh invalidates old results. Aborted and delayed responses cannot populate the new selection. Returned list and detail identities must match the selected database/collection/type before their bodies appear. Unexpected API data and failed inventories appear as unknown or failed, rather than empty success.

All reads use the existing owner access gate. Workspace tabs are organization within the single-owner experience, not a new multi-user authorization system. Unassigned metadata is owner-only under the existing gate. Qdrant's existing source/import UI remains in Connectome → Memories & context → Qdrant source records.

The Atlas adds no writes. The full existing verification suite separately exercises authorized research reimport, temporary review/project records and Raindrop test events under its established cleanup behavior.

## Files and verification

- `rrflow-app/apps/rrflow/src/lib/source-atlas-contracts.ts`
- `rrflow-app/apps/rrflow/src/components/source-atlas/source-atlas.tsx`
- `rrflow-app/apps/rrflow/src/components/source-atlas/source-atlas.module.css`
- `rrflow-app/apps/rrflow/src/components/knowledge-map/connectome.tsx`
- `rrflow-app/apps/rrflow/src/components/dashboard.tsx`: one lazy import changed to the Connectome view switch.
- `rrflow-app/apps/rrflow/tests/source-atlas.spec.ts`: naming, scoped navigation, source content, race conditions, mismatched detail identity, unavailable inventory, refresh, keyboard return focus, light/dark accessibility, mobile layout and one live read-only case.
- `.github/workflows/ci.yml`: includes the four isolated Atlas cases in the credentialless suite; the live case remains local.

Both production builds and the five focused Atlas cases passed. Final root `pnpm verify` passed TypeScript, lint and **61 Playwright tests**, with one existing optional import skipped and no retries. Linux verification uses a temporary non-Git snapshot to avoid cold imports through the Windows mount; all 692 application/CI/deployment input hashes match the shared checkout after verification. The running application uses the shared checkout's `.next-atlas` build. Local screenshots and the exact input manifest stay in ignored `test-results-atlas/`; no private source content is committed as demonstration media. Native connection configuration and source placement are unchanged. Modelence is not redeployed by this slice.

## Next foundation work

1. Select the canonical namespace and purpose vocabulary with Jesse; the planner previews the current proposal only.
2. Verify native conditional-write behavior before implementing persisted unique names, stable identities, expected revisions and aliases.
3. Resolve project/source/brain links with explicit reviewed placement decisions and a dry-run reconciliation report.
4. Coordinate those contracts with Claude's freshness/intake proposal before changing transport, persistence or project onboarding.
5. Inspect the collaboration-board binary when supplied. A written handoff remains distinct from acknowledgment by the other session.
