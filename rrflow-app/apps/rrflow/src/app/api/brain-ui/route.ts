import { apiError, checkLocalRequest } from '@/lib/http';
import { brainUiInput, brainUiMessageSchema } from '@/lib/brain-ui-contracts';
import { streamBrainWorkspace } from '@/lib/brain-ui';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const POST = async (request: Request) => {
  try { checkLocalRequest(request); } catch (error) { return apiError(error, 403); }
  const parsed = brainUiInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(new Error('Choose a specialist and describe the work in 8–1000 characters.'), 400);
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamBrainWorkspace(parsed.data, message => {
          if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(brainUiMessageSchema.parse(message))}\n`));
        }, request.headers.get('x-rrflow-verification') === 'playwright');
        if (!cancelled) controller.close();
      } catch { if (!cancelled) controller.error(new Error('The knowledge interface stream was interrupted.')); }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/a2ui+json', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
};
