import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { MeshRequestError, MeshRequestReceiptsError, recall } from '@/lib/mesh';
import { recallInputSchema } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
  try {
    checkLocalRequest(request);
    const input = recallInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return apiError(new Error(input.error.issues[0]?.message ?? 'Choose a brain and ask a question.'), 400);
    return NextResponse.json(await recall(input.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MeshRequestError) {
      const receipts = error instanceof MeshRequestReceiptsError ? error.receipts : [];
      return NextResponse.json({ error: error.message, requestId: error.requestId, receipts }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return apiError(error);
  }
};
