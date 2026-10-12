import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { ExploreRequestError, listDatabases } from '@/lib/explore';

export const dynamic = 'force-dynamic';

const failed = (error: unknown) =>
  error instanceof ExploreRequestError
    ? NextResponse.json(
        { error: error.message, requestId: error.requestId },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      )
    : apiError(error);

/** Every HydraDB database this key can reach, with readiness, counts and collections. */
export const GET = async (request: Request) => {
  try {
    checkLocalRequest(request);
    return NextResponse.json(await listDatabases(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failed(error);
  }
};
