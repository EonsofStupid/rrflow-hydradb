import { NextResponse } from 'next/server';
import { checkLocalRequest } from '@/lib/http';
import { lessonInputSchema } from '@/lib/learning-contracts';
import { readLearning, saveReviewedLesson } from '@/lib/learning';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export const GET = async (request: Request) => {
  try { checkLocalRequest(request); return NextResponse.json(await readLearning(), { headers }); }
  catch { return NextResponse.json({ error: 'Learning evidence is unavailable. Refresh to retry.' }, { status: 503, headers }); }
};
export const POST = async (request: Request) => {
  try {
    checkLocalRequest(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Send a lesson as JSON.' }, { status: 415, headers });
    const text = await request.text(); if (text.length > 7000) return NextResponse.json({ error: 'This lesson is too large.' }, { status: 413, headers });
    let body: unknown; try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'Invalid lesson.' }, { status: 400, headers }); }
    const input = lessonInputSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: 'Choose a failing check and describe the cause, correction, and future practice.' }, { status: 400, headers });
    return NextResponse.json(await saveReviewedLesson(input.data, request.headers.get('x-rrflow-verification') === 'playwright'), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Lesson could not be saved.' }, { status: 503, headers }); }
};
