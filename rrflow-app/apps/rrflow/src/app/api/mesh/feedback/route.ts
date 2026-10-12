import { NextResponse } from 'next/server';
import { apiError, checkLocalRequest } from '@/lib/http';
import { recordFeedback } from '@/lib/mesh';
import { feedbackInputSchema } from '@/lib/mesh-contracts';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
  try {
    checkLocalRequest(request);
    const input = feedbackInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return apiError(new Error('Feedback needs the answer it refers to.'), 400);
    const result = await recordFeedback(input.data);
    return NextResponse.json(result, { status: result.error ? 502 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
};
