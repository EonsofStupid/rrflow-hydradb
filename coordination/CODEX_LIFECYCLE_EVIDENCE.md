# Evidence for the RRFLOW lifecycle film

Read-only inspection on October 12, 2026 PDT / October 13 UTC. This handoff
supports the expanded film with observed records, public sources, and exact
UI controls. No provider data, app source, build, deployment, or Git state
was changed for this inspection. The capture worker separately completed one
root-authorized placement confirmation; its receipts and the successful
filmed lesson retrieval are recorded below.

## The truthful story

1. Public source context arrives with its repository, path, revision, and hash.
2. A person confirms its existing Shippin placement. Refresh can demonstrate
   persistence. This is confirmation, not correction of a misclassification.
3. Main-branch CI automatically captures actual verification outcomes in
   HydraDB, and the source-sync workflow updates its native checkpoint.
4. An earlier failure was reviewed, its code correction is inspectable, and a
   passing follow-up is linked to a saved engineering practice.
5. That reviewed practice is actually retrievable as context for future work.
6. Raindrop receives observation/review events. Accepted delivery is distinct
   from native read-back, evaluation, and prompt promotion.

The film must not claim automatic diagnosis, trained classification, autonomous
code changes, proven causal improvement, or automatic prompt promotion.

## Current automatic CI capture

Live `GET /api/learning` at 03:19 UTC returned no provider errors. The native
read requests included `f79363d7-bd17-4e5a-a242-d57367c87737`,
`c5a35bcd-d9f3-4051-8bdc-46199b85fc11`, and
`f71ee725-b788-4037-8deb-099a226b4927`.

| Field | Observed value |
| --- | --- |
| Record | `learning-d6f79d78a33a3ed46b373477bc8e748e` |
| Commit | `06c7de09a45e501ec869c69fe1fb2c457438c534` |
| Recorded at | `2026-10-13T03:06:29.387Z` |
| Mode | `automatic-ci` |
| Conclusion | `passed` |
| Observed checks | 41; no failed checks |
| Native write request | `9df3b8c6-11a1-4999-9548-bd483c46ad40` |
| Managed evidence ingestion | `accepted_indexing_unverified` |
| Raindrop delivery | `accepted` |

[Actual CI run](https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38340002520)
finished successfully. Its capture step succeeded at 03:06:58–03:06:59 UTC.
The public log emits the canonical record and write receipt above. The
Modelence deployment job in this particular run was **skipped**; do not imply
this run deployed the public service.

The previous automatic record `learning-a025dbd44081b052d78d49fa6e98e3f8`
is also present: commit `f6bcda83033a610bdf7dc4f5c0561ee5a0576a41`,
[run 38339480830](https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38339480830),
41 checks, passed, `2026-10-13T03:00:00.164Z`.

Both use schema version 1.0 and SHA-256
`d7226048618bc2b7ce08842561c9f40e4b46cc70d262988bdcf921e9c4ff6b6b`.
The latest evidence links the
[exact committed schema](https://github.com/EonsofStupid/rrflow-hydradb/blob/06c7de09a45e501ec869c69fe1fb2c457438c534/rrflow-app/scripts/learning-evidence.schema.json).

UI: dashboard button **Learning trail**, region **Learning trail**, button
**Refresh learning trail**. The latest article contains `06c7de09` and
**Captured automatically from CI**. Open **Where does the evidence schema
come from?** to show the version, link, and hash. Individual check details
show their source links. These are observations, not diagnosed causes.

## Current automatic repository synchronization

`GET /api/repository-sync` at `2026-10-13T03:22:29.298Z` returned a native
HydraDB HTTP 200 receipt, request `19100bf8-ce6a-4289-b666-a2f0cfbd428f`,
for the saved checkpoint in `rrflow_specialist`.

| Field | Observed value |
| --- | --- |
| Commit | `06c7de09a45e501ec869c69fe1fb2c457438c534` |
| State | `searchable` |
| Total/searchable | 111 / 111 |
| Completed | 103 |
| Changed / accepted on this run | 0 / 0 |
| Failed / removed / deleted | 0 / 0 / 0 |
| Last successful time | `2026-10-13T03:07:41.211Z` |
| Raindrop status | `accepted`, HTTP 200 |
| Raindrop event ID | `github-sync-06c7de09a45e501ec869c69fe1fb2c457438c534-38340002442-1` |

[Actual sync run](https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38340002442)
passed. Its **Sync committed sources, verify indexing, and report to Raindrop**
step succeeded at 03:07:39–03:07:41 UTC. This is a successful incremental
check of existing content; zero changed files must not be presented as a
fresh ingestion of 111 files. Searchable and completed are separate states.
Unchanged sources can correctly retain their older source commit.

## Real failure, reviewed correction, and retained practice

The existing reviewed lesson is
`e55bf51095223b807ca8925591b296461811d830836ede2018275e94ec08f59d`.
It was saved at `2026-10-13T01:40:15.637Z` with
`status=reviewed-with-follow-up`.

| Evidence | Record / commit / run |
| --- | --- |
| Failed | `learning-3a114264ea082df19da25a82d900d9b4`; `435647cd99da55c26d2022c7692e1e761c57b3c7`; [38321136137](https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38321136137) |
| Passing follow-up | `learning-e0b96693075ef96f1a63c19c385a240b`; `8775997805e99a430cd8aba4a049b4ba35d90a0e`; [38322254472](https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38322254472) |

Both historical runs were imported retrospectively with `capture.mode=imported-ci`.
They must not be described as automatic capture at the time they originally ran.
The matching failed/passing check is **Playwright sync, connector, and refresh
checks (no live credentials)**, rule ID `github:job:0:step:9`.

Reviewed cause: the credentialless CI page contained two alerts, so the broad
`getByRole('alert')` assertion was ambiguous under Playwright strict mode.

The actual public code diff in commit 8775997 changes:

```ts
await expect(map.getByRole('alert')).toContainText('Source service unavailable');
```

to:

```ts
await expect(map.getByRole('alert').filter({ hasText: 'Source service unavailable' })).toBeVisible();
```

[Inspect the committed test](https://github.com/EonsofStupid/rrflow-hydradb/blob/8775997805e99a430cd8aba4a049b4ba35d90a0e/rrflow-app/apps/rrflow/tests/connectome.spec.ts#L56).
The captured GitHub step has no invented original test-file line; its
[rule source is the capture schema's step-outcome contract](https://github.com/EonsofStupid/rrflow-hydradb/blob/9295c8586eca05a048b39f3ecf99735c0eb3a577/rrflow-app/scripts/learning-evidence.schema.json#/$defs/stepOutcome).

Saved practice: **For failure-state UI checks, scope the assertion to the
intended region and error message. Verify with the credentialless CI
environment as well as the local connected app.**

UI: **Learning trail** → **Lessons kept in HydraDB** → **Trace this lesson**.
The badge reads **Reviewed · passing follow-up linked** and the detail shows
the reviewed cause, correction, source link, and failed-to-passing commits.
No new lesson save is needed for footage.

## Actual retrieval of that reviewed lesson

A read-only query through `POST /api/explore/rrflow_specialist/query` returned
exactly one matching chunk of the saved lesson, including its diagnosis,
correction, practice, rule URL, original/follow-up commits, and status.

```json
{
  "query": "For failure-state UI checks, scope the assertion to the intended region and error message",
  "collections": ["rrflow_lessons"],
  "type": "knowledge",
  "queryBy": "hybrid",
  "mode": "fast",
  "maxResults": 5,
  "graphContext": false,
  "forcefulRelations": false,
  "temporalReasoning": false
}
```

- Request: `dd8470ec-ee04-4633-9884-1f17a0aae590`.
- Observed latency: 207.3 ms; one local observation, not a benchmark.
- Source: `reviewed-lesson:e55bf51095223b807ca8925591b296461811d830836ede2018275e94ec08f59d`.
- Title: **Reviewed lesson: Playwright sync, connector, and refresh checks (no live credentials)**.
- Collection: `rrflow_lessons`; score approximately 0.963.
- Independent list read found the same source and `status=reviewed-with-follow-up`,
  request `898b1cb1-8294-4ef9-90de-851c052d46e9`.

Safe visible controls: open `/explore`, choose the **rrflow_specialist** database
button before recording source contents, then **Query Lab**. Fill the **query**
field, choose **rrflow_lessons**, **type → knowledge**, **mode → fast**, and
leave **query_by → hybrid**. Set **max_results** to 5 and uncheck
**graph_context**, **forceful**, and **temporal**. Click **Run (fast)**.
The result shows the source title, collection, and native request ID.
The initial explorer can select another ready database, so do not record its
source list before explicitly selecting Work.

This query route makes no application state or telemetry write. The returned
context supports saying **the reviewed lesson can be retrieved for the next
change**. It does not prove an agent applied the practice or improved a model.

### Final filmed query receipt

The selected final film uses the expanded-context retrieval captured through
the actual Query Lab UI at `2026-10-13T03:39:15.188Z`.
`06-retrieve-reviewed-lesson-contents.webm` has `status=captured` in the
recording manifest. Native request
`dd7dc5f2-2129-48a2-82a9-7916a9b7583e` returned exactly one chunk of
`reviewed-lesson:e55bf51095223b807ca8925591b296461811d830836ede2018275e94ec08f59d`
in an observed 175.1 ms (rounded to 175 ms in the UI). The recorded request uses `rrflow_lessons`,
`knowledge`, `hybrid`, `fast`, `maxResults=5`, `alpha=auto`,
`recencyBias=0.4`, and disabled graph/forceful/temporal options.
This is real read-only retrieval, with no generated answer or provider write.
The actual returned `llm_prompt` was expanded and scrolled to show the
human-reviewed diagnosis, correction, and future practice. This is returned
context, not a generated model answer. The capture worker visually reviewed
the contents screenshot for privacy and confirmed it is safe.

The earlier successful clip `06-retrieve-reviewed-lesson-final.webm`,
captured at `2026-10-13T03:37:15.832Z`, remains valid additional evidence:
request `12f909c3-8788-4b6b-8fdd-447502755c1d`, one matching chunk,
195.3 ms. It is superseded by the expanded-context clip for the final edit.

Two earlier locator-failure attempts remain honestly marked `failed` in the
manifest and are excluded from the intended final edit. The successful final
clip and its receipt above are the filming evidence.

## Safe placement confirmation target

Before the capture worker's separately authorized confirmation, the Work
organization sample contained 27 items; all 22 public-filtered items had
`decision=null`. Do not describe a pre-existing saved public placement.

- Database: `rrflow_specialist`.
- Unique title: **EonsofStupid/rrflow-hydradb / rrflow-app/apps/rrflow/src/lib/access.ts**.
- Source ID: `github:eonsofstupid/rrflow-hydradb:apps/rrflow/src/lib/access.ts`.
- Item key: `f579a1b18e9bcf5ff0fb63f7ffc2be920dd9f4701fc948c587f2e0fb18f24a92`.
- Source version: `92dcf3144df73e04776edd4af8429d4660b6352cb3c5c89cba64b8bc131a0d5b`.
- Source content SHA-256: `1600b46654cd87f731e7b91978b59d9343c37d5f3fde70d510e9510521fe9307`.
- Public source commit: `f6bcda83033a610bdf7dc4f5c0561ee5a0576a41`.
- Suggested/destination: Shippin; reason is its existing dedicated Shippin database.

UI: **Context inbox** → **Source workspace = Shippin · company knowledge**
(`rrflow_specialist`) → **Show source titles** → unique title above.
This sequence prevents Personal/Gmail titles from appearing. The capture
worker has root authorization for exactly one UI confirmation preserving
**Shippin work**, with no artificial wrong placement or invented note.
Saving associates a placement decision; it does not relocate source content
or establish a trained routing rule.

### Filmed confirmation and independent read-back

The capture worker completed that single authorized confirmation through the
actual UI. `05-human-confirmation.webm` in
`submission/demo-media/recordings/lifecycle/manifest.json` has
`status=captured` and `persistedAfterRefresh=true`. It records one write,
to the exact public source above, retaining `destination=shippin` and an
empty note. Its saved `updatedAt` is `2026-10-13T03:27:43.784Z`, with the
same source version listed above. Raindrop returned `status=accepted`.

The operation includes 16 native preflight/read requests followed by the
canonical decision write. The first request is
`a902f6f5-eae5-4e53-bfe8-70083211d199`; the final write request is
`367dc20b-ab28-4bea-9f4c-b623fadf9ae5`. All 17 IDs are retained in the
recording manifest. The filmed refresh and reopened modal confirmed the
same timestamp, Shippin destination, and **Your saved decision takes
precedence** message.

An independent read-only `GET /api/organization?database=rrflow_specialist`
at `2026-10-13T03:37:41.198Z` again returned the identical saved decision,
`decisionsAvailable=true`, `changedSinceReview=false`, and the reason
**Your saved decision takes precedence over the routing suggestion.**
Its native decision-read request is
`3b8f285f-74c8-44ca-8fd2-493c080f6a7f` (16 total read requests).
No additional confirmation or correction was written by this evidence task.

## Qdrant Cloud import completion update

Root verified at **03:40 UTC on October 13** that all six approved Qdrant
Cloud imports now report **completed** in their intended native HydraDB
destinations: three Personal records in `default-tenant/qdrant_sources`
and three Work records in `rrflow_specialist/qdrant_sources`.
The source collections remain `rrflow_personal_sources` and
`rrflow_shippin_sources`, respectively. This updates the earlier
`graph_creation` observations retained in `coordination/CODEX_QDRANT_CLOUD.md`;
the earlier timestamps remain valid historical evidence.

This is root's native completion observation, not a claim that Modelence's
hosted Qdrant connection environment is configured. Hosted provider
environment setup was still pending when this update was supplied. This
worker made no new native queries, imports, or other provider writes for
the completion update.

## Development dogfooding source evidence

The live learning trail's bounded dogfood sample includes actual workspace
documents with source hashes. Suitable public examples:

| Source path | Stored SHA-256 |
| --- | --- |
| `coordination/CODEX_GRAPH.md` | `d37af55ca2396c6891bba07e1d7ea0e094b9a6b4ee13ff825af9cc3a0a8be906` |
| `coordination/CODEX_QDRANT_CLOUD.md` | `bfa7b2f0b5b37a0f5b879fdf89513e74a4246acd840a73953c4ea21172b7bdfb` |
| `research/DEVPOST_ALIGNED.md` | `1f37c495704634294394737c842c98f1cea26ce1bcfcf424f4d99bce646155cb` |

Native IDs use `workspace:<path>`. `dogfood/sync.mjs` stores the actual fields
`additional_metadata.path` and `additional_metadata.sha256`; the learning UI
reads these under **RRFLOW uses its own context**. This is source synchronization
and inspection, not autonomous engineering work.

## Raindrop: acceptance versus read-back

Fresh evidence here confirms native HTTP acceptance for the latest CI capture
and source-sync event. This inspection did not newly read either event in
Raindrop's UI; do not upgrade delivery acceptance to independently verified
read-back or measured improvement.

Existing documented UI read-back is available for
[event 0d426672-9f38-482b-a765-cf6551c84482](https://app.raindrop.ai/events?org=ea2ca283&project=rrflow-hydradb&event=0d426672-9f38-482b-a765-cf6551c84482&tab=overview).
`research/IMPLEMENTATION_EVIDENCE.md` records five retrieved hits, the matching
HydraDB request `cc06272c-0c50-4c25-9d9e-c663fe699b16`, `kind=retrieval`,
`recall_mode=fast`, and an **answer_helpful** signal visible after feedback.
This is historical native UI read-back, distinct from this task's fresh
read-only API observations. A new view of the actual event can provide fresh
footage without another event or feedback write.
