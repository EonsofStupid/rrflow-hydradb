# Context organization and learning evidence

RRFLOW separates source boundaries from suggestions about where a reference belongs.
HydraDB remains the authoritative store for organization decisions, verification
evidence, and reviewed lessons. Qdrant is a source system; see [QDRANT_SOURCES.md](QDRANT_SOURCES.md).

## Personal and Shippin

The Context inbox discovers native collections, including connected Gmail and GitHub,
and reads a bounded sample of source metadata. It shows Personal, Shippin, and Needs
review lanes. Explicit workspace labels and project names supply deterministic
suggestions. Conflicting or missing evidence stays reviewable. Source titles start
hidden; they can be revealed deliberately.

Confirming or correcting a placement stores a ContextDecision in the source database,
in `rrflow_organization`. The decision records source identity and a revision hash.
It does not move the original content or create an automatic rule for unrelated
sources. Changed metadata requires another review. Optimistic concurrency rejects
stale saves. Raindrop receives suggested/chosen categories without the source body,
title, ID, or reviewer note.

Each refresh reads up to 20 knowledge records and 20 memories from the default
collection and up to six named collections, then shows the latest 40 returned items.
Counts describe this sample, not the whole account. The Connectome collection picker
provides explicit access to Gmail, GitHub, Qdrant imports, and other named collections.

## How a failure becomes useful context

The Learning trail reads native `LearningEvidence` and `ReviewedLesson` nodes from
`rrflow_specialist/rrflow_learning`. Each observation links to its original GitHub
run or Playwright assertion and a versioned capture schema with a SHA-256 hash.

1. GitHub Actions records actual step outcomes and Playwright results.
2. A failed check remains an observation; the capture process does not guess a cause.
3. A reviewer supplies a diagnosis, correction, and practice for future work.
4. The reviewer may link a later passing run of the same rule/check, source path,
   and repository on a different commit. A passing follow-up does not prove causation.
5. HydraDB retains the reviewed lesson and receives a separately reported retrieval
   ingestion request in `rrflow_lessons`. Raindrop receives metadata about the review.

Without qualifying follow-up evidence, the lesson stays a candidate. Neither path
changes prompts or promotes an engineering rule automatically. Evidence capture,
retrieval indexing, review, and prompt evaluation are separate statuses.

The GitHub workflow captures on trusted `main` pushes only. Pull requests do not get
ingestion credentials. Capture runs even after a failed check where the runner can
still execute it; capture errors do not replace the original check result. The CLI
can also import `gh run view` JSON as explicitly retrospective `imported-ci` evidence.
The schema must be committed before publishing, so its immutable source URL is valid.

The dogfooding panel shows workspace documents in a bounded native source read,
including source hashes and file modification times. These timestamps are not claims
about when indexing finished. The existing workspace watcher supplies these documents.

## Local verification

Run from Ubuntu WSL with `scripts/wsl-run.sh`. `pnpm verify` covers TypeScript, lint,
and Playwright; `pnpm build` creates production assets. A validation server may use a
separate build directory and port through `scripts/start-local.ps1`.

`tests/organization.spec.ts`, `tests/learning-trail.spec.ts`, and the Qdrant source UI
test use labeled fixtures for browser behavior and accessibility. Native imports and
round-trip checks are recorded separately; fixture screenshots are not live data.
