# Hosted Qdrant source handoff

Codex worker `/root/project_context` owns the narrow shared-cluster collection configuration in `rrflow-app/apps/rrflow/src/lib/qdrant.ts`, `qdrant-contracts.ts`, `tests/qdrant.spec.ts`, root `modelence.config.json`, `rrflow-app/scripts/modelence-validate.mjs`, and `rrflow-app/docs/rrflow/MODELENCE_DEPLOYMENT.md`. Root retains application runtime, launcher, final build, release and deployment ownership. Authentication files are frozen from the earlier handoff.

## Cloud population verified

At **2026-10-13T02:19:26Z**, the exact saved Infisical endpoint authenticated successfully. The initial collection catalog was empty. Two collections were created and populated with the already approved existing seed records:

| Scope | Cloud collection | Records | Native write | Exact read-back |
| --- | --- | ---: | --- | --- |
| Personal | `rrflow_personal_sources` | 3 | completed | content hashes and text match |
| Shippin / Work | `rrflow_shippin_sources` | 3 | completed | content hashes and text match |

Both use payload-only configuration `vectors={}`. No embeddings or vector-search capability is claimed. Personal point IDs retrieved zero records from the Shippin collection. The original local services and their three records each were not changed.

Personal records were checked in memory against the approved private seed file, with no personal source text emitted or written to this repository. Work records were checked against their published GitHub documents (`README.md`, `rrflow-app/README.md`, `TEAM.md`) at commit `8775997805e99a430cd8aba4a049b4ba35d90a0e`. Only these six records were copied. No private research, inbox data or credentials were ingested.

This is one existing cloud cluster with logically separate collections, not two physical services. No cluster or paid resource was purchased. Collection names and scope checks prevent Personal and Shippin from sharing one source collection; provider credentials still determine provider-level authorization.

## Runtime mapping

Infisical project `rrflow-hydradb`, environment `dev`, root `/`:

- `qdrant-endpoint` supplies both `QDRANT_PERSONAL_URL` and `QDRANT_WORK_URL`.
- `qdrant` supplies both server API-key variables (`QDRANT_PERSONAL_API_KEY`, `QDRANT_WORK_API_KEY`).
- Set `QDRANT_PERSONAL_COLLECTION=rrflow_personal_sources` and `QDRANT_WORK_COLLECTION=rrflow_shippin_sources`.

No secret values or endpoint values are included here. A fresh in-memory comparison confirmed the saved endpoint exactly matches the address subsequently provided by the user. No secret names were renamed or duplicated in Infisical. The Modelence collection declarations now contain the verified non-secret collection names as defaults. Runtime injection and Modelence publishing remain root-owned.

Local defaults remain separate loopback origins with `rrflow_sources`. Existing HydraDB import identities remain unchanged. A new cloud collection uses a distinct `qdrant:<scope>:<collection>:<pointId>` identity and the actual cloud collection in source provenance. IDs longer than 100 bytes use `qdrant:<scope>:sha256:<digest>`, preserving the complete native identity in source metadata. No old import is silently relabeled. All six new cloud identities have now been imported through the actual UI and read back from their correct HydraDB destinations, as recorded below. Previously imported local-source knowledge remains canonical and present.

## Validation

The actual server shared-cluster fixture passed scoped native read paths, scope filtering, import provenance and destinations, duplicate origin+collection rejection before network access, preservation of local source IDs, and the bounded SHA-256 identity fallback. Configuration/preflight fixtures passed shared-origin distinct-collection acceptance and same-collection rejection. The native local-service isolation test also passed. Final focused rerun: two fixture tests passed in 10.8 seconds with isolated `/tmp/rrflow-qdrant-cloud-test-results`; the prior combined three-check run passed in 6.1 seconds. App TypeScript checking passed during integration, and final focused ESLint passed. Root owns combined final build/verification. No application restart, production build, git mutation or deployment was performed by this worker.

Provider references: [Qdrant database authentication](https://qdrant.tech/documentation/cloud/authentication/), [collection management](https://qdrant.tech/documentation/manage-data/collections/).

## Real browser import and native read-back — 02:38 UTC

The root-owned final production build at `http://localhost:3000` was verified through a real Playwright Chromium browser with no route mocks. The verifier signed in using the Infisical-injected password, opened **Connectome → Qdrant source records**, expanded each record's provenance, selected the three Personal records, imported them through the UI button, then did the same for the three Work records. No password, trace, video, browser storage state or provider credentials were recorded.

| Scope | Native destination | Accepted | Import time (UTC) | Ingest request ID | Registry write request ID |
| --- | --- | ---: | --- | --- | --- |
| Personal | `default-tenant/qdrant_sources` | 3 | 2026-10-13T02:37:09.408Z | `a9399e8a-b5d6-4cf3-94a4-245446483e11` | `46b6b120-6c49-4ba0-bb9c-5a1b151bc586` |
| Work | `rrflow_specialist/qdrant_sources` | 3 | 2026-10-13T02:37:11.873Z | `c6bbe879-c62e-4d53-b5a3-fb668988cbaa` | `0b1ed43e-73bd-48db-b63b-26d60faa3e6c` |

Ingestion returned native HTTP202 and the version registry writes returned HTTP200. Immediate final read-back did not yet satisfy the verifier; a **read-only** follow-up at **2026-10-13T02:38:31.989Z** confirmed all six cloud identities with matching version hashes, recorded import times and correct workspace/source-collection metadata. No repeated ingestion was performed on that follow-up. All six native indexing states were **`graph_creation`**, with **zero confirmed completed**.

- Personal `/context/list` request: `9db8b469-73d1-4ad1-b5ad-19f993dc1519`; three new cloud IDs found among six existing total source observations. Status request: `ab30ee4f-3062-43fd-8323-2326b6e7314b`; version read: `e843ea60-be25-450e-ad23-f0f4cbf8e3de`.
- Work `/context/list` request: `21bd6ead-db65-491b-b424-c6aae27bcb04`; three new cloud IDs found among six existing total source observations. Status request: `77e7d1a0-2c7f-4a0f-b239-150d83db9fc2`; version read: `49e62b67-2ef0-4dda-a6e7-62b45a899897`.

Each of these six canonical cloud identities was present in native context-list read-back, with its imported version matching the current source version:

| Scope | HydraDB source identity | Native indexing status |
| --- | --- | --- |
| Personal | `qdrant:personal:rrflow_personal_sources:2859bdd0-3dae-4bfb-8431-901a3baec408` | `graph_creation` |
| Personal | `qdrant:personal:rrflow_personal_sources:3a11e989-befa-4f9f-8b34-875f07ecf43b` | `graph_creation` |
| Personal | `qdrant:personal:rrflow_personal_sources:fed59983-32d7-4015-820f-6216c2e06ca2` | `graph_creation` |
| Work | `qdrant:work:rrflow_shippin_sources:085535f5-358c-4ebd-8039-30de779efdca` | `graph_creation` |
| Work | `qdrant:work:rrflow_shippin_sources:b164ac1c-c71e-4682-808b-496128f46d47` | `graph_creation` |
| Work | `qdrant:work:rrflow_shippin_sources:e71a170f-3ae9-41c8-8b95-c6fbd014f836` | `graph_creation` |

Standalone verifier: `rrflow-app/apps/rrflow/scripts/verify-cloud-qdrant.mjs`; `--read-only` reviews and checks already-imported records without another import. Run through WSL with the workspace password supplied only in process memory. Errors intentionally emit a safe stage rather than Playwright call logs, which can contain input values.

Screenshot `submission/screenshots/22-qdrant-cloud-connectome.png` shows only the approved six source cards with source bodies collapsed and the actual graph-creation status. Root corrected the footer to distinguish the Qdrant source collection from the actual HydraDB destination, `qdrant_sources`. The screenshot has now been recaptured from the final build and visually inspected; both destination footers are correct. No production source was changed by this verification task. All worker files are frozen; no further imports are required.

## Final exact-start verification — 02:46 UTC

After root's final `.next` build passed and the fresh public-mode process started at `http://localhost:3000`, the existing verifier ran with **`--read-only`**. At **2026-10-13T02:46:58.071Z**, all six cloud source records remained present, with matching source/import versions, correct workspace metadata and no source warnings. All six still reported **`graph_creation`**, not completed. No data was imported or updated during this final verification.

| Scope | Native context-list receipt | Native status receipt | Native version-registry receipt |
| --- | --- | --- | --- |
| Personal | `2b33e02a-31e2-4ff8-9c3d-e85c1f73bf36` | `1380e024-a76e-4d6b-b5d5-4cbc4459ab9e` | `f61500a0-466d-4ce7-bebb-1aa08ec69bbf` |
| Work | `cdc2d401-7422-4bab-a3ae-ef2c75fa15d7` | `81f6b0a4-b719-41e3-a056-20d62978c98e` | `d6733eef-62b6-453c-9856-201f2b8c3841` |

The unchanged `hosted-smoke.mjs` then passed anonymous API/page protection, invalid-host rejection, native curated-demo read (six public demo records; request `b31a6e4d-fb4d-4742-ae65-71f01a979e12`), real browser sign-in, Secure/HttpOnly/SameSite cookie checks, authenticated workspace access, cross-site rejection, and logout. This verifies the exact local public-mode production start; it does not itself claim a Modelence deployment.

Only this handoff and the generated screenshot changed during the final check. The prior generated screenshot was preserved outside the repository before recapture. Passwords remained process-memory only; no trace, video or browser storage-state capture was enabled. No worker process remains active.
