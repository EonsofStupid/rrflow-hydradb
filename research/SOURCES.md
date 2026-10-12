# Source register

Accessed October 12, 2026. Public source descriptions below are reading annotations, not independent verification. Private research remains linked to its original location. No private source text was sent to public search queries or to HydraDB/Raindrop ingestion.

## Read first

1. [shippin.cloud direction](SHIPPIN_CONNECTOME.md) — current user decisions; then [LFG_NOTES_v3](https://docs.google.com/document/d/1NCIJK8wBlnzAa43OuWLktQup3RtksqDvM8n2ckPWj5U/edit) for historical design concepts and per-item status.
2. [HydraDB OSS architecture](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/architecture.md) — storage and execution boundaries.
3. [HydraDB BYOG](https://docs.hydradb.com/essentials/v2/bring-your-own-graph) — hosted Cypher and document-ingest graph payloads; distinct contracts.
4. [Raindrop signals](https://www.raindrop.ai/docs/platform/signals.md) — behavior review and refinement.
5. [LongMemEval](https://github.com/xiaowu0162/LongMemEval) — outcome and retrieval evaluation.

## HydraDB

| Source | Inspection and use |
| --- | --- |
| [Documentation index / agent guide](https://docs.hydradb.com/llms.txt) | Fetched directly; serves the integration guide rather than a simple link-only index |
| [Documentation sitemap](https://docs.hydradb.com/sitemap.xml) | Used to discover current v2 pages |
| [Introduction](https://docs.hydradb.com/get-started/v2/introduction) | Managed product model |
| [Query](https://docs.hydradb.com/essentials/v2/query) | Retrieval modes and contracts |
| [Context graphs](https://docs.hydradb.com/essentials/v2/context-graphs) | Graph-enriched retrieval results |
| [Bring Your Own Graph](https://docs.hydradb.com/essentials/v2/bring-your-own-graph) | Hosted Cypher and ingest-time graph payloads; both inspected; hosted procedures rejected |
| [Native MCP](https://docs.hydradb.com/plugins/mcp) | Native knowledge, graph, source-inspection, and feedback tools |
| [Connected subgraph](https://docs.hydradb.com/api-reference/v2/endpoint/subgraph) | Item-level traversal; OpenAPI inspected for depth, truncation, and access scope |
| [Connectors](https://docs.hydradb.com/essentials/v2/connectors) | Catalog discovery, synchronization, permissions |
| [Application OpenAPI](https://docs.hydradb.com/api-reference/v2/openapi.json) | Query, temporal, scope, graph context, ingestion, relations, chunks, subgraph, and inspection contracts reviewed; `/byog/*` absent from inspected spec |
| [OSS README](https://github.com/hydra-db/hydradb) | Product boundary and documented setup |
| [Architecture](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/architecture.md) | Snapshot, storage, and writer model |
| [Using HydraDB](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/USING-HYDRADB.md) | Client behavior and operational pitfalls |
| [Cypher compatibility](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/cypher-compat.md) | Supported language subset |
| [License](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/LICENSE) | Repository license text inspected; no licensing opinion provided |

The observed OSS `main` commit was `671e07bfc7f8a5806727b29cf616f513f969a7a4`, timestamp `2026-10-12T15:14:42Z`. References are pinned where practical. This is a research anchor, not a requirement to build an outdated revision later.

The deeper pass inspected source for telemetry, HTTP handling, graph snapshots, and native path configuration. Exact files and package checks are in the [inspection ledger](INSPECTION_LEDGER.json). No runtime compatibility conclusion follows from these reads. The hosted graph guide documents a different dialect from the pinned OSS compatibility guide; do not combine their supported features into a fictional single endpoint.

## Raindrop AI

| Source | Inspection and use |
| --- | --- |
| [Introduction](https://www.raindrop.ai/docs/introduction/) | Product purpose and monitoring capabilities |
| [Index](https://www.raindrop.ai/docs/llms.txt) | Documentation discovery |
| [OpenTelemetry](https://www.raindrop.ai/docs/sdk/opentelemetry.md) | Direct Markdown read; trace ingestion contract |
| [Signals](https://www.raindrop.ai/docs/platform/signals.md) | Direct Markdown read; label/refinement workflow |
| [Experiments](https://www.raindrop.ai/docs/platform/experiments.md) | Direct Markdown read; logged-cohort comparison |
| [Query API](https://www.raindrop.ai/docs/query-api/api-reference.md) | Direct Markdown read; documented resources and project scope |
| [Replay endpoint](https://www.raindrop.ai/docs/sdk/custom-replay-endpoint.md) | Harness contract inspected; required exports present in inspected 1.0.1 package, end-to-end execution untested |
| [npm registry](https://registry.npmjs.org/raindrop-ai/latest) | Observed latest 1.0.1; metadata recorded |
| [1.0.1 declarations](https://unpkg.com/raindrop-ai@1.0.1/dist/index.d.ts) / [ESM runtime](https://unpkg.com/raindrop-ai@1.0.1/dist/index.mjs) | `defineAgent` and `createEvalHandler` export presence checked without installation/execution |
| [Self-diagnostics](https://www.raindrop.ai/docs/platform/self-diagnostics.md) | Agent-reported signals as a distinct evidence source |

Some Raindrop pages failed in the web reader but were successfully fetched as public Markdown through direct HTTP. No authenticated Raindrop API behavior was tested.

## Internal research

| Source | Authority / relevance |
| --- | --- |
| [LFG_NOTES_v3](https://docs.google.com/document/d/1NCIJK8wBlnzAa43OuWLktQup3RtksqDvM8n2ckPWj5U/edit) | September 26 draft; supersedes v2/v2.1; current user product direction overrides conflicting role/storage choices |
| [LFG_ENGINE_PLAN](https://docs.google.com/document/d/1GnHwbR9sv1X5rH0bf98G8efM_lPaQxdiJx0fmpm6J5s/edit) | September 26 companion draft; scoring, normalization, schemas, snapshots, and proposed proof artifacts |
| [Boundary Question Bank v0.2](https://docs.google.com/document/d/1c-HSBhxLY-z-A6xn_owLsi47HD10_sIa0FPHZqq0IB4/edit) | September 30 draft; artifact-bound predicates and oracle proposal; not yet evaluated against session corpus |
| [RRFlow + LFG v2](https://docs.google.com/document/d/1tv9d09bsZnfvZUee9xO_hG1wz3gchZqvAb2uZ7WOmKY/edit) | Historical design and provenance; superseded |
| [v2.1 addendum](https://docs.google.com/document/d/15_AifE6m3mSgPocC75FKrHVum-bXMvand1s4ENkQvP8/edit) | Historical amendments; superseded by v3 |
| [ArkType project README](D:/localdev/ArkType-RRFLOW/README.md) | Local authoring/validation workstream and links to canonical Drive docs |
| [RRO manifesto](D:/localdev/RRO/RRO_MANIFESTO.md) | Earlier governance-aware retrieval vision; historical |
| [RRO strategy](D:/localdev/RRO/RRO_STRATEGY.md) | Earlier implementation direction; not promoted over v3 |
| [RRO kernel/engine contract](D:/localdev/RRO/KERNEL_ENGINE_CONTRACT.md) | Historical component and publication boundaries |

User-supplied integration guide: `C:/Users/jessa/.codex/attachments/b34aff80-de5c-403f-8e4f-be8a75094116/Pasted text.txt`. Its examples are contextual material; current endpoint schemas need verification at build time.

## Event and evaluation references

| Source | Status |
| --- | --- |
| [Hack Hydra](https://hackhydra.hydradb.com/) | Tracks and rules read; published event is in the past |
| [Official linked Luma](https://luma.com/h038glzk) | Dates corroborated; registration closed |
| [LongMemEval](https://github.com/xiaowu0162/LongMemEval) | README and evaluation guidance inspected |
| [LongMemEval-V2](https://github.com/xiaowu0162/LongMemEval-V2) | README overview inspected |
| [BEAM](https://github.com/mohammadtavakoli78/BEAM) | Repository overview inspected |
| [EnterpriseRAG-Bench](https://github.com/onyx-dot-app/EnterpriseRAG-Bench) | Repository identified and opened; protocol review remains |
| [Zep paper](https://arxiv.org/html/2501.13956v1) | Temporal model and contradiction-handling section inspected |
| [Zep fact timestamps](https://help.getzep.com/facts) | Current documentation for transactional and validity timestamps |
| [Mem0 paper](https://arxiv.org/abs/2504.19413) | Abstract-level review; extraction/consolidation baseline |
| [GraphRAG dynamic community selection](https://www.microsoft.com/en-us/research/blog/graphrag-improving-global-search-via-dynamic-community-selection/) | Primary research overview; global-query strategy |
| [Reflexion](https://arxiv.org/html/2303.11366v4) | Feedback, reflection, memory, and retry method inspected |
| [ExpeL](https://arxiv.org/html/2308.10144v3) | Experience extraction, insight updates, and inference retrieval inspected |
| [Voyager](https://arxiv.org/html/2305.16291v2) | Skill library, execution feedback, and model-based success assessment inspected |
| [Calibration research](https://arxiv.org/abs/1706.04599) | General confidence/correctness distinction; not a validated calibration recipe for authored rules |
| [RAPTOR](https://arxiv.org/html/2401.18059v1) | Tree construction and tree-versus-all-level retrieval comparison inspected |
| [HippoRAG](https://arxiv.org/abs/2405.14831) | Abstract and mechanism overview |
| [HippoRAG 2](https://arxiv.org/html/2502.14802v2) | Triple filtering, passage integration, seeds, and PPR retrieval inspected |

## Outstanding evidence

No benchmark results, HydraDB deployment test, shared-identity proof across hosted graph and managed context, managed/OSS parity test, Raindrop authenticated export/replay test, native Raindrop connector confirmation, or exhaustive novelty review. The research found no basis to promise sub-millisecond graph retrieval or automatic rule improvement. Those remain proposed measurements and design work.

The public `https://research.hydradb.com/hydradb.pdf` URL appeared in search but returned 404 on direct web opening. Its search snippet was not used as evidence for a technical claim.
