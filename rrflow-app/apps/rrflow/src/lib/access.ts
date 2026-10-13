import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = '__Host-rrflow_session';
export const SESSION_SECONDS = 8 * 60 * 60;
type Environment = Record<string, string | undefined>;
export type DemoWindow = { open: boolean; expiresAt: string | null };
export type SessionStatus = { authenticated: boolean; local: boolean; configured: boolean; expiresAt: string | null; demo: DemoWindow };
type Configuration = { enabled: boolean; ready: boolean; origin: URL | null; password: string; secret: string };
type Claims = { v: 1; aud: string; iat: number; exp: number; nonce: string };

export class WorkspaceAccessError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const loopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
const configuration = (env: Environment): Configuration => {
  const value = env.RRFLOW_PUBLIC_ORIGIN || env.SITE_URL;
  const password = env.RRFLOW_WORKSPACE_PASSWORD || '';
  const secret = env.RRFLOW_SESSION_SECRET || '';
  const enabled = !!value || env.RRFLOW_WORKSPACE_PASSWORD !== undefined || env.RRFLOW_SESSION_SECRET !== undefined || env.RRFLOW_ACCESS_MODE === 'public';
  let origin: URL | null = null;
  try {
    const candidate = new URL(value || '');
    if (!candidate.username && !candidate.password && !candidate.search && !candidate.hash && candidate.pathname === '/' && (candidate.protocol === 'https:' || candidate.protocol === 'http:' && loopback(candidate.hostname))) origin = candidate;
  } catch { /* Invalid configuration must not restore unauthenticated access. */ }
  return { enabled, ready: !!origin && password.length >= 16 && secret.length >= 32, origin, password, secret };
};

/** Use this boolean only to choose the public entrance, never to expose configuration to a client. */
export const isPublicWorkspace = () => configuration(process.env).enabled;
export const workspaceEntranceUrl = (request: Request) => new URL('/', configuration(process.env).origin?.origin || request.url);

/** One publication cutoff, evaluated on every server request; no timer or second store. */
export const publicDemoWindow = (env: Environment = process.env, now = Date.now()): DemoWindow => {
  const config = configuration(env);
  if (!config.enabled) return { open: true, expiresAt: null };
  const value = env.RRFLOW_DEMO_EXPIRES_AT || '';
  // Require a full, unambiguous UTC ISO instant and reject calendar rollover.
  const valid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
  const cutoff = valid ? Date.parse(value) : NaN;
  if (!Number.isFinite(cutoff) || new Date(cutoff).toISOString() !== value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')) return { open: false, expiresAt: null };
  return { open: config.ready && now < cutoff, expiresAt: new Date(cutoff).toISOString() };
};

const context = (request: Request, env: Environment) => {
  const config = configuration(env);
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  if (!host || /[\s,@/#\\?]/.test(host)) throw new WorkspaceAccessError('The workspace host is not allowed.', 403);
  let target: URL;
  try { target = new URL(`${config.origin?.protocol || url.protocol}//${host}`); }
  catch { throw new WorkspaceAccessError('The workspace host is not allowed.', 403); }
  const forwardedHost = request.headers.get('x-forwarded-host');
  const local = !config.enabled && loopback(target.hostname) && (!forwardedHost || forwardedHost === host);
  if (!local) {
    if (!config.ready || !config.origin) throw new WorkspaceAccessError('Private workspace access is not configured on this host.', 503);
    if (target.host !== config.origin.host) throw new WorkspaceAccessError('The workspace host is not allowed.', 403);
    if (config.origin.protocol === 'https:' && url.protocol !== 'https:' && request.headers.get('x-forwarded-proto') !== 'https') throw new WorkspaceAccessError('Use the HTTPS workspace address.', 403);
  }
  const expectedOrigin = local ? `${url.protocol}//${target.host}` : config.origin!.origin;
  const origin = request.headers.get('origin');
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (request.headers.get('sec-fetch-site') === 'cross-site' || origin !== null && origin !== expectedOrigin || !local && mutation && origin !== expectedOrigin) throw new WorkspaceAccessError('Cross-site workspace access is not allowed.', 403);
  return { config, local };
};

const signature = (payload: string, config: Configuration) => createHmac('sha256', config.secret).update(payload).update('\0').update(createHash('sha256').update(config.password).digest()).digest('base64url');
const constantEqual = (left: string, right: string) => timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
const readCookie = (request: Request) => {
  const matches = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${SESSION_COOKIE}=`));
  return matches.length === 1 ? matches[0].slice(SESSION_COOKIE.length + 1) : null;
};

export const verifyWorkspaceSession = (token: string | null, env: Environment = process.env, now = Date.now()): Claims | null => {
  const config = configuration(env);
  if (!config.ready || !config.origin || !token || token.length > 1000) return null;
  const pieces = token.split('.');
  if (pieces.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(pieces[0]) || !/^[A-Za-z0-9_-]{43}$/.test(pieces[1]) || !constantEqual(pieces[1], signature(pieces[0], config))) return null;
  try {
    const payload = Buffer.from(pieces[0], 'base64url');
    if (payload.toString('base64url') !== pieces[0]) return null;
    const claims = JSON.parse(payload.toString('utf8')) as Claims;
    const seconds = Math.floor(now / 1000);
    if (claims.v !== 1 || claims.aud !== config.origin.origin || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > seconds + 30 || claims.exp <= seconds || claims.exp - claims.iat !== SESSION_SECONDS || !/^[A-Za-z0-9_-]{22}$/.test(claims.nonce)) return null;
    return claims;
  } catch { return null; }
};

export const getSessionStatus = (request: Request, env: Environment = process.env): SessionStatus => {
  const { config, local } = context(request, env);
  const demo = publicDemoWindow(env);
  if (local) return { authenticated: true, local: true, configured: false, expiresAt: null, demo };
  const claims = verifyWorkspaceSession(readCookie(request), env);
  return { authenticated: !!claims, local: false, configured: config.ready, expiresAt: claims ? new Date(claims.exp * 1000).toISOString() : null, demo };
};

export const assertWorkspaceAccess = (request: Request, env: Environment = process.env) => {
  const status = getSessionStatus(request, env);
  if (!status.authenticated) throw new WorkspaceAccessError('Sign in to access your private workspace.', 401);
  return status;
};

export const createWorkspaceSession = (request: Request, password: string, env: Environment = process.env, now = Date.now()) => {
  const { config, local } = context(request, env);
  const demo = publicDemoWindow(env, now);
  if (local) return { token: null, status: { authenticated: true, local: true, configured: false, expiresAt: null, demo } satisfies SessionStatus };
  if (!constantEqual(password, config.password)) throw new WorkspaceAccessError('The workspace password is incorrect.', 401);
  const iat = Math.floor(now / 1000);
  const claims: Claims = { v: 1, aud: config.origin!.origin, iat, exp: iat + SESSION_SECONDS, nonce: randomBytes(16).toString('base64url') };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return { token: `${payload}.${signature(payload, config)}`, status: { authenticated: true, local: false, configured: true, expiresAt: new Date(claims.exp * 1000).toISOString(), demo } satisfies SessionStatus };
};
