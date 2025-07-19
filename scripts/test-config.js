/**
 * Integration Test Configuration
 * Environment-specific settings for different test scenarios
 */

export const testConfig = {
  // Test environments
  environments: {
    local: {
      name: 'Local Development',
      mcp_url: 'http://localhost:3458/mcp',
      timeout: 10000,
      retries: 3,
    },
    docker: {
      name: 'Docker Container',
      mcp_url: 'http://localhost:3457/mcp',
      timeout: 15000,
      retries: 2,
    },
    ci: {
      name: 'CI/CD Pipeline',
      mcp_url: process.env.CI_MCP_URL || 'http://localhost:3000/mcp',
      timeout: 30000,
      retries: 5,
    },
  },

  // Test categories to run
  categories: {
    smoke: ['basic', 'critical'],
    full: ['basic', 'critical', 'edge', 'performance', 'concurrency'],
    quick: ['basic'],
    nightly: ['basic', 'critical', 'edge', 'performance', 'concurrency', 'stress'],
  },

  // Logging configuration
  logging: {
    verbose: process.env.TEST_VERBOSE === 'true',
    saveResults: process.env.TEST_SAVE_RESULTS === 'true',
    resultsPath: './test-results',
    screenshots: process.env.TEST_SCREENSHOTS === 'true',
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'NetworkError'],
  },

  // Performance thresholds
  performance: {
    api: {
      list: 2000, // ms
      create: 3000, // ms
      update: 2000, // ms
      search: 5000, // ms
    },
  },
};
