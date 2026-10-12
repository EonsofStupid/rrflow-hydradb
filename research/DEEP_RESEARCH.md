# Deeper research: evidence, evaluation, and rule promotion

Research date: October 12, 2026. This extends the [research base](README.md). **Documented** means a published contract; **source-inspected** means code or package contents were read; **analysis** means a deduction from those sources; **proposed** means a design to test. None of these means the integration has run successfully.

Later user direction in this session: [shippin.cloud](SHIPPIN_CONNECTOME.md), RRFlow as the reasoning engine, HydraDB as authoritative state, and coordinated Codex/Claude work. Historical draft responsibilities below are research context, not constraints on that direction. The hosted Cypher API was also located after this first deep pass; see the connectome brief for the corrected capability map.

The strongest research hypothesis is that HydraDB could connect an observed failure to the exact evidence, predicate, rule revision, and correction involved. RRFlow supplies the concepts for controlled change; Raindrop supplies observations and evaluation tooling. The value to establish is improved decisions on unseen cases, with a reproducible explanation of what changed.

## 1. The internal baseline now includes three complementary drafts

| Source | Role and authority |
| --- | --- |
| [LFG_NOTES_v3](https://docs.google.com/document/d/1NCIJK8wBlnzAa43OuWLktQup3RtksqDvM8n2ckPWj5U/edit), September 26 | Component responsibilities and decisions; explicitly supersedes v2/v2.1, while retaining per-item draft status |
| [LFG_ENGINE_PLAN](https://docs.google.com/document/d/1GnHwbR9sv1X5rH0bf98G8efM_lPaQxdiJx0fmpm6J5s/edit), September 26 | Companion implementation draft: normalization, rules, scoring, schema generation, snapshots, and proof artifacts |
| [Boundary Question Bank — Core Predicates, v0.2](https://docs.google.com/document/d/1c-HSBhxLY-z-A6xn_owLsi47HD10_sIa0FPHZqq0IB4/edit), September 30 | Later draft for an oracle and project-bound verification questions; explicitly not evaluated on a session corpus |

The question bank's later date does not establish that it supersedes the responsibility boundaries in v3. The engine plan is an implementation proposal, not evidence of implemented behavior. Its own open questions include rule-weight semantics and schema-conversion viability.

## 2. Integration findings from actual source inspection

### Raindrop replay exports are available in the inspected release

**Source-inspected:** the npm registry resolved `raindrop-ai` latest to **1.0.1**. Both `defineAgent` and `createEvalHandler` appear in its root TypeScript declarations and runtime ESM exports. This resolves the earlier uncertainty about whether the required exports are publicly available. It does not prove a replay endpoint can discover and execute our future agent. [Registry metadata](https://registry.npmjs.org/raindrop-ai/latest) · [Versioned declarations](https://unpkg.com/raindrop-ai@1.0.1/dist/index.d.ts) · [Versioned runtime](https://unpkg.com/raindrop-ai@1.0.1/dist/index.mjs)

Keep three activities distinct: replay executes the agent, evaluators judge outputs, and Raindrop Experiments compare cohorts of already logged events. The replay workflow therefore needs a real callable agent and a versioned dataset; a dashboard comparison alone is insufficient. [Replay guide](https://www.raindrop.ai/docs/sdk/custom-replay-endpoint.md) · [Experiments](https://www.raindrop.ai/docs/platform/experiments.md)

### HydraDB telemetry cannot be assumed to plug straight into Raindrop

**Source-inspected:** HydraDB revision `671e07bfc7f8a5806727b29cf616f513f969a7a4` builds HTTP exporters for traces and metrics, and optionally logs, from one base endpoint. Its inspected configuration can disable logs, but that does not remove the metric exporter. Raindrop documents an OTLP/HTTP **trace** endpoint; metrics, logs, and OTLP/gRPC are unsupported there. [HydraDB exporter](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/crates/telemetry/src/otlp.rs) · [Configuration](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/crates/telemetry/src/config.rs) · [Raindrop ingestion contract](https://www.raindrop.ai/docs/sdk/opentelemetry.md)

**Proposed:** start by instrumenting the application turn and its HydraDB client call. If database telemetry is also needed, route signals through a collector with separate destinations. Test trace parenting separately: the repository has a W3C trace-context utility, but inspection of the HTTP handler did not establish incoming `traceparent` propagation. A parsing helper alone is insufficient evidence of an end-to-end trace. [Propagation utility](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/crates/telemetry/src/propagate.rs) · [HTTP handler](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/src/client/http.rs)

### Stored graph relations need an independent evidence standard

**Documented:** managed HydraDB BYOG can replace extracted graph structure with caller-supplied entities and relations. Its chunk-linking behavior can associate a relation with the best available chunk even when support is weak. **Analysis:** a stored relation and an attached chunk must not automatically become a verified claim. Preserve source versions and record how support was assessed. This managed feature must also not be assumed to exist in the OSS engine. [BYOG contract](https://docs.hydradb.com/essentials/v2/bring-your-own-graph)

## 3. A scoring counterexample in the LFG engine draft

The engine plan proposes a noisy-OR score per option, then labels `top_score / sum_of_scores` as probability. It resolves above a threshold and separately escalates near ties. These rules are deterministic, but determinism does not make their scores calibrated probabilities. [Engine plan, sections 3.4–3.5](https://docs.google.com/document/d/1GnHwbR9sv1X5rH0bf98G8efM_lPaQxdiJx0fmpm6J5s/edit)

**Analytical counterexample, not an observed implementation bug:**

| Quantity | One weak rule for A; no rule for B |
| --- | --- |
| Authored weight / A score | 0.10 |
| B score | 0 |
| Normalized top score | 0.10 / 0.10 = **1.00** |
| Top-minus-second margin | 0.10 |
| Within the draft's 0.05 tie tolerance? | No |
| Meets the example 0.80 threshold? | Yes |

Normalization measures relative support among represented options. It loses information about absolute evidence strength: even this weak match can clear the decision threshold. A second failure mode is correlated evidence. Three copies or close paraphrases of a 0.60 rule produce `1 − (1 − 0.60)^3 = 0.936`; repeated evidence has increased the score without adding an independent observation.

**Proposed research changes:** retain raw support, margin, matched evidence families, and the abstention decision as separate fields. Compare max, grouped noisy-OR, and the current formula on held-out examples. Report error among accepted decisions alongside coverage, including sole weak matches, duplicate evidence, conflicting rules, and out-of-scope inputs. Thresholds should be selected on development data and evaluated on a separate split.

Calibration research supplies the general distinction between a confidence score and empirical correctness. It does not establish that a particular neural-network calibration method transfers to RRFlow's authored rule scores. [Guo et al., On Calibration of Modern Neural Networks](https://arxiv.org/abs/1706.04599)

The engine plan's schema fixture approach is useful here too: a deterministic contract can make outputs reproducible while separate behavioral evaluation establishes their quality. Its latency targets and library integration claims still require measurement.

## 4. The question bank suggests a useful graph workload

The September 30 draft binds questions to module inventories, boundary maps, ADRs, canonical names, and other project artifacts. This is a concrete reason to use connected evidence: the same proposed code change can depend on several independently versioned sources. [Boundary Question Bank v0.2](https://docs.google.com/document/d/1c-HSBhxLY-z-A6xn_owLsi47HD10_sIa0FPHZqq0IB4/edit)

**Analysis:** its yes/no questions have mixed polarity and different proof requirements. They cannot safely share a generic “yes means pass” interpretation.

| Predicate example, paraphrased | Passing interpretation | Evidence and evaluator to investigate |
| --- | --- | --- |
| Does this introduce a circular dependency? | No | Dependency graph and a defined cycle query |
| Is the change consistent with ratified ADRs? | Yes | Applicable, ratified ADR versions; often a model-assisted judgment |
| Does the existing test suite still pass? | Yes | A test-run artifact tied to the evaluated commit |
| Does this reuse something already available? | Depends on the exact question wording | Module inventory and change context |

**Proposed predicate record:** stable ID, revision, question, `pass_when`, applicability condition, evidence bindings, evaluator kind/version, and outcome. Outcomes should distinguish **pass**, **fail**, **unknown**, and **not applicable**. An unrun test is unknown; a question that does not apply is not a success measurement. A model's explanation of a test result cannot substitute for the run artifact.

Raindrop distinguishes agent-reported self-diagnostics from other signals. Preserve that distinction alongside human labels, deterministic check results, and model judgments in the evidence graph. Agreement among these is useful evidence, but multiple labels derived from the same model response are not independent confirmations. [Self-diagnostics](https://www.raindrop.ai/docs/platform/self-diagnostics.md)

The question bank proposes retiring questions whose answers are uniform more than 90% of the time. **Analysis:** that criterion suits an investigation of classification usefulness better than a universal deletion rule. A rarely failing invariant can still catch a costly defect. Evaluate frequency, consequence, evaluator accuracy, cost, and redundancy separately; keep required checks even when most runs pass.

## 5. Temporal memory requires authority as well as timestamps

Zep's paper separates when a fact applies from when the system learned or invalidated it. Its described contradiction handling compares facts and updates temporal validity. Current Zep documentation exposes creation, validity, invalidation, and expiration timestamps. These are useful references for our temporal model, not HydraDB guarantees. [Zep paper, section 2.2.3](https://arxiv.org/html/2501.13956v1) · [Fact timestamps](https://help.getzep.com/facts)

**Source-inspected:** HydraDB OSS `GraphSnapshot` records a read epoch and storage snapshot. That provides a storage read boundary, not an application contract for historical truth. [Snapshot implementation](https://github.com/hydra-db/hydradb/blob/671e07bfc7f8a5806727b29cf616f513f969a7a4/src/core/snapshot.rs)

**Proposed:** retain effective time, observation time, source revision, authority/status, and explicit supersession evidence. Consider an ADR effective September 26 but ingested September 30. A query about what applied on September 27 and a query about what the system knew on September 27 can legitimately differ. Late discovery of an older draft should not overwrite a ratified decision. Uncertain dates and unresolved contradictions should remain visible.

Our own v2-to-v3 research makes a useful fixture: keep the former Judge-in-LFG proposal, the later Governance assignment, and the explicit supersession link. The September 30 question bank is a companion document unless authority evidence says otherwise.

## 6. Prior art sharpens the contribution to investigate

| Primary research | Mechanism inspected | RRFlow implication, proposed |
| --- | --- | --- |
| [Reflexion](https://arxiv.org/html/2303.11366v4) | Reflective text derived from feedback is stored for later trials | Compare against simply retrieving past corrections |
| [ExpeL](https://arxiv.org/html/2308.10144v3) | Success/failure experiences produce editable insights; successful trajectories are retrieved for unseen tasks | Compare rule promotion with a simpler experience-and-insight memory |
| [Voyager](https://arxiv.org/html/2305.16291v2) | Reusable executable skills grow through execution feedback and model-based success assessment | Treat executable reuse and its verifier as separately evaluated components |

**Synthesis:** memory, feedback, and reusable skills already have substantial precedent. A more specific contribution to test is **evidence-linked promotion of a correction into bounded deterministic behavior, with versioned replay and rollback**. The graph could make the dependencies inspectable: which observation triggered a candidate, which source supported it, which cases challenged it, and which snapshot activated it. This is a positioning hypothesis, not an exhaustive novelty finding.

## 7. The next evidence that would change our assessment

These are scoped research probes for a later implementation phase; none was run in this pass.

1. **Replay contract:** one frozen case reaches the real agent, records its configuration and evidence versions, and returns a graded result through the documented Raindrop harness.
2. **Trace correlation:** one application turn links to its HydraDB call and journal entry; verify IDs survive export. Test database parent propagation only if database spans are required.
3. **Predicate grounding:** a tiny corpus contains pass, fail, missing-evidence, and not-applicable cases. Measure evidence binding and verdict accuracy separately.
4. **Rule reliability:** compare scoring choices on held-out cases and report accepted-decision error versus coverage. Include the weak-single-match and correlated-rule counterexamples.
5. **Temporal authority:** test late-arriving drafts, explicit supersession, retractions, and different effective/observation dates.
6. **Incremental benefit:** compare plain correction retrieval, graph-linked evidence, and evaluated deterministic promotion using the same corpus and model. Keep all variants' budgets and failure denominators visible.

These probes would establish whether the three systems together deliver a benefit beyond a simpler memory-and-evaluation baseline. The [evaluation plan](EVALUATION.md) provides the broader benchmark ladder; the [inspection ledger](INSPECTION_LEDGER.json) records the versioned technical checks from this pass.
