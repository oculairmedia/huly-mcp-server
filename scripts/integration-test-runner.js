#!/usr/bin/env node
/**
 * Enhanced Integration Test Runner
 * Comprehensive testing with all the features we need
 */

import { testConfig } from './test-config.js';
import { TestDataManager } from './test-data-manager.js';
import { TestReporter } from './test-reporter.js';
import { testScenarios } from './test-scenarios.js';
import fetch from 'node-fetch';

class IntegrationTestRunner {
  constructor() {
    this.config = testConfig;
    this.dataManager = new TestDataManager();
    this.reporter = new TestReporter(testConfig);
    this.environment = process.env.TEST_ENVIRONMENT || 'local';
    this.suite = process.env.TEST_SUITE || 'smoke';
  }

  // Enhanced MCP call with retry logic
  async callMCPTool(method, params = {}, options = {}) {
    const { retries = this.config.retry.maxAttempts, delay = this.config.retry.delay } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const start = Date.now();
        const envConfig = this.config.environments[this.environment];
        
        const response = await fetch(envConfig.mcp_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: method, arguments: params },
            id: Date.now()
          }),
          timeout: envConfig.timeout
        });

        const duration = Date.now() - start;
        const result = await response.json();
        
        // Record performance
        this.reporter.recordPerformance(method, duration);
        
        if (result.error) {
          throw new Error(result.error.message || JSON.stringify(result.error));
        }
        
        return result.result;
      } catch (error) {
        if (attempt < retries && this.isRetryableError(error)) {
          console.log(`   Retry ${attempt}/${retries} after ${delay}ms...`);
          await this.sleep(delay * Math.pow(this.config.retry.backoff, attempt - 1));
        } else {
          throw error;
        }
      }
    }
  }

  // Check if error is retryable
  isRetryableError(error) {
    return this.config.retry.retryableErrors.some(e => 
      error.message.includes(e) || error.code === e
    );
  }

  // Helper sleep function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Run a single test scenario
  async runTestScenario(category, name, scenario) {
    const start = Date.now();
    console.log(`\n🧪 ${category}/${name}: ${scenario.name}`);
    
    try {
      const result = await scenario.test(this.callMCPTool.bind(this));
      const duration = Date.now() - start;
      
      if (scenario.expectError) {
        // Test expected to fail
        this.reporter.recordTest(`${category}/${name}`, 'failed', {
          duration,
          error: 'Test should have thrown an error but succeeded'
        });
      } else {
        // Test passed
        this.reporter.recordTest(`${category}/${name}`, 'passed', {
          duration,
          result
        });
      }
    } catch (error) {
      const duration = Date.now() - start;
      
      if (scenario.expectError) {
        // Expected error occurred
        this.reporter.recordTest(`${category}/${name}`, 'passed', {
          duration,
          expectedError: error.message
        });
      } else {
        // Unexpected error
        this.reporter.recordTest(`${category}/${name}`, 'failed', {
          duration,
          error: error.message
        });
      }
    }
  }

  // Run all test scenarios
  async runAllTests() {
    console.log('='.repeat(60));
    console.log('🚀 Enhanced Integration Test Suite');
    console.log('='.repeat(60));
    console.log(`Environment: ${this.environment}`);
    console.log(`Test Suite: ${this.suite}`);
    console.log(`Started: ${new Date().toISOString()}`);
    
    const categoriesToRun = this.config.categories[this.suite] || ['basic'];
    
    for (const [category, scenarios] of Object.entries(testScenarios)) {
      if (!categoriesToRun.includes(category)) continue;
      
      console.log(`\n\n📂 Category: ${category.toUpperCase()}`);
      console.log('-'.repeat(40));
      
      for (const [name, scenario] of Object.entries(scenarios)) {
        await this.runTestScenario(category, name, scenario);
      }
    }
    
    // Generate reports
    this.reporter.generateSummary();
    this.reporter.saveResults();
    
    // Cleanup test data
    if (process.env.TEST_CLEANUP !== 'false') {
      await this.dataManager.cleanup();
    }
    
    // Exit with appropriate code
    process.exit(this.reporter.results.summary.failed > 0 ? 1 : 0);
  }
}

// Run the tests
const runner = new IntegrationTestRunner();
runner.runAllTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});