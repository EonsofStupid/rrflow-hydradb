# Modelence deployment preparation

## Root release update — October 13, 2026 UTC

The historical preparation below is complete. Root deployed verified application commit `f6bcda83033a610bdf7dc4f5c0561ee5a0576a41` successfully to https://rrflow-mv63m3vynl0-prod.cloud.modelence.app (`rrflow-mv63m3vynl0` / `prod`). The user configured the fixed cutoff `2026-10-14T03:24:33.967Z`; live session status confirmed the event open at 03:31 UTC. No restart or redeployment was needed after settings took effect.

Eight hosted Playwright smoke checks passed, including actual login/logout, cookie properties, private APIs, cross-site rejection, and six curated sources read from HydraDB, request `bf25bcb1-a6c2-42b7-a33c-d3650df19181`. The hostile-host probe is rejected at TLS on HTTPS; the smoke script now reports that distinction instead of requiring an application HTTP response through a failed TLS handshake. Its original HTTP-mode check remains intact.

Hosted Qdrant optional runtime values were absent; user was asked to apply the two URL fields from Infisical `qdrant-endpoint` and the two key fields from `qdrant`. The deployment CLI credential does not authorize dashboard environment methods; one read-only request returned Unauthorized and no mutation was attempted. Do not claim hosted Qdrant connected until a new native read verifies it.

GitHub automatic deployment remains disabled pending a durable supported CI credential. The cached interactive credential has a one-hour lifetime and was not copied into GitHub secrets. CI evidence capture and HydraDB source sync are independently active.

## Original preparation handoff

Codex worker `/root/connections_console` owns only the new root `modelence.config.json`, `rrflow-app/scripts/modelence-validate.mjs`, `rrflow-app/docs/rrflow/MODELENCE_DEPLOYMENT.md`, and narrow Modelence entries in `.gitignore` for this task. Root owns application authentication, public demo, integration, validation builds, and release.

Official deployment guide and live JSON schema reviewed October 12, 2026. Published CLI `modelence@0.26.3` was fetched into the existing npm execution cache and its `deploy --help` inspected; no application dependency was added. No authentication, environment creation, upload, deployment, or paid resource was initiated.

The existing Next.js application is supported without adopting the Modelence framework. Deploy from the repository root; the service root is `rrflow-app`. The local application's start script deliberately binds loopback port 3100, so cloud startup uses direct Next exec with `0.0.0.0` and injected `PORT` instead.

CLI source confirms `CI=1` selects noninteractive behavior and uses `MODELENCE_TOKEN` with `--app` / `--env` (there is no `--ci` option). Interactive deployment still confirms target/secrets in the browser. Cache paths are `~/.modelence/auth.json` or `$MODELENCE_HOME/auth.json`, `.modelence/project.json`, and `.modelence/tmp/`; legacy setup writes `.modelence.env` and `.modelence.backup.env`.

Qdrant Cloud is now configured with two distinct collections on the user's existing cluster. Three approved Personal and three public Work records were populated, imported through the actual UI, and read back from their separate HydraDB destinations. All six remain in graph creation at the last observation. See `CODEX_QDRANT_CLOUD.md`. The original two loopback services remain available for local testing; Modelence runs one Node web process and connects to the existing cloud providers.

Root extended ownership to `qdrant.ts`, `qdrant-contracts.ts`, `components/qdrant/qdrant-sources.tsx`, and Qdrant-only tests for hosted availability. Public mode or a public origin disables absent external source endpoints without making network calls. Explicit server HTTPS origins need API keys; secrets and external endpoint values are not returned to the browser. Local defaults and fixed Personal/Work HydraDB destinations remain intact. A shared external origin requires distinct collection names; sharing the same origin and collection is rejected.

Root reports the auth contract: password minimum 16, session secret minimum 32, `RRFLOW_ACCESS_MODE=public` fail-closed default, `RRFLOW_PUBLIC_ORIGIN` fallback `SITE_URL`. These are declared runtime-only. Root's public demo database is separate (`rrflow_public_demo/rrflow_demo`).

Validation completed by this worker:

- `node rrflow-app/scripts/modelence-validate.mjs`: passed the read-only deployment invariant check. No credentials were fetched or printed.
- Focused ESLint for Qdrant server/contracts/component/tests: passed.
- Playwright `tests/qdrant.spec.ts --grep=server-owned --output=/tmp/rrflow-modelence-qdrant-config`: 1 passed in 7.1 seconds. Covers unchanged local endpoints, hosted disabled mode, valid external configuration, required API key, prohibited URL credentials/path/query/loopback, and hidden external hostname.
- `git diff --check`: passed; Git only reported existing LF/CRLF conversion notices.
- `git check-ignore` confirmed `.modelence/auth.json`, `.modelence/project.json`, `.modelence.env`, and `.modelence.backup.env` are ignored.
- Root's type check identified the resolver's inferred union did not expose optional `error`; an explicit return type fixed that integration error. Root owns the repeat combined check.

Source frozen. Root owns exact build/start/HTTP verification, combined authenticated/demo tests, and deployment. No worker build, service restart, git operation, native provider mutation, account setup, or deployment occurred. The user subsequently authorized root to deploy using Modelence's official skill; this handoff records only preparation evidence, not a deployed result.

Files ready for root: `modelence.config.json`, `.gitignore`, `rrflow-app/scripts/modelence-validate.mjs`, `rrflow-app/docs/rrflow/MODELENCE_DEPLOYMENT.md`, `rrflow-app/apps/rrflow/src/lib/qdrant.ts`, `rrflow-app/apps/rrflow/src/lib/qdrant-contracts.ts`, `rrflow-app/apps/rrflow/src/components/qdrant/qdrant-sources.tsx`, `rrflow-app/apps/rrflow/tests/qdrant.spec.ts`, and this handoff.

Follow-up: the user requested a 24-hour curated publication, then password-only access. `RRFLOW_DEMO_EXPIRES_AT` is now required runtime text without a committed value. Root sets an absolute UTC ISO cutoff at actual publication plus 24 hours and preserves it on restarts/redeployments. Initial `--runtime` preflight rejects missing, invalid, noncanonical calendar, and past timestamps. No cutoff was guessed or set by this worker. The auth agent owns server enforcement and expiration tests; no scheduler or new process is introduced.

Cutoff preflight checked with synthetic child-process-only values: valid future ISO passed; past ISO, invalid calendar date, and malformed text each failed with the expected safe message. No real provider credential or publication value was used. `git diff --check` passed again. This follow-up is frozen for root integration.
