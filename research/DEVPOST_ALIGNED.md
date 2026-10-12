# RRFLOW — aligned submission copy

**Elevator pitch:** Your life and work, clearly connected without getting mixed up. RRFLOW turns scattered context into visible memories, useful knowledge paths, and decisions you can inspect and correct.

**Built with:** HydraDB, Raindrop, Digo app-starter, TypeScript, Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, A2UI, Infisical, Playwright, GitHub Actions, Claude Code, OpenAI Codex.

## Inspiration

My life does not fit into one project folder. My Gmail, GitHub repositories, personal ambitions, lessons, and business decisions all hold pieces of what matters. Meanwhile, I am building shippin.ai, shippin.cloud, and shipping.buzz. I need these worlds to stay clearly separated while still benefiting from the things I learn.

Most tools organize files or answer a question. I wanted a system that helps me understand my growing context: what belongs to my personal life, what belongs to Shippin, what I have learned, and why a particular memory matters now. I also wanted to correct the system rather than quietly accept its guesses.

## What it does

RRFLOW is a visual memory and context workspace built around two distinct areas: **Personal** and **Shippin**. Its intended intake flow brings in email, repositories, and other sources, proposes where information belongs, and lets a person confirm or correct that placement. Those corrections should become durable context.

The working prototype establishes the foundation: native HydraDB brains, visible company sources and engineering memories, source-backed knowledge avenues, interactive guidance, and saved review plans. Personal uses the existing default-tenant database and its connected Gmail/GitHub collections; Shippin keeps its separate company and service databases. The dashboard provides database creation with a Personal/Shippin assignment. Existing folders and GitHub projects can supply saved, scoped context, and pushes to our public repository synchronize source changes into HydraDB with Raindrop delivery receipts. Its engineering knowledge covers a SWEBOK-aligned core, Rust, Go, React, Next.js, and TypeScript.

The connectome is the place to explore that understanding. A source, memory, or avenue should reveal its contents, freshness, provenance, and actual relationships in the same view. Raindrop records real interactions and feedback so quality can be investigated. Automatic personal/work sorting and the complete correction inbox are still being implemented; they are not presented as completed automation.

## How we built it

We adapted **Digo app-starter** using Next.js, React, TypeScript, Tailwind, and reusable shadcn/Radix components. This let us focus on the experience and native product integrations.

HydraDB is the authoritative home for knowledge, relationships, source revisions, and saved work. Typed A2UI messages turn research into interactive cards, tooltips, and dialogs. Raindrop captures retrieval and feedback delivery. Infisical keeps credentials server-side, and Playwright tests real user journeys.

Claude and Codex collaborated in one shared workspace with explicit file ownership and handoffs. GitHub publication, source synchronization, project selection, and dashboard connector controls are verified independently before their status is promoted to working.

## Challenges we ran into

The hardest product problem was making growing context understandable without mixing personal and business information. A graph must explain what a connection means, not merely look complicated. A useful correction must affect later decisions, not disappear into a feedback button.

We also had to distinguish a source being accepted from it becoming searchable, retrieval from reasoning, and a proposed check from a completed check. Coordinating Windows/WSL development and multiple contributors reinforced the need for one repository and a verified combined build.

## Accomplishments that we're proud of

We connected six engineering disciplines, 65 knowledge avenues, and 304 research questions with source provenance in HydraDB. The practices brain records real lessons learned during development, and the Shippin services have separate knowledge scopes.

We verified native persistence, real Raindrop event and feedback delivery, progressive knowledge interfaces, and accessible light/dark interactions with Playwright. The application shows evidence and failures instead of assuming that every request succeeded.

## What we learned

Useful memory needs boundaries, provenance, and human correction. As knowledge grows, the interface must help people understand it rather than simply show larger counts.

Engineering best practices are one valuable part of that memory. They become more useful when connected to a specific project, past decision, and observed result. Trust comes from being able to inspect and correct those connections.

## What's next for rrflow

Complete the personal and Shippin dashboards, Gmail/repository intake, and human review queue. Make proposed classifications, corrections, and their downstream effects visible inside the connectome.

Expand project-aware workflows into evidence-producing agent orchestration: choose the right context, explain the next action, request human input where needed, and preserve the outcome. Use Raindrop evaluations to assess improvements before promoting them into trusted behavior.

The direction is a system whose understanding—and interface—becomes more useful as your life and work evolve, while you stay in control.
