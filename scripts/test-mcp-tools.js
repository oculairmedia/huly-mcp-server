#!/usr/bin/env node
/* eslint-disable no-unused-vars */
/**
 * Automated test script for MCP tools
 * Tests all tools and reports which ones are working/broken
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables
config({ path: join(projectRoot, '.env') });

const PORT = process.env.TEST_PORT || '3458';
const MCP_URL = `http://localhost:${PORT}/mcp`;
// Generate unique project identifier using last 4 digits of timestamp
const timestamp = Date.now();
const TEST_PROJECT_IDENTIFIER = `T${timestamp.toString().slice(-4)}`;
const TEST_PROJECT_NAME = `MCP Test ${timestamp}`;

let serverProcess = null;

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

// Helper function to make MCP requests
async function callMCPTool(method, params = {}) {
  try {
    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: `tools/call`,
        params: {
          name: method,
          arguments: params,
        },
        id: Date.now(),
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    return result.result;
  } catch (error) {
    throw error;
  }
}

// Test functions for each tool
async function testListProjects() {
  console.log('\n🧪 Testing list_projects...');
  try {
    const result = await callMCPTool('huly_list_projects');
    console.log('✅ list_projects: PASSED');
    console.log(`   Found projects in workspace`);
    testResults.passed.push('list_projects');
    return true;
  } catch (error) {
    console.log('❌ list_projects: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'list_projects', error: error.message });
    return false;
  }
}

async function testCreateProject() {
  console.log('\n🧪 Testing create_project...');
  try {
    const result = await callMCPTool('huly_create_project', {
      name: TEST_PROJECT_NAME,
      identifier: TEST_PROJECT_IDENTIFIER,
      description: 'Automated test project for MCP tools validation',
    });
    console.log('✅ create_project: PASSED');
    console.log(`   Created project: ${TEST_PROJECT_IDENTIFIER}`);
    testResults.passed.push('create_project');
    return true;
  } catch (error) {
    console.log('❌ create_project: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'create_project', error: error.message });

    // Check if project already exists
    if (error.message.includes('already exists')) {
      console.log('   ℹ️  Using existing project for further tests');
      return 'exists';
    }
    return false;
  }
}

async function testListIssues() {
  console.log('\n🧪 Testing list_issues...');
  try {
    const result = await callMCPTool('huly_list_issues', {
      project_identifier: 'HULLY',
      limit: 5,
    });
    console.log('✅ list_issues: PASSED');
    testResults.passed.push('list_issues');
    return true;
  } catch (error) {
    console.log('❌ list_issues: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'list_issues', error: error.message });
    return false;
  }
}

async function testCreateIssue() {
  console.log('\n🧪 Testing create_issue...');
  try {
    const result = await callMCPTool('huly_create_issue', {
      project_identifier: 'HULLY',
      title: 'Automated Test Issue',
      description: 'This issue was created by the automated test script',
      priority: 'medium',
    });
    console.log('✅ create_issue: PASSED');

    // Extract issue identifier from result
    const match = result.content[0].text.match(/HULLY-(\d+)/);
    const issueId = match ? match[0] : null;
    console.log(`   Created issue: ${issueId}`);
    testResults.passed.push('create_issue');
    return issueId;
  } catch (error) {
    console.log('❌ create_issue: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'create_issue', error: error.message });
    return null;
  }
}

async function testUpdateIssue(issueId) {
  console.log('\n🧪 Testing update_issue...');
  if (!issueId) {
    console.log('⚠️  update_issue: SKIPPED (no issue to update)');
    testResults.warnings.push('update_issue skipped - no issue created');
    return false;
  }

  try {
    const result = await callMCPTool('huly_update_issue', {
      issue_identifier: issueId,
      field: 'title',
      value: 'Automated Test Issue - Updated',
    });
    console.log('✅ update_issue: PASSED');
    console.log(`   Updated issue: ${issueId}`);
    testResults.passed.push('update_issue');
    return true;
  } catch (error) {
    console.log('❌ update_issue: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'update_issue', error: error.message });
    return false;
  }
}

async function testSearchIssues() {
  console.log('\n🧪 Testing search_issues...');
  try {
    const result = await callMCPTool('huly_search_issues', {
      query: 'test',
      project_identifier: 'HULLY',
    });
    console.log('✅ search_issues: PASSED');
    testResults.passed.push('search_issues');
    return true;
  } catch (error) {
    console.log('❌ search_issues: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'search_issues', error: error.message });
    return false;
  }
}

async function testGetIssueDetails(issueId) {
  console.log('\n🧪 Testing get_issue_details...');
  if (!issueId) {
    console.log('⚠️  get_issue_details: SKIPPED (no issue to get)');
    testResults.warnings.push('get_issue_details skipped - no issue created');
    return false;
  }

  try {
    const result = await callMCPTool('huly_get_issue_details', {
      issue_identifier: issueId,
    });
    console.log('✅ get_issue_details: PASSED');
    testResults.passed.push('get_issue_details');
    return true;
  } catch (error) {
    console.log('❌ get_issue_details: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'get_issue_details', error: error.message });
    return false;
  }
}

async function testCreateSubissue(parentIssueId) {
  console.log('\n🧪 Testing create_subissue...');
  if (!parentIssueId) {
    console.log('⚠️  create_subissue: SKIPPED (no parent issue)');
    testResults.warnings.push('create_subissue skipped - no parent issue');
    return false;
  }

  try {
    const result = await callMCPTool('huly_create_subissue', {
      parent_issue_identifier: parentIssueId,
      title: 'Automated Test Subissue',
      description: 'This subissue was created by the automated test script',
      priority: 'low',
    });
    console.log('✅ create_subissue: PASSED');
    testResults.passed.push('create_subissue');
    return true;
  } catch (error) {
    console.log('❌ create_subissue: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'create_subissue', error: error.message });
    return false;
  }
}

async function testListComponents() {
  console.log('\n🧪 Testing list_components...');
  try {
    const result = await callMCPTool('huly_list_components', {
      project_identifier: 'HULLY',
    });
    console.log('✅ list_components: PASSED');
    testResults.passed.push('list_components');
    return true;
  } catch (error) {
    console.log('❌ list_components: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'list_components', error: error.message });
    return false;
  }
}

async function testCreateComponent() {
  console.log('\n🧪 Testing create_component...');
  try {
    const result = await callMCPTool('huly_create_component', {
      project_identifier: 'HULLY',
      label: 'Test Component',
      description: 'Component created by automated test',
    });
    console.log('✅ create_component: PASSED');
    testResults.passed.push('create_component');
    return true;
  } catch (error) {
    console.log('❌ create_component: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'create_component', error: error.message });
    return false;
  }
}

async function testListMilestones() {
  console.log('\n🧪 Testing list_milestones...');
  try {
    const result = await callMCPTool('huly_list_milestones', {
      project_identifier: 'HULLY',
    });
    console.log('✅ list_milestones: PASSED');
    testResults.passed.push('list_milestones');
    return true;
  } catch (error) {
    console.log('❌ list_milestones: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'list_milestones', error: error.message });
    return false;
  }
}

async function testCreateMilestone() {
  console.log('\n🧪 Testing create_milestone...');
  try {
    // Test with correct date format
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const dateStr = futureDate.toISOString().split('T')[0];

    const result = await callMCPTool('huly_create_milestone', {
      project_identifier: 'HULLY',
      label: 'Test Milestone',
      description: 'Milestone created by automated test',
      target_date: dateStr,
    });
    console.log('✅ create_milestone: PASSED');
    testResults.passed.push('create_milestone');

    // Test with incorrect date format
    console.log('   Testing error handling...');
    try {
      await callMCPTool('huly_create_milestone', {
        project_identifier: 'HULLY',
        label: 'Bad Date Test',
        target_date: 'Jan 31 2025',
      });
      console.log('   ⚠️  Should have failed with bad date format');
      testResults.warnings.push('create_milestone did not validate date format');
    } catch (error) {
      console.log('   ✅ Correctly rejected invalid date format');
    }

    return true;
  } catch (error) {
    console.log('❌ create_milestone: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'create_milestone', error: error.message });
    return false;
  }
}

async function testListComments(issueId) {
  console.log('\n🧪 Testing list_comments...');
  if (!issueId) {
    console.log('⚠️  list_comments: SKIPPED (no issue)');
    testResults.warnings.push('list_comments skipped - no issue created');
    return false;
  }

  try {
    const result = await callMCPTool('huly_list_comments', {
      issue_identifier: issueId,
    });
    console.log('✅ list_comments: PASSED');
    testResults.passed.push('list_comments');
    return true;
  } catch (error) {
    console.log('❌ list_comments: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'list_comments', error: error.message });
    return false;
  }
}

async function testCreateComment(issueId) {
  console.log('\n🧪 Testing create_comment...');
  if (!issueId) {
    console.log('⚠️  create_comment: SKIPPED (no issue)');
    testResults.warnings.push('create_comment skipped - no issue created');
    return false;
  }

  try {
    const result = await callMCPTool('huly_create_comment', {
      issue_identifier: issueId,
      message: 'This comment was created by the automated test script',
    });
    console.log('✅ create_comment: PASSED');
    testResults.passed.push('create_comment');
    return true;
  } catch (error) {
    console.log('❌ create_comment: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'create_comment', error: error.message });
    return false;
  }
}

async function testListGithubRepositories() {
  console.log('\n🧪 Testing list_github_repositories...');
  try {
    const result = await callMCPTool('huly_list_github_repositories');
    console.log('✅ list_github_repositories: PASSED');
    testResults.passed.push('list_github_repositories');
    return true;
  } catch (error) {
    console.log('❌ list_github_repositories: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'list_github_repositories', error: error.message });
    return false;
  }
}

async function testAssignRepository() {
  console.log('\n🧪 Testing assign_repository_to_project...');
  try {
    // This might fail if already assigned, which is OK
    const result = await callMCPTool('huly_assign_repository_to_project', {
      project_identifier: 'HULLY',
      repository_name: 'oculairmedia/huly-mcp-server',
    });
    console.log('✅ assign_repository_to_project: PASSED');
    testResults.passed.push('assign_repository_to_project');
    return true;
  } catch (error) {
    if (error.message.includes('already assigned')) {
      console.log('⚠️  assign_repository_to_project: Already assigned');
      testResults.warnings.push('assign_repository_to_project - repository already assigned');
      return true;
    }
    console.log('❌ assign_repository_to_project: FAILED');
    console.log(`   Error: ${error.message}`);
    testResults.failed.push({ tool: 'assign_repository_to_project', error: error.message });
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('===========================================');
  console.log('🚀 MCP Tools Automated Test Suite');
  console.log('===========================================');
  console.log(`MCP URL: ${MCP_URL}`);
  console.log(`Starting tests at: ${new Date().toISOString()}`);

  let createdIssueId = null;

  // Run all tests
  await testListProjects();
  const projectCreated = await testCreateProject();
  await testListIssues();
  createdIssueId = await testCreateIssue();
  await testUpdateIssue(createdIssueId);
  await testSearchIssues();
  await testGetIssueDetails(createdIssueId);
  await testCreateSubissue(createdIssueId);
  await testListComponents();
  await testCreateComponent();
  await testListMilestones();
  await testCreateMilestone();
  await testListComments(createdIssueId);
  await testCreateComment(createdIssueId);
  await testListGithubRepositories();
  await testAssignRepository();

  // Print summary
  console.log('\n===========================================');
  console.log('📊 TEST SUMMARY');
  console.log('===========================================');
  console.log(`✅ Passed: ${testResults.passed.length} tools`);
  console.log(`❌ Failed: ${testResults.failed.length} tools`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

  if (testResults.passed.length > 0) {
    console.log('\n✅ PASSED TOOLS:');
    testResults.passed.forEach((tool) => {
      console.log(`   - ${tool}`);
    });
  }

  if (testResults.failed.length > 0) {
    console.log('\n❌ FAILED TOOLS:');
    testResults.failed.forEach(({ tool, error }) => {
      console.log(`   - ${tool}: ${error}`);
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    testResults.warnings.forEach((warning) => {
      console.log(`   - ${warning}`);
    });
  }

  console.log('\n===========================================');
  console.log(`Tests completed at: ${new Date().toISOString()}`);
  console.log('===========================================');

  // Exit with error code if any tests failed
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Start the MCP server
async function startServer() {
  console.log('🚀 Starting MCP server...');

  return new Promise((resolve, reject) => {
    // Set up environment variables
    const env = {
      ...process.env,
      PORT,
      NODE_ENV: 'test',
    };

    // Start the server
    serverProcess = spawn('npm', ['run', 'start:http'], {
      cwd: projectRoot,
      env,
      detached: false,
    });

    let serverStarted = false;
    let errorOutput = '';

    // Handle server output
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('HTTP transport started') && !serverStarted) {
        serverStarted = true;
        console.log('✅ MCP server started successfully');
        setTimeout(() => resolve(), 1000); // Give it a second to fully initialize
      }
    });

    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    serverProcess.on('exit', (code, signal) => {
      if (!serverStarted) {
        reject(new Error(`Server exited unexpectedly: ${errorOutput}`));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverStarted) {
        if (serverProcess) {
          serverProcess.kill();
        }
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

// Stop the MCP server
async function stopServer() {
  if (serverProcess) {
    console.log('\n🛑 Stopping MCP server...');
    serverProcess.kill('SIGTERM');

    // Give it time to shut down gracefully
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Force kill if still running
    try {
      process.kill(serverProcess.pid, 0);
      serverProcess.kill('SIGKILL');
    } catch (e) {
      // Process already dead, which is what we want
    }

    serverProcess = null;
    console.log('✅ MCP server stopped');
  }
}

// Check if MCP server is running
async function checkServerHealth() {
  try {
    const healthUrl = MCP_URL.replace('/mcp', '/health');
    const response = await fetch(healthUrl);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Export test functions for reuse
export { callMCPTool, checkServerHealth, startServer, stopServer, testResults };

// Run the tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      // Check if server is already running
      const isRunning = await checkServerHealth();

      if (!isRunning) {
        // Start the server
        try {
          await startServer();
        } catch (error) {
          console.error('❌ Failed to start MCP server:', error.message);
          process.exit(1);
        }
      } else {
        console.log('ℹ️  Using existing MCP server');
      }

      // Run all tests
      await runAllTests();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    } finally {
      // Always stop the server if we started it
      if (serverProcess) {
        await stopServer();
      }
    }
  })();
}
