# RRFLOW — aligned submission copy

**Elevator pitch:** Your life and work, clearly connected without getting mixed up. RRFLOW turns scattered context into visible memories, useful knowledge paths, and decisions you can inspect and correct.

**Built with:** HydraDB, Raindrop, Qdrant Cloud, Digo app-starter, TypeScript, Next.js, React, React Flow, Motion, Tailwind CSS, shadcn/ui, Radix UI, typed A2UI messages, Infisical, Playwright, GitHub Actions, Modelence, Higgsfield, Claude Code, OpenAI Codex.

## Inspiration

My life does not fit into one project folder. My Gmail, GitHub repositories, personal ambitions, lessons, and business decisions all hold pieces of what matters. Meanwhile, I am building shippin.ai, shippin.cloud, and shipping.buzz. I need these worlds to stay clearly separated while still benefiting from the things I learn.

I wanted a system that helps me understand my growing context: what belongs to my personal life, what belongs to Shippin, what I have learned, and why a particular memory matters now. I also wanted to inspect and correct its decisions. While building it, we realized the same loop should help develop RRFLOW itself: capture what happened, review the lesson, and retrieve that evidence for the next change.

## What it does

RRFLOW is a visual memory and context workspace built around two distinct areas: **Personal** and **Shippin**. The context inbox explains proposed placement, exposes original source evidence, and lets the owner confirm or change a source's placement. That decision is saved in HydraDB and survives refresh. Proposals currently use source and workspace rules; human review remains part of the process.

Personal uses HydraDB's existing default-tenant database and its connected Gmail/GitHub collections; Shippin keeps separate company and service databases. The dashboard supports creating databases, selecting folders or GitHub projects, inspecting memories, and following source-backed knowledge avenues. Its engineering specialist covers a SWEBOK-aligned core, Rust, Go, React, Next.js, and TypeScript.

The React Flow connectome shows stored relationships and opens source and research details. Qdrant Cloud supplies separate Personal and Work source collections, with original record identities and HydraDB import status visible. Raindrop records real interactions and feedback so their quality can be investigated.

The development loop is working too. GitHub pushes trigger source synchronization and capture actual CI outcomes into HydraDB. The Learning trail connects an observed failure to a reviewed diagnosis, its correction, the exact evidence schema, and a passing follow-up. Query Lab retrieves the saved lesson for future work. This demonstrates automatic capture and reusable reviewed context; code fixes and promotion of new behavior still require review.

The Modelence-hosted event offers a guided, time-limited public demo using fictional Personal examples and public engineering sources. The owner's connected workspace is password protected.

## How we built it

We adapted **Digo app-starter** using Next.js, React, TypeScript, Tailwind, and reusable shadcn/Radix components. React Flow and Motion provide interactive graphs and transitions, with light/dark themes and source drill-down. Modelence hosts the existing application.

HydraDB is the authoritative home for knowledge, relationships, source revisions, and saved decisions. Qdrant is a source integration with separate Personal/Work collections; the demonstrated records are payload records, without a vector-search performance claim. Typed A2UI messages turn stored research into interactive cards, tooltips, and dialogs. Raindrop captures retrieval and feedback delivery. Infisical supplies credentials securely, and Playwright tests user journeys.

Claude and Codex collaborated in one shared workspace with explicit file ownership and handoffs. GitHub Actions runs verification and records outcomes; source synchronization keeps the development context current. The demonstration combines a labeled Higgsfield concept introduction with real application recordings and inspectable evidence.

## Challenges we ran into

The hardest product problem was making growing context understandable without mixing personal and business information. Every relationship needs a meaning, and every decision needs a source and a persistent record. The public demonstration also needed a clear boundary around the owner's private context.

We had to distinguish a source being accepted from it becoming searchable, a reviewed practice from a promoted rule, and a proposed check from a completed check. A real Playwright failure taught us to target the intended error message when multiple alerts appear. We retained that failure, reviewed correction and passing follow-up as a retrievable lesson. Coordinating Windows/WSL development and multiple contributors reinforced the need for one repository and a verified combined build.

## Accomplishments that we're proud of

We connected six engineering disciplines, 65 knowledge avenues, and 304 draft research questions with source provenance in HydraDB. The Shippin services have separate knowledge scopes, and a real public-source placement confirmation was saved and verified again after refresh.

We verified native persistence, real Raindrop event and feedback delivery, accessible light/dark interactions, and the hosted access boundary with Playwright. We also retrieved a saved development lesson from HydraDB with its original diagnosis and correction. The product's own development now produces context that the next development attempt can inspect and reuse.

## What we learned

Useful memory needs boundaries, provenance, and human correction. As knowledge grows, the interface must help people understand it rather than simply show larger counts.

Engineering best practices become more useful when connected to a specific project, past decision, and observed result. The improvement lifecycle needs each link: capture, review, retained practice, retrieval, and another observed outcome. A passing test or an accepted feedback event alone does not prove the system improved.

## What's next for rrflow

Expand classification beyond the current source/workspace rules and evaluate it against reviewed Personal/Shippin decisions. Show how those decisions affect later routing, while preserving their provenance and allowing reversal.

Extend the working capture-and-retrieval loop into agent orchestration: choose relevant lessons before a change, propose an action, obtain the required review, and measure the follow-up. Use Raindrop evaluations to assess candidate prompt and routing improvements before promoting them. Expand Qdrant retrieval, strengthen multi-user access, and connect the Shippin infrastructure inventory.

The direction is a system whose understanding—and interface—becomes more useful as your life and work evolve, while you stay in control.
