import { NextResponse, type NextRequest } from 'next/server';
import { assertWorkspaceAccess, getSessionStatus, publicDemoWindow, workspaceEntranceUrl, WorkspaceAccessError } from '@/lib/access';

export const proxy = (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;
  // The demo endpoint must contain only the root-owned, explicitly curated public payload.
  if (pathname === '/api/session') return NextResponse.next();
  try {
    if ((pathname === '/api/demo' || pathname === '/demo') && ['GET', 'HEAD'].includes(request.method) && publicDemoWindow().open) getSessionStatus(request);
    else assertWorkspaceAccess(request);
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vary', 'Cookie');
    return response;
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 503;
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
    if (pathname !== '/api' && !pathname.startsWith('/api/') && status === 401) {
      const entrance = workspaceEntranceUrl(request); entrance.searchParams.set('access', 'required');
      return NextResponse.redirect(entrance, { status: 307, headers });
    }
    return NextResponse.json({ error: error instanceof WorkspaceAccessError ? error.message : 'Private workspace access is unavailable.' }, { status, headers });
  }
};

export const config = { matcher: ['/api/:path*', '/workspace/:path*', '/explore/:path*', '/live/:path*', '/demo/:path*'] };
