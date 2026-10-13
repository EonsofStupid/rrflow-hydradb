import { NextResponse } from 'next/server';
import { getPublicDemo } from '@/lib/public-demo';
import type { PublicDemoResponse } from '@/lib/public-demo-contracts';
import { assertWorkspaceAccess, getSessionStatus, publicDemoWindow, WorkspaceAccessError } from '@/lib/access';

export const dynamic = 'force-dynamic';
export const GET = async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  try {
    if (!publicDemoWindow().open) assertWorkspaceAccess(request);
    else getSessionStatus(request); // Validate the actual host/origin, including the local-only development exception.
    if (new URL(request.url).search) {
      const rejected: PublicDemoResponse = { snapshot: null, checkedAt: new Date().toISOString(), requestId: null, storage: 'HydraDB', error: 'The public demo does not accept source or query parameters.' };
      return NextResponse.json(rejected, { status: 400, headers });
    }
    const result = await getPublicDemo();
    return NextResponse.json(result, { status: result.error ? 503 : 200, headers });
  } catch (error) {
    const rejected: PublicDemoResponse = { snapshot: null, checkedAt: new Date().toISOString(), requestId: null, storage: 'HydraDB', error: error instanceof WorkspaceAccessError ? error.message : 'Public demo access is unavailable.' };
    return NextResponse.json(rejected, { status: error instanceof WorkspaceAccessError ? error.status : 503, headers });
  }
};
