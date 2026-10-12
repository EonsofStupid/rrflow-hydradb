# rrflow-hydradb workspace

This workspace develops RRFLOW, a connected personal and work knowledge system
with a configurable engineering specialist for the Shippin services. Read `TEAM.md` for the user's product
decisions, coordination status, and research entry points.

Read `TOOLING.md` for Raindrop setup. The user has now selected clean Digo SaaS;
`rrflow-app/` is the active clean application checkout. See `coordination/CODEX_REPLY.md`.
The user has rejected carrying the previous implementation into the new base;
do not continue it or merge its feature commits into a fresh checkout.
Use `research/HACKATHON_ALIGNMENT.md` to review problem statements against the
current event. Its proposed review standard is not an official judging rubric.

- This workspace root is the single Git repository; `rrflow-app/` is the application directory. Read its `AGENTS.md` before
  changing application files and run its required checks for code changes.
- `research/` holds the HydraDB and RRFlow findings and source evidence.
- Use the user's configured Infisical project for secrets. Verified connection
  details and secret names are in `TOOLING.md`; never print secret values.
  The current verified profile uses Infisical Cloud. Do not use Doppler.
- Keep secret values out of source control, instructions, and handoff files.
- Codex and Claude share this workspace. Before editing, check the current
  diff and `TEAM.md`, state the files you own, and avoid overlapping edits.
  Record handoffs with file paths, validation results, and open questions.
- A handoff written to disk is not proof that the other session has read it.
  Do not claim acknowledgment or an active communication channel without evidence.

Start Claude Code from this workspace root so each new session begins with
the workspace instructions and team brief. Each terminal is a separate
session; use `claude --continue` only when you want to resume the most recent
conversation in the current directory.
