import { NextResponse } from 'next/server';
import { importResearch } from '@/lib/knowledge';
import { apiError, checkLocalRequest } from '@/lib/http';
export const maxDuration = 120;
export const POST = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  try { return NextResponse.json(await importResearch()); } catch (error) { return apiError(error); }
};

