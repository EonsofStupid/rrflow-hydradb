# Infrastructure operations and prompt improvement

Research date: October 12, 2026. This applies Jesse's stated use case to the existing HydraDB/RRFlow research. Public documentation and code were read; no tailnet, hypervisor, Cisco device, or production service was contacted.

## User-supplied scope

Jesse is the first operator. He wants to launch and manage shippin.cloud, shippin.ai, and shipping.buzz, with a UI populated from the tailnet and capable of drilling into dedicated Cisco servers, Proxmox instances labeled WI / TX / VA, and the homelab. He also wants system prompts managed and improved using Raindrop over time.

Service roles, actual domains/endpoints, asset counts, cluster membership, and physical-host mappings have not been verified. Preserve the supplied names; do not infer that all three services share one deployment or that all sites share a Proxmox cluster.

The execution checklist is [WORKPLAN.md](../WORKPLAN.md). The established state/engine boundaries remain in [SHIPPIN_CONNECTOME.md](SHIPPIN_CONNECTOME.md).

## Native discovery paths

| System | Verified public capability | Project implication and remaining proof |
| --- | --- | --- |
| Tailscale | Its documented device API lists tailnet devices and gets a device's details. `devices:core:read` covers the corresponding GET operations. | Use scoped discovery for inventory. It does not establish every physical server, guest, dependency, or application-health result. Live account access is pending. |
| Proxmox VE | Official source defines a cluster-wide `GET resources` endpoint with resource IDs/types and node associations, plus type-dependent status and utilization fields. | Read each actual instance with its installed-version contract. Combine instance identity with resource identity; reconcile devices separately. Permissions can limit returned inventory. |
| Cisco | The user named dedicated Cisco servers, but no models or management products are known. | Determine the physical inventory and supported management interface before choosing a Cisco API or assuming UCS/Intersight/CIMC/Redfish availability. |
| Service runtime | No deployment or health endpoint was inspected. | Derive service-to-workload mappings from deployment evidence. Define separate application checks from machine reachability. |

Sources: [Tailscale device inventory](https://tailscale.com/docs/features/access-control/device-management/how-to/export-list), [Tailscale credential scopes](https://tailscale.com/docs/reference/trust-credentials), [official Proxmox resources implementation](https://github.com/proxmox/pve-manager/blob/master/PVE/API2/Cluster.pm), and [Proxmox permission documentation](https://github.com/proxmox/pve-docs/blob/master/pveum.adoc).

The public Proxmox wiki/API viewer returned HTTP 403 during this research. The official repository was readable instead; its `master` branch is not proof of compatibility with Jesse's installed versions. Inspect the version-specific API when connecting.

## Proposed connectome model

The useful question is “what does this service depend on, and what evidence supports the current conclusion?”

| Entity/relationship | Purpose |
| --- | --- |
| Service → deployment → workload | Identify the running implementation of each service; allow several deployments and environments. |
| Workload → Proxmox node → physical server → site | Explain placement only where those relationships are verified; do not force every deployment into this shape. |
| Asset ↔ tailnet device | Associate private connectivity with an asset while retaining separate provider identities. |
| Service/workload → dependency | Traverse effects and prerequisites without assuming adjacency implies causality. |
| Observation → upstream resource + capture time | Preserve who reported what, when, and with what scope. |
| Readiness check → evidence + rule revision | Explain pass, fail, unknown, or not-applicable outcomes. |
| Run → prompt/rule version + tool results + outcome | Reconstruct the actual behavior behind a decision. |
| Correction → original record + superseding evidence | Retain the previous understanding and why it changed. |

These are application design proposals, not reserved HydraDB types. Use native graph operations once the selected deployment is verified. Avoid a separate inventory database: observations, reconciliation decisions, and inference records belong to HydraDB. Provider systems remain the origin of their live facts, and Infisical remains the secret system.

Tree navigation is a projection of this graph. A service may span sites, a host may serve multiple services, and a tailnet device may correspond to a guest rather than its physical server. Unmatched and conflicting identities need first-class UI states.

## Dynamic UI semantics to preserve

- A tailnet device record is connectivity inventory. An API response or last-seen value alone does not establish application health.
- A Proxmox guest's running status does not establish that its service passes a release check.
- An unavailable source makes observations stale or unknown; it should not erase known assets or turn missing checks into passes.
- Discovery should update typed records and relationships. UI components render those records; source text should not dictate executable UI behavior.
- Site and service views should preserve the same IDs, filters, and selections as evidence and run views.

## What Raindrop can do for system prompts

Raindrop's documented replay workflow exposes parameters such as a system prompt from an application-owned agent harness. Its playground lets users try parameter changes on selected inputs, run a full suite, and save reusable configurations. The real agent still runs in the application. This supports a native prompt evaluation workflow. [Replay/playground guide](https://raindrop.ai/docs/sdk/custom-replay-endpoint.md)

Experiments compare previously logged cohorts, including prompt variants; they do not execute replay. The inspected guide says creating/editing experiments requires Pro. Verify the chosen account's features before making that part of the implementation. [Experiments](https://raindrop.ai/docs/platform/experiments.md)

The self-healing cookbook describes evidence-led investigation followed by a reproducible check and a reviewed change. This supplies a useful improvement pattern; it does not establish a service that autonomously publishes production prompts. [Self-healing workflow](https://raindrop.ai/docs/cookbooks/self-healing-loop.md)

**Still unverified:** a production prompt registry/serving API, native deployment to the three services, and automatic optimization suitable for this setup. Do not promise those features based on evaluation presets.

Proposed project loop:

1. Resolve the active prompt revision from HydraDB for a specific agent/service.
2. Correlate its actual run and evidence with a Raindrop trace.
3. Investigate a failure and create a candidate prompt with fixed evaluation inputs.
4. Use Raindrop's replay/playground with the real RRFlow entry point in a controlled environment.
5. Keep the evaluated prompt version, results, and promotion decision in HydraDB.
6. Activate or reject it explicitly, retain rollback, and inspect subsequent outcomes.

Raindrop's OTLP interface accepts HTTP traces; its docs explicitly exclude OTLP metrics/logs. The trace attribute mapping includes system instructions. This is useful for correlating prompt behavior but is not an infrastructure metrics backend. [OpenTelemetry](https://raindrop.ai/docs/sdk/opentelemetry.md)

The replay handler requires an authenticated endpoint reachable by Raindrop. A private tailnet address should not be assumed reachable by the hosted service. Resolve this deployment path separately; exposing broad infrastructure control is not necessary to evaluate prompt behavior. [Replay deployment guidance](https://raindrop.ai/docs/sdk/custom-replay-endpoint.md)

## Useful RRFlow tests for this use case

- The same hostname appears in two Proxmox instances: keep identities distinct until supporting evidence links them.
- A guest migrates but remains the same workload: update placement without losing service history.
- A tailnet record is fresh but the application check fails: preserve both observations and fail the relevant readiness predicate.
- A source is unreachable: explain the unknown result and choose a useful next evidence request.
- A prior run used a retired prompt: replay against that recorded version rather than today's active prompt.
- A model proposes a host mapping without evidence: retain a candidate or unknown, not a verified relationship.
- A prompt candidate improves the motivating example but fails another site's case: report the regression rather than automatically promote it.

These are proposed acceptance scenarios. No live result is claimed.
