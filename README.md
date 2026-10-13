# RRFLOW

**One connected memory for your life and work—with clear boundaries and human control.**

RRFLOW starts with a real founder's context: personal ambitions, Gmail, repositories, lessons, and the work of launching **shippin.ai, shippin.cloud, and shipping.buzz**. The product direction is to keep personal and Shippin work separate, propose where new information belongs, and make corrections part of its lasting understanding.

The working prototype visualizes native HydraDB knowledge, research avenues, company sources, engineering memories, and source evidence. **Personal uses the existing `default-tenant` database**, including its connected Gmail/GitHub source collections. Shippin has separate company/service databases. The dashboard can create additional native databases and save their Personal/Shippin assignment in HydraDB. The Context inbox explains proposed placements and saves human corrections. Connectome uses React Flow for inspectable relationships and exposes original HydraDB and Qdrant records with provenance. Typed A2UI guidance and real retrieval/feedback delivery in Raindrop keep evidence visible. Classification is conservative routing with human review; autonomous prompt promotion and model training are not implemented.

## One repository

The active application is [`rrflow-app/apps/rrflow`](rrflow-app/apps/rrflow). All contributors work in this same repository. Root GitHub Actions run from `rrflow-app/`.

- [Application setup and capabilities](rrflow-app/README.md)
- [Aligned Devpost copy](research/DEVPOST_ALIGNED.md)
- [Team decisions](TEAM.md) and [implementation checklist](WORKPLAN.md)
- [Research and native integration evidence](research/README.md)
- [Three-minute captioned demo](submission/demo-media/rrflow-event-demo.mp4) and [presenter script](submission/demo-media/VOICEOVER.txt)
- [Modelence deployment and 24-hour event setup](rrflow-app/docs/rrflow/MODELENCE_DEPLOYMENT.md)

## Foundation and products

Built from **[Digo app-starter](https://github.com/digohq/app-starter)** at `7c528e1407aeea502423b393f793f5b17c6caf4e`, retaining its [MIT license](rrflow-app/LICENSE). The active app uses Next.js, React, TypeScript, React Flow, Motion, Tailwind, and shadcn/Radix components. Original Digo apps remain inactive reference code.

**HydraDB** owns authoritative knowledge and application records through native graph/context APIs. **Raindrop** observes interactions and feedback. **Infisical** supplies server credentials. **Playwright** verifies the application; the active app does not use Jest or a second application database.

## Run

See the app README for the existing Infisical-backed Windows/WSL launcher. From a Node 22 environment:

```sh
cd rrflow-app
corepack enable
pnpm install --frozen-lockfile
pnpm build
# Set server-only HydraDB/Raindrop credentials in the process environment.
pnpm start
```

The local application binds to `127.0.0.1:3100`. Hosted mode provides a single-owner password gate and a separate curated public event with a fixed server-enforced cutoff. It is not multi-user SaaS identity. Modelence configuration is committed; a hosted URL is published only after an actual deployment succeeds. Private source research and credentials are excluded from Git.

## Verification

`pnpm verify` runs TypeScript, ESLint, and Playwright from the app folder. Local integration tests exercise authorized HydraDB and Raindrop resources; CI uses provider fixtures for the repository-sync tests and does not receive production credentials. Source synchronization runs separately on `main` pushes and records accepted versus searchable state in HydraDB.
