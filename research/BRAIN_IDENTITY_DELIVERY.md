# Persistent brain identity — October 24, 2026

## Owner workflow

Open **Connectome → Source Atlas → Registered brains** in Personal or Shippin work. Register a logical brain against an existing database and collection, optionally linking a saved folder/GitHub project. The form previews the exact address and native binding before saving.

The canonical address is `<personal|work>/<project-slug>/<knowledge|practice|catalog|intake>`. Workspace-wide records use `shared` with no project reference. Project-specific names require a saved project in the same workspace. A display label is separate from the canonical address.

Registration creates a server-generated immutable `brain-<UUIDv4>` identity. Rename preserves that identity, creation date, project reference and native binding, increments the brain revision, and reserves the previous canonical address as an alias. Alias lookup is available through the same owner-protected API: `GET /api/brain-registry?workspace=personal&name=personal/shared/knowledge` (only if actually registered). Search in the UI also includes aliases.

No existing database is renamed or reclassified. No source is copied or moved. No connector is configured or synced. Existing native database cards remain separate from explicitly registered logical brains. Engineering practice's existing `seniordev` assignment is not silently converted to Work or Personal.

## Canonical storage and enforcement

Registry graph metadata uses the dedicated database recorded in Claude's updated user-decision handoff:

| Workspace | Database | Graph collection |
| --- | --- | --- |
| Personal | `rrflow_registry` | `personal` |
| Shippin work | `rrflow_registry` | `work` |

The dedicated `rrflow_registry` database was provisioned after the read-only comparison below. A graph collection is initialized on its first explicit write; reads do not initialize a registry anchor. Source databases and their contents are unchanged. The service reuses the existing database transport rather than adding another HTTP implementation. The registry database is reserved from generic source provisioning and connector routing, including when a conflicting generic membership names it.

The owner API selects the workspace collection; callers cannot supply the registry database or collection. This is application-level scope enforcement. An administrator or agent holding a broad native key is not isolated merely by collection names. `commons` is an approved product direction for reviewed public-source practices; it is not activated by this Personal/Work identity slice, and the Claude-owned session-capture configuration has not moved.

`BrainRegistry` holds the workspace registry revision; `RegisteredBrain` nodes hold typed identity/binding properties; `BrainRegistryRevision` nodes preserve accepted name changes. `HAS_BRAIN` and `HAS_REVISION` connect them. No independently edited JSON mirror or secondary search card is maintained.

Every write:

1. Validates the strict request schema and expected registry revision; the caller cannot supply an immutable ID on registration or a new binding on rename.
2. Reads the complete bounded registry (maximum 250 brains), rejects malformed/duplicate identities, names, aliases, bindings, anchor nodes and conflicting project addresses.
3. Derives the canonical address on the server. Names and aliases are unique within the workspace; one exact database/collection binding can have one registered brain. This avoids implying that different labels isolate the same physical contents.
4. Rechecks the target against the current native database catalog/workspace assignments. Named collections must exist. A project reference must resolve in the requested workspace. This is validation against existing single-owner scope, not new multi-user identity infrastructure.
5. Commits the brain, history node and registry revision in one hosted Cypher statement guarded by `WHERE r.revision = $expected`. Concurrent saves from the same snapshot cannot both be accepted. A conflict returns HTTP 409; the UI keeps the draft and asks for a fresh review, without automatically retrying or rebasing it.
6. Validates the returned identity. Native failures and uncertain responses do not become save confirmations. GET/name resolution also validates the full registry before returning a binding.

Direct administrative Cypher writers can bypass this application protocol. They must honor the same revision contract; malformed snapshots are refused on later reads, but this is not a claim of a native schema constraint or protection from arbitrary administrator writes. Concurrent-write behavior below was measured on the deployed hosted API, not assumed from the open-source engine or asserted as a vendor SLA.

## Native evidence

The current [hosted BYOG guide](https://docs.hydradb.com/essentials/v2/bring-your-own-graph.md), fetched October 24, documents parameterized hosted Cypher, collection isolation, `MERGE`, `WITH`, filters and writes. Its hosted contract differs from the public engine's language subset. The managed OpenAPI snapshot does not describe the `/byog/*` routes. This implementation relies on the hosted guide plus live execution evidence.

A bounded probe in the existing `rrflow_specialist/rrflow` collection used only a unique `RegistryConcurrencyProbe.ext_id`:

- Eight simultaneous `MERGE ... ON CREATE` requests observed exactly one root.
- Four rounds of eight simultaneous revision-guarded updates each produced exactly one winner.
- Exact-ID cleanup removed one probe; the verification query returned zero remaining. Creation count request `f7b8b651-20e1-43db-92fd-fb70e155c104`; cleanup read `da905a2b-8f61-4c69-a5f2-8ffe35adb179`.

The final `brain-registry.ts` service was executed against the dedicated live registry at `2026-10-24T21:43:19.296Z`, with unique temporary graph collections substituted only at the native transport boundary. All other native catalog, membership, collection-discovery and service logic ran normally. Eight concurrent registrations produced one accepted identity; two concurrent renames produced one accepted revision. A fresh module read revision 2 and exactly two history records. Stable ID/binding, prior-name resolution, duplicate-alias rejection, stale-revision rejection and Personal/Work separation passed. No production registry identity was seeded. The temporary collection `rrflow_registry_probe_43d8730b9c2e4d179d488a2cd4be6e57` was deleted; cleanup verification returned zero roots (request `2a305bf1-c237-42ce-86cd-1b6d3331e68c`). Full receipts/scripts remain locally under ignored `test-results-registry/`.

The pre-provisioning comparison at 21:42 UTC found zero identity anchors at the earlier proposed locations, zero `DatabaseWorkspace` memberships, zero `Project`/`ProjectContext` records, two existing specialist `Workspace` nodes, and one `RepositorySync` checkpoint. Existing workspace/sync records remain canonical where they were; they were neither copied nor deleted. The empty native database `personal` and the public demo database remain separate reconciliation items. Creation of `rrflow_registry` was accepted with request `4d1ba452-046f-48fa-bc69-324a494f2b34`; the final live service test confirms its graph is usable. The [native database guide](https://docs.hydradb.com/llms.txt) was fetched October 24 to verify `POST /databases` and readiness semantics.

## Verification and boundaries

`tests/brain-registry.spec.ts` covers pure contract invariants, actual server modules with native HTTP mocked, browser save/reload/rename/error flows, accessibility, mobile layout and API input/access guards. The existing Atlas fixtures now include an explicit empty registry. CI includes the four isolated registry cases. Live native persistence is checked separately in an owned temporary collection, not by leaving test names in the owner's real registry.

Final local validation: both production builds passed. Root `pnpm verify` passed TypeScript, lint and **65 Playwright tests / one opt-in Qdrant import skipped**, no retries (1.3 minutes of browser tests). The native Linux verification snapshot avoids slow Windows-mounted module reads; all **697** app/CI/deployment inputs match the shared checkout, manifest SHA256 `a7ea2690291ba323ef54d4dcd17d216609b81cc658eff3d0e3401c86d86c983e`. The shared checkout's `.next-registry` is the user-facing build. A live registration-form inspection loaded the actual Personal `default-tenant/gmail` binding without saving a name; the Work registry read returned revision zero with no Personal identities. The reserved database creation endpoint returned 409 before provider mutation. Screenshots and receipts remain in ignored `test-results-registry/`.

After the port-3100 switch, three additional Playwright checks passed against the shared checkout's final build: registry UI save/rename with isolated fixtures, actual API guards, and live Gmail source inspection. No fixture identities were sent to HydraDB by the browser test.

Remaining work: migrate existing names only through a reviewed dry run; provide project-level rename/move reconciliation; support reviewed rebinding; resolve registry names throughout workers/MCP/CI ingestion; integrate SWAG vision/provider-fact/decision lifecycles. Existing project IDs remain location-derived; saving a brain does not silently replace that project identity model. Automatic model learning or rule promotion is not implemented by registering names. Modelence deployment is unchanged.
