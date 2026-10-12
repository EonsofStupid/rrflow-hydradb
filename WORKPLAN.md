# RRFLOW objectives and working checklist

Updated October 12, 2026. Owner: Codex. Claude acknowledged the clean Digo base and owns the live specialist/Raindrop module. This checklist tracks the full product; checked items have evidence, while unchecked items may have partial implementation. See research/IMPLEMENTATION_EVIDENCE.md.

## Target outcome

Current first-slice checklist (details and native IDs in `research/IMPLEMENTATION_EVIDENCE.md`):

- [x] Establish one clean Digo app and acknowledged Codex/Claude file ownership.
- [x] Load HydraDB and Raindrop credentials from Infisical without key files in the app.
- [x] Import and explore 6 versioned engineering disciplines, 65 avenues, and 304 draft questions using native HydraDB graph operations.
- [x] Save, retry, reload, and delete a deterministic review plan; keep unrun checks pending.
- [x] Provide light/dark, source drill-down, five live specialist scopes, and native request IDs.
- [x] Send a real UI retrieval and feedback to Raindrop; inspect both in the selected project.
- [x] Finish the final mobile overflow recheck after the screenshot review fix.
- [ ] Add actual evidence-producing engineering execution and progressive inference.
- [ ] Evaluate a prompt candidate on fixed cases and record promotion/rollback in HydraDB.
- [ ] Discover the real tailnet/Proxmox/Cisco infrastructure and reconcile service mappings.

The broader checklist below intentionally keeps criteria open where only part of a capability exists.

Build **RRFLOW as Jesse's connected personal and work knowledge system**, with clear boundaries between personal life and Shippin projects. Gmail, repositories, ambitions, decisions, and lessons should be understandable memories, with proposed placement, human corrections, and traceable provenance. Its configurable engineering specialist provides methodical oversight of AI work, grounded in project knowledge and verified outcomes.

Current release priorities: visible native memories and context avenues inside the connectome; saved local-folder/GitHub project context; native connector and webhook controls; GitHub push synchronization; and useful Raindrop delivery status. Automatic personal/work classification and a complete correction inbox remain open product work. Do not describe them as completed merely because the scopes are visible.

Its first use case gives Jesse one workspace to launch and operate **shippin.cloud, shippin.ai, and shipping.buzz**: see what runs where, drill into the infrastructure, identify what blocks a launch or recovery, inspect the evidence, and improve the system prompts behind the assistance over time.

The initial user is Jesse. The infrastructure scope he named is the **tailnet, dedicated Cisco servers, Proxmox instances in WI / TX / VA, and the homelab**. These are supplied labels, not a verified inventory or a claim that the locations form one cluster. Actual service roles and deployment mappings remain to be discovered.

## Settled decisions

- **HydraDB owns authoritative application state:** the connectome, observations, source references, reasoning runs, rule and prompt revisions, evaluations used for promotion, and outcomes.
- **RRFlow is the reasoning engine:** it opens relevant knowledge avenues during a task, applies rules, gathers evidence, calls tools, and evaluates outcomes.
- **RRFLOW is a configurable specialist:** project scope, knowledge, tools, working standards, and completion checks are explicit. See [the specialist design](research/RRFLOW_SPECIALIST.md). Required checks use actual results; judgment quality still needs evaluation.
- **Use native products deliberately.** Use HydraDB's supported interfaces and Raindrop's actual investigation/evaluation tools. Custom code earns its place by supplying domain behavior or a missing integration.
- **Playwright is the testing and browser demonstration framework.** No Jest in the fresh implementation.
- **Codex and the existing Claude Code session share one plan and experience.** Separate file ownership; review each other's complete user journeys.
- **The first application slice is running.** The active clean Digo app is rrflow-app/apps/rrflow. Current priority is the engineering knowledge UI and live specialists, followed by verified telemetry and then infrastructure discovery. See [TOOLING.md](TOOLING.md).

Infrastructure systems still report their own live operational facts. HydraDB stores the canonical application interpretation and observation history of those facts. Raindrop stores telemetry and evaluation working data; it does not become a second source of active runtime rules or prompts. Secrets remain in the user's configured Infisical project.

**Verified implementation:** Both HydraDB and Raindrop credentials are available through Infisical. The UI imports 6 disciplines / 65 avenues / 304 questions into native seniordev/rrflow, explores real relationships, persists review plans, and retrieves real managed evidence. Production build and the six original browser scenarios have passed; combined validation follows new Raindrop changes. [Evidence](research/IMPLEMENTATION_EVIDENCE.md)

## Goals and evidence of success

These are proposed acceptance targets for the first release, not measured results.

| Goal | Completion evidence |
| --- | --- |
| Understand the infrastructure | Every returned in-scope device/resource appears once or is visibly awaiting reconciliation. A mapped service can be followed to its verified compute, site, and connectivity relationships. |
| Make a useful launch or recovery decision | One selected service has an explicit checklist with pass, fail, unknown, and not-applicable results. Each material result links to its evidence and observation time. |
| Provide a strong operator UI | Jesse completes discovery, service drill-down, evidence inspection, and a saved correction without needing terminal logs to understand the product. Keyboard and narrow-screen versions support the same core journey. |
| Make reasoning and continuity dependable | The acceptance scenarios preserve scope, show unresolved facts, and reconstruct their meaningful state from HydraDB after a new browser session and application restart. |
| Supervise AI work methodically | Missing, failed, forged, or outdated required-check evidence cannot produce a verified completion through the controlled execution path. Legitimate tasks pass proportionate checks without unnecessary escalation. |
| Improve prompts on evidence | One candidate prompt is compared with the active version on fixed inputs and separate regression cases. Its outcome, promotion or rejection, and rollback are reproducible. |

Measure task completion time and errors against Jesse's current workflow before claiming an improvement. For RRFlow, compare the same tasks against native HydraDB retrieval with the same model and evidence budget. Record correctness, unsupported claims, useful abstention, deterministic coverage, model calls, cost, and latency. Set performance budgets after the first baseline; do not invent benchmark wins.

## The experience we are building toward

The following navigation is a design proposal, to refine using real inventory and Jesse's task walkthrough.

| Surface | What Jesse should accomplish |
| --- | --- |
| Overview | See the three services, current launch blockers, changes requiring attention, and when their evidence was refreshed. |
| Infrastructure | Browse WI / TX / VA / homelab, search devices and compute, filter by source or state, and resolve unmatched records. |
| Service detail | Follow a service to deployments, VMs/containers, hosts, sites, and dependencies; inspect readiness and the next useful action. |
| Knowledge and run detail | Open the avenues RRFlow actually used: infrastructure observations, deployment requirements, runbooks, prior decisions, incidents, and prompt policy. |
| Prompts and evaluations | Inspect active system prompts, compare candidates and evidence, open the relevant Raindrop evaluation, and see promotion history. |
| Specialist and task | Configure responsibility, accessible resources, permitted actions, and checks before finishing; understand current work and required attention in plain language. |

Use the tree for navigation and cross-links for relationships. A focused dependency graph should answer a question such as “what depends on this host?” A readable list/tree must support the same task. Render the interface from typed records and explicit UI components; discovered names and retrieved text are data, not executable UI instructions.

**Proposed first complete journey:** choose shippin.cloud, refresh the permitted inventory, resolve one service-to-host relationship, inspect a launch blocker, open its source evidence, record a corrected mapping or requirement, and reload the task. Follow with one prompt improvement case that changes an observed failure. Beginning with shippin.cloud is a scoping proposal, not a claim about where it currently runs.

## How we maximize the products

Evaluate each relevant capability against a concrete user outcome. Record `use now`, `later`, or `unsupported/unverified` with a reason; installing every feature is not the measure of success. Native product facts and source links are in [infrastructure research](research/INFRASTRUCTURE_OPERATIONS.md) and [HydraDB research](research/HYDRADB.md).

| Capability | Intended use | Proof required before relying on it |
| --- | --- | --- |
| HydraDB hosted graph/Cypher | Service, compute, source, rule, prompt, and run relationships | Durable round trip; identities; retries; update/delete behavior in the selected deployment |
| Managed hybrid retrieval and graph context | Find relevant runbooks, requirements, prior decisions, and evidence | Scope enforcement and a verified identity relationship to canonical graph records |
| Item subgraphs, relations, source inspection | Expand an avenue and reach its supporting source | Correct level of graph, source revision, access, and truncation behavior |
| Knowledge and memory ingestion | Retain useful operational knowledge and evaluated corrections | Freshness, indexing readiness, supersession, and authoritative revision handling |
| Native connectors and webhooks | Refresh supported documentation sources | Actual connector availability and reliable update/deletion propagation |
| HydraDB MCP and query feedback | Native tools for inference; retrieval feedback linked to a request | Authenticated tool listing and one meaningful scoped call; feedback is distinct from rule promotion |
| Tailscale and Proxmox APIs | Populate inventory and correlate connectivity with compute | Scoped real responses, stable identities, partial failures, and installed-version compatibility |
| Cisco management interface | Add physical-server identity and health where supported | Discover the actual server models and management products before selecting their API |
| Raindrop traces, signals, datasets, replay, experiments | Investigate mistakes and compare prompt/behavior changes | Trace-to-run correlation, selected project, available plan, working harness, and repeatable evaluation |
| Playwright Test | Browser journeys, HTTP checks, visual checks, accessibility checks, and demonstrations | Assertions about real outcomes, with fixture and live reports clearly distinguished |

The hosted graph, managed context API, and OSS HydraDB engine have different contracts. Shared branding does not establish shared record semantics. Do not depend on managed retrieval over arbitrary graph records until tested. If the required combination is unsupported, record the gap and choose a supported scope with Jesse; do not add a parallel authoritative database.

## Scope and sequence

| Stage | Target | Exit evidence |
| --- | --- | --- |
| P0: establish the base | Runnable clean project, selected accounts/scopes, agreed task and native contracts | Setup record, UI task outline, and capability probes |
| P0: first complete slice | Engineering knowledge dashboard, native specialist retrieval, and saved evidence plan | UI import, native graph drill-down, request IDs, plan retry/reload/deletion, both themes and Playwright |
| P0: demonstrated improvement | One actual prompt failure and evaluated candidate | Baseline/candidate comparison, active revision handling, and rollback |
| P1: expand coverage | Remaining services/sites, richer dependencies, native documentation connectors | Same acceptance checks on added coverage |
| P1: operational actions | Selected deployment/recovery actions with explicit targets and verifiable results | Action-specific contract, bounded authorization, failure recovery, and postcondition checks |
| P2: broader automation | Repeated improvement workflows and additional use cases | Measured benefit and dependable controls from earlier stages |

The first inventory slice reads infrastructure; control actions get separate implementations after their target and effects are specified. A readiness assessment is not a deployment. General billing, broad customer onboarding, a replacement hypervisor console, and an unrestricted prompt autopilot are outside the first slice. No artificial dates are assigned here; confirm the current event's submission instructions through [hackathon alignment](research/HACKATHON_ALIGNMENT.md).

## Working checklist

`[ ]` means not yet demonstrated. Mark `[x]` only with a short evidence link or recorded result. Use the stable IDs in handoffs. An item needs an owner, completion evidence, and any blocker; these stage checks do not add a permission prompt to every reversible task.

### A. Define Jesse's launch and operations workflow

- [ ] **A1 — Service purpose.** Record what each of shippin.cloud, shippin.ai, and shipping.buzz does, its desired launch state, and its actual deployment mappings or explicit unknowns. Output: three concise service records.
- [ ] **A2 — First journey.** Walk through one launch/readiness task and one troubleshooting task from Jesse's current process. Pick the first service and the exact decision the interface must help him make. Output: steps, inputs, outcome, current time/cost.
- [ ] **A3 — Readiness criteria.** Define the checks that matter for that service, such as runtime, routing, TLS, dependencies, release verification, or recovery readiness where applicable. Every check has evidence, freshness requirements, and pass/fail/unknown/not-applicable semantics.
- [ ] **A4 — Action boundaries.** For each proposed button, identify whether it reads, records a decision, or changes infrastructure; specify the target, expected result, retry behavior, and any required authorization. Avoid generic “fix everything” actions.

Exit: both agents can describe the same first journey, entity names, evidence, and expected outcome.

### B. Complete setup and team coordination

- [x] **B1 — Clean base.** Resolve the replacement repository/upstream, establish the fresh checkout, and record its commit and run commands without importing the rejected implementation. Preserve the old checkout until the replacement exists.
- [x] **B2 — Shared context.** Claude reads this plan and acknowledges its assignment in `coordination/CLAUDE_REPLY.md`. Both record exact files before editing; use one set of shared contracts.
- [ ] **B3 — Secrets and scope.** Infisical project binding and the HydraDB key are verified; finish documenting and checking intended scopes for Tailscale, each Proxmox instance, and Raindrop. Keep values out of source, browser payloads, fixtures, and reports. [Verified subset](TOOLING.md#verified-infisical-and-hydradb-access)
- [ ] **B4 — Verified connections.** HydraDB authentication and database readiness are verified. Check each remaining connection with a meaningful permitted read and record its real account/project/resource scope. Keep installed/configured/authenticated/working statuses separate; discovery does not imply every device was inspected.
- [x] **B5 — Playwright baseline.** Install/configure Playwright in the selected base; verify one browser page and one application HTTP endpoint. Document local and CI commands. Update inherited test scripts to the user's Playwright choice.

Exit: the new project starts reproducibly and each integration's actual readiness is visible. UI design with labeled fixtures can progress while specific external connections are unresolved.

### C. Prove the HydraDB state and capability contract

- [ ] **C1 — Selected surface.** Name the HydraDB deployment, supported graph/context interfaces, and official client versions. Perform create/read/update/retry/delete probes on task-owned test records, then verify persisted data after reconnecting.
- [ ] **C2 — Unified identities.** Test whether graph records, managed context, and retrieval share the required IDs and update/deletion semantics. Record the observed supported path and remaining gaps. Do not silently synchronize independently authoritative corpora.
- [ ] **C3 — Domain identities.** Define canonical IDs for services, sites, physical servers, Proxmox instances/nodes/guests, tailnet devices, observations, source versions, runs, prompts, and rules. Scope upstream IDs by their provider instance; keep aliases, name changes, and re-enrollments explicit.
- [ ] **C4 — Relationship contract.** Model hosting, location, connectivity, dependency, support, supersession, and run usage with source references. Separate observed facts, Jesse's declared intent, and inferred links. An unresolved relationship remains visibly unresolved.
- [ ] **C5 — Scope and durability.** Verify access boundaries, empty-allowed-source handling, duplicate events, partial writes, interrupted runs, and recovery. Confirm that active revisions and run resumption survive process restart without another application state store.

Exit: a small documented example proves the required storage/retrieval path; architectural gaps are visible before feature code depends on them.

### D. Populate the infrastructure from its actual sources

- [ ] **D1 — Tailnet discovery.** Read in-scope devices and details through the native API. Preserve upstream identity, names, tags, addresses, source, and observation time where available. Reconcile counts and show unassigned devices.
- [ ] **D2 — Proxmox discovery.** Inventory each supplied instance in WI / TX / VA and the homelab where applicable. Verify versions and permissions; retrieve available nodes, guests, storage, and statuses. Do not assume these instances share a cluster.
- [ ] **D3 — Physical layer.** Identify the Cisco server models and management endpoints, and verify their relationship to Proxmox hosts. Choose an appropriate native API only after that inventory exists.
- [ ] **D4 — Identity reconciliation.** Match tailnet devices, guests, and hosts using explicit supporting identifiers. Test a rename, duplicate hostname, guest migration, and missing tailnet agent. Permit Jesse to correct a link while preserving provenance.
- [ ] **D5 — Service dependencies.** Bind one real service to its compute, runtime, ingress, domain, and dependencies from deployment evidence. Show unknown mappings instead of fabricating complete topology.
- [ ] **D6 — Refresh and failure semantics.** Define freshness windows, update cadence, rate-limit handling, pagination, and partial-refresh status. Keep the last observation with its age. One unreachable source must not erase its inventory or mark every dependent service healthy.
- [ ] **D7 — Separate health signals.** Distinguish tailnet visibility, host/guest state, application checks, and launch readiness. Show the vantage point and timestamp of checks; an unseen or unreachable device is not by itself proof of a host outage.

Exit: the first service's topology is derived from evidence, with unmatched inventory and stale/unknown facts visible in the UI.

### E. Adapt RRFlow to this domain

- [ ] **E1 — Five operations.** Map Gate, Choice, Score, Extract, and Compose to the selected task: check evidence eligibility, choose an avenue/action, rank relevance, extract supported facts, and compose the readiness result. Keep these as reasoning behavior using native HydraDB operations.
- [ ] **E2 — Progressive avenues.** Show only eligible, relevant avenues and why they became useful. A new observation or unresolved predicate can open another avenue. Test recovery from an incorrect initial branch without losing relevant cross-links.
- [ ] **E3 — Evidence-bound predicates.** Each readiness check records its rule revision, source observations, evaluator kind/version, and result. An unrun check is unknown. Relevance weights and model self-assessments are not calibrated correctness probabilities.
- [ ] **E4 — Deliberate triggers.** Define an event-to-rule-to-tool-to-result sequence for deterministic cases; use model assistance where the task actually needs it. Record actual tool arguments and outcomes, with retries bounded and duplicate events handled.
- [ ] **E5 — Bounded inference.** Set hop, result, text, model-call, and time budgets. Preserve source scope, handle truncation explicitly, and distinguish exhausted budgets from evidence that a dependency does not exist.
- [ ] **E6 — Corrections and replay.** Retain the original observation/decision, the correction, its supporting evidence, and the revisions used. A later source change must not silently rewrite what an earlier run knew.
- [ ] **E7 — Specialist profiles.** Define versioned responsibility, project/knowledge scope, tool permissions, working standards, budgets, and completion policy. Pin the effective profile and prompt versions to every task; configuration cannot exceed the authenticated caller's authority.
- [ ] **E8 — Supervision contract.** Implement context inspection, proportional planning, action assessment, change review, and completion verification through one RRFlow contract usable by both products. Add an MCP interface only for useful task-level semantics, keeping HydraDB operations native.
- [ ] **E9 — Trusted evidence.** Validate check results from their actual producer against the current task, content revision, environment, and policy. Reject claimed, outdated, or altered results. Test required unknown/failing checks and explicit exceptions without turning them into passes.
- [ ] **E10 — Enforced boundaries.** Verify that controlled actions and completion cannot bypass RRFlow through direct tools, alternate credentials, or writable evidence records. Record advisory-only boundaries honestly. Prompt tuning must not disable enforced policy.

Exit: the chosen task has an inspectable sequence of real decisions, tools, evidence, and outcomes that persists in HydraDB.

### F. Design and build a strong operator UI

- [ ] **F1 — Task layout.** Produce a low-fidelity overview, service detail, infrastructure explorer, evidence view, and prompt comparison using representative data. Walk the selected task before committing to detailed styling.
- [ ] **F2 — Visual language.** Establish typography, spacing, semantic colors, density, icons, and component states. Make service/site/source labels consistent. Use status text and icons alongside color; keep one clear primary action per task state.
- [ ] **F3 — Dynamic inventory.** Render lists, counts, hierarchy, and relationships from the domain records. New or removed devices update the appropriate views without handwritten cards or losing the current selection.
- [ ] **F4 — Useful drill-down.** Support service-to-host and host-to-affected-services navigation with breadcrumbs, search, filters, stable links, and preserved context. Only show dependency links supported by evidence.
- [ ] **F5 — Evidence in context.** Open the supporting fact or source beside the decision, with provider, timestamp, revision, and any uncertainty. Show concise operational explanations; reserve raw API details for an optional diagnostic view.
- [ ] **F6 — Complete states.** Design loading, no inventory, no search results, unconfigured source, denied access, partial data, stale data, timeout, conflicting observations, and retry behavior. Preserve the operator's input through errors.
- [ ] **F7 — Honest activity.** Drive progress from actual lifecycle events. Distinguish a matched rule, a tool execution, a model-generated proposal, and a fixture playback where relevant. Do not fabricate reasoning logs or success states.
- [ ] **F8 — Accessible interaction.** Verify keyboard flow, visible focus, labels, dialogs, contrast, reduced motion, zoom, and narrow-screen layouts. Provide an accessible list/tree equivalent for graph interactions.
- [ ] **F9 — Design review.** Review the complete journey with Jesse, fix confusing transitions and unnecessary panels, then establish visual baselines. Polish selected states after behavior and data semantics are coherent.
- [ ] **F10 — Plain-language specialist UI.** Explain the task, actual progress, checked evidence, blocker, and next action without requiring infrastructure vocabulary. Use configuration fields such as Responsible for, Can access, Can do, and Checks before finishing; reveal technical detail on demand. Verify understanding in a task walkthrough.

Exit: Jesse can answer “what runs where, what needs attention, why, and what next?” without interpreting implementation details.

### G. Improve system prompts with Raindrop

- [ ] **G1 — Prompt inventory.** Identify the actual agents/system prompts serving the three services. Store canonical prompt IDs, immutable versions, bindings, and active revisions in HydraDB; keep credentials in Infisical.
- [ ] **G2 — Trace correlation.** Instrument one real run with service, run, prompt/rule revision, source observation IDs, tool outcomes, and evaluation references. Confirm the selected Raindrop project and inspect the resulting trace; redact secret values.
- [ ] **G3 — Failure definition.** Label concrete failures such as invented host mappings, treating stale observations as current, or choosing a wrong operational tool. Use native signals/investigation and datasets for examples; keep independent expected outcomes.
- [ ] **G4 — Native replay/playground.** Expose the real RRFlow agent through the documented replay harness with a prompt parameter. Compare candidate and baseline on fixed data, model, and tool environment. Evaluations must not issue production infrastructure changes; use controlled read-only inputs or an isolated test environment.
- [ ] **G5 — Promotion and rollback.** Persist the exact candidate, dataset/evaluator versions, test results, and promotion decision in HydraDB. Test activating and rolling back a revision. Keep edits in Raindrop's evaluation workspace from silently changing the production prompt.
- [ ] **G6 — Verify improvement.** Run held-out and adversarial cases, inspect regressions, then compare logged production cohorts where sufficient data exists. Report sample sizes and inconclusive outcomes. Repeated prompt optimization comes after this first dependable loop.

Raindrop documents prompt parameters, a replay playground, and saved evaluation configurations. A production prompt registry, automatic deployment, and autonomous optimization were not established by the inspected docs. Use its native supported workflow and verify additional features before designing around them. [Replay and playground](https://raindrop.ai/docs/sdk/custom-replay-endpoint.md) · [Experiments](https://raindrop.ai/docs/platform/experiments.md)

Exit: an observed failure leads to a tested prompt change or a documented rejection, with an inspectable active revision and rollback path.

### H. Verify with Playwright

- [ ] **H1 — Browser journey.** Automate inventory refresh, service drill-down, evidence inspection, correction, and reload. Assert the displayed results and persisted postconditions, not just that clicks succeeded.
- [ ] **H2 — HTTP and native contracts.** Use Playwright's request support for the application's HTTP contracts and state postconditions. Use the appropriate MCP client/Inspector inside a test harness for protocol checks; HTTP success alone does not prove MCP compatibility.
- [ ] **H3 — Adverse scenarios.** Cover duplicate/renamed inventory, unavailable Proxmox instance, stale observation, missing service mapping, no permitted sources, interrupted run, and a rejected prompt candidate. Confirm the UI's next action is useful in each case.
- [ ] **H4 — Visual and accessibility checks.** Check the agreed layouts, meaningful screen sizes, focus behavior, and critical component states. Review screenshot changes intentionally. Combine automated accessibility checks with manual keyboard and reading-order review.
- [ ] **H5 — Fixture/live separation.** Use deterministic API fixtures for repeatable UI tests and demonstrations; use a separate live suite for vendor and persistence claims. The live suite must fail visibly if its required service is unavailable, not silently replace it with mocks.
- [ ] **H6 — Repeatability and diagnostics.** Use task-owned test data, stable semantic locators, and deterministic setup/cleanup. Preserve traces/screenshots on failure, protect captured secrets, and report flakes without hiding them behind retries.
- [ ] **H7 — Completion report.** Run type/lint/build checks required by the selected base and the relevant Playwright suites. Attach commands, versions, environment, passed/failed cases, and remaining limitations to the handoff.
- [ ] **H8 — Oversight acceptance.** Demonstrate a worker claiming completion with a missing or stale check, correct rejection with a useful next action, and eventual verified completion after valid evidence. Test a valid task, a bypass attempt, a correctly inapplicable check, and a prompt change attempting to weaken policy; measure false blocks as well as missed failures.

Playwright supports both [HTTP API checks](https://playwright.dev/docs/api-testing) and [visual comparisons](https://playwright.dev/docs/test-snapshots); its [accessibility guidance](https://playwright.dev/docs/accessibility-testing) also describes the limits of automated checks.

### I. Demonstrate and hand off one coherent experience

- [ ] **I1 — Demonstration story.** Show a real service, its infrastructure, a concrete blocker or failure, the evidence, a correction, and restored state after reload. Then demonstrate the prompt comparison tied to that failure.
- [ ] **I2 — Execution provenance.** Identify which steps use live systems, deterministic rules, model calls, or controlled fixtures. Show the actual MCP request/result for an MCP claim. Label prerecorded or fixture fallbacks.
- [ ] **I3 — Launch package.** Document run/configuration instructions, current capability coverage, service mappings, known gaps, and recovery steps. Confirm event-specific submission requirements separately before publication.
- [ ] **I4 — Cross-review.** Codex reviews data/behavior shown in the UI; Claude reviews whether contracts support the whole operator journey. Resolve shared names and ownership conflicts, then update this checklist with evidence.

Exit: another session can reproduce the demonstrated behavior and distinguish working capability from future plans.

## Coordination and next work

The following ownership is proposed until Claude acknowledges it. No message delivery or active Claude session is implied.

| Work | Lead | Paired review |
| --- | --- | --- |
| HydraDB contracts, identity model, RRFlow predicates, native capability probes | Codex | Claude checks usability of fields and events |
| Operator task flows, visual language, responsive UI, interaction states | Claude | Codex checks source and state semantics |
| Inventory, prompt evaluation, and service slices | Claim one complete slice at a time | Review UI, application behavior, storage, and Playwright evidence together |
| Acceptance scenarios and demonstration | Both through separate file claims | Jesse's actual task remains the product reference |

Current deliverables include the running clean Digo application, native research import/review planner, live specialist view, and this broader roadmap. B1/B2/B5 are complete. Next: complete telemetry read-back and shared integration review, then implement evidence-producing reasoning and infrastructure discovery. Remaining boxes require their full stated evidence; partial UI coverage does not complete them.

## Inputs still needed

| Input | Who/where resolves it | What it blocks |
| --- | --- | --- |
| Purpose and first launch milestone for each service | Jesse and existing project material | Final task-specific UI and readiness rules |
| Replacement repository/upstream | Jesse; current decision in TOOLING.md | Implementation in the new base |
| Tailnet identity and permitted inventory scope | Jesse's account/configuration | Live device discovery |
| Proxmox endpoints, versions, and site/cluster membership | Existing configuration and native discovery | Actual compute topology |
| Cisco models and management interface | Inventory/configuration | Native physical-server integration |
| HydraDB graph/context identity and write/retrieval contract | Cloud authentication/readiness verified; remaining capability probes and vendor clarification if needed | Combined graph/retrieval features |
| Actual system prompts, agent entry points, and Raindrop project/plan | Code/configuration and Raindrop | Prompt harness and evaluation coverage |
| Remaining integration credentials/scopes | Verified Infisical project; connect each target explicitly | Tailscale, Proxmox, and Raindrop runtime access |

These are dependencies to resolve as work reaches them, not a request to paste credentials into chat.

## Evidence record for completed items

Use a short entry rather than a new bureaucracy:

`Item ID | owner | file/commit | fixture or live | command/run/reference | observed result | remaining limitation`

Keep the shared decision record in [TEAM.md](TEAM.md), setup facts in [TOOLING.md](TOOLING.md), and capability evidence in [research](research/README.md). A file handoff becomes acknowledged only when the other session responds.

## Brain-driven UI slice — October 12

- [x] Add Brain workspace to the shared dashboard, loaded on demand.
- [x] Stream a typed A2UI v0.9.1 custom catalog from native HydraDB research reads.
- [x] Populate sourced tooltips and accessible drill-down modals from current brain revisions.
- [x] Show actual routing/read/render/reporting states and partial failures.
- [x] Display knowledge before awaited Raindrop delivery; link quality verdicts to the same event.
- [x] Reuse Claude's shared receipts and notifications instead of creating a second activity system.
- [ ] Complete final combined production build, Playwright verification, and visual review.
- [ ] Add actual agent/tool execution and persistent checkpoints in HydraDB.
- [ ] Replay quality cases and evaluate candidate prompt revisions before promotion.

Implementation boundaries and primary references: research/A2UI_DELIVERY.md. Modelence hosting is compatible with the Node app and external HydraDB; public access/authentication and cloud launch configuration remain prerequisites.
