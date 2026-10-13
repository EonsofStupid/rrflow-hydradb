import 'server-only';
import { NextResponse } from 'next/server';
import { assertWorkspaceAccess } from './access';

export const checkLocalRequest = (request: Request) => {
  assertWorkspaceAccess(request);
};
export const apiError = (error: unknown, status = 503) =>
  NextResponse.json({ error: error instanceof Error ? error.message : 'The request could not be completed.' }, { status, headers: { 'Cache-Control': 'no-store' } });

