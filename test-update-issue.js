#!/usr/bin/env node

import fetch from 'node-fetch';

async function testUpdateIssue() {
  const url = 'http://localhost:3457/mcp';

  // Test updating an issue to done
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'huly_update_issue',
      arguments: {
        issue_identifier: 'HULLY-190',
        field: 'status',
        value: 'done',
      },
    },
    id: 1,
  };

  console.log('Testing update_issue with:', JSON.stringify(request.params, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testUpdateIssue();
