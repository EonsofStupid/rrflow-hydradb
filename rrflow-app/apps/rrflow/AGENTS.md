# Active RRFLOW application
User decisions override upstream Nest/Prisma/Jest conventions here.
This is the only active pnpm app. Digo's original apps/web and apps/api are preserved as upstream reference, not running services.
Use Next.js App Router + TypeScript and copied Digo shadcn components.
HydraDB is the only authoritative application store. Keep native Cypher visible in domain operations.
Playwright is the test runner. Run root pnpm verify and pnpm build from Ubuntu WSL.
Credentials stay server-side. This slice is a loopback-only single-user workspace, not a publicly authenticated deployment.
Claim file ownership in ../.. coordination before overlapping agent work.

