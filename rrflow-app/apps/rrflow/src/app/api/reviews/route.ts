import { NextResponse } from 'next/server';
import { createReview } from '@/lib/knowledge';
import { newRunSchema } from '@/lib/contracts';
import { apiError, checkLocalRequest } from '@/lib/http';
export const POST = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  if (Number(request.headers.get('content-length')) > 4096) return apiError(new Error('Review request is too large.'), 413);
  let raw: string;
  try { raw = await request.text(); } catch { return apiError(new Error('Unable to read the request.'), 400); }
  if (raw.length > 4096) return apiError(new Error('Review request is too large.'), 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return apiError(new Error('Send a valid review request.'), 400); }
  const input = newRunSchema.safeParse(body);
  if (!input.success) return apiError(new Error(input.error.issues[0]?.message || 'Invalid review request.'), 400);
  try { return NextResponse.json(await createReview(input.data), { status: 201 }); } catch (error) { return apiError(error); }
};

