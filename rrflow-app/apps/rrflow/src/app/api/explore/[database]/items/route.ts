import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { ExploreRequestError, listItems } from '@/lib/explore';
import { databaseNameSchema, listItemsInputSchema } from '@/lib/explore-contracts';

export const dynamic = 'force-dynamic';

/** Browse knowledge sources or memories in one database/collection (`POST /context/list`). */
export const GET = async (request: Request, context: { params: Promise<{ database: string }> }) => {
  try {
    checkLocalRequest(request);
    const database = databaseNameSchema.safeParse((await context.params).database);
    if (!database.success) return apiError(new Error(database.error.issues[0]?.message), 400);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const input = listItemsInputSchema.safeParse(params);
    if (!input.success) return apiError(new Error(input.error.issues[0]?.message ?? 'Invalid query.'), 400);
    return NextResponse.json(await listItems(database.data, input.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ExploreRequestError) {
      return NextResponse.json({ error: error.message, requestId: error.requestId }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    return apiError(error);
  }
};
