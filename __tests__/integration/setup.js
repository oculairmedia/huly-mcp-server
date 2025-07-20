import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
const testEnvPath = join(__dirname, '../../.env.test');
const envPath = join(__dirname, '../../.env');

export async function setupTestEnvironment() {
  // Check if test env exists, otherwise use regular env
  try {
    await fs.access(testEnvPath);
    dotenv.config({ path: testEnvPath });
  } catch {
    dotenv.config({ path: envPath });
  }

  // Ensure required environment variables are set
  const required = ['HULY_URL', 'HULY_EMAIL', 'HULY_PASSWORD', 'HULY_WORKSPACE'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for integration tests: ${missing.join(', ')}\n` +
        'Please create a .env.test file with test credentials or set them in your environment.'
    );
  }

  // Set test-specific overrides
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

  return {
    url: process.env.HULY_URL,
    email: process.env.HULY_EMAIL,
    password: process.env.HULY_PASSWORD,
    workspace: process.env.HULY_WORKSPACE,
  };
}

// Test data generators
export function generateTestProjectIdentifier() {
  return `TEST${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

export function generateTestIssueData(overrides = {}) {
  return {
    title: `Test Issue ${Date.now()}`,
    description: 'Integration test issue',
    priority: 'medium',
    ...overrides,
  };
}

export function generateTestTemplateData(overrides = {}) {
  return {
    title: `Test Template ${Date.now()}`,
    description: 'Integration test template',
    priority: 'medium',
    ...overrides,
  };
}

// Cleanup utilities
const createdResources = {
  projects: new Set(),
  issues: new Set(),
  templates: new Set(),
  components: new Set(),
  milestones: new Set(),
};

export function trackResource(type, identifier) {
  if (createdResources[type]) {
    createdResources[type].add(identifier);
  }
}

export async function cleanupTestResources(client, services) {
  const { issueService, projectService, templateService, deletionService } = services;

  // Delete tracked issues
  for (const issueId of createdResources.issues) {
    try {
      await deletionService.deleteIssue(client, issueId, { force: true });
    } catch (error) {
      console.warn(`Failed to cleanup issue ${issueId}:`, error.message);
    }
  }

  // Delete tracked templates
  for (const templateId of createdResources.templates) {
    try {
      await templateService.deleteTemplate(client, templateId);
    } catch (error) {
      console.warn(`Failed to cleanup template ${templateId}:`, error.message);
    }
  }

  // Delete tracked projects (this will cascade delete everything inside)
  for (const projectId of createdResources.projects) {
    try {
      await deletionService.deleteProject(client, projectId, { force: true });
    } catch (error) {
      console.warn(`Failed to cleanup project ${projectId}:`, error.message);
    }
  }

  // Clear tracking
  Object.values(createdResources).forEach((set) => set.clear());
}

// Test utilities
export async function waitForCondition(conditionFn, timeout = 5000, interval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
}

export function expectToBeIssue(issue) {
  expect(issue).toHaveProperty('_id');
  expect(issue).toHaveProperty('identifier');
  expect(issue).toHaveProperty('title');
  expect(issue).toHaveProperty('status');
  expect(issue).toHaveProperty('priority');
}

export function expectToBeProject(project) {
  expect(project).toHaveProperty('_id');
  expect(project).toHaveProperty('identifier');
  expect(project).toHaveProperty('name');
}

export function expectToBeTemplate(template) {
  expect(template).toHaveProperty('_id');
  expect(template).toHaveProperty('title');
  expect(template).toHaveProperty('space');
}

// Mock utilities for testing error scenarios
export function createMockClient(overrides = {}) {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    createDoc: jest.fn().mockResolvedValue('mock-id'),
    update: jest.fn().mockResolvedValue(true),
    removeDoc: jest.fn().mockResolvedValue(true),
    removeCollection: jest.fn().mockResolvedValue(true),
    addCollection: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
}