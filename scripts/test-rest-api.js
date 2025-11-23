#!/usr/bin/env node
/**
 * REST API Integration Test
 * Tests the REST API endpoints to ensure they're working correctly
 */

import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PORT = process.env.TEST_PORT || '3457';
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = `${BASE_URL}/api`;

let serverProcess = null;

/**
 * Start the MCP server with HTTP transport
 */
async function startServer() {
  console.log('🚀 Starting MCP server for REST API testing...');
  
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['index.js', '--transport=http'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: PORT,
        LOG_LEVEL: 'error', // Reduce noise during testing
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('HTTP transport started')) {
        console.log(`✅ Server started on port ${PORT}`);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('Failed')) {
        console.error('❌ Server error:', error);
        reject(new Error(error));
      }
    });

    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Stop the MCP server
 */
async function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log('🛑 Stopping server...');
    serverProcess.kill('SIGTERM');
    
    return new Promise((resolve) => {
      serverProcess.on('exit', () => {
        console.log('✅ Server stopped');
        resolve();
      });
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
          resolve();
        }
      }, 5000);
    });
  }
}

/**
 * Check if server is healthy
 */
async function checkHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    console.log('🏥 Health check:', data.status);
    return response.ok && data.status === 'healthy';
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
}

/**
 * Test REST API health endpoint
 */
async function testApiHealth() {
  console.log('\n📋 Testing API health endpoint...');
  
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ API health check passed');
      console.log(`   Service: ${data.data.service}`);
      console.log(`   Tool count: ${data.data.toolCount}`);
      return true;
    } else {
      console.log('❌ API health check failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ API health check error:', error.message);
    return false;
  }
}

/**
 * Test tool listing endpoint
 */
async function testListTools() {
  console.log('\n📋 Testing tool listing...');
  
  try {
    const response = await fetch(`${API_URL}/tools`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Tool listing passed');
      console.log(`   Found ${data.data.count} tools`);
      console.log(`   Categories: ${data.data.categories.join(', ')}`);
      return true;
    } else {
      console.log('❌ Tool listing failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Tool listing error:', error.message);
    return false;
  }
}

/**
 * Test tool execution
 */
async function testToolExecution() {
  console.log('\n📋 Testing tool execution...');
  
  try {
    const response = await fetch(`${API_URL}/tools/huly_query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          entity_type: 'project',
          mode: 'list',
          options: {
            limit: 5,
          },
        },
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Tool execution passed');
      console.log(`   Tool: ${data.data.toolName}`);
      console.log(`   Execution time: ${data.data.executionTime}ms`);
      return true;
    } else {
      console.log('❌ Tool execution failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Tool execution error:', error.message);
    return false;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n📋 Testing error handling...');
  
  try {
    const response = await fetch(`${API_URL}/tools/invalid_tool_name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {}
      })
    });
    
    const data = await response.json();
    
    if (response.status === 404 && !data.success && data.error.code === 'TOOL_NOT_FOUND') {
      console.log('✅ Error handling passed');
      console.log(`   Error code: ${data.error.code}`);
      console.log(`   Status: ${response.status}`);
      return true;
    } else {
      console.log('❌ Error handling failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Error handling test error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting REST API Integration Tests\n');
  
  const tests = [
    { name: 'Health Check', fn: checkHealth },
    { name: 'API Health', fn: testApiHealth },
    { name: 'List Tools', fn: testListTools },
    { name: 'Tool Execution', fn: testToolExecution },
    { name: 'Error Handling', fn: testErrorHandling },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} threw error:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  return failed === 0;
}

/**
 * Main test runner
 */
async function main() {
  try {
    // Start server
    await startServer();
    
    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests
    const success = await runTests();
    
    // Stop server
    await stopServer();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    
    // Ensure server is stopped
    await stopServer();
    
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  await stopServer();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  await stopServer();
  process.exit(1);
});

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
