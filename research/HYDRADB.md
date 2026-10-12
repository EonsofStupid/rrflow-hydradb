# HydraDB: capabilities and boundaries

Checked October 12, 2026. “Documented” below means described by the provider, not independently verified at runtime.

Current product direction: [shippin.cloud](SHIPPIN_CONNECTOME.md). HydraDB is the chosen authoritative state system; the surfaces below are capability boundaries to verify within that direction.

## Three documented surfaces

| Dimension | Managed application API | Open-source graph engine |
| --- | --- | --- |
| Entry point | `api.hydradb.com`, API-Version 2 | A running graph node via Bolt or HTTP |
| Main abstraction | Knowledge, memories, chunks, context graphs | Vertices, typed relationships, properties, graph queries |
| Representative operations | `/context/ingest`, `/query`, connectors | OpenCypher through `/v1/graphs/{graph_id}/query` |
| Role in our investigation | Rapid experiments with ingestion and retrieval | Explicit control of an evidence graph; published hackathon foundation |
| Work we should expect to own | Domain modeling, verification, application logic | Also ingestion/extraction and any semantic retrieval not independently verified in OSS |

**Hosted graph API:** the current BYOG guide additionally documents `/byog/query` for cloud Cypher reads and writes. Its dialect differs from the pinned OSS surface, and it rejects procedure calls. The native MCP exposes this surface too. These routes were absent from the inspected application OpenAPI. Treat hosted behavior as a distinct contract to test, not as missing functionality or OSS parity. [Hosted graph guide](https://docs.hydradb.com/essentials/v2/bring-your-own-graph) · [MCP graph tools](https://docs.hydradb.com/plugins/mcp)

The pasted integration guide describes the application API. Its SDK methods and SaaS connectors should not be assumed to exist on a local graph node. The OpenAPI identifies itself as the HydraDB Application API; the OSS repository has its own client contract. [Application API](https://docs.hydradb.com/api-reference/v2/openapi.json) · [OSS README](https://github.com/hydra-db/hydradb)

## Managed knowledge and memory

The supplied guide documents knowledge and memory ingestion, optional inference of durable memories, metadata filtering, scoped collections, and a common retrieval endpoint. Hybrid retrieval combines semantic and text search; fast, thinking, and automatic modes make different retrieval tradeoffs. Core responses use a `data` envelope, with documented exceptions for connector operations.

Database provisioning and indexing are asynchronous. Search readiness and graph completion are distinct. Stable source IDs, correct collection selection, and update/delete handling matter for any synchronization adapter. These are implementation contracts to verify against the live schema before coding. [Query concepts](https://docs.hydradb.com/essentials/v2/query) · [Supplied guide/index](https://docs.hydradb.com/llms.txt)

Graph context supplies paths related to the query, relationships among chunks, and mappings between chunks and path groups. Retrieved chunks remain the main evidence payload. Empty graph results do not establish that the answer is absent from all data. [Context graphs](https://docs.hydradb.com/essentials/v2/context-graphs)

**Document-ingest BYOG:** `graph_payload` replaces extraction for a source. Its whole-graph update restriction applies to this ingestion mode; it must not be generalized to hosted Cypher CRUD. Source chunk links may be weak evidence. [BYOG modes](https://docs.hydradb.com/essentials/v2/bring-your-own-graph)

Design inference: preserve canonical RRFlow identities outside any convenience entity-name normalization, and verify identity behavior before using BYOG as an authoritative category registry. Keep proposed relations and validated relations distinguishable.

## OSS architecture

The Rust engine uses SlateDB and object storage for durable graph records. Query nodes and indexers have disposable caches. Reads pin a storage snapshot; traversal indexes are accelerators, with a WAL overlay or canonical-data fallback for changes. This is a useful foundation for consistent graph reads, but does not itself establish application-level bitemporal history. [Architecture](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/architecture.md)

The README documents Neo4j-compatible clients, bounded native path procedures, and independent query/indexing processes. Linux/WSL is a documented development route on this Windows machine. Build prerequisites include Rust and native parsing/GraphBLAS libraries. The repository identifies its license as AGPL-3.0. [README](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/README.md) · [License](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/LICENSE)

Important documented client constraints:

- OpenCypher is a subset: one statement per request, restricted `WITH` and projection forms, and specific batch-write shapes.
- Transactions are auto-commit; a sequence of requests is not a single rollback unit.
- Bare ID-anchored reads can return a row for a nonexistent node; use the documented label-based existence checks.
- Bookmark and pagination fields must be exact; unknown HTTP fields may be silently ignored.
- Plain relationship creation can duplicate edges; verify idempotent writes and bounded traversal behavior.

[Cypher compatibility](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/cypher-compat.md) · [Application usage guide](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/USING-HYDRADB.md)

## Consequences for this project

These are proposed design responses, not native HydraDB features:

1. Use HydraDB as the authoritative state system and consume its native surfaces directly. Verify that structured reasoning state and managed retrieval can share canonical identities in the selected deployment. Do not introduce a separate RRFlow store to bridge an unverified product boundary.
2. Model source versions, effective times, observation times, and supersession explicitly. Snapshot consistency answers a different question from “what did we believe then about what was true earlier?”
3. Adapt LFG classification into RRFlow's reasoning engine. If a local compiled snapshot is retained for performance, make it reconstructible from HydraDB and record its source revision.
4. Make publication of a rule revision a deliberate operation. Test failure between graph writes before depending on a multi-record promotion.
5. Read the authenticated connector catalog before claiming a native Raindrop connector. None was established in this research. Custom ingestion is documented for unsupported providers. [Connectors](https://docs.hydradb.com/essentials/v2/connectors)

For managed multi-user experiments, derive query ACLs from authenticated identity: the documentation says omitting them leaves retrieval unfiltered within scope. Application scope checks also remain necessary. [Connectors and permissions](https://docs.hydradb.com/essentials/v2/connectors)
