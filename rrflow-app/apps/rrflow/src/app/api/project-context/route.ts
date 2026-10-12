import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { projectContextInput, projectIdSchema } from '@/lib/project-context-contracts';
import { inspectAndSaveProject, listProjectContexts, loadProjectContext } from '@/lib/project-context';
import type { ServiceReceipt } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export const GET = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const receipts: ServiceReceipt[] = [];
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id && !projectIdSchema.safeParse(id).success) return apiError(new Error('The saved project identifier is invalid.'), 400);
    return NextResponse.json(id ? { project: await loadProjectContext(id, receipts), receipts } : { projects: await listProjectContexts(receipts), receipts }, { headers });
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
