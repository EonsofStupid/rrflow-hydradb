/** One owner-API contract for local agents and CI; native credentials remain in the RRFLOW server. */
export function knowledgeClient({ baseUrl = process.env.RRFLOW_BASE_URL || 'http://127.0.0.1:3100', fetch: request = globalThis.fetch } = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('The local knowledge client requires a loopback HTTP origin. Remote owner authentication is not configured by this client.');
  const call = async (path, body) => {
    const response = await request(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(65000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const text = await response.text(); if (text.length > 300000) throw new Error('The context response exceeded its limit.');
    let data; try { data = JSON.parse(text); } catch { throw new Error('The RRFLOW server returned unreadable context.'); }
    if (!response.ok) throw new Error(data.error || `RRFLOW returned HTTP ${response.status}.`);
    return data;
  };
  const scope = workspace => { if (!['personal', 'shippin'].includes(workspace)) throw new Error('Choose personal or shippin.'); return workspace; };
  const listBrains = workspace => call(`/api/brain-registry?workspace=${scope(workspace)}`);
  return {
    listBrains,
    async query({ workspace, brain: address, question, mode = 'fast', recordType = 'knowledge' }) {
      const snapshot = await listBrains(workspace);
      const brain = snapshot.brains.find(item => item.id === address || item.canonicalName === address || item.aliases.includes(address));
      if (!brain) throw new Error('That brain is not registered in this workspace.');
      return call('/api/knowledge-path', { action: 'query', workspace, brainId: brain.id, expectedBrainRevision: brain.revision, question, mode, recordType });
    },
    readRun({ workspace, brainId, runId }) { return call(`/api/knowledge-path?${new URLSearchParams({ workspace: scope(workspace), brainId, runId })}`); },
    connect(manifest) { return call('/api/knowledge-path', { ...manifest, action: 'connect' }); },
  };
}
