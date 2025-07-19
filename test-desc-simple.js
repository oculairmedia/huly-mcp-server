#!/usr/bin/env node
import fetch from 'node-fetch';

async function test() {
  // Call list_issues to see what descriptions look like
  const response = await fetch('http://localhost:3457/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'huly_list_issues',
        arguments: {
          project_identifier: 'HULLY',
          limit: 3,
        },
      },
      id: 1,
    }),
  });

  const result = await response.json();

  if (result.error) {
    console.error('Error:', result.error);
    return;
  }

  // Parse the text response to find description info
  const text = result.result.content[0].text;
  console.log('Raw response:', text);

  // Now create an issue with description and check it
  const createResponse = await fetch('http://localhost:3457/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'huly_create_issue',
        arguments: {
          project_identifier: 'HULLY',
          title: 'Test Issue for Description Analysis',
          description: 'This is a test description to see how it is stored',
          priority: 'medium',
        },
      },
      id: 2,
    }),
  });

  const createResult = await createResponse.json();
  console.log('\nCreate result:', createResult);

  // Extract issue ID from the result
  const match = createResult.result?.content?.[0]?.text?.match(/HULLY-(\d+)/);
  if (match) {
    const issueId = match[0];
    console.log('\nCreated issue:', issueId);

    // Now try to get details of this issue
    const detailsResponse = await fetch('http://localhost:3457/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'huly_get_issue_details',
          arguments: {
            issue_identifier: issueId,
          },
        },
        id: 3,
      }),
    });

    const detailsResult = await detailsResponse.json();
    console.log('\nGet details result:', JSON.stringify(detailsResult, null, 2));
  }
}

test().catch(console.error);
