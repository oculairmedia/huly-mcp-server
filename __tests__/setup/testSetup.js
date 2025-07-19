/**
 * Test Setup Configuration
 * 
 * Common setup and utilities for all tests
 */

import { jest } from '@jest/globals';

// Global test configuration
global.testTimeout = 10000; // 10 seconds

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG_TESTS) {
    console.error = jest.fn();
    console.log = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Common test utilities
export const waitFor = async (condition, timeout = 5000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout waiting for condition');
};

export const mockEnvironment = (overrides = {}) => {
  const original = { ...process.env };
  
  Object.assign(process.env, {
    HULY_URL: 'https://test.huly.io',
    HULY_EMAIL: 'test@example.com',
    HULY_PASSWORD: 'testpassword',
    HULY_WORKSPACE: 'testworkspace',
    ...overrides
  });
  
  return () => {
    process.env = original;
  };
};

// Helper to create mock responses
export const createMockResponse = (content, isError = false) => {
  return {
    content: [{
      type: 'text',
      text: isError ? `❌ Error [TEST_ERROR]: ${content}` : content
    }]
  };
};

// Helper to create mock requests
export const createMockRequest = (toolName, args = {}) => {
  return {
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };
};

// Common test data generators
export const generateTestProject = (overrides = {}) => {
  const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    _id: id,
    _class: 'tracker:class:Project',
    name: `Test Project ${id}`,
    identifier: 'TEST',
    description: 'Test project description',
    defaultIssueStatus: 'tracker:status:Backlog',
    createdOn: Date.now(),
    modifiedOn: Date.now(),
    ...overrides
  };
};

export const generateTestIssue = (projectId, number = 1, overrides = {}) => {
  const id = `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    _id: id,
    _class: 'tracker:class:Issue',
    space: projectId,
    identifier: `TEST-${number}`,
    number: number,
    title: `Test Issue ${number}`,
    description: '',
    status: 'tracker:status:Backlog',
    priority: 'tracker:priority:Medium',
    createdOn: Date.now(),
    modifiedOn: Date.now(),
    ...overrides
  };
};

// Export error codes for tests
export const TEST_ERROR_CODES = {
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

// Helper to verify error responses
export const expectError = (response, errorCode, messagePattern) => {
  expect(response.content).toHaveLength(1);
  expect(response.content[0].type).toBe('text');
  
  const text = response.content[0].text;
  expect(text).toContain('❌ Error');
  expect(text).toContain(`[${errorCode}]`);
  
  if (messagePattern) {
    if (messagePattern instanceof RegExp) {
      expect(text).toMatch(messagePattern);
    } else {
      expect(text).toContain(messagePattern);
    }
  }
};

// Helper to verify success responses
export const expectSuccess = (response, messagePattern) => {
  expect(response.content).toHaveLength(1);
  expect(response.content[0].type).toBe('text');
  
  const text = response.content[0].text;
  expect(text).not.toContain('❌ Error');
  
  if (messagePattern) {
    if (messagePattern instanceof RegExp) {
      expect(text).toMatch(messagePattern);
    } else {
      expect(text).toContain(messagePattern);
    }
  }
};