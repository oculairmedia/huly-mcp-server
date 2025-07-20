#!/usr/bin/env node

import { spawn } from 'child_process';
import fetch from 'node-fetch';

// Set environment variables
process.env.HULY_MCP_EMAIL = 'emanuvaderland@gmail.com';
process.env.HULY_MCP_PASSWORD = 'k2a8yy7sFWVZ6eL';
process.env.HULY_MCP_WORKSPACE = 'agentspace';

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        console.log('✅ Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

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

async function createTestProject() {
  const timestamp = Date.now();
  const projectName = `Test Status Project ${timestamp}`;
  const projectIdentifier = `TST${timestamp}`.substring(0, 5).toUpperCase();

  console.log(`\nCreating test project: ${projectName} (${projectIdentifier})`);

  const result = await callMCPTool('huly_create_project', {
    name: projectName,
    description: 'Test project for status update verification',
    identifier: projectIdentifier,
  });

  console.log('✅ Project created successfully');
  return projectIdentifier;
}

async function createTestIssue(projectIdentifier) {
  console.log(`\nCreating test issue in project ${projectIdentifier}`);

  const result = await callMCPTool('huly_create_issue', {
    project_identifier: projectIdentifier,
    title: 'Test Issue for Status Updates',
    description: 'This issue will be used to test all status transitions',
    priority: 'medium',
  });

  // Extract issue identifier from the response
  const text = result.content[0].text;
  const match = text.match(/Created issue ([A-Z0-9]+-\d+)/);
  const issueIdentifier = match ? match[1] : null;

  if (!issueIdentifier) {
    throw new Error('Failed to extract issue identifier from response');
  }

  console.log(`✅ Issue created: ${issueIdentifier}`);
  return issueIdentifier;
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

async function runAllTests(serverProcess) {
  try {
    // Create test project
    const projectIdentifier = await createTestProject();

    // Create test issue
    const issueIdentifier = await createTestIssue(projectIdentifier);

    // Wait a moment for everything to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusesToTest = [
      'backlog',
      'todo',
      'in-progress',
      'done',
      'canceled',
      'Todo', // Test case sensitivity
      'In Progress', // Test with space
      'DONE', // Test uppercase
      'Backlog', // Test going back to backlog
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
  } catch (error) {
    console.error('Test setup error:', error.message);
  }

  // Clean up - kill the server
  console.log('\nStopping server...');
  serverProcess.kill('SIGTERM');
}

async function main() {
  console.log('Starting MCP server...');

  // Start the server
  const serverProcess = spawn('npm', ['run', 'start:http'], {
    stdio: 'pipe',
    detached: false,
  });

  let serverOutput = '';

  serverProcess.stdout.on('data', (data) => {
    serverOutput += data.toString();
    // Only log startup messages
    if (!serverOutput.includes('Server started')) {
      process.stdout.write(data);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  serverProcess.on('exit', (code) => {
    console.log(`\nServer process exited with code ${code}`);
    process.exit(code || 0);
  });

  // Wait for server to be ready
  console.log('Waiting for server to be ready...');
  const serverReady = await waitForServer('http://localhost:3457');

  if (!serverReady) {
    console.error('❌ Server failed to start after 30 seconds');
    serverProcess.kill('SIGTERM');
    process.exit(1);
  }

  // Run the tests
  try {
    await runAllTests(serverProcess);
  } catch (error) {
    console.error('Test error:', error);
    serverProcess.kill('SIGTERM');
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, cleaning up...');
  process.exit(0);
});

// Run the main function
main().catch(console.error);
