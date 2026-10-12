# RRFLOW

**One connected memory for your life and work—with clear boundaries and human control.**

RRFLOW starts with a real founder's context: personal ambitions, Gmail, repositories, lessons, and the work of launching **shippin.ai, shippin.cloud, and shipping.buzz**. The product direction is to keep personal and Shippin work separate, propose where new information belongs, and make corrections part of its lasting understanding.

The working prototype visualizes native HydraDB knowledge, research avenues, company sources, engineering memories, and source evidence. **Personal uses the existing `default-tenant` database**, including its connected Gmail/GitHub source collections. Shippin has separate company/service databases. The dashboard can create additional native databases and save their Personal/Shippin assignment in HydraDB. It creates typed A2UI guidance and records real retrieval and feedback delivery in Raindrop. Automatic personal/work classification and a complete human review inbox remain in development; the interface must not imply that they have already run.

## One repository

The active application is [`rrflow-app/apps/rrflow`](rrflow-app/apps/rrflow). All contributors work in this same repository. Root GitHub Actions run from `rrflow-app/`.

- [Application setup and capabilities](rrflow-app/README.md)
- [Aligned Devpost copy](research/DEVPOST_ALIGNED.md)
- [Team decisions](TEAM.md) and [implementation checklist](WORKPLAN.md)
- [Research and native integration evidence](research/README.md)

## Foundation and products

Built from **[Digo app-starter](https://github.com/digohq/app-starter)** at `7c528e1407aeea502423b393f793f5b17c6caf4e`, retaining its [MIT license](rrflow-app/LICENSE). The active app uses Next.js, React, TypeScript, Tailwind, and shadcn/Radix components. Original Digo apps remain inactive reference code.

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

The current application binds to `127.0.0.1:3100`. A public GitHub repository is not a publicly deployed SaaS. Public authentication and tenant access enforcement must precede an Internet-facing deployment. Private source research and credentials are excluded from Git.

## Verification

`pnpm verify` runs TypeScript, ESLint, and Playwright from the app folder. Local integration tests exercise authorized HydraDB and Raindrop resources; CI uses provider fixtures for the repository-sync tests and does not receive production credentials. Source synchronization runs separately on `main` pushes and records accepted versus searchable state in HydraDB.
