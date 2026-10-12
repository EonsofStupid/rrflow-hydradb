# RRFLOW — Devpost submission draft

Draft by Claude, 2026-10-12 15:22 PDT. Screenshots: `submission/screenshots/01–06` (from the 3100 build). Every claim below is marked **Live** (working on
real data today), **Wired** (built and configured, waiting on its first trigger), or
**Next** (designed, not built). Update the markers before submitting; do not upgrade a
claim without evidence.

---

## Project name

RRFLOW

## Tagline (≤ 200 chars)

A senior-developer brain for a founder living a double life: it learns from every doc,
push and lesson, and shows the real call behind every answer.

## Inspiration

Jesse lives a double life. By day he is launching a cluster of services —
**shippin.cloud, shippin.ai and shipping.buzz** — and by night he is still growing his own
craft, ambitions and engineering judgement. The knowledge for both lives is scattered across
docs, inboxes and GitHub repositories, and the AI agents helping him forget everything the
moment a session ends.

We wanted one specialist that remembers like a senior developer, keeps each life's
knowledge in its own place, grows on its own as work happens, and never asks you to take
its word for anything.

## What it does

**A brain mesh, grouped by project (Live).** Five dedicated HydraDB databases:
- the **Shippin cluster**: one shared company brain plus a specialist brain each for
  shippin.cloud, shippin.ai and shipping.buzz;
- an **Engineering practice** brain for lessons and tool quirks that apply to every project.

Databases on the key that belong to no project are shown, not hidden.

**Knowledge that grows by itself (Live).** A dogfood sync sends the team's working
documents to the company brain within 30 seconds of any change. The cluster already knows
21 real documents, including ones the agents wrote while building RRFLOW. Each service
brain starts from an honest record of what is decided and what is still unknown.

**GitHub pushes trigger it (Wired).** Each push to `main` runs a GitHub Action that
re-indexes the repository's source and docs into HydraDB and reports the sync to
Raindrop. The secrets are stored in GitHub from Infisical; the first run happens on the
first push.

**It learned while we built it (Live).** The practices brain holds 16 real lessons from
the build, each with evidence — e.g. "Infisical CLI under Git Bash rewrites `--path=/`"
with the Infisical request ID that proved it.

**Ask a brain (Live).** Native HydraDB hybrid retrieval returns evidence with its source,
in fast or deep mode. It retrieves; it does not invent an answer.

**Transparent at all times (Live).**
- **Verify with HydraDB** makes fresh calls on demand: 11 live calls, 6 databases visible,
  5 of 5 brains ready.
- **What RRFLOW did** lists every call: service, endpoint, database, HTTP status, timing and
  the request ID you can look up.
- Toasts announce every action, success or failure.

**Quality monitoring with Raindrop (Live).** Each search and each helpful / not-helpful
verdict is sent to Raindrop. A drop falls in the UI only when Raindrop accepts it. Events
are read back in the Raindrop dashboard.

**Engineering disciplines (Live, by Codex).** SWEBOK-aligned core plus Rust, Go, React,
Next.js and TypeScript: 6 disciplines, 65 avenues and 304 review questions, stored as a
native HydraDB graph with source provenance. They drive evidence-based review plans.

**The double life, separated (Next).** A personal workspace for ambitions, growth and
lessons, kept apart from the Shippin cluster, with per-service goal dashboards.

**Email that grows the brains (Next).** Launch emails and replies flowing into the right
service brain, so the cluster's context grows with the inbox.

## How we built it

- **Two AI agents as one team.** Claude Code and Codex shared one workspace, split file
  ownership, coordinated through handoff files, and recorded their own quirks into the
  practices brain — RRFLOW dogfooded itself from the first hour.
- **App:** Next.js 16, React 19, TypeScript, Tailwind and sonner, on the clean Digo SaaS
  starter (MIT).
- **HydraDB as the single source of truth:**
  - databases, `context/ingest` (knowledge and memories), `/query`, `context/list`,
    `stats`, `status`;
  - hosted Cypher (BYOG) for the disciplines graph.
- **Raindrop:** HTTP events and signals API on the Pro trial, project `rrflow-hydradb`.
- **Infisical:** every key is injected into server memory at launch; nothing on disk.
- **Playwright:** browser journeys, accessibility (axe), both themes, mobile — 12 tests.
- **Environment:** WSL Ubuntu with tmux for agent teams; Windows for the agents' shells.

## Challenges we ran into

The product captured them itself. A few, all recorded with evidence in the practices brain:
- Git Bash silently rewrote `--path=/` into `C:/Program Files/Git/`, breaking secret reads.
- `wsl.exe -- bash -c` expanded variables twice and froze a PATH snapshot into `.bashrc`.
- HydraDB returned a JSON metadata chunk as a "hit"; we filter it so people only see prose.
- The HydraDB agent plugin's redaction misses HydraDB's own `sk_live_` key format.
- Keeping one source of truth while two agents edited the same app at the same time.

## Accomplishments that we're proud of

- Nothing simulated: every number on screen comes from a real HydraDB or Raindrop call,
  with its request ID one click away.
- Honest states everywhere: empty brains say they are empty, failures keep their request
  IDs, and unknown counts show as unknown, not zero.
- The system recorded the lessons of its own construction.

## What we learned

- A single authoritative store beats syncing two "sources of truth."
- Transparency is a feature: a receipt for every call builds more trust than a green badge.
- Agents need memory too — and they need to share it.

## What's next for RRFLOW

1. The personal workspace: the second half of the double life.
2. Email ingestion into the right service brain.
3. Live service inventory from the tailnet and the Proxmox instances (WI / TX / VA,
   homelab), so each Shippin specialist knows where its service runs.
4. The rest of the reasoning loop: understand the task → follow the links → check the
   evidence → act within permissions.
5. Raindrop Experiments on fast vs. deep retrieval, and a reviewed prompt-improvement loop.

## Built with

hydradb · raindrop · infisical · next.js · react · typescript · tailwindcss · sonner ·
zod · playwright · claude-code · codex · wsl · pnpm

## Links

- Code: https://github.com/EonsofStupid/rrflow-hydradb (public once Codex publishes `main`)
- Demo: local single-user slice at http://127.0.0.1:3100; see the video.

---

## Demo script (≈ 2½ minutes)

1. **(0:00) The double life.** "Jesse runs a business launch and a personal craft at the
   same time. RRFLOW is the senior dev that remembers both."
2. **(0:20) The mesh.** Open Specialist brains:
   - the Shippin cluster boundary;
   - the company brain's 21 documents under "What the cluster knows";
   - each service's honest record;
   - the separate practices brain, and `default-tenant` shown, not hidden.
3. **(0:50) Proof.** Press **Verify with HydraDB**. Toast: "5 of 5 brains found and ready ·
   11 live calls". The panel shows each call's endpoint and request ID.
4. **(1:15) Ask.** Click "Why does a command fail in Git Bash on Windows?". The practices
   brain returns the quirk it learned today, with its source. Click 👍; the Raindrop drop
   falls, and "Searches accepted" and "Verdicts accepted" tick up.
5. **(1:45) It grows on its own.** Edit a workspace doc. Within 30 s the company brain's
   document count rises. Push to GitHub; the Action re-indexes the repo (show the run).
6. **(2:15) What's next.** The personal workspace and email ingestion.

## Screenshots to attach

Take fresh ones from the rebuilt 3100 server: overview, Specialist brains (cluster group),
Verify toast + activity panel, Ask result + Raindrop drop, engineering disciplines.
