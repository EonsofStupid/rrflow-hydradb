# Active RRFLOW application
User decisions override upstream Nest/Prisma/Jest conventions here.
This is the only active pnpm app. Digo's original apps/web and apps/api are preserved as upstream reference, not running services.
Use Next.js App Router + TypeScript and copied Digo shadcn components.
HydraDB is the only authoritative application store. Keep native Cypher visible in domain operations.
Playwright is the test runner. Run root pnpm verify and pnpm build from Ubuntu WSL.
Credentials stay server-side. Local loopback use and a hosted single-owner password gate are supported. The curated public event has a fixed server-enforced expiration; this is not a multi-user SaaS identity system.
Claim file ownership in ../.. coordination before overlapping agent work.

