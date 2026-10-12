import { NextResponse } from 'next/server';
import { checkLocalRequest } from '@/lib/http';
import { createDatabaseSchema } from '@/lib/databases-contracts';
import { createDatabase, DatabaseActionError, listDatabases } from '@/lib/databases';
import type { ServiceReceipt } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export const GET = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try { checkLocalRequest(request); return NextResponse.json(await listDatabases(receipts), { headers }); }
  catch (error) { return NextResponse.json({ databases: [], checkedAt: new Date().toISOString(), receipts, error: error instanceof Error ? error.message : 'Databases could not load.' }, { status: error instanceof DatabaseActionError ? error.httpStatus : 503, headers }); }
};
export const POST = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send database settings as JSON.', receipts }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 2000) return NextResponse.json({ error: 'Database settings are too large.', receipts }, { status: 413, headers });
    let data: unknown;
    try { data = JSON.parse(text); } catch { return NextResponse.json({ error: 'Enter valid database settings.', receipts }, { status: 400, headers }); }
    const input = createDatabaseSchema.safeParse(data);
    if (!input.success) return NextResponse.json({ error: 'Choose Personal or Shippin and a name of 3–63 characters: lowercase letters, numbers, underscores or hyphens, starting with a letter.', receipts }, { status: 400, headers });
    return NextResponse.json(await createDatabase(input.data, receipts), { status: 201, headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Database creation could not complete.', receipts }, { status: error instanceof DatabaseActionError ? error.httpStatus : 503, headers }); }
};
