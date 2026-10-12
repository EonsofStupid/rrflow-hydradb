import 'server-only';
import { NextResponse } from 'next/server';

export const checkLocalRequest = (request: Request) => {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  const target = host ? new URL(`${url.protocol}//${host}`) : url;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('This workspace is available locally until account access is configured.');
  }
  const origin = request.headers.get('origin');
  if ((origin && origin !== target.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new Error('Cross-site workspace access is not allowed.');
  }
};
export const apiError = (error: unknown, status = 503) =>
  NextResponse.json({ error: error instanceof Error ? error.message : 'The request could not be completed.' }, { status, headers: { 'Cache-Control': 'no-store' } });

