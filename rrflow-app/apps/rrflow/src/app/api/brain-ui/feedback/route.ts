import { NextResponse } from 'next/server';
import { brainUiFeedbackInput } from '@/lib/brain-ui-contracts';
import { apiError, checkLocalRequest } from '@/lib/http';
import { trackSignal } from '@/lib/raindrop';

export const POST = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const input = brainUiFeedbackInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError(new Error('Choose a quality verdict for this interface.'), 400);
  const helpful = input.data.verdict === 'helpful';
  const delivery = await trackSignal({ event_id: input.data.eventId, signal_name: helpful ? 'brain_ui_helpful' : 'brain_ui_missing_context', sentiment: helpful ? 'POSITIVE' : 'NEGATIVE', signal_type: 'feedback', properties: { kind: 'knowledge_ui_feedback', verification_run: request.headers.get('x-rrflow-verification') === 'playwright' } }, 'Recorded your verdict on the brain-generated interface');
  return NextResponse.json({ status: delivery.status, error: delivery.error, receipts: delivery.receipt ? [delivery.receipt] : [] }, { status: delivery.status === 'accepted' ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
};
