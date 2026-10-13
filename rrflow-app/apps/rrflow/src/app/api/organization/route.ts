import { NextResponse } from 'next/server';
import { checkLocalRequest } from '@/lib/http';
import { organizationDatabaseSchema, organizationInputSchema } from '@/lib/organization-contracts';
import { OrganizationError, readOrganization, saveOrganization } from '@/lib/organization';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export const GET = async (request: Request) => {
  try {
    checkLocalRequest(request);
    const database = organizationDatabaseSchema.safeParse(new URL(request.url).searchParams.get('database') ?? 'default-tenant');
    if (!database.success) return NextResponse.json({ error: 'Choose a supported Personal or Shippin inbox.' }, { status: 400, headers });
    return NextResponse.json(await readOrganization(database.data), { headers });
  } catch { return NextResponse.json({ error: 'Context organization could not load. Refresh to retry.' }, { status: 503, headers }); }
};
export const POST = async (request: Request) => {
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send a review as JSON.' }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 2000) return NextResponse.json({ error: 'This review is too large.' }, { status: 413, headers });
    let body: unknown; try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'Invalid review.' }, { status: 400, headers }); }
    const input = organizationInputSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: 'Choose a destination and refresh the source before saving.' }, { status: 400, headers });
    return NextResponse.json(await saveOrganization(input.data, request.headers.get('x-rrflow-verification') === 'playwright'), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof OrganizationError ? error.message : 'Your decision could not be verified. Refresh before retrying.' }, { status: error instanceof OrganizationError ? error.status : 503, headers }); }
};
