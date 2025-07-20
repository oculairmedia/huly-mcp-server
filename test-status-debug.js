#!/usr/bin/env node

import fetch from 'node-fetch';

async function testStatusUpdate() {
  const url = 'http://localhost:3457/mcp';

  // Test updating an issue status
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'huly_update_issue',
      arguments: {
        issue_identifier: 'HULLY-190',
        field: 'status',
        value: 'Backlog',
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

    if (result.error) {
      console.log('\nError details:');
      console.log('Code:', result.error.code);
      console.log('Message:', result.error.message);
      if (result.error.data) {
        console.log('Data:', JSON.stringify(result.error.data, null, 2));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testStatusUpdate();
