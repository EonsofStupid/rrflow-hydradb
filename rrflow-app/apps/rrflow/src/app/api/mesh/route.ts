import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { getMeshSnapshot } from '@/lib/mesh';

export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  try {
    checkLocalRequest(request);
    return NextResponse.json(await getMeshSnapshot(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
};
