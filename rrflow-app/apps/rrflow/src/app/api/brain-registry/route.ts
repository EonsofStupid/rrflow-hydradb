import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkLocalRequest } from '@/lib/http';
import { WorkspaceAccessError } from '@/lib/access';
import { BrainRegistryError, brainRegistryActionSchema, registeredBrainNameSchema, registryWorkspaceSchema, resolveRegisteredBrain } from '@/lib/brain-registry-contracts';
import { changeBrainRegistry, readBrainRegistry } from '@/lib/brain-registry';
import type { ServiceReceipt } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
const failure = (error: unknown, receipts: ServiceReceipt[]) => NextResponse.json({ error: error instanceof z.ZodError ? 'The registry returned an unreadable identity. Refresh before editing.' : error instanceof Error ? error.message : 'The brain registry is unavailable.', receipts }, { status: error instanceof BrainRegistryError ? error.status : error instanceof WorkspaceAccessError ? error.status : 503, headers });
export const GET = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request);
    const params = new URL(request.url).searchParams;
    const workspace = registryWorkspaceSchema.safeParse(params.get('workspace'));
    const name = params.get('name');
    if (!workspace.success || [...params.keys()].some(key => !['workspace', 'name'].includes(key)) || params.getAll('workspace').length !== 1 || params.getAll('name').length > 1 || name !== null && !registeredBrainNameSchema.safeParse(name).success) return NextResponse.json({ error: 'Choose one Personal or Shippin workspace and a valid brain name.', receipts }, { status: 400, headers });
    const snapshot = await readBrainRegistry(workspace.data, receipts);
    return NextResponse.json(name ? { ...resolveRegisteredBrain(snapshot, name), revision: snapshot.revision, checkedAt: snapshot.checkedAt, receipts } : snapshot, { headers });
  } catch (error) { return failure(error, receipts); }
};
export const POST = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send a JSON registration.', receipts }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 8000) return NextResponse.json({ error: 'This registration is too large.', receipts }, { status: 413, headers });
    const parsed = brainRegistryActionSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ error: 'Check the brain name, project, binding and expected revision.', receipts }, { status: 400, headers });
    return NextResponse.json(await changeBrainRegistry(parsed.data, receipts), { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'The registration JSON could not be read.', receipts }, { status: 400, headers });
    return failure(error, receipts);
  }
};
