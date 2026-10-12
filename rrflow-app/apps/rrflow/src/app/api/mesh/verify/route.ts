import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { verifyHydra } from '@/lib/mesh';

export const dynamic = 'force-dynamic';

/** Live, uncached proof of the HydraDB integration, made at the moment the person asks. */
export const GET = async (request: Request) => {
  try {
    checkLocalRequest(request);
    return NextResponse.json(await verifyHydra(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
};
