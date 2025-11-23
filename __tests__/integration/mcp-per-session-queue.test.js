import fetch from 'node-fetch';

function resolveMcpUrl() {
  const base = process.env.MCP_BASE_URL || 'http://localhost:3457';
  return base.endsWith('/mcp') ? base : `${base}/mcp`;
}

async function initializeSession() {
  const mcpUrl = resolveMcpUrl();
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'jest', version: '1.0' },
      },
    }),
  });
  if (res.status !== 200) throw new Error(`init failed: ${res.status}`);
  const sessionId = res.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('no session id header');
  return sessionId;
}

async function mcpPost(sessionId, payload) {
  const mcpUrl = resolveMcpUrl();
  return fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify(payload),
  });
}

describe('Per-session POST serialization', () => {
  // Give plenty of time in CI
  if (typeof globalThis.jest !== 'undefined' && typeof globalThis.jest.setTimeout === 'function') {
    globalThis.jest.setTimeout(120000);
  }

  test('two concurrent POSTs under same session do not hang', async () => {
    const sid = await initializeSession();

    const p1 = mcpPost(sid, { jsonrpc: '2.0', id: 10, method: 'tools/list', params: {} });
    const p2 = mcpPost(sid, { jsonrpc: '2.0', id: 11, method: 'tools/list', params: {} });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
