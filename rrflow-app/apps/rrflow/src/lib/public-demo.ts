import 'server-only';
import { z } from 'zod';
import { PUBLIC_DEMO_COLLECTION, PUBLIC_DEMO_DATABASE, PUBLIC_DEMO_ID, publicDemoSnapshotSchema, type PublicDemoResponse } from './public-demo-contracts';

/** The public surface can read one curated node only; it never discovers private databases. */
export const getPublicDemo = async (): Promise<PublicDemoResponse> => {
  const result: PublicDemoResponse = { snapshot: null, checkedAt: new Date().toISOString(), requestId: null, storage: 'HydraDB' };
  try {
    const key = process.env.HYDRA_DB_API_KEY;
    if (!key) throw new Error('No public demo credential');
    const response = await fetch('https://api.hydradb.com/byog/query', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: PUBLIC_DEMO_DATABASE, collection: PUBLIC_DEMO_COLLECTION,
        query: 'MATCH (s:PublicDemoSnapshot {ext_id: $id}) RETURN s.snapshot AS snapshot LIMIT 1', params: { id: PUBLIC_DEMO_ID },
      }),
    });
    result.requestId = response.headers.get('x-request-id')?.slice(0, 200) ?? null;
    if (!response.ok) throw new Error('Public demo read failed');
    const body = z.object({ success: z.literal(true), data: z.array(z.object({ snapshot: z.string().max(32_000) }).strict()).length(1), meta: z.object({ request_id: z.string().max(200).optional() }).passthrough().optional() }).parse(await response.json());
    result.requestId = body.meta?.request_id ?? result.requestId;
    result.snapshot = publicDemoSnapshotSchema.parse(JSON.parse(body.data[0].snapshot));
  } catch {
    // Never expose a provider error or fall back to a private workspace/fixture.
    result.snapshot = null;
    result.error = 'The curated demo could not be read from HydraDB. Please retry shortly.';
  }
  result.checkedAt = new Date().toISOString();
  return result;
};
