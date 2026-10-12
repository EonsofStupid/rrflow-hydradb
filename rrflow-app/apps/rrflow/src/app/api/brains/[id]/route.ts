import { NextResponse } from 'next/server';
import { getBrain } from '@/lib/knowledge';
import { brainIdSchema } from '@/lib/contracts';
import { apiError, checkLocalRequest } from '@/lib/http';
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const id = brainIdSchema.safeParse((await context.params).id);
  if (!id.success) return apiError(new Error('Brain not found.'), 404);
  try {
    const brain = await getBrain(id.data);
    return brain ? NextResponse.json(brain) : apiError(new Error('Import this brain to explore it.'), 404);
  } catch (error) { return apiError(error); }
};

