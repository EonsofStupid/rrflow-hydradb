# Evidence to collect before choosing a build

This is a proposed evaluation plan. No results are claimed.

The [deeper research](DEEP_RESEARCH.md) adds targeted probes for replay, trace correlation, predicate grounding, rule calibration, and temporal authority. In particular, compare accepted-decision error against coverage; normalization of authored rule weights is not a demonstrated probability of correctness.

## Establish the target event and interface

Use the current [Company Brain hackathon brief](HACKATHON_ALIGNMENT.md) for event alignment. The August Hack Hydra tracks, OSS emphasis, and build-period rules cited in earlier research are historical and must not be applied to the current event without verification.

The first user is Jesse, launching and operating shippin.cloud, shippin.ai, and shipping.buzz. Use [WORKPLAN.md](../WORKPLAN.md) for infrastructure discovery, operator UI, prompt improvement, and Playwright acceptance scenarios. Benchmark references below are optional later research, not prerequisites for the first complete slice.

The product direction is now shippin.cloud with RRFlow reasoning and HydraDB-owned state. Determine which native deployment exposes the required graph/context capabilities under one canonical identity and update model; do not solve a capability gap with parallel state stores. The hosted graph API, managed context API, and OSS engine have different contracts.

## Five small capability probes

1. **Graph round trip:** create typed evidence relations, retrieve them, restart, and confirm durable results. A health check alone is insufficient.
2. **Identity and retries:** repeat an ingestion, change a source version, and ensure neither duplicate relations nor mismatched identities alter the answer.
3. **Temporal correction:** retain an old decision, its replacement, and when the change was observed; answer both historical and current questions.
4. **Context validation:** deliberately include an unsupported relation, stale claim, wrong scope, and missing evidence. Observe explicit verification outcomes.
5. **Trace correlation:** follow one failed answer from its Raindrop event to the exact rule, retrieval, and source versions in our records.

For managed BYOG, include conflicting entity names and a weakly supported relation. For OSS, include a partial multi-request write and interrupted rule publication. These probes resolve different uncertainties.

## Compare one change at a time

Proposed baseline ladder for the same task set and answer model:

| Variant | What it isolates |
| --- | --- |
| Text/vector retrieval with no relationship expansion | Baseline evidence selection |
| Add HydraDB relationship traversal | Incremental value of graph structure |
| Add LFG address-scoped retrieval | Value and cost of classification |
| Add temporal handling and Governance | Stale-evidence, conflict, and abstention behavior |
| Add an evaluated rule correction | Whether the improvement persists on held-out cases |

Report answer correctness separately from evidence recall. Also measure citation support, abstention on unanswerable questions, temporal-update accuracy, false rejections, deterministic classification coverage, escalation rate, tokens, and end-to-end latency. Separate ingestion cost from query cost; disclose warm versus cold runs.

Freeze the corpus revision, rule revision, model configuration, retrieval budget, and evaluator version for each comparison. Keep errors and timeouts in the denominator. Keep promotion examples separate from evaluation questions. A signal-rate correlation is not a controlled causal result.

## Primary benchmark references

**LongMemEval** supplies 500 questions across extraction, multi-session reasoning, temporal reasoning, updates, and abstention. Its repository includes both answer evaluation and evidence-retrieval evaluation. The latter excludes abstention cases, so retrieval scores cannot establish correct abstention. Start with a declared development subset, then use the official protocol for comparable results. [Repository](https://github.com/xiaowu0162/LongMemEval)

**LongMemEval-V2** targets experience from multimodal agent trajectories; its stated scale reaches much larger histories than the original benchmark. It is a later stress target, not an interchangeable version of the same workload. [Repository](https://github.com/xiaowu0162/LongMemEval-V2)

**BEAM** adds long, coherent conversations and varied memory probes; its authors also provide LIGHT as a memory baseline. [Repository](https://github.com/mohammadtavakoli78/BEAM)

**EnterpriseRAG-Bench** is a relevant enterprise retrieval reference linked by the event. Inspect its dataset and evaluation protocol if that track becomes the target. [Repository](https://github.com/onyx-dot-app/EnterpriseRAG-Bench)

## Adjacent research worth reading

- **Zep/Graphiti:** temporal knowledge graphs and historical relationships. Useful comparison for the proposed correction model. The paper's reported results are its authors' results, not expected HydraDB performance. [Paper](https://arxiv.org/abs/2501.13956)
- **Mem0:** memory extraction, consolidation, retrieval, and a graph variant. Useful baseline for whether our additional rule and verification machinery pays for itself. [Paper](https://arxiv.org/abs/2504.19413)
- **Microsoft GraphRAG:** community summaries support corpus-wide questions; dynamic selection helps choose relevant communities. Useful when classifying a request as a broad synthesis task rather than a specific evidence lookup. [Research](https://www.microsoft.com/en-us/research/blog/graphrag-improving-global-search-via-dynamic-community-selection/)

These are selected primary references, not a comprehensive novelty review.

## Brainstorming questions that now have a concrete basis

1. Which outcome matters most: better memory, faster correct classification, or explainable recovery from failures?
2. Which smallest graph relationship would make an answer better than the baseline?
3. What evidence must exist before a correction can become an active rule?
4. Which native HydraDB deployment supports the required connectome and reasoning state with one canonical identity model?
5. What real failure from our own work would make a convincing before/after demonstration?
