import { z } from 'zod';
import { NextResponse } from 'next/server';
import { deleteReview } from '@/lib/knowledge';
import { apiError, checkLocalRequest } from '@/lib/http';
export const DELETE = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return apiError(new Error('Plan not found.'), 404);
  try {
    return await deleteReview(id.data) ? NextResponse.json({ deleted: true }) : apiError(new Error('Plan not found.'), 404);
  } catch (error) { return apiError(error); }
};
