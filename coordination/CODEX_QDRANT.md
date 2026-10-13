# Qdrant source ownership

Codex connections worker owns only new qdrant source integration files, new Qdrant runtime/seed scripts, tests/qdrant.spec.ts and dedicated docs. Root owns dashboard/shared launchers/CI/release. Two independent loopback Qdrant services with persisted storage: Personal source -> HydraDB default-tenant; Work source -> HydraDB rrflow_specialist. Seeds: Personal only explicitly stated user goals/preferences, Work only public repository documentation. Explicit UI import controls preserve provenance. No vector-search or generated embedding claims. Native HydraDB remains authoritative application knowledge state. Runtime inspection found Docker installed but ordinary user lacks socket permission; checking passwordless sudo for authorized provisioning.

## Runtime and source delivery — October 12, 18:28 PDT

Qdrant 1.19.2 is running under Ubuntu WSL Docker (daemon29.8.2) via two containers. Ordinary WSL user socket access/sudo was unavailable; WSL root is the authorized runtime provisioning route, with no global permission changes. Image pinned sha256:b7b0444c4c351c970b98e90a6f89c2ee4287c65b44e52b4cb503fa5b2aa927ad.

- Personal REST127.0.0.1:6333, rrflow-qdrant-personal, own personal_data + personal_snapshots volumes, own network172.18/16.
- Work REST127.0.0.1:6335, rrflow-qdrant-work, own work_data + work_snapshots volumes, own network172.19/16.
- gRPC not published; both REST bindings explicitly loopback. API keys not configured on these local single-user instances. Optional QDRANT_PERSONAL_API_KEY/QDRANT_WORK_API_KEY only read server-side.
- Three payload-only points per instance in rrflow_sources, vectors={}. Personal points are paraphrased user-provided goals; Work points are public README.md, rrflow-app/README.md, TEAM.md at commit8775997805e99a430cd8aba4a049b4ba35d90a0e. No private research, Gmail or secrets read/seeded.
- Personal seed text stays outside Git at /home/devcontainers/.local/share/rrflow-qdrant/personal-seeds.json, permissions0600. Public script accepts this file or RRFLOW_QDRANT_PERSONAL_SEEDS override.

Files: rrflow-app/qdrant/compose.yml; scripts/qdrant-seed.mjs; scripts/start-qdrant.ps1; apps/rrflow/src/lib/qdrant-contracts.ts + qdrant.ts; src/app/api/qdrant/route.ts; src/components/qdrant/qdrant-sources.tsx (QdrantSources export); tests/qdrant.spec.ts; docs/rrflow/QDRANT_SOURCES.md.

GET/POST /api/qdrant uses direct native Qdrant list/scroll/retrieve, followed by native HydraDB ingest only after explicit selected-record import. Personal cannot override default-tenant; Work cannot override rrflow_specialist. Documents in qdrant_sources, provenance+workspace metadata, stable source IDs + upsert. Native QdrantSourceImport version/timestamp evidence in same HydraDB database/rrflow_qdrant; status independently read from context/status with explicit collection. Accepted != indexed. Hash mismatch or cross-scope selection fails409 before any HydraDB write. View limited to first50 points, imports max20, truncation stated; no automatic background sync/deletions/vector-search claim.

Validation: app typecheck passed; focused ESLint passed; direct local-service Playwright isolation scenario passed (1test,4.7s runner,128ms scenario). Personal point IDs retrieve nothing from Work, bothscope/sourcekind constraints verified, payload-onlyvector config verified. Full source UI/boundary tests and native import await root validation-server rebuild. Set PLAYWRIGHT_BASE_URL=http://127.0.0.1:3102 and RRFLOW_QDRANT_LIVE_IMPORT=1 for the authorized six-record import test. Test stores aggregate native receipt IDs and indexing states as evidence. Without live flag, import test skips. No HydraDB source import performed yet at this handoff.

## Native import verification — October 12, 18:34 PDT

Port3103 validation build tested with RRFLOW_QDRANT_LIVE_IMPORT=1: three Playwright checks passed in7.4s (physical isolation; invalid destination/stale/cross-site rejection; authorized real import). Exactly3 Personal records accepted into default-tenant/qdrant_sources at2026-10-13T01:32:52.655Z and3 Work records into rrflow_specialist/qdrant_sources at01:32:53.386Z. All6 persisted QdrantSourceImport hashes match source versions. No synthetic records were added.

Independent existing Explore/native context/list readback: Personal total3, returned3, all additional_metadata.workspace=personal, request b7353e0c-bbe9-4f32-8d2d-1ac2e821a44a. Work total3, returned3, all workspace=shippin, request7d323ca2-c49a-4fa8-9c28-056e604b92ed. Stable IDs use qdrant:personal:rrflow_sources:<uuid> and qdrant:work:rrflow_sources:<uuid>. Qdrant originals remain3+3.

Latest native status all6=graph_creation at18:34; do not claim completed indexing. Status read request IDs: e1fb3941-eca3-457e-9622-7ed08b252342 (Personal),487b6037-2bc4-4688-8b54-dd6d75414c7c (Work).

Root-approved final hardenings now in source (post3103 build): require saved import-record count equal accepted point count; label completed status without matching saved version as current version unconfirmed; initial GET/api/qdrant?evidence=0 renders local sources before full HydraDB evidence request. Pending evidence explicitly labeled. Final focused lint passed. New fixture assertion for unconfirmed versions needs final rebuilt app; all source changes frozen pending root final build.

## Final read-only checkpoint — 18:35:50 PDT

Root final build3104 returns Qdrant sources with matching import versions3/3 Personal +3/3 Work, native source counts3each, and no warnings. All6 remain graph_creation; completed=0, so completed-indexing claim remains deliberately unmade. The local-first endpoint returned3+3 points in18ms with evidencePending=true and zero HydraDB calls; full evidence snapshot took583ms in this single local observation (not a benchmark).

Final native /context/status IDs: Personal81b53e92-f5c7-4301-a978-08e09ed4459b; Workd71fd28c-8efe-448e-8ee6-b8822576149f. Version registry read IDs: Personal925443ff-2f38-44b7-beee-c4b73c61e588; Work31f8ec79-e0f8-492a-91cf-2494e4e7f756. Structured evidence in rrflow-app/docs/rrflow/QDRANT_EVIDENCE.json contains IDs/counts/statuses only, no Personal text or secrets.

Worker stopped source/test work as requested. Root owns combined final pnpm verify, publication and presentation-server restart. No further Playwright invocation, git mutation, or app restart by this worker.
