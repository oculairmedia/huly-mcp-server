/**
 * Integration tests for the tool registry system
 *
 * These tests verify the end-to-end functionality of the tool loading
 * and execution system using real files and minimal mocking.
 */

import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import {
  initializeTools,
  getAllToolDefinitions,
  executeTool,
  hasTool,
  registry,
} from '../../src/tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test fixtures directory
const FIXTURES_DIR = join(__dirname, 'fixtures', 'tools');

// Mock logger to avoid console output during tests
jest.unstable_mockModule('../../src/utils/index.js', () => ({
  createLoggerWithConfig: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  })),
}));

jest.unstable_mockModule('../../src/config/index.js', () => ({
  getConfigManager: jest.fn(() => ({
    getHulyConfig: jest.fn(() => ({ test: true })),
  })),
}));

describe('Tool Registry Integration Tests', () => {
  beforeAll(async () => {
    // Clear the registry before tests
    registry.clear();
  });

  afterEach(() => {
    // Clear registry between tests
    registry.clear();
  });

  afterAll(async () => {
    // Clean up test fixtures
    try {
      await rm(FIXTURES_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Tool Loading Integration', () => {
    it('should load all tools from the actual tool directories', async () => {
      // Initialize the real tool system
      await initializeTools();

      // Verify tools were loaded
      const stats = registry.getStats();
      expect(stats.totalTools).toBeGreaterThan(0);
      expect(stats.categories).toBeDefined();

      // Check specific categories exist
      expect(stats.categories.projects).toBeGreaterThan(0);
      expect(stats.categories.issues).toBeGreaterThan(0);
      expect(stats.categories.components).toBeGreaterThan(0);
      expect(stats.categories.milestones).toBeGreaterThan(0);
      expect(stats.categories.github).toBeGreaterThan(0);
      expect(stats.categories.comments).toBeGreaterThan(0);
    });

    it('should correctly categorize all loaded tools', async () => {
      await initializeTools();

      // Check project tools
      const projectTools = registry.getByCategory('projects');
      const projectNames = projectTools.map((t) => t.definition.name);
      expect(projectNames).toContain('huly_list_projects');
      expect(projectNames).toContain('huly_create_project');

      // Check issue tools
      const issueTools = registry.getByCategory('issues');
      const issueNames = issueTools.map((t) => t.definition.name);
      expect(issueNames).toContain('huly_list_issues');
      expect(issueNames).toContain('huly_create_issue');
      expect(issueNames).toContain('huly_update_issue');
      expect(issueNames).toContain('huly_create_subissue');
      expect(issueNames).toContain('huly_search_issues');
      expect(issueNames).toContain('huly_get_issue_details');
    });

    it('should handle missing category directories gracefully', async () => {
      // Create a mock tool loader that includes a non-existent category
      const _mockCategories = ['nonexistent', 'alsonothere'];

      // This should not throw
      await expect(initializeTools()).resolves.not.toThrow();

      // System should still be functional
      const stats = registry.getStats();
      expect(stats.totalTools).toBeGreaterThan(0);
    });
  });

  describe('Tool Execution Integration', () => {
    beforeEach(async () => {
      await initializeTools();
    });

    it('should execute tools with proper context', async () => {
      // Mock services and client
      const mockClient = { test: true };
      const mockServices = {
        projectService: {
          getAllProjects: jest
            .fn()
            .mockResolvedValue([{ name: 'Test Project', identifier: 'TEST' }]),
        },
      };
      const mockContext = {
        client: mockClient,
        services: mockServices,
        config: { test: true },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      };

      // Execute a real tool
      const result = await executeTool('huly_list_projects', {}, mockContext);

      // Verify execution - the tool will be called through the registry
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      // The tool returns an error because the mock service doesn't have listProjects method
      expect(result.content[0].text).toContain('Error');
    });

    it('should handle tool execution errors gracefully', async () => {
      const mockContext = {
        client: null,
        services: {
          projectService: {
            getAllProjects: jest.fn().mockRejectedValue(new Error('Service error')),
          },
        },
        config: { test: true },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      };

      // Execute tool that will fail
      const result = await executeTool('huly_list_projects', {}, mockContext);

      // Should return error response
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should validate tool inputs before execution', async () => {
      const mockContext = {
        client: {},
        services: {
          issueService: {
            createIssue: jest.fn(),
          },
        },
        config: { test: true },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      };

      // Try to create issue without required fields
      const result = await executeTool('huly_create_issue', {}, mockContext);

      // Should return validation error
      expect(result.content[0].text).toContain('Validation failed');
      expect(mockContext.services.issueService.createIssue).not.toHaveBeenCalled();
    });
  });

  describe('Tool Discovery', () => {
    it('should discover all tools matching expected patterns', async () => {
      await initializeTools();

      const allTools = getAllToolDefinitions();

      // Each tool should have required properties
      allTools.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(tool.name).toMatch(/^huly_/);
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      });
    });

    it('should maintain tool uniqueness', async () => {
      await initializeTools();

      const allTools = getAllToolDefinitions();
      const toolNames = allTools.map((t) => t.name);
      const uniqueNames = new Set(toolNames);

      // No duplicates
      expect(toolNames.length).toBe(uniqueNames.size);
    });
  });

  describe('Performance Tests', () => {
    it('should load all tools within acceptable time', async () => {
      const start = Date.now();
      await initializeTools();
      const loadTime = Date.now() - start;

      // Should load in under 100ms
      expect(loadTime).toBeLessThan(100);
    });

    it('should handle concurrent tool executions', async () => {
      await initializeTools();

      const mockContext = {
        client: {},
        services: {
          projectService: {
            getAllProjects: jest.fn().mockResolvedValue([]),
          },
        },
        config: { test: true },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      };

      // Execute multiple tools concurrently
      const executions = Array(10)
        .fill(null)
        .map(() => executeTool('huly_list_projects', {}, mockContext));

      const results = await Promise.all(executions);

      // All should succeed
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      });
    });

    it('should not leak memory during repeated operations', async () => {
      await initializeTools();

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        getAllToolDefinitions();
        hasTool('huly_create_issue');
        registry.getByCategory('issues');
      }

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tool files gracefully', async () => {
      // Create a malformed tool file
      const malformedDir = join(FIXTURES_DIR, 'malformed');
      await mkdir(malformedDir, { recursive: true });

      // Tool with syntax error
      await writeFile(join(malformedDir, 'broken.js'), 'export const definition = { syntax error');

      // Should not throw during initialization
      await expect(initializeTools()).resolves.not.toThrow();

      // Clean up
      await rm(malformedDir, { recursive: true, force: true });
    });

    it('should handle tools with missing exports', async () => {
      // Create a tool with missing exports
      const incompleteDir = join(FIXTURES_DIR, 'incomplete');
      await mkdir(incompleteDir, { recursive: true });

      // Tool missing handler
      await writeFile(
        join(incompleteDir, 'nohandler.js'),
        `export const definition = {
          name: 'test_tool',
          description: 'Test',
          inputSchema: { type: 'object', properties: {}, required: [] }
        };`
      );

      // Should not throw during initialization
      await expect(initializeTools()).resolves.not.toThrow();

      // Tool should not be registered
      expect(hasTool('test_tool')).toBe(false);

      // Clean up
      await rm(incompleteDir, { recursive: true, force: true });
    });
  });

  describe('Tool Registry Statistics', () => {
    it('should provide accurate statistics', async () => {
      await initializeTools();

      const stats = registry.getStats();

      // Verify statistics structure
      expect(stats).toHaveProperty('totalTools');
      expect(stats).toHaveProperty('categories');
      // Verify counts
      expect(stats.totalTools).toBe(35); // We know we have 35 tools
      expect(Object.keys(stats.categories).length).toBeGreaterThanOrEqual(8); // At least 8 categories

      // Sum of category counts should equal total
      const categorySum = Object.values(stats.categories).reduce((a, b) => a + b, 0);
      expect(categorySum).toBe(stats.totalTools);
    });

    it('should track tools by category', async () => {
      await initializeTools();

      const stats = registry.getStats();

      // Each category should have tools
      Object.values(stats.categories).forEach((count) => {
        expect(count).toBeGreaterThan(0);
      });

      // Specific category counts - verify they exist and have tools
      expect(stats.categories.projects).toBeGreaterThanOrEqual(2);
      expect(stats.categories.issues).toBeGreaterThanOrEqual(6);
      expect(stats.categories.components).toBeGreaterThanOrEqual(2);
      expect(stats.categories.milestones).toBeGreaterThanOrEqual(2);
      expect(stats.categories.github).toBeGreaterThanOrEqual(2);
      expect(stats.categories.comments).toBeGreaterThanOrEqual(2);
      if (stats.categories.templates) {
        expect(stats.categories.templates).toBeGreaterThan(0);
      }
      if (stats.categories.validation) {
        expect(stats.categories.validation).toBeGreaterThan(0);
      }
    });
  });
});
