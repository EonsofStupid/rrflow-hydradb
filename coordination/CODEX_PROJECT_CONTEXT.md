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
