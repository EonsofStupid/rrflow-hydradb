import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { ExploreRequestError, getItem } from '@/lib/explore';
import { databaseNameSchema, itemDetailInputSchema } from '@/lib/explore-contracts';

export const dynamic = 'force-dynamic';

/** One item: stored content (`/context/inspect`), extracted relations, and its subgraph. */
export const GET = async (request: Request, context: { params: Promise<{ database: string; id: string }> }) => {
  try {
    checkLocalRequest(request);
    const { database: rawDatabase, id } = await context.params;
    const database = databaseNameSchema.safeParse(rawDatabase);
    if (!database.success) return apiError(new Error(database.error.issues[0]?.message), 400);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const input = itemDetailInputSchema.safeParse(params);
    if (!input.success) return apiError(new Error(input.error.issues[0]?.message ?? 'Invalid query.'), 400);
    return NextResponse.json(await getItem(database.data, decodeURIComponent(id), input.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ExploreRequestError) {
      return NextResponse.json({ error: error.message, requestId: error.requestId }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    return apiError(error);
  }
};
