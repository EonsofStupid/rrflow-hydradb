import { NextResponse } from 'next/server';
import { createWorkspaceSession, getSessionStatus, SESSION_COOKIE, SESSION_SECONDS, WorkspaceAccessError } from '@/lib/access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
// A conservative per-process budget, independent of spoofable forwarding/IP headers.
// This is a temporary single-owner entrance, not a distributed identity service.
let budget = { startedAt: 0, attempts: 0 };
const errorResponse = (error: unknown) => NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : 'Session access could not be completed.' }, { status: error instanceof WorkspaceAccessError ? error.status : 503, headers });

export const GET = (request: Request) => {
  try { return NextResponse.json(getSessionStatus(request), { headers }); }
  catch (error) { return errorResponse(error); }
};

export const POST = async (request: Request) => {
  try {
    const state = getSessionStatus(request);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new WorkspaceAccessError('Send the password as JSON.', 415);
    if (Number(request.headers.get('content-length') || 0) > 2048) throw new WorkspaceAccessError('The sign-in request is too large.', 413);
    if (!state.local) {
      const now = Date.now();
      if (now - budget.startedAt >= 60_000) budget = { startedAt: now, attempts: 0 };
      if (++budget.attempts > 20) return NextResponse.json({ error: 'Too many sign-in attempts. Wait one minute and retry.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
    }
    // Enforce the byte limit while streaming, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new WorkspaceAccessError('Enter the workspace password.', 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2048) throw new WorkspaceAccessError('The sign-in request is too large.', 413); chunks.push(part.value); } }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new WorkspaceAccessError('Enter the workspace password.', 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !('password' in input) || typeof input.password !== 'string' || input.password.length > 512) throw new WorkspaceAccessError('Enter the workspace password.', 400);
    const { token, status } = createWorkspaceSession(request, input.password);
    const response = NextResponse.json(status, { headers });
    if (token) response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { return errorResponse(error); }
};

export const DELETE = (request: Request) => {
  try {
    const state = getSessionStatus(request);
    const response = NextResponse.json({ authenticated: state.local, local: state.local, configured: state.configured, expiresAt: null, demo: state.demo }, { headers });
    response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0, expires: new Date(0) });
    return response;
  } catch (error) { return errorResponse(error); }
};
