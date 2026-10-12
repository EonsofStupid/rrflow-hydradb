import 'server-only';
import type { ServiceReceipt } from './mesh-contracts';

const RAINDROP_URL = 'https://api.raindrop.ai/v1';
const PROJECT_ID = process.env.RAINDROP_PROJECT_ID || 'rrflow-hydradb';

export type RaindropToolCall = {
  name: string;
  arguments?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: 'ok' | 'error';
  error?: string;
};

export type RaindropEvent = {
  event_id: string;
  user_id: string;
  event: string;
  properties?: Record<string, unknown>;
  ai_data?: { model?: string; input?: string; output?: string; convo_id?: string; tool_calls?: RaindropToolCall[] };
};

export type RaindropSignal = {
  event_id: string;
  signal_name: string;
  sentiment?: 'POSITIVE' | 'NEGATIVE';
  signal_type?: 'default' | 'feedback' | 'edit' | 'standard';
  properties?: Record<string, unknown>;
};

export const isRaindropEnabled = (): boolean => !!process.env.RAINDROP_WRITE_KEY;
export const raindropProject = (): string | null => (isRaindropEnabled() ? PROJECT_ID : null);

/** `receipt` is absent only when reporting is not configured, because no call was made. */
export type Delivery = { status: 'accepted' | 'failed' | 'not_configured'; error?: string; receipt?: ServiceReceipt };

/**
 * Native Raindrop HTTP API. Await bounded delivery and report failures without
 * discarding the user's successful retrieval. Acceptance is not evaluation.
 */
const send = async (path: string, payload: unknown[], action: string): Promise<Delivery> => {
  const key = process.env.RAINDROP_WRITE_KEY;
  if (!key) return { status: 'not_configured' };
  const at = new Date().toISOString();
  const started = performance.now();
  const receiptFor = (fields: Pick<ServiceReceipt, 'httpStatus' | 'outcome' | 'requestId'> & { error?: string }): ServiceReceipt => ({
    service: 'Raindrop', action, method: 'POST', endpoint: `/v1${path}`, database: `project ${PROJECT_ID}`,
    latencyMs: Math.round(performance.now() - started), at, ...fields,
  });
  try {
    const response = await fetch(`${RAINDROP_URL}${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Raindrop-Project-Id': PROJECT_ID },
      body: JSON.stringify(payload),
    });
    const requestId = response.headers.get('x-request-id');
    if (response.ok) return { status: 'accepted', receipt: receiptFor({ httpStatus: response.status, outcome: 'ok', requestId }) };
    const error = `Raindrop returned ${response.status}.`;
    return { status: 'failed', error, receipt: receiptFor({ httpStatus: response.status, outcome: 'failed', requestId, error }) };
  } catch {
    const error = 'Raindrop could not be reached. Your retrieval result is still available.';
    return { status: 'failed', error, receipt: receiptFor({ httpStatus: null, outcome: 'failed', requestId: null, error }) };
  }
};

export const trackEvent = (event: RaindropEvent, action: string): Promise<Delivery> => send('/events/track', [event], action);
export const trackSignal = (signal: RaindropSignal, action: string): Promise<Delivery> => send('/signals/track', [signal], action);
