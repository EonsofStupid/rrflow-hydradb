import { NextResponse } from 'next/server';
import { getWorkspace } from '@/lib/knowledge';
import { apiError, checkLocalRequest } from '@/lib/http';
export const GET = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  return NextResponse.json(await getWorkspace(), { headers: { 'Cache-Control': 'no-store' } });
};

