# Cowork Claude → Codex / VS Code Claude: Brain Explorer claim and handoff

Written 14:25 PDT, October 12. This is the cloud Claude session Jesse runs from
the Claude app (not the VS Code session). I read `TEAM.md`, `AGENTS.md`,
`TOOLING.md`, `CODEX_REPLY.md`, `CLAUDE_REPLY.md` before touching anything.

## What Jesse asked this session for

"HydraDB must be a heavy part of the demo and UI" and "TypeScript can
dynamically populate and show HydraDB's different brains, drill down, and show
an engaging UI." That is the Brain Explorer below.

## Files I claim (NEW files only; no edits to Codex or VS Code Claude files)

All under `rrflow-app/apps/rrflow/`:

- `src/lib/explore-contracts.ts` — zod input schemas + output types, client-safe
- `src/lib/explore.ts` — `server-only`; raw HydraDB fetch (same shape as the
  private helper in `mesh.ts`; candidate for one shared transport later)
- `src/app/api/explore/route.ts` — GET: every database the key can reach →
  `/databases`, then per database `/databases/status`, `/databases/stats`,
  `/databases/collections`; readiness, counts, collections, request id, error
- `src/app/api/explore/[database]/items/route.ts` — GET: `POST /context/list`
  for `knowledge` or `memory`, paginated; `?collection=&kind=&page=&pageSize=`
- `src/app/api/explore/[database]/items/[id]/route.ts` — GET: `/context/inspect`
  (content + inferred content), `/context/relations` (entity triplets with
  predicate, confidence, context, synthesized), `/context/subgraph` (connected
  items, depth 2). Per-call failures are reported by name, never hidden as empty.
- `src/app/api/explore/[database]/query/route.ts` — POST: Query Lab. Forwards
  every `POST /query` knob (collections, type, query_by, mode, max_results,
  alpha, recency_bias, graph_context, query_forceful_relations,
  temporal_reasoning + temporal_now, attributes, acl) and returns chunks in
  server order, graph edges, temporal facts, forceful relations, alias
  expansions, `request_id`, `latency_ms`, `api_version`, `llm_prompt`.
- `src/components/explore/relation-graph.tsx` — dependency-free SVG force graph
- `src/components/explore/brain-explorer.tsx` — `<BrainExplorer embedded? />`
- `src/app/explore/page.tsx` — standalone preview route `/explore`

All routes use `checkLocalRequest` / `apiError` from `@/lib/http` and read
`HYDRA_DB_API_KEY` from server env only. Nothing writes to HydraDB.

## Conventions followed

- Zero retrieval hits reads "No matching evidence was returned; try another
  question or scope." Retrieval is labelled as retrieval, never as reasoning.
- Every panel names the HydraDB call behind it and shows the request id.
- Unknown counts render as "unknown", not 0. Failures keep their message and
  request id.
- Semantic Tailwind tokens only (`bg-card`, `border-border`,
  `text-muted-foreground`, `bg-primary`). No new dependencies. No Jest.

## Verification status (honest)

- `tsc --noEmit` on my files: only `Cannot find module 'next'` errors, which hit
  every existing route and `src/lib/http.ts` identically — a resolution issue in
  the shell I have (pnpm symlinks from WSL), not the code. Zod, contracts and
  the component type-check clean. **Please run `pnpm type-check && pnpm lint`
  from WSL and tell me what breaks; I have not run the dev server.**
- Not yet exercised against live HydraDB from this session. Known soft spots
  to confirm on first contact: `/context/subgraph` query-string form (the SDK
  calls `context/subgraph?id=…`), `inferred_content` field name on inspect,
  and whether `/databases/collections` answers `collections` or
  `sub_tenant_ids` (both handled).

## Ask for Codex

Embed `<BrainExplorer embedded />` next to `<LiveMesh />` in the dashboard,
or keep `/explore` as a sibling route — your call, your file. It needs no props.
If you want the Query Lab's result card reused by `ask-brain.tsx`, say so and I
will extract `LabResult` into its own file.

## Also on disk, outside this repo

`app-starter/` carries my earlier hackathon work on commits `fcb7f05..acbc8ad`
(NestJS brain module, radar scan of GitHub/HF/HN into `app_knowledge` with
forceful relations, memories with `infer: true`, feedback, plus the SDK-based
version of this Explorer). Per `AGENTS.md` it is not merged into `rrflow-app/`.
The radar scan (public rising projects → HydraDB knowledge) is the one piece
worth porting if the shipping.buzz brain needs live content; it is a pure
function of fetch → `app_knowledge[]` and has no NestJS dependency in
`apps/api/src/brain/radar/*`.
