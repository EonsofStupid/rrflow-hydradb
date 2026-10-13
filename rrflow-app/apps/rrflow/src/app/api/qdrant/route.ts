import { NextResponse } from 'next/server';
import { checkLocalRequest } from '@/lib/http';
import { qdrantImportSchema, qdrantScopeSchema, type QdrantReceipt } from '@/lib/qdrant-contracts';
import { importQdrantSources, QdrantSourceError, readQdrantSources } from '@/lib/qdrant';
import type { ServiceReceipt } from '@/lib/mesh-contracts';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export const GET = async (request: Request) => {
  try {
    checkLocalRequest(request);
    const params = new URL(request.url).searchParams;
    const value = params.get('scope');
    const evidence = params.get('evidence');
    if (evidence !== null && !['0', '1'].includes(evidence)) return NextResponse.json({ error: 'Choose a valid evidence view.', receipts: [], qdrantReceipts: [] }, { status: 400, headers });
    const scope = value === null ? undefined : qdrantScopeSchema.safeParse(value);
    if (scope && !scope.success) return NextResponse.json({ error: 'Choose Personal or Work.', receipts: [], qdrantReceipts: [] }, { status: 400, headers });
    return NextResponse.json(await readQdrantSources(scope?.data, evidence !== '0'), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Sources could not load.', receipts: [], qdrantReceipts: [] }, { status: error instanceof QdrantSourceError ? error.status : 503, headers }); }
};
export const POST = async (request: Request) => {
  const receipts: ServiceReceipt[] = [], qdrantReceipts: QdrantReceipt[] = [];
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send the source selection as JSON.', receipts, qdrantReceipts }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 6000) return NextResponse.json({ error: 'Select at most 20 source records.', receipts, qdrantReceipts }, { status: 413, headers });
    let data: unknown;
    try { data = JSON.parse(text); } catch { return NextResponse.json({ error: 'The source selection could not be read.', receipts, qdrantReceipts }, { status: 400, headers }); }
    const parsed = qdrantImportSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: 'Select 1–20 current source records from Personal or Work. Their destination is fixed by scope.', receipts, qdrantReceipts }, { status: 400, headers });
    return NextResponse.json(await importQdrantSources(parsed.data, receipts, qdrantReceipts), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Source import could not complete.', receipts, qdrantReceipts }, { status: error instanceof QdrantSourceError ? error.status : 503, headers }); }
};
