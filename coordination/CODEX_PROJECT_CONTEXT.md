# Codex project-context work

I am the Codex project-context worker delegated by the root Codex agent, not Claude.
Read workspace/app instructions, TEAM.md, current diff and CODEX_REPLY.md.

I own new `src/lib/project-context*.ts`, `src/app/api/project-context/**`,
`components/brain-ui/project-picker.tsx` and its CSS, `tests/project-context.spec.ts`,
plus integration edits to `lib/brain-ui.ts`, `lib/brain-ui-contracts.ts`,
`components/brain-ui/brain-workspace.tsx` and its CSS only.

The picker will inspect bounded project metadata from an explicit local folder or
GitHub repository, save a source/version snapshot through native HydraDB Cypher,
reload saved pointers, and use server-loaded context when selecting specialists
and avenues. It will never execute project commands or copy secrets. Root Codex
owns production build/restart, full validation, commit and public push.

## Delivery — October 12, 15:50 PDT

Source is frozen for the root agent's production build. Implemented:

- `rrflow-app/apps/rrflow/src/lib/project-context-contracts.ts` and
  `project-context.ts`: bounded inspection of explicit folder or GitHub repository;
  native `Project` / `ProjectContext` Cypher records scoped through either
  `Workspace personal` or `Workspace shippin` in the existing seniordev/rrflow store.
- `src/app/api/project-context/route.ts`: guarded list/read/save/delete operations,
  real native receipts, validated source and workspace input.
- `src/components/brain-ui/project-picker.tsx` and `.module.css`: explicit Personal
  versus Shippin work choice, folder/GitHub input, saved-context reload, source
  refresh, file drill-down, detected stack, manifest/check counts, timestamps,
  revision, and check entry points explicitly labeled Not run.
- `src/lib/brain-ui.ts`, `brain-ui-contracts.ts`, and
  `src/components/brain-ui/brain-workspace.tsx`: requests carry saved project ID
  plus workspace; server rereads that HydraDB snapshot and adds detected
  specialists/topic matches. Source provenance remains on the generated interface.
- `tests/project-context.spec.ts`: two Playwright scenarios covering a real
  disposable folder and real public GitHub repository, persistence/reload,
  personal/work isolation, script non-execution, excluded secret paths and
  symlinks, bounded metadata, server-backed avenue selection, mobile overflow,
  invalid input and cross-site rejection. Cleanup deletes only test-created
  contexts and test-created directories.

Local reads list up to 400 allowed paths and extract selected fields from up to
12 recognized manifests. They never execute a project command. Manifest values,
source code, hidden files, credentials and symlink escapes are excluded. Local
revisions are metadata fingerprints (including manifest hashes), not claims of
full source coverage. GitHub records use one actual default-branch commit SHA.
Optional GITHUB_TOKEN/GH_TOKEN stays server-side; public repositories work with
the public API within GitHub rate limits.

Validation: TypeScript passed before final scoped-delete and error-display
refinements. Full-app lint is running in session 96621. Root agent owns final
build, runtime tests and full verification. No build, server restart, commit or
push was performed by this worker. Automatic project classification, automatic
source watching, engineering execution and model inference are not claimed by
this slice.
