# Codex → Claude: RRFLOW team handoff

Status: ready for Claude to read; acknowledgment pending.

Setup correction: Jesse clarified that this project is still being set up. The assessment below is provisional, not authorization to continue the previous implementation. Read `../TOOLING.md` for the pending clean-upstream decision. Do not assume application readiness, a working MCP integration, or an established messaging channel.

Jesse explicitly asked Codex and the Claude Code instance in this VS Code workspace to work as a team. This is that coordination request. Please read `../AGENTS.md`, `../TEAM.md`, `../WORKPLAN.md`, and `../research/SHIPPIN_CONNECTOME.md` before taking ownership.

## Shared direction

- RRFLOW is the configurable engineering specialist product direction, integrating with shippin.ai and shippin.cloud. It should supervise AI work methodically, with verifiable required checks and a UI understandable without engineering expertise.
- Jesse is the initial operator for launching shippin.cloud, shippin.ai, and shipping.buzz. The UI should populate from the tailnet and drill into Cisco servers, Proxmox instances in WI / TX / VA, and the homelab. These are user-supplied scope labels, not verified topology.
- RRFlow is the reasoning engine. Adapt the prior research to HydraDB's actual capabilities.
- HydraDB owns authoritative persistent state, including knowledge, reasoning runs, rules, corrections, and outcomes.
- The connectome exposes useful knowledge trees and cross-linked avenues during inference.
- Use native HydraDB capabilities directly. Do not introduce parallel state stores or abstractions that merely rename API calls.
- Use Playwright for testing and repeatable browser demonstrations. Jesse explicitly rejected Jest; inherited Jest configuration is not a product decision. Playwright installation and runtime verification remain pending.
- Use the verified Infisical project described in `TOOLING.md`; do not introduce Doppler or put secret values in these files.
- Raindrop should help improve system prompts using verified native capabilities. Keep active prompt revisions in HydraDB; do not assume Raindrop evaluation presets serve production prompts.

## Your initial assignment

Please review `WORKPLAN.md` and propose one coherent operator journey from UI through RRFlow to HydraDB and back. This handoff requests planning and coordination, not continuation of the old application implementation.

1. Report any work already underway and the files you are editing, so Codex can avoid collisions.
2. Review the checklist's setup dependencies and proposed first slice. If assessing the old starter as reference, identify conflicting persistence/testing defaults without deleting, migrating, or carrying its implementation forward.
3. Propose low-fidelity views for the specialist/task, service overview, infrastructure drill-down, source evidence, readiness, and prompt comparison. Use plain-language goals, progress, findings, blockers, and next actions. Include stale, partial, unknown, and failure states. Use the checklist's first-service journey as a proposal; do not invent actual topology.
4. Identify the state fields and UI events that journey actually requires. Mark proposals as proposals until we reconcile them with the native HydraDB contract.
5. Propose file ownership for the first complete slice in the selected clean base. Share the API/UI contract using that base's conventions; do not assume the rejected implementation's directory structure is required.

Write your acknowledgment and findings to **`coordination/CLAUDE_REPLY.md`**. Include current task/session identity if available, claimed files, findings, validation performed, and unresolved questions. Own that reply file; Codex will read it and respond separately in `coordination/CODEX_REPLY.md` to avoid simultaneous edits.

## Codex ownership and findings

Codex owns `WORKPLAN.md`, `research/`, and this handoff for the planning pass. No application code was changed by this pass. Infisical binding and HydraDB cloud authentication/readiness are now verified through read-only requests recorded in `TOOLING.md`. Graph writes, retrieval integration, MCP, and benchmarks remain untested.

Start with:

- `WORKPLAN.md` — objectives, phases, stable checklist IDs, acceptance evidence, and proposed ownership.
- `research/RRFLOW_SPECIALIST.md` — specialist configuration, enforced versus advisory supervision, evidence contract, plain-language UI, and acceptance demonstration.
- `research/INFRASTRUCTURE_OPERATIONS.md` — tailnet/Proxmox discovery and Raindrop prompt evaluation capabilities and limits.
- `research/SHIPPIN_CONNECTOME.md` — current direction and direct capability map.
- `research/HYDRADB.md` — managed context, hosted graph, and OSS contract differences.
- `research/DEEP_RESEARCH.md` — predicate grounding, rule-scoring counterexample, temporal authority, and prior art.
- `research/SOURCES.md` — original documentation and internal research references.

The central unresolved technical contract is whether hosted Cypher and managed knowledge/memory retrieval can address the same canonical records with reliable update/deletion propagation. Hosted `/byog/query` and native MCP graph tools are documented. Do not assume the separate surfaces share arbitrary graph records, and do not bridge the uncertainty with a second authoritative store.

Raindrop is requested for prompt improvement and evaluation; runtime integration remains pending. Native HydraDB query feedback is also documented. These support different parts of the workflow.

Planning handoff: documentation links and checklist IDs are checked locally. HydraDB access is verified; application behavior and the specialist runtime remain unverified. Use checklist IDs to identify claimed work and return evidence for completed items; writing this plan did not establish Claude acknowledgment.

## Integration checkpoint

Before implementation diverges, agree the initial journey, state ownership, required native operations, shared field definitions, and file claims. Then implement complete vertical slices and cross-review them. App code changes require the repository's checks; documentation-only assessment does not establish runtime compatibility.

Writing this handoff is not evidence of message receipt. Team status changes to acknowledged only after Claude supplies a response.
# Current implementation supersedes the earlier planning handoff

Read `CODEX_REPLY.md` and `CLAUDE_REPLY.md` for active file claims and review findings. The clean Digo app is implemented in `rrflow-app/apps/rrflow`; the earlier setup-only assignment below is historical.

