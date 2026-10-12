# Folding Raindrop AI into the design

Raindrop here means AI agent monitoring and evaluations, confirmed by Jesse on October 12, 2026.

Current direction: [shippin.cloud](SHIPPIN_CONNECTOME.md) keeps authoritative state in HydraDB and uses RRFlow as the reasoning engine. The user has requested Raindrop tooling for this project. Official assistant skills and project-local MCP configurations are installed; Codex OAuth sign-in succeeded, while Claude sign-in and runtime instrumentation remain pending. See [tooling status](../TOOLING.md). Any runtime integration must preserve HydraDB state ownership.

**Yes, an integration is plausible.** The clean starting point is to connect the agent's observed behavior to the evidence and rule revisions that produced it. HydraDB can store those relationships; Raindrop can supply the monitoring surface. This is an application integration hypothesis, not a confirmed native connector.

## What is documented

Raindrop supports inspection of agent trajectories, behavior signals, issues, and comparisons of logged behavior. Its introduction frames failures such as forgotten context and incorrect confident answers as monitoring targets. [Introduction](https://www.raindrop.ai/docs/introduction/)

Its OpenTelemetry endpoint accepts **OTLP/HTTP traces** as JSON or protobuf. The documentation distinguishes this from OTLP/gRPC and from ingestion of OTLP metrics or logs. This gives a concrete instrumentation seam; an exporter still needs an integration check. [OpenTelemetry](https://www.raindrop.ai/docs/sdk/opentelemetry.md)

Signals can start from a behavioral description, be tested against sampled events, and refined with human match/non-match labels. That is relevant to RRFlow's correction loop, but a signal classification is evidence about behavior, not automatic authorization to change a rule. [Signals](https://www.raindrop.ai/docs/platform/signals.md)

The Query API documents reads for events, traces, signals, users, and conversations, with project scoping. This makes selective retrieval of observations a plausible bridge into our own graph. It is not proof that every UI feature has an export contract. [Query API](https://www.raindrop.ai/docs/query-api/api-reference.md)

**Experiments compare cohorts of existing logged events; they do not themselves run or replay an agent.** Raindrop separately documents a replay harness that calls your real agent against a dataset and grades outputs. The required `defineAgent` and `createEvalHandler` exports were found in both the root declarations and runtime ESM of the published **1.0.1** package. Availability is source-verified; end-to-end replay remains untested. Treat offline benchmark execution, replay, and production cohort analysis as distinct steps. [Experiments](https://www.raindrop.ai/docs/platform/experiments.md) · [Replay workflow](https://www.raindrop.ai/docs/sdk/custom-replay-endpoint.md) · [Versioned runtime exports](https://unpkg.com/raindrop-ai@1.0.1/dist/index.mjs)

**Source-level integration finding:** the inspected HydraDB exporter sends traces and metrics, plus optional logs, using one base endpoint. Raindrop accepts OTLP traces only. Instrumenting the application directly or routing database signals through a collector is therefore a better hypothesis than assuming the exporter can point wholesale at Raindrop. Incoming HTTP trace parenting is also unverified. [Source comparison and limits](DEEP_RESEARCH.md#hydradb-telemetry-cannot-be-assumed-to-plug-straight-into-raindrop)

## Proposed integration boundary

Instrument one agent turn with correlated identifiers:

| Proposed field | Why keep it |
| --- | --- |
| Trace and session IDs | Join a failure to its interaction history |
| RRFlow address and tree revision | Know which classification context applied |
| Rule and snapshot revision | Reproduce which deterministic behavior was active |
| Retrieval ID and source-version IDs | Identify exactly which evidence was available |
| Governance verdict and reason | Separate retrieval failure from rejected context |
| Outcome and evaluator version | Distinguish observed results from a model's self-assessment |

These are our proposed attributes, not reserved Raindrop field names. Validate current SDK support and chosen semantic conventions when implementing.

Suggested flow:

1. The orchestrator records classification, retrieval, verification, model/tool calls, and outcome under one trace.
2. Raindrop exposes a recurring failure, such as reuse of a superseded project decision.
3. An analysis job correlates that event with the decision and evidence graph in HydraDB.
4. RRFlow receives a candidate correction plus supporting examples and counterexamples.
5. Governance and held-out evaluation determine whether the candidate is suitable for promotion.
6. The snapshot compiler produces a new revision; subsequent outcomes are compared with the previous revision.

Observation should not block RRFlow's reasoning loop. Its journal, decisions, rule revisions, and outcomes belong in HydraDB, so a monitoring dashboard is not required to reconstruct the run.

## What to borrow if building a Raindrop-like feature

The most useful concepts are trace-linked signals, a label-review workflow, and comparisons by behavior category. A graph could help answer: “Which rule revision and retrieved claim are shared by these failures?” That is an investigation query, not proof of causation.

Evaluate HydraDB's native query feedback first, then assess which Raindrop capabilities add value. Keep authoritative evaluation and correction records in HydraDB. An external dashboard, if used, consumes those records or their linked telemetry; it must not become a second reasoning-state system. [Native MCP feedback](https://docs.hydradb.com/plugins/mcp)

## Questions still open

- Which Raindrop records and signal labels can be read reliably through the authenticated API for the selected plan?
- Does the live HydraDB connector catalog include Raindrop? If not, which minimal custom adapter is sufficient?
- How should a source deletion or revised signal label propagate to candidate corrections?
- Which checks are deterministic, which need human labels, and which remain model judgments?
- Can a correction improve the target behavior without merely overfitting the events that triggered it?
