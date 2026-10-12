> Earlier collaboration draft. Use [the aligned Devpost copy](../research/DEVPOST_ALIGNED.md) for the current submission. Counts below are historical observations; automatic sorting and prompt improvement remain future work.

## Inspiration

Jesse lives a double life. By day he's launching a cluster of services — **shippin.cloud, shippin.ai and shipping.buzz**. By night he's still growing his own craft and ambitions. The knowledge for both lives is scattered across an inbox that never stops filling, a growing set of GitHub repos and dozens of working docs. Meanwhile the AI agents helping him forget everything the moment a session ends.

We wanted one specialist that remembers like a senior developer. It should keep work and personal knowledge apart, grow on its own as email and code arrive, and never ask you to take its word for anything.

## What it does

RRFLOW is a connected personal-and-work knowledge system with a senior-developer specialist for the Shippin services, built on **HydraDB** as the single source of truth.

- **The Shippin cluster, as a brain mesh.**
  - A shared company brain plus one specialist brain each for shippin.cloud, shippin.ai and shipping.buzz, each its own HydraDB database.
  - A separate practices brain for lessons that apply to every project.
- **Email that grows the brains.** Gmail is connected through HydraDB's native connector. More than 1,800 emails are already indexed, and the count keeps rising as mail arrives.
- **GitHub that triggers it.**
  - Every push to the repo fires a GitHub Action that re-indexes the codebase into the company brain: 70 sources on the latest push. Each sync is reported to Raindrop.
  - HydraDB's native GitHub connector has also indexed 147 sources. Its instruction is to keep work (Shippin) separate from personal.
- **It learned while we built it.** Our own working documents sync into the company brain within 30 seconds of any change. The practices brain holds the real tool quirks we hit, each with evidence.
- **Ask a brain.** HydraDB hybrid retrieval returns evidence with its source, in fast or deep mode. It retrieves; it doesn't invent answers.
- **Transparent at every step.**
  - **Verify with HydraDB** makes fresh calls on demand.
  - **What RRFLOW did** lists every call, with endpoint, result, timing and the request ID you can look up.
  - Toasts announce every action, success or failure.
- **Quality you can watch.** Searches and 👍/👎 verdicts go to **Raindrop**. Events are read back in Raindrop's dashboard, ready for Issues and Experiments.
- **Engineering disciplines.** A SWEBOK-aligned core plus Rust, Go, React, Next.js and TypeScript, stored as a HydraDB graph: 6 disciplines, 65 avenues and 304 review questions, with provenance. They drive evidence-based review plans.

## How we built it

- **A team of AI agents.** Claude Code and Codex, with Claude Cowork joining for the explorer, worked in one workspace with explicit file ownership, coordinating through handoff files. They recorded their own quirks into RRFLOW's practices brain, so the product dogfooded itself from the first hour.
- **App:** Next.js 16, React 19, TypeScript, Tailwind and sonner, on the clean Digo SaaS starter (MIT).
- **HydraDB:**
  - database provisioning;
  - knowledge and memory ingestion, hybrid `/query`, listing, stats and status;
  - native Gmail and GitHub connectors;
  - hosted Cypher for the disciplines graph.
- **Raindrop:** HTTP events and signals on the Pro trial.
- **Infisical:** every key is injected into server memory at launch. No secrets on disk or in the repo; each staged file was scanned before each push.
- **GitHub Actions** for CI and push-triggered sync. **Playwright** for browser journeys, accessibility checks, both themes and mobile.

## Challenges we ran into

- **Windows plus WSL plus Git Bash.** Path rewriting broke secret reads (`--path=/` became `C:/Program Files/Git/`), and `wsl.exe` expanded variables twice and froze a PATH into `.bashrc`. Both are now lessons in the practices brain.
- **HydraDB sometimes returned a JSON metadata chunk as a "hit."** We filter it, so people only see real evidence.
- **The HydraDB agent plugin's redaction misses HydraDB's own `sk_live_` key format,** so we never paste keys into captured sessions.
- **Two agents editing one app at once.**
  - We learned to claim files, hand off releases and verify each other's work.
  - When our first push silently dropped the app's source code because of an over-broad ignore rule, the sync's own report ("5 sources") gave it away.

## Accomplishments that we're proud of

- **Inspect the integration evidence.** Database readiness, source and memory lists, retrieval, and Raindrop delivery expose live results. Research counts come from the stored graph; workflow routing is deterministic, and unexecuted checks remain pending.
- **Honest states everywhere.** Empty brains say they're empty, unknown counts show as unknown, and failures keep their evidence.
- **The knowledge grows without anyone pressing a button:** email arriving, code pushed, docs edited.
- **The system recorded the lessons of its own construction.**

## What we learned

- One authoritative store beats syncing two "sources of truth."
- Transparency is a feature. A receipt for every call builds more trust than a green badge.
- Agents need memory too, and they need to share it.

## What's next for rrflow

1. **Validated personal / work sorting** across email and repos. The instruction is in place; next is proving it routes correctly, with a human approving the uncertain cases.
2. **Routing email and commits to the right Shippin specialist brain,** so each service's context grows on its own.
3. **Live service inventory** from the tailnet and the Proxmox instances (WI / TX / VA, homelab), so each specialist knows where its service runs.
4. **The full reasoning loop:** understand the task → follow the links → check the evidence → act within permissions.
5. **Raindrop Experiments** on retrieval depth, and a reviewed prompt-improvement loop.
