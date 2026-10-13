import { NextResponse } from 'next/server';
import { checkLocalRequest, apiError } from '@/lib/http';
import { databaseNameSchema } from '@/lib/explore-contracts';
import { listCollections } from '@/lib/explore';

export const dynamic = 'force-dynamic';
export const GET = async (request: Request, context: { params: Promise<{ database: string }> }) => {
  try {
    checkLocalRequest(request);
    const database = databaseNameSchema.safeParse((await context.params).database);
    if (!database.success) return apiError(new Error('Invalid database name.'), 400);
    return NextResponse.json(await listCollections(database.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return apiError(new Error('Source collections could not be loaded.')); }
};
