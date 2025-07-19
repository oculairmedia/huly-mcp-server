/**
 * Jest Global Setup
 * 
 * This file is run once before all test suites
 */

import { jest } from '@jest/globals';

// Import test setup utilities
import './__tests__/setup/testSetup.js';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.HULY_URL = 'https://test.huly.io';
process.env.HULY_EMAIL = 'test@example.com';
process.env.HULY_PASSWORD = 'testpassword';
process.env.HULY_WORKSPACE = 'testworkspace';

// Increase timeout for all tests
jest.setTimeout(10000);

// Global test helpers
global.testHelpers = {
  // Wait for async condition
  waitFor: async (condition, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timeout waiting for condition');
  },
  
  // Delay execution
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};