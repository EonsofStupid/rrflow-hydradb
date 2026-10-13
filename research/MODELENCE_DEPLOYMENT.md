# Modelence deployment fit

Verified October 12, 2026 against the current official documentation and CLI source.
The product is **Modelence** (modelence.com).

## Verified support

- [Deploy Setup](https://docs.modelence.com/deploy/setup.md) supports an existing Node.js/Next.js application through `modelence.config.json`; adopting the Modelence framework is not required.
- A single service can use a monorepo subdirectory, Node 22, pnpm install/build commands, and `next start`. The production process must bind to all interfaces and the supplied `PORT`.
- External databases remain external. HydraDB can remain authoritative. The environment also provisions MongoDB, but this application does not need to use it.
- [CLI implementation](https://github.com/modelence/modelence/blob/2b3543123eaaa8837a5360096135a71bfa6fdf62/packages/modelence/src/bin/deploy.ts) supports non-interactive CI with `MODELENCE_TOKEN` and a target supplied by `--app`/`--env`. First interactive deployment selects the organization, app and environment in the browser.
- The service cannot run our two Qdrant Docker Compose services alongside Next.js. Qdrant must remain on a separately reachable host or managed service.

## Proposed release path

GitHub remains the source of the application. A passing `main` commit can be deployed
to a preview environment, checked with Playwright against the hosted URL, and then
promoted to the stable Devpost environment. Record the deployed commit and keep the
previous working revision available. A new commit is a new version of the same demo,
not a new Devpost project. Do not enable deployment on an unchecked push.

Suggested service contract: repository root configuration, service `root: rrflow-app`,
Node 22 slim, build `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm build`;
start `pnpm --filter @rrflow/app exec next start --hostname 0.0.0.0 --port "$PORT"`.
Validate these exact commands with a supplied PORT before an actual deployment.

## Remaining work before publishing the live dashboard

The current app is deliberately a loopback single-user workspace. Its APIs reject
public hosts and it can access Personal Gmail/GitHub context. Publishing a usable
dashboard requires account or demo access controls and server-side scope checks,
not simply accepting a public hostname. Choose a protected owner demo or a curated
public demonstration dataset, then test that public callers cannot retrieve personal
records or invoke owner mutations.

Other runtime requirements: server-only HydraDB/Raindrop secrets in Modelence, reachable
Qdrant endpoints with credentials, and hosted research files or an intentional read-only
research-import boundary. Local folder attachment must remain local or become an
authenticated agent capability. Modelence app/environment and CI token have not yet
been configured for this repository. No Modelence deployment is claimed.

This document records a supported deployment direction; it does not change the
application's storage architecture or weaken its current local access boundary.
