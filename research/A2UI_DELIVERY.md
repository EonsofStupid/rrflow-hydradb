# RRFLOW brain-driven interface

User direction, October 12, 2026: demonstrate A2UI with tooltips and modals populated from the brains; make status and quality feedback clear; show HydraDB and Raindrop together without delaying knowledge display.

## Implemented contract

`rrflow-app/apps/rrflow/src/lib/brain-ui-contracts.ts` negotiates one custom A2UI v0.9.1 catalog, `https://shippin.cloud/a2ui/brain-workspace/v1`. Its schema is served at `/api/brain-ui/catalog`. The implementation supports Column, WorkflowStatus, BrainSummary, AvenueCard, and Observation. This is a focused catalog renderer, not a general implementation of every A2UI catalog, function, or transport.

`POST /api/brain-ui` streams newline-framed `createSurface`, `updateDataModel`, and `updateComponents` envelopes using `application/a2ui+json`. The client also handles `deleteSurface`. Both boundaries validate messages; unknown catalog/component types, mismatched surfaces, cycles, repeated child references, malformed/truncated frames, and oversized streams are rejected. Native React components render text and an allowlisted HTTPS source link; the server cannot supply executable UI code.

RRFLOW selects engineering core plus the chosen discipline, adding TypeScript for React/Next.js. These are knowledge scopes inside `seniordev/rrflow`, not independent AI agents. Existing native Cypher operations load each brain's current revision and avenues. Reads run concurrently across brains, and each completed brain is streamed immediately. The first three avenues per brain are ranked by matching goal words, falling back to source order. The UI states this deterministic selection rule explicitly.

Tooltips explain selection and source. Dialogs show the original questions, source revision, native request IDs and draft/unchecked status. No question is marked passed. The orchestrator status is derived from actual read completions; incomplete or failed reads remain visible. Closing a modal restores focus to its trigger; Escape dismisses a tooltip. Heavy UI code is loaded only when this view opens.

## Raindrop's role

After knowledge is sent, the server awaits bounded delivery of `brain_ui_generated`. It records the source revisions, participating disciplines, failed reads, native HydraDB IDs, and outcome under `kind=deterministic_knowledge_ui`. It does not invent a model call. Delivery updates stream independently, so a five-second telemetry timeout cannot hold back available knowledge.

The interface exposes Helpful / Missing context verdicts. `/api/brain-ui/feedback` sends `brain_ui_helpful` or `brain_ui_missing_context` signals linked to that same event. The UI confirms success only on HTTP acceptance and links directly to the event. The event and verdict provide concrete inputs for later quality investigation/replay; they are not proof of improved prompts or automatic learning.

HydraDB remains the authoritative store. A2UI surfaces and the shared activity panel are transient views, not another database. The client records real service receipts in Claude's activity provider. Measured first-knowledge timing is request-to-first-decoded-knowledge in this local browser, not a paint benchmark or a production latency promise.

## Boundaries and next evidence

- Actual model/tool execution, durable orchestration checkpoints, evaluator replay, and evidence-based prompt promotion remain to implement.
- The interface operates within the existing local single-user access boundary.
- Company/service brain retrieval remains in the live specialist view; this first generated interface uses the versioned engineering research graph.
- No cross-database joins, autonomous agents, live infrastructure inventory, A2A transport, or MCP-delivered A2UI are claimed by this slice.
- Playwright covers native retrieval/feedback, early stream updates, keyboard focus, both themes, mobile overflow, accessibility, partial provider failures, interrupted streams, protocol boundaries, and shared receipt inspection. Final results are recorded in IMPLEMENTATION_EVIDENCE.md after the complete run.

## Primary references checked October 12, 2026

- [A2UI v0.9.1 protocol](https://a2ui.org/specification/v0_9_1/a2ui_protocol/): declarative envelopes, custom catalogs, data-model updates, transport framing.
- [Official envelope schema](https://raw.githubusercontent.com/a2ui-project/a2ui/main/specification/v0_9_1/json/server_to_client.json).
- [Official common types](https://raw.githubusercontent.com/a2ui-project/a2ui/main/specification/v0_9_1/json/common_types.json): ComponentId and ChildList references.
- [Custom catalog guidance](https://a2ui.org/guides/defining-your-own-catalog/).

## Modelence hosting assessment

[Modelence's current deployment contract](https://docs.modelence.com/deploy/setup.md) supports an existing Next.js Node application and externally hosted databases. RRFLOW can retain HydraDB. Before publishing, replace the local-only host boundary with real authenticated access, configure trusted origins, bind the production process to the supplied PORT, configure runtime-only secrets, and make optional research import portable. Modelence also provisions an environment MongoDB connection; RRFLOW need not use it. No Modelence deployment, resource creation, billing, or public endpoint has been performed.

Automated A2UI verification calls carry `x-rrflow-verification: playwright`; their Raindrop events use `user_id=rrflow-playwright` and `verification_run=true`, including feedback properties, so evaluation can exclude test traffic. Earlier development probes before this marker also exist in the project; do not treat those as human ground truth.
