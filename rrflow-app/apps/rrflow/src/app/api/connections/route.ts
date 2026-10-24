import { NextResponse } from 'next/server';
import { checkLocalRequest } from '@/lib/http';
import { connectionsActionSchema, connectionsQuerySchema } from '@/lib/connections-contracts';
import { changeConnections, readConnections, ConnectionScopeError } from '@/lib/connections';
import type { ServiceReceipt } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, max-age=0', 'Referrer-Policy': 'no-referrer' };
export const GET = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request);
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = connectionsQuerySchema.safeParse(Object.keys(query).length ? query : { view: 'overview' });
    if (!parsed.success) return NextResponse.json({ error: 'Choose a valid connection view.', receipts }, { status: 400, headers });
    return NextResponse.json(await readConnections(parsed.data, receipts), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Connections could not load.', receipts }, { status: error instanceof ConnectionScopeError ? error.httpStatus : 503, headers });
  }
};
export const POST = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send settings as JSON.', receipts }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 40_000) return NextResponse.json({ error: 'These settings are too large.', receipts }, { status: 413, headers });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return NextResponse.json({ error: 'These settings could not be read.', receipts }, { status: 400, headers }); }
    const parsed = connectionsActionSchema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'Check the required settings. Use a managed brain and a public HTTPS webhook URL without credentials or query parameters.', receipts }, { status: 400, headers });
    return NextResponse.json(await changeConnections(parsed.data, receipts), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The connection could not be updated.', receipts }, { status: error instanceof ConnectionScopeError ? error.httpStatus : 503, headers });
  }
};
