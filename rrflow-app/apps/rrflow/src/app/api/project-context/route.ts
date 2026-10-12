import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { projectContextInput, projectIdSchema } from '@/lib/project-context-contracts';
import { inspectAndSaveProject, listProjectContexts, loadProjectContext, removeProjectContext } from '@/lib/project-context';
import type { ServiceReceipt } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export const GET = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const receipts: ServiceReceipt[] = [];
  try {
    const id = new URL(request.url).searchParams.get('id');
    const workspace = new URL(request.url).searchParams.get('workspace') || 'shippin';
    if (workspace !== 'personal' && workspace !== 'shippin') return apiError(new Error('Choose Personal or Shippin work.'), 400);
    if (id && !projectIdSchema.safeParse(id).success) return apiError(new Error('The saved project identifier is invalid.'), 400);
    return NextResponse.json(id ? { project: await loadProjectContext(id, workspace, receipts), receipts } : { projects: await listProjectContexts(workspace, receipts), receipts }, { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Project context is unavailable.', receipts }, { status: 503, headers }); }
};

export const POST = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  if (Number(request.headers.get('content-length') || 0) > 4096) return apiError(new Error('The project request is too large.'), 413);
  const parsed = projectContextInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(new Error('Choose Local folder or GitHub and enter its path or repository.'), 400);
  const receipts: ServiceReceipt[] = [];
  try { return NextResponse.json({ project: await inspectAndSaveProject(parsed.data, receipts), receipts }, { headers }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'The project could not be loaded.', receipts }, { status: 422, headers }); }
};

export const DELETE = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const params = new URL(request.url).searchParams;
  const id = projectIdSchema.safeParse(params.get('id'));
  const workspace = params.get('workspace');
  if (!id.success || (workspace !== 'personal' && workspace !== 'shippin')) return apiError(new Error('Choose a saved project and its workspace.'), 400);
  const receipts: ServiceReceipt[] = [];
  try { return NextResponse.json({ removed: await removeProjectContext(id.data, workspace, receipts), receipts }, { headers }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'The project could not be removed.', receipts }, { status: 503, headers }); }
};
