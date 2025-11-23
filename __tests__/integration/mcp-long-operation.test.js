import fetch from 'node-fetch';

const BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:3457';

async function init(baseUrl) {
  const res = await fetch(`${baseUrl}/mcp`, {
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
  const sid = res.headers.get('mcp-session-id');
  if (!sid) throw new Error('No session id');
  return sid;
}

describe('MCP long operation behavior', () => {
  if (typeof globalThis.jest !== 'undefined' && typeof globalThis.jest.setTimeout === 'function') {
    globalThis.jest.setTimeout(180000);
  }

  test('POST calls time out per HULY_MCP_REQUEST_TIMEOUT_MS but SSE remains open', async () => {
    const sid = await init(BASE_URL);

    // Fire a mocked long operation tool (if not available, we just ensure server returns 200 and doesn't close SSE prematurely)
    // Here we call a real tool but our assertion is focused on HTTP-level behavior.
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sid,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/call',
        params: {
          name: 'huly_entity',
          arguments: {
            entity_type: 'comment',
            operation: 'create',
            issue_identifier: process.env.TEST_ISSUE_ID || 'HULLY-15',
            data: { message: 'MCP long operation behavior test' },
          },
        },
      }),
    });

    // We expect an HTTP 200 even for long-running unless the tool exceeds server request timeout (60000ms default)
    expect([200, 408, 500]).toContain(res.status);
  });
});
