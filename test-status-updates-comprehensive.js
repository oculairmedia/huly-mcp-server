#!/usr/bin/env node

import fetch from 'node-fetch';

async function callMCPTool(toolName, args) {
  const url = 'http://localhost:3457/mcp';

  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
    id: Date.now(),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(`MCP Error: ${result.error.message}`);
    }

    return result.result;
  } catch (error) {
    throw error;
  }
}

async function getIssueStatus(issueIdentifier) {
  const result = await callMCPTool('huly_get_issue_details', {
    issue_identifier: issueIdentifier,
  });

  // Extract status from the response text
  const text = result.content[0].text;
  const statusMatch = text.match(/\*\*Status\*\*: (.+)/);
  return statusMatch ? statusMatch[1] : null;
}

async function testStatusUpdate(issueIdentifier, newStatus) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing status update to: ${newStatus}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Step 1: Get current status
    console.log('1. Getting current status...');
    const beforeStatus = await getIssueStatus(issueIdentifier);
    console.log(`   Current status: ${beforeStatus}`);

    // Step 2: Update status
    console.log(`2. Updating status to "${newStatus}"...`);
    const updateResult = await callMCPTool('huly_update_issue', {
      issue_identifier: issueIdentifier,
      field: 'status',
      value: newStatus,
    });

    const updateText = updateResult.content[0].text;
    console.log(`   Update response: ${updateText.split('\n')[0]}`);

    // Step 3: Verify the change
    console.log('3. Verifying status change...');
    const afterStatus = await getIssueStatus(issueIdentifier);
    console.log(`   New status: ${afterStatus}`);

    // Step 4: Check if update was successful
    const success = afterStatus.toLowerCase() === newStatus.toLowerCase();

    if (success) {
      console.log(`   ✅ SUCCESS: Status changed from "${beforeStatus}" to "${afterStatus}"`);
    } else {
      console.log(`   ❌ FAILED: Status is "${afterStatus}", expected "${newStatus}"`);
      console.log(
        `      Before: "${beforeStatus}", After: "${afterStatus}", Expected: "${newStatus}"`
      );
    }

    return {
      success,
      beforeStatus,
      afterStatus,
      expectedStatus: newStatus,
    };
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runAllTests() {
  const issueIdentifier = 'HULLY-190';
  const statusesToTest = [
    'backlog',
    'todo',
    'in-progress',
    'done',
    'canceled',
    'Todo', // Test case sensitivity
    'In Progress', // Test with space
    'DONE', // Test uppercase
  ];

  console.log(`\nTesting status updates for issue: ${issueIdentifier}`);
  console.log(`Will test ${statusesToTest.length} different status values\n`);

  const results = [];

  for (const status of statusesToTest) {
    const result = await testStatusUpdate(issueIdentifier, status);
    results.push(result);

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.forEach((result, index) => {
      if (!result.success) {
        console.log(
          `- "${statusesToTest[index]}": ${result.error || `Expected "${result.expectedStatus}", got "${result.afterStatus}"`}`
        );
      }
    });
  }

  console.log(
    `\n${successful === results.length ? '✅ All tests passed!' : '❌ Some tests failed!'}`
  );
}

// Run the tests
runAllTests().catch(console.error);
