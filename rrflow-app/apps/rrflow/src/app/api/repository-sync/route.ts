import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { getRepositorySync } from '@/lib/repository-sync';

export const dynamic = 'force-dynamic';
export const GET = async (request: Request) => {
  try {
    checkLocalRequest(request);
    const result = await getRepositorySync();
    return NextResponse.json(result, { status: result.error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
};
