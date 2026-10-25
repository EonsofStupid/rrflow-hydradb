import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkLocalRequest } from '@/lib/http';
import { WorkspaceAccessError } from '@/lib/access';
import { BrainRegistryError, brainRegistrationSchema, registryWorkspaceSchema } from '@/lib/brain-registry-contracts';
import { knowledgeActionSchema } from '@/lib/knowledge-path-contracts';
import { connectKnowledgeProject, listKnowledgeRuns, queryKnowledgePath, readKnowledgeRun, resolveKnowledgeBrain, reviewKnowledgePath } from '@/lib/knowledge-path';
import type { ServiceReceipt } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
const failure = (error: unknown, receipts: ServiceReceipt[]) => NextResponse.json({ error: error instanceof z.ZodError ? 'The knowledge path returned incomplete data. Refresh before continuing.' : error instanceof Error ? error.message : 'The knowledge path is unavailable.', receipts }, { status: error instanceof BrainRegistryError || error instanceof WorkspaceAccessError ? error.status : 503, headers });
export const GET = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request); const params = new URL(request.url).searchParams;
    const parsed = z.object({ workspace: registryWorkspaceSchema, brainId: brainRegistrationSchema.shape.id, runId: z.string().uuid().optional() }).strict().safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].some(key => params.getAll(key).length !== 1)) return NextResponse.json({ error: 'Choose one workspace and registered brain.', receipts }, { status: 400, headers });
    const { workspace, brainId, runId } = parsed.data;
    if (runId) { await resolveKnowledgeBrain(workspace, brainId, receipts); return NextResponse.json({ run: await readKnowledgeRun(workspace, brainId, runId, receipts), receipts }, { headers }); }
    return NextResponse.json({ ...await listKnowledgeRuns(workspace, brainId, receipts), receipts }, { headers });
  } catch (error) { return failure(error, receipts); }
};
export const POST = async (request: Request) => {
  const receipts: ServiceReceipt[] = [];
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send JSON.', receipts }, { status: 415, headers });
    const raw = await request.text(); if (raw.length > 9000) return NextResponse.json({ error: 'The request is too large.', receipts }, { status: 413, headers });
    const parsed = knowledgeActionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: 'Check the project, registered brain, revision and reviewed evidence.', receipts }, { status: 400, headers });
    const input = parsed.data;
    const result = input.action === 'query' ? await queryKnowledgePath(input, receipts) : input.action === 'connect' ? await connectKnowledgeProject(input, receipts) : await reviewKnowledgePath(input, receipts, request.headers.get('x-rrflow-verification') === 'playwright');
    return NextResponse.json(result, { headers });
  } catch (error) { if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON.', receipts }, { status: 400, headers }); return failure(error, receipts); }
};
