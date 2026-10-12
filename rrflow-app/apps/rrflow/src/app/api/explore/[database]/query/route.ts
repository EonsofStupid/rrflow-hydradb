import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { ExploreRequestError, labQuery } from '@/lib/explore';
import { databaseNameSchema, labQueryInputSchema } from '@/lib/explore-contracts';

export const dynamic = 'force-dynamic';

/** Query Lab: forward every `POST /query` knob and return the structured response with its request id. */
export const POST = async (request: Request, context: { params: Promise<{ database: string }> }) => {
  try {
    checkLocalRequest(request);
    const database = databaseNameSchema.safeParse((await context.params).database);
    if (!database.success) return apiError(new Error(database.error.issues[0]?.message), 400);
    const input = labQueryInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return apiError(new Error(input.error.issues[0]?.message ?? 'Invalid query.'), 400);
    return NextResponse.json(await labQuery(database.data, input.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ExploreRequestError) {
      return NextResponse.json({ error: error.message, requestId: error.requestId }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    return apiError(error);
  }
};
