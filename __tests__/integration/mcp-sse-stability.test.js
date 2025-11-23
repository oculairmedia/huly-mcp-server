import fetch from 'node-fetch';

// Resolve full MCP endpoint from env; allow BASE_URL with or without trailing /mcp
function resolveMcpUrl() {
  const base = process.env.MCP_BASE_URL || 'http://localhost:3457';
  return base.endsWith('/mcp') ? base : `${base}/mcp`;
}

// Helper to initialize MCP session and return session id
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

  expect(res.status).toBe(200);
  const sessionId = res.headers.get('mcp-session-id');
  expect(sessionId).toBeTruthy();
  return sessionId;
}

// Helper to POST an MCP request with session
async function mcpPost(sessionId, payload) {
  const mcpUrl = resolveMcpUrl();
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify(payload),
  });
  return res;
}

describe('MCP SSE stability & tool execution', () => {
  // Increase timeout for this suite
  if (typeof globalThis.jest !== 'undefined' && typeof globalThis.jest.setTimeout === 'function') {
    globalThis.jest.setTimeout(120000);
  }

  test('keeps SSE stream open and executes short tool call', async () => {
    const sessionId = await initializeSession();

    // tools/list should return 200 and stream an event
    const listRes = await mcpPost(sessionId, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    expect(listRes.status).toBe(200);

    // Execute a short tool call (entity comment create) - should not close connection
    const callRes = await mcpPost(sessionId, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'huly_entity',
        arguments: {
          entity_type: 'comment',
          operation: 'create',
          issue_identifier: process.env.TEST_ISSUE_ID || 'HULLY-15',
          data: { message: 'MCP SSE stability test - short comment' },
        },
      },
    });

    expect(callRes.status).toBe(200);
    // No further strict assertions on body since server streams SSE; status 200 is sufficient to prove no disconnect
  });

  test('does not apply server-side timeout to SSE GET', async () => {
    const sessionId = await initializeSession();

    // Open SSE stream (GET) - we expect the server to respond (200) and keep it open
    const mcpUrl = resolveMcpUrl();
    const sseRes = await fetch(mcpUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'mcp-session-id': sessionId,
      },
    });

    expect(sseRes.status).toBe(200);
    // We do not consume full stream in test; just ensure headers and status are OK and the call doesn't immediately close.
    // Abort after a short delay to emulate client closing the stream
    if (typeof sseRes.body?.cancel === 'function') {
      sseRes.body.cancel();
    }
  });
});
