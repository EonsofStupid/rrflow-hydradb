# Modelence deployment

Published October 12, 2026 Pacific / October 13 UTC. This configuration deploys the existing Next.js application; it does not adopt Modelence's application framework or move RRFLOW state out of HydraDB.

Live application: https://rrflow-mv63m3vynl0-prod.cloud.modelence.app. Target app `rrflow-mv63m3vynl0`, environment `prod`. The deployed application source is commit `f6bcda83033a610bdf7dc4f5c0561ee5a0576a41`; the next commit changed only media documentation. The CLI completed the build and rollout successfully. The public event cutoff is **`2026-10-14T03:24:33.967Z`**, October 13 at 8:24 p.m. Pacific. It was verified active at 03:31 UTC; retain this exact cutoff during later deployments.

The hosted Playwright smoke passed all eight checks: anonymous private API protection, unexpected-host rejection at TLS, native curated HydraDB read, real browser login, secure HttpOnly session cookie, authenticated workspace read, cross-origin login rejection, and logout. Public HydraDB read receipt: `bf25bcb1-a6c2-42b7-a33c-d3650df19181`, six curated sources. Application-level unexpected-host rejection was separately verified on the local deployment-mode server; the hosted TLS layer rejects that test before application routing.

Qdrant Cloud works locally. At the hosted check, the four optional Qdrant URL/key variables had not been configured, and the hosted UI correctly reported both sources disconnected. Set the two URL variables from Infisical `qdrant-endpoint` and the two API-key variables from `qdrant`, then apply the environment. Existing HydraDB imports remain available. No key values belong in this document.

The GitHub workflow contains deployment after verification, but that job remains disabled until a suitable Modelence CI credential is configured. The interactive CLI cache expires after one hour and is not a durable automation credential. GitHub CI evidence capture and source synchronization are already active; automatic hosted deployment is a separate pending configuration.

The public entrance is `/`, the curated demonstration is `/demo`, and the password-protected real workspace is `/workspace`. Easy public access to the curated event lasts 24 hours from publication; afterward access requires the workspace password. Public demonstration data lives separately in HydraDB's `rrflow_public_demo/rrflow_demo`; the deployment configuration does not copy Personal records into it. Authentication and demo behavior are verified with the application release checks, not by this configuration file alone.

## Runtime contract

Repository-root [`modelence.config.json`](../../../modelence.config.json) declares exactly one `node-22-slim` service rooted at `rrflow-app`. It runs the frozen pnpm install and existing production build. Startup bypasses the workstation-only `pnpm start` script and runs:

```sh
pnpm --filter @rrflow/app exec next start --hostname 0.0.0.0 --port "$PORT"
```

Modelence injects `PORT` and `SITE_URL`; the latter supplies the public origin unless `RRFLOW_PUBLIC_ORIGIN` is set. `RRFLOW_ACCESS_MODE=public` is a committed runtime default so access remains closed if origin or authentication configuration is missing. Keep the standard `.next` production output; do not configure the workstation's `RRFLOW_DIST_DIR` on this host.

No managed PostgreSQL or Redis resource is requested. Modelence documents automatic MongoDB environment variables; RRFLOW does not consume them. HydraDB remains the authoritative store. No migration or background worker is added to startup. These choices follow the [official deployment contract](https://docs.modelence.com/deploy/setup.md) and [live version-1 schema](https://cloud.modelence.com/schema/modelence.config.json?version=1).

## Environment values

Set actual values through Modelence's environment configuration, sourced from the user's Infisical project. Every entry is runtime-only; no credential reaches the frontend build or a `NEXT_PUBLIC_*` variable. Required secret declarations have no committed default.

| Variable | Required | Purpose |
| --- | --- | --- |
| `RRFLOW_DEMO_EXPIRES_AT` | Yes | UTC ISO timestamp set to actual publication time plus 24 hours; no committed date. |
| `RRFLOW_WORKSPACE_PASSWORD` | Yes | Private workspace access; at least 16 characters. |
| `RRFLOW_SESSION_SECRET` | Yes | Signed sessions; independent random value, at least 32 characters. |
| `HYDRA_DB_API_KEY` | Yes | Existing native HydraDB key, stored as `hydradb_apy_key` in Infisical. |
| `RAINDROP_WRITE_KEY` | Yes | Existing Raindrop write credential. |
| `RRFLOW_PUBLIC_ORIGIN` | No | Exact public HTTPS origin; defaults to injected `SITE_URL`. |
| `HYDRA_DB_DATABASE` / `HYDRA_DB_COLLECTION` | Defaults provided | Engineering graph defaults `seniordev` / `rrflow`; Personal and Shippin scope rules remain in application code. |
| `RAINDROP_PROJECT_ID` | Default provided | `rrflow-hydradb`. |
| `GITHUB_TOKEN` | No | Authenticated repository reads when needed. |
| `QDRANT_PERSONAL_URL` / `QDRANT_WORK_URL` | No | Server-configured HTTPS Qdrant origins; one cluster may serve distinct collections. |
| `QDRANT_PERSONAL_API_KEY` / `QDRANT_WORK_API_KEY` | With its external URL | Server-side credentials for each source; collection-scoped keys may be used. |
| `QDRANT_PERSONAL_COLLECTION` / `QDRANT_WORK_COLLECTION` | Defaults provided | Modelence defaults point to the verified cloud collections `rrflow_personal_sources` and `rrflow_shippin_sources`; unconfigured local application defaults remain `rrflow_sources`. |

`NODE_ENV=production` and `RRFLOW_ACCESS_MODE=public` are non-secret runtime defaults. `PORT`, `SITE_URL`, and `MODELENCE_*` deployment variables are not declared in the app configuration. Do not use the legacy Digo root `.env.example` to provision additional application databases.

The password gate is a single-owner workspace boundary, not a multi-user SaaS account/role system. Use the curated demo for public access; possession of the workspace password allows access to the real connected data and authorized dashboard actions.

## The 24-hour published event

At actual publication, set `RRFLOW_DEMO_EXPIRES_AT` in the hosted environment to the publication time plus exactly 24 hours, using UTC ISO format such as the value produced by `new Date(publicationTimeMs + 24 * 60 * 60 * 1000).toISOString()`. Do not set the clock while preparing source files or use a relative "24 hours after startup" timer. Record the actual publication time and cutoff in the release evidence once known.

The server checks this fixed timestamp for anonymous demo access. It needs no scheduler, cron job, browser timer, or second process. Once the timestamp is reached, anonymous demo access closes and the password route continues to work. Missing or malformed expiration must fail closed; verify this in the application authentication tests before release. Keep the same cutoff across restarts, rebuilds, and redeployments so these actions cannot reopen the event. Only an explicitly authorized new publication should create a new cutoff.

## Qdrant and workstation features

The two existing Qdrant containers remain on the workstation, with separate loopback ports and persisted volumes. Modelence supports one web process and cannot run this Docker Compose stack alongside Next.js. No tunnel, public port, or external Qdrant resource is created by deployment.

In public/hosted mode, each source without an explicit server URL reports **not connected on this host** without attempting loopback access. Knowledge already imported to HydraDB remains available through the Connectome and Context inbox. External sources require server-configured HTTPS origins and API keys. One Qdrant cluster can hold distinct Personal and Shippin collections; this is logical collection separation, not two physically isolated services. Identical origin plus collection pairs are rejected. Browser requests cannot choose URLs, collections or fixed HydraDB destinations. URL credentials, paths, query parameters, redirects and invalid collection names are rejected. External origins and keys are not returned to the browser.

Source identity retains scope, collection and native point ID. Existing local `rrflow_sources` imports keep their original IDs. Newly named cloud collections produce distinct source IDs and provenance; changing the collection does not silently claim an older import belongs to the new source. IDs exceeding HydraDB's 100-byte limit use a SHA-256 identity while retaining the full collection and point ID in source metadata. Cloud import is a separately inspectable observation and does not delete or migrate existing knowledge.

With no public-mode/origin configuration, local defaults remain `127.0.0.1:6333` and `127.0.0.1:6335`. Local folders and ignored research input files also do not become remotely available by hosting the dashboard. Existing indexed knowledge and public GitHub sources are independent of those files.

## Validation before deployment

Use Ubuntu WSL / Node 22. From `rrflow-app`, this read-only helper checks the committed service contract and secret declarations:

```sh
node scripts/modelence-validate.mjs
```

`--runtime` also checks required runtime values, password/session length, a valid future UTC ISO publication cutoff, HTTPS origin, and injected port without printing values or calling providers. Its future-cutoff check is an **initial-publication** preflight, not a reason to extend an expired event during later maintenance. `--artifact` checks for the standard production `BUILD_ID`. Neither option builds, starts, authenticates, or deploys anything; presence of a build artifact does not prove HTTP readiness.

After the application's authentication and demo changes are stable, run the exact config build commands from `rrflow-app`:

```sh
corepack enable && pnpm install --frozen-lockfile
pnpm build
```

Then run the exact start command above with `PORT=3000` and the hosted environment supplied securely to the process. Confirm the public entry and unexpired demo respond, anonymous demo access stops after the cutoff, password access continues, the real workspace/API reads require a session, invalid passwords fail, login/logout works, cross-origin mutations fail, and real service secrets do not appear in responses. Run the release's Playwright verification against that process. Do not run the local launcher on the same validation port or replace the current port-3100 process during this check. The [official guide](https://docs.modelence.com/deploy/setup.md) requires the build and HTTP check before deployment.

## CLI and deployment handoff

`modelence@0.26.3` was the published latest version when checked on October 12, 2026. Its `deploy --help` was executed via npm's temporary execution cache; it was not added to application dependencies. The [official CLI source](https://github.com/modelence/modelence) and installed package establish these behaviors:

- Interactive `npx modelence@0.26.3 deploy --app <app-alias> --env <environment-alias>` opens browser authentication and target/secret confirmation. Run it from the repository root. Allow at least 15 minutes and follow output through an actual deployment result.
- Noninteractive deployment uses environment `CI=1` and `MODELENCE_TOKEN`, plus `--app` and `--env` (or a previously saved target). There is **no `--ci` flag**. Missing required environment values fail CI deployment; do not use `--skip-env-check` for this workspace.
- `MODELENCE_TOKEN` authenticates the deployment CLI, not the web application. Supply it through a secret-backed CI environment; never commit it or declare it in `modelence.config.json`.
- Auth cache lives in `~/.modelence/auth.json` or `$MODELENCE_HOME/auth.json`. The project selection and temporary archives live under `.modelence/`. The optional framework setup command writes `.modelence.env` and may create `.modelence.backup.env`; that framework setup is not required for this Next.js service. All these local paths are ignored.
- The CLI packages tracked files plus nonignored untracked files. Review the diff and upload inputs before release. Generated output, private research inputs, local credentials, and CLI cache must remain ignored.

Root completed account confirmation, artifact upload, cloud build and rollout after combined verification. Runtime settings remain in the selected Modelence environment. The preparation handoff in `coordination/CODEX_MODELENCE.md` retains its historical scope; the published result and current limitations are recorded above.
