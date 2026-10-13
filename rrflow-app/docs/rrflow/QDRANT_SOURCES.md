# Personal and Work Qdrant sources

Qdrant is an external source. HydraDB remains RRFLOW's authoritative knowledge and application store. The application does not claim a native HydraDB Qdrant connector: the provider catalog did not list one when checked on October 12, 2026.

| Source | Local REST endpoint | Container | HydraDB import destination |
|---|---|---|---|
| Personal | `http://127.0.0.1:6333` | `rrflow-qdrant-personal` | `default-tenant/qdrant_sources` |
| Work / Shippin | `http://127.0.0.1:6335` | `rrflow-qdrant-work` | `rrflow_specialist/qdrant_sources` |

Each service has a separate Docker bridge network, persistent data volume, and snapshot volume. Only REST is published, on loopback; gRPC is not published. These local instances have no configured API key, so they are for this single-user local workspace. Never change the bind to a public interface without configuring authentication. Optional `QDRANT_PERSONAL_API_KEY` and `QDRANT_WORK_API_KEY` are read only on the app server if authentication is configured later.

Qdrant version `1.19.2` is pinned by image digest in `qdrant/compose.yml`. Start the services from the workspace root:

```powershell
wsl -d Ubuntu -u root -- docker compose -f /mnt/d/localdev/rrflow-hydradb/rrflow-app/qdrant/compose.yml up -d
```

The equivalent convenience command is `./rrflow-app/scripts/start-qdrant.ps1`. Add `-Seed` only after preparing the local Personal input described below.

The WSL user on this machine cannot access the Docker socket; WSL root performs Docker provisioning. No global permissions were changed. `docker compose down` preserves the named volumes; do not add `--volumes` unless intentionally deleting the sources.

The source collection is `rrflow_sources`. Initial records have payloads and stable IDs, with `vectors: {}`. No embeddings or Qdrant vector search are implemented in this slice. The adapter uses native collection listing, point scroll, and retrieval by selected ID.

## Populate sources

Personal text is deliberately outside the public repository. The local file `/home/devcontainers/.local/share/rrflow-qdrant/personal-seeds.json` contains only three paraphrased goals/preferences explicitly supplied by the user: personal growth/context organization, understandable live UI, and methodical engineering. It contains no Gmail messages, secrets, or inferred personal facts.

To reproduce elsewhere, supply your own JSON array with `sourceId`, `title`, and `text` fields at that local path, or set `RRFLOW_QDRANT_PERSONAL_SEEDS`. Review the input before running the script. Work records come only from public `README.md`, `rrflow-app/README.md`, and `TEAM.md` fetched from a verified commit of `EonsofStupid/rrflow-hydradb`.

```powershell
wsl -d Ubuntu -- /home/devcontainers/.local/share/fnm/node-versions/v22.23.3/installation/bin/node /mnt/d/localdev/rrflow-hydradb/rrflow-app/scripts/qdrant-seed.mjs
```

Seeding updates only the three explicit stable source IDs per instance, preserving unrelated points. It does not import into HydraDB automatically.

## Review and import through RRFLOW

`QdrantSources` renders the two libraries, preview text, provenance, source timestamps, selected point IDs, last import times and native HydraDB indexing state. Select up to 20 records in one scope and click its import button. Personal always maps to `default-tenant`; Work always maps to `rrflow_specialist`. The browser cannot override that destination.

`POST /api/qdrant` re-reads the selected points and checks their reviewed content hashes and payload scope before any HydraDB write. Native `POST /context/ingest` uses explicit `collection=qdrant_sources`, stable source IDs, provenance metadata and `upsert=true`. Originals remain in Qdrant. Accepted versions and timestamps are recorded in the same HydraDB database under `rrflow_qdrant`, label `QdrantSourceImport`. Indexing status is read independently from native `/context/status`; acceptance is not completion.

The display currently covers the first 50 points and explicitly announces truncation. This is an explicit import workflow, not a background synchronization job. Deleted source records are not automatically deleted from HydraDB. RRFLOW does not share or reclassify records across these scopes.

## Validation and primary references

`tests/qdrant.spec.ts` covers isolated source scopes, stale selection rejection before HydraDB writes, constrained destination selection, and fixture UI import behavior. Set `RRFLOW_QDRANT_LIVE_IMPORT=1` explicitly to also import the already-authorized source records into HydraDB. Without it, that mutation test is skipped. Set `PLAYWRIGHT_BASE_URL` to the rebuilt validation server when appropriate. No artificial personal facts are needed.

- [Qdrant local Docker quickstart](https://qdrant.tech/documentation/quickstart/)
- [Qdrant collections and vector configuration](https://qdrant.tech/documentation/manage-data/collections/)
- [Qdrant point scrolling](https://api.qdrant.tech/api-reference/points/scroll-points)
- [Qdrant v1.19.2 release](https://github.com/qdrant/qdrant/releases/tag/v1.19.2)
- [HydraDB API documentation](https://docs.hydradb.com/)
