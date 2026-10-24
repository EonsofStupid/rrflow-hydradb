# SWAG vision, evolving decisions and brain identity — proposal

October 24, 2026. This design follows Jesse's correction: **SWAG embodies his vision while absorbing relevant OpenAI decisions and Cloudflare versions.** The source roadmap supports that living decision system. Naming is not yet selected or enforced in production. Existing native databases retain their identities and contents. The connection cleanup below implements a narrower assignment check against existing records; it does not implement this whole proposal.

## SWAG is the user's vision and decision context

SWAG needs to retain what Jesse wants, why it matters, which tradeoffs he accepts, and how Personal and Shippin projects contribute. RRFLOW uses that intent when evaluating new information, executing reviewed work and examining results. An external release can change the available options or invalidate a technical assumption. It cannot silently redefine the user's priorities.

Keep these record types distinct, with typed relationships and revision history in HydraDB:

| Record | Meaning and authority | Required evidence |
| --- | --- | --- |
| Vision revision | User-authored or user-confirmed goals, constraints, preferences and principles | Author, effective revision, scope, source conversation/document, superseded revision |
| Provider fact | What an official source says about a decision, API, release or deprecation | Publisher, source URL, publication/retrieval dates, exact applicable version or date range, content revision/hash, verification state |
| Project baseline | What a project actually uses and where it runs | Repository/commit, dependency lock or configuration evidence, deployment/environment, observation time |
| Impact assessment | A proposed consequence for this project and this vision | Provider-fact and baseline references, affected capability, uncertainty, alternatives, relevant vision revision |
| Decision | A reviewed choice to adopt, defer, reject or supersede an approach | Reviewer, reason, evidence references, expected prior revision, scope, effective revision |
| Outcome / lesson | What happened when the decision was tried | Actual CI/run/evaluation evidence, rule/schema revision, observed result, counterevidence, review status |

The intended loop is **vision → current project context → new source evidence → proposed impact → reviewed decision → execution → measured outcome → candidate lesson**. An accepted lesson informs later work; it does not retroactively make an unrun check pass. Record missing evidence and contradictory findings explicitly.

For example, an official Cloudflare release note becomes a versioned provider fact. RRFLOW compares it with the affected project's observed configuration, relates it to Jesse's priorities, and presents an adoption proposal with its source and tests. An OpenAI API decision follows the same path. Separate the latest published version, the project's pinned version, and its observed deployed version. This example claims no current provider release or compatibility result.

Machine-enforced transitions must prevent source ingestion or model-generated text from writing an accepted vision revision or promoting a rule. Require a valid record schema, authorized scope, evidence references and expected revision. A human decision is attributable and reversible through a superseding revision. Automated checks can append observations; any later automatic promotion needs an explicit reviewed policy and measured criteria.

## Freshness and development dogfooding

Use official primary sources for provider facts, with a refresh policy suited to the source. A failed refresh means verification is overdue, not that the previous fact is newly confirmed. Revisions produce candidate impacts only for linked projects. Curated technical claims need this treatment whether they support Personal or Work; an inbox message's historical contents and a claim extracted from it have different freshness semantics.

RRFLOW's own repository is another project in this system: CI failures, the correction's schema/rule origin, the code change and later checks can produce traceable candidate lessons. Raindrop supplies interaction/evaluation evidence linked to the HydraDB run and decision. Qdrant can supply referenced source records; HydraDB retains canonical vision, assignments and decisions. This is the intended learning lifecycle, not proof that autonomous revision or promotion already exists.

The UI should let Jesse drill from **What I want → What changed → Why it affects this project → Proposed next step → What we tested → What we learned**. Each view shows scope, provenance, freshness and review state. Source Atlas is the source/route view inside this experience.

## What the roadmap brain does

Working UI name: **Source Atlas**. It answers: which sources belong to this project, what each source contributes, which brain holds it, how it gets updated, what depends on it, and what needs attention?

The atlas is canonical metadata and typed relationships in HydraDB. It points to original sources and their existing knowledge records. A per-project view provides the roadmap without copying every document into an additional store. A product delivery roadmap is a different view, linked to this source map by project and evidence references.

Suggested navigation:

```text
Personal / Shippin work
  Project
    Brains and their purposes
    Sources and original revisions
    Connections and ingestion routes
    Last verified sync / indexing / freshness
    Decisions, corrections and dependent workflows
```

Show accepted, indexing, searchable, failed and unknown distinctly. Keep source-update time, last sync attempt, last successful sync and last verification separate. A navigation tree explains ownership; cross-links explain reuse and dependencies. Expand graph branches on demand and expose limits on every bounded sample.

## Stable identity, readable naming and native binding

| Field | Responsibility | Change policy |
| --- | --- | --- |
| `brainId` | Opaque, immutable identifier, assigned once | Never regenerated when a label, project slug or provider location changes |
| `canonicalName` | Readable address derived from registered workspace, project and purpose | Validated and unique; controlled rename retains an alias |
| `displayName` | Layman-friendly label in the UI | Editable without changing routing |
| `storageBinding` | Exact HydraDB database and collection | Explicit, versioned binding; migration is a separate operation |

Candidate readable syntax: `<workspace>/<project>/<purpose>`. For example:

| Proposed name | UI label | Existing binding / limitation |
| --- | --- | --- |
| `personal/shared/knowledge` | Personal knowledge | Existing `default-tenant`; named collections remain explicit |
| `work/shared/knowledge` | Shippin company knowledge | Existing `rrflow_specialist` |
| `work/shippin-cloud/knowledge` | Shippin Cloud | Existing `shippin_cloud` |
| `work/shippin-ai/knowledge` | Shippin AI | Existing `shippin_ai` |
| `work/shipping-buzz/knowledge` | Shipping Buzz | Existing `shipping_buzz` |
| `work/shared/practice` | Engineering practices | Candidate logical scope for `seniordev`; confirm intended sharing before activation |

`shared` here means shared within the named workspace. It never grants Personal/Work cross-access. Existing `personal`, `practice`, `shippin` and Qdrant `work` labels need an explicit compatibility map; a string normalization must not become an authorization decision. Project IDs remain separate from project slugs, folder locations and GitHub repository names. Existing project IDs are derived from workspace/kind/location, so moving a folder or repository requires a reconciliation decision rather than silently creating a new logical project.

The atlas itself can be presented as `personal/shared/catalog` and `work/shared/catalog`. These are scoped views/records in existing HydraDB storage initially, not a requirement to provision two new databases. An owner can see an aggregate view; an agent receives only authorized catalog entries. Hiding document text alone is insufficient: source titles and project names also need scope protection.

## Core records and relationships

- **Project:** stable ID, workspace ID, slug, display name, current lifecycle and authoritative repository/folder references.
- **Brain:** stable ID, project/workspace references, purpose, canonical name, display name, aliases, storage binding and revision.
- **Connection:** provider, account reference, secret reference, environment, allowed source kinds, intended scope, observed health and last verification. Secret values stay in Infisical or the provider; they are never atlas properties.
- **Source:** stable provider/account/resource identity, source kind, project links, content owner, original location, revision/hash, visibility, deletion/tombstone state and observed update time.
- **Ingestion route:** source/connection/brain references, destination collection, update trigger, routing policy revision, last attempt/result and native receipt. Indexing state is separate from delivery acceptance.
- **Decision:** proposed placement, confirmed placement, reviewer identity, source revision, reason and superseding decision reference. A correction stays traceable.

Typed relationships: `PROJECT_HAS_BRAIN`, `PROJECT_USES_SOURCE`, `CONNECTION_READS_SOURCE`, `ROUTE_TARGETS_BRAIN`, `SOURCE_SUPPORTS_PRACTICE`, `WORKFLOW_USES_SOURCE`, and `DECISION_CLASSIFIES_SOURCE`. Cross-database edges resolve explicit database/collection/native-ID references through authorized application paths; do not assume a cross-database Cypher join.

One source can legitimately support several projects. That is an explicit relationship, not a reason to duplicate content or silently synchronize it into every destination. Native GitHub issue ingestion and repository-file ingestion represent different source kinds even when their repository is the same.

## Enforcement in executable code

The existing TypeScript/Zod boundary is the right place for the domain contract. A naming regex alone is insufficient. Validate before any external write, then persist through native HydraDB operations with conflict handling.

1. Validate a versioned record schema and allowed purpose values. Derive the readable name server-side from registered fields; reject unknown fields and malformed segments.
2. Resolve stable workspace/project/brain IDs. Reject dangling references, duplicate canonical names/aliases and ambiguity. Enforce uniqueness during persistence, including concurrent requests; verify native conditional-write behavior before relying on it.
3. Authorize the source, connection and target brain independently. Recheck configured resource overrides before sync/resume. Reject an unauthorized cross-scope route even when the name is well formed.
4. Resolve the existing native database binding from the registry. Labels and model-generated text cannot select arbitrary database or network destinations.
5. Detect duplicate ingestion routes using provider/account/resource/source-kind/target identity. Allow an additional route only as an explicit configured relationship.
6. Require an expected revision for edits. Preserve source identity and decision history on rename. A failed refresh never turns unknown status into healthy.
7. Preserve unregistered or ambiguous records in an owner-visible reconciliation queue; prohibit writes until resolved. Do not silently drop them from discovery.
8. Apply the same contract to dashboard actions, MCP tools, ingestion workers and CI. CI checks the schemas and migration fixtures; runtime checks protect live requests.

Playwright acceptance cases must cover: a saved rename preserving routing; duplicate/concurrent names; Personal connector visibility; a newly registered project brain appearing in the picker; rejected unregistered or cross-scope writes; resource overrides; an unavailable registry; source movement; stale decisions; and refresh persistence.

The connection cleanup now resolves the native database catalog against existing `DatabaseWorkspace` memberships and explicit built-in assignments. It exposes Personal, registered custom destinations and unresolved connections; each mutation rereads assignment state. Configure/sync/resume validates existing resource overrides, including native `database_override` and `tenant_id_override`, and rejects cross-workspace or unverified targets. New selections are bound to the verified connector destination. Unknown/failed provisioning is unavailable. This is single-owner workspace routing enforcement, not a multi-user authorization system or the new logical brain registry.

Full logical brain naming, immutable project identity, revision checks, aliases and reviewed decision transitions remain proposed. Do not claim that a readable name grants access or has replaced a native database name.

## Implementation order

- [x] Read the current native catalog, connector/resource destinations and webhook registration without exporting credentials or personal content. See the October 24 audit; account permission and hosted environment reviews remain separate work.
- [ ] Agree on canonical namespace and purpose vocabulary. Preserve existing IDs and document aliases.
- [ ] Implement registry read/resolution and an owner-visible reconciliation report in existing HydraDB storage; run a dry migration comparison against the native catalog.
- [x] Replace hardcoded connector destinations with existing catalog/membership resolution; keep unresolved scopes unavailable. Validation evidence is recorded in the resume checkpoint.
- [ ] Add the Source Atlas inside the Connectome, with a list/tree equivalent and source/route drill-down.
- [ ] Enforce the same contract across dashboard, MCP, workers and CI; prove the cases above with Playwright.
- [ ] Reconcile duplicates and obsolete routes one at a time, preserving checkpoints and showing exact effects before any disconnect/delete operation.

## Collaboration board

The user will supply a binary. Its interface and storage contract are unknown until inspected. First identify its version, supported local/remote modes, machine-readable interface and persistence behavior. Then wire only supported operations.

Proposed task fields: task ID, project/brain references, owner, claimed files, dependencies, status, acceptance criteria, evidence links, blocked reason and review acknowledgment. Codex and Claude need explicit claims and acknowledgments before overlapping edits. An agent writing a handoff does not prove that the other agent has received it. The board should reference canonical knowledge/decision records, not create a competing brain catalog.

## Code evidence

- `rrflow-app/apps/rrflow/src/lib/databases-contracts.ts`: physical-name syntax and built-in workspace map.
- `rrflow-app/apps/rrflow/src/lib/databases.ts`: existing native `DatabaseWorkspace` registry in `rrflow_specialist/rrflow`.
- `rrflow-app/apps/rrflow/src/lib/mesh-contracts.ts`: fixed five-brain enum and display catalog.
- `rrflow-app/apps/rrflow/src/lib/connections.ts`: native catalog/membership resolution and resource override checks; connector choices no longer use the fixed mesh enum.
- `rrflow-app/apps/rrflow/src/components/connections/connections-console.tsx`: returned destination selector and unresolved-connection review list.
- `rrflow-app/apps/rrflow/src/lib/project-context.ts`: location-derived project ID and scoped native Workspace records.
- `rrflow-app/apps/rrflow/src/lib/qdrant-contracts.ts`: fixed Personal/Work destinations and server-owned source endpoints.
