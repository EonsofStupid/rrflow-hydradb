# RRFLOW research base

Research date: October 12, 2026, America/Los_Angeles.

Purpose: establish the evidence and terminology for product decisions. This research pack supports the [working objectives and checklist](../WORKPLAN.md); documented capabilities are distinct from verified integrations. Raindrop means **Raindrop AI monitoring and evaluations**, as confirmed by Jesse.

**Current user direction:** RRFLOW is a configurable engineering specialist for shippin.ai and shippin.cloud, with RRFlow reasoning and HydraDB-owned application state. It should oversee AI work methodically and provide a UI understandable without engineering expertise. Knowledge trees and cross-linked avenues become available during inference. Adapt the research to native capabilities without parallel state stores or redundant wrappers. HydraDB cloud authentication/readiness are now verified; Raindrop runtime instrumentation and full application integration remain pending. See [tooling status](../TOOLING.md). [Current direction](SHIPPIN_CONNECTOME.md) · [Shared team brief](../TEAM.md)

| Read | What it answers |
| --- | --- |
| [Objectives and working checklist](../WORKPLAN.md) | How do we build and verify Jesse's service launch, infrastructure, and prompt improvement experience? |
| [Configurable engineering specialist](RRFLOW_SPECIALIST.md) | How does methodical AI oversight integrate with the products, enforce checks, and stay understandable to users? |
| [Infrastructure operations](INFRASTRUCTURE_OPERATIONS.md) | Which native discovery and evaluation capabilities support the tailnet, Proxmox, Cisco, and prompt use cases? |
| [shippin.cloud connectome](SHIPPIN_CONNECTOME.md) | The confirmed product direction, direct HydraDB capability mapping, and unified state requirements |
| [Deeper research findings](DEEP_RESEARCH.md) | Source-level integration checks, scoring counterexamples, predicate grounding, temporal authority, and prior art |
| [HydraDB capabilities](HYDRADB.md) | Which HydraDB interface are we discussing, and what is documented? |
| [RRFlow mapping](RRFLOW_MAPPING.md) | Which ideas survive from the latest research, and where could they fit? |
| [Raindrop integration](RAINDROP.md) | What can be integrated today, and what would we build ourselves? |
| [Evaluation and open questions](EVALUATION.md) | How would we establish that a concept works? |
| [Source register](SOURCES.md) | Primary references, internal research, evidence status, and reading order |

The internal baseline includes **LFG_NOTES_v3** and its **LFG_ENGINE_PLAN** companion, both September 26, plus the **Boundary Question Bank v0.2**, September 30. V3 explicitly supersedes v2 and v2.1 but retains individual LOCKED, PROPOSED, PARKED, and OPEN items. The later question bank is a draft, not evidence that v3's component boundaries were superseded. See the [source register](SOURCES.md).

The deeper pass confirmed Raindrop replay exports in the inspected 1.0.1 package, identified a telemetry-routing mismatch, and derived a weak-match counterexample to the engine draft's scoring formula. It also mapped project-bound verification questions to an evidence graph. These findings narrow what needs to be tested before selecting a build. [Details](DEEP_RESEARCH.md) · [Inspection ledger](INSPECTION_LEDGER.json)

The current event is the October 12, 2026 **Company Brain Hackathon**. Its verified brief and our problem-statement review template are in [Hackathon alignment](HACKATHON_ALIGNMENT.md). The August Hack Hydra event cited in earlier research is historical context, not the current deadline or rubric. [Organizer](https://luma.com/oct-hackathon)

Evidence boundary: public documentation, OpenAPI, pinned repository code, published package exports, primary papers, and private research were inspected. Infisical project binding and authenticated HydraDB cloud listing/status calls are now verified. No HydraDB server was started, no benchmark was run, and no private data was ingested into HydraDB or Raindrop. Performance and end-to-end compatibility remain to be measured. No external publication was performed.
