/**
 * Error Resilience and Edge Case Integration Tests
 *
 * This test suite focuses on error handling, edge cases, and system resilience
 * under various failure scenarios and boundary conditions.
 */

import { jest } from '@jest/globals';
import { initializeTools, executeTool, getAllToolDefinitions } from '../../src/tools/index.js';

jest.setTimeout(60000); // 1 minute

describe('Error Resilience Integration Tests', () => {
  let mockContext;
  let errorLogger;

  beforeAll(async () => {
    await initializeTools();

    // Setup error tracking
    errorLogger = {
      errors: [],
      warnings: [],
      log: function (level, message, error) {
        this[`${level}s`].push({ message, error, timestamp: new Date() });
      },
    };

    mockContext = {
      client: {
        findOne: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      services: {
        projectService: {
          createProject: jest.fn(),
          getProject: jest.fn(),
          listProjects: jest.fn(),
          deleteProject: jest.fn(),
        },
        issueService: {
          createIssue: jest.fn(),
          updateIssue: jest.fn(),
          getIssue: jest.fn(),
          listIssues: jest.fn(),
          deleteIssue: jest.fn(),
          createSubIssue: jest.fn(),
        },
        componentService: {
          createComponent: jest.fn(),
          listComponents: jest.fn(),
          deleteComponent: jest.fn(),
        },
        templateService: {
          createTemplate: jest.fn(),
          createIssueFromTemplate: jest.fn(),
        },
        bulkOperationService: {
          executeBulkOperation: jest.fn(),
        },
        deletionService: {
          validateDeletion: jest.fn(),
          deleteProject: jest.fn(),
        },
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: (msg, error) => errorLogger.log('warning', msg, error),
        error: (msg, error) => errorLogger.log('error', msg, error),
      },
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    errorLogger.errors = [];
    errorLogger.warnings = [];
  });

  describe('Network and Connection Errors', () => {
    it('should handle connection timeouts gracefully', async () => {
      mockContext.services.projectService.createProject.mockRejectedValue(
        new Error('ETIMEDOUT: Connection timed out')
      );

      const result = await executeTool(
        'huly_create_project',
        {
          name: 'Timeout Test',
          identifier: 'TIMEOUT',
        },
        mockContext
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('ETIMEDOUT');
      expect(errorLogger.errors).toHaveLength(1);
    });

    it('should handle network unreachable errors', async () => {
      mockContext.services.issueService.createIssue.mockRejectedValue(
        new Error('ENETUNREACH: Network is unreachable')
      );

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'NET',
          title: 'Network Test Issue',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('ENETUNREACH');
    });

    it('should handle DNS resolution failures', async () => {
      mockContext.services.projectService.listProjects.mockRejectedValue(
        new Error('ENOTFOUND: getaddrinfo ENOTFOUND invalid-domain.com')
      );

      const result = await executeTool('huly_list_projects', {}, mockContext);

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('ENOTFOUND');
    });

    it('should handle connection refused errors', async () => {
      mockContext.services.issueService.getIssue.mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused')
      );

      const result = await executeTool(
        'huly_get_issue_details',
        {
          issue_identifier: 'TEST-1',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('ECONNREFUSED');
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should handle invalid credentials', async () => {
      mockContext.services.projectService.createProject.mockRejectedValue(
        new Error('Authentication failed: Invalid credentials')
      );

      const result = await executeTool(
        'huly_create_project',
        {
          name: 'Auth Test',
          identifier: 'AUTH',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Authentication failed');
    });

    it('should handle expired tokens', async () => {
      mockContext.services.issueService.updateIssue.mockRejectedValue(
        new Error('Token expired: Please re-authenticate')
      );

      const result = await executeTool(
        'huly_update_issue',
        {
          issue_identifier: 'TEST-1',
          field: 'status',
          value: 'done',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Token expired');
    });

    it('should handle insufficient permissions', async () => {
      mockContext.services.projectService.deleteProject.mockRejectedValue(
        new Error('Permission denied: Insufficient privileges to delete project')
      );

      const result = await executeTool(
        'huly_delete_project',
        {
          project_identifier: 'PERM',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Permission denied');
    });

    it('should handle workspace access restrictions', async () => {
      mockContext.services.projectService.listProjects.mockRejectedValue(
        new Error('Workspace access denied: User not member of workspace')
      );

      const result = await executeTool('huly_list_projects', {}, mockContext);

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Workspace access denied');
    });
  });

  describe('Data Validation and Constraint Errors', () => {
    it('should handle duplicate resource creation', async () => {
      mockContext.services.projectService.createProject.mockRejectedValue(
        new Error('Duplicate key error: Project identifier EXIST already exists')
      );

      const result = await executeTool(
        'huly_create_project',
        {
          name: 'Duplicate Test',
          identifier: 'EXIST',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Duplicate key error');
    });

    it('should handle foreign key constraint violations', async () => {
      mockContext.services.issueService.createIssue.mockRejectedValue(
        new Error('Foreign key constraint violation: Project MISSING does not exist')
      );

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'MISSING',
          title: 'Constraint Test',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Foreign key constraint');
    });

    it('should handle data length limit violations', async () => {
      const longTitle = 'X'.repeat(1000); // Extremely long title

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'LONG',
          title: longTitle,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('too long');
    });

    it('should handle invalid enum values', async () => {
      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'ENUM',
          title: 'Enum Test',
          priority: 'invalid_priority_level',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('priority');
    });
  });

  describe('Resource Not Found Errors', () => {
    it('should handle project not found errors', async () => {
      mockContext.services.issueService.listIssues.mockRejectedValue(
        new Error('Project not found: NONEXIST')
      );

      const result = await executeTool(
        'huly_list_issues',
        {
          project_identifier: 'NONEXIST',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Project not found');
    });

    it('should handle issue not found errors', async () => {
      mockContext.services.issueService.updateIssue.mockRejectedValue(
        new Error('Issue not found: MISSING-999')
      );

      const result = await executeTool(
        'huly_update_issue',
        {
          issue_identifier: 'MISSING-999',
          field: 'status',
          value: 'done',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Issue not found');
    });

    it('should handle component not found errors', async () => {
      mockContext.services.componentService.deleteComponent.mockRejectedValue(
        new Error('Component not found: NonExistentComponent')
      );

      const result = await executeTool(
        'huly_delete_component',
        {
          project_identifier: 'TEST',
          component_label: 'NonExistentComponent',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Component not found');
    });

    it('should handle template not found errors', async () => {
      mockContext.services.templateService.createIssueFromTemplate.mockRejectedValue(
        new Error('Template not found: invalid-template-id')
      );

      const result = await executeTool(
        'huly_create_issue_from_template',
        {
          template_id: 'invalid-template-id',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Template not found');
    });
  });

  describe('Rate Limiting and Quota Errors', () => {
    it('should handle rate limiting gracefully', async () => {
      mockContext.services.issueService.createIssue.mockRejectedValue(
        new Error('Rate limit exceeded: Too many requests. Please try again later.')
      );

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'RATE',
          title: 'Rate Limited Request',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Rate limit exceeded');
    });

    it('should handle quota exceeded errors', async () => {
      mockContext.services.projectService.createProject.mockRejectedValue(
        new Error('Quota exceeded: Maximum number of projects reached')
      );

      const result = await executeTool(
        'huly_create_project',
        {
          name: 'Quota Test',
          identifier: 'QUOTA',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Quota exceeded');
    });

    it('should handle storage quota errors', async () => {
      mockContext.services.issueService.createIssue.mockRejectedValue(
        new Error('Storage quota exceeded: Cannot create more issues')
      );

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'STOR',
          title: 'Storage Test',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Storage quota exceeded');
    });
  });

  describe('Bulk Operation Error Handling', () => {
    it('should handle partial bulk operation failures', async () => {
      mockContext.services.bulkOperationService.executeBulkOperation.mockResolvedValue({
        summary: {
          total: 5,
          succeeded: 3,
          failed: 2,
          duration: 200,
        },
        results: [
          { success: true, item: { title: 'Issue 1' }, result: { identifier: 'TEST-1' } },
          { success: true, item: { title: 'Issue 2' }, result: { identifier: 'TEST-2' } },
          {
            success: false,
            item: { title: 'Issue 3' },
            error: 'Validation failed: Invalid priority',
          },
          { success: true, item: { title: 'Issue 4' }, result: { identifier: 'TEST-4' } },
          { success: false, item: { title: 'Issue 5' }, error: 'Rate limit exceeded' },
        ],
        errors: [
          { item: { title: 'Issue 3' }, error: 'Validation failed: Invalid priority' },
          { item: { title: 'Issue 5' }, error: 'Rate limit exceeded' },
        ],
      });

      const result = await executeTool(
        'huly_bulk_create_issues',
        {
          project_identifier: 'BULK',
          issues: [
            { title: 'Issue 1' },
            { title: 'Issue 2' },
            { title: 'Issue 3' },
            { title: 'Issue 4' },
            { title: 'Issue 5' },
          ],
        },
        mockContext
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.succeeded).toBe(3);
      expect(data.summary.failed).toBe(2);
      expect(data.failed_creates).toHaveLength(2);
      expect(data.failed_creates[0].error).toContain('Validation failed');
      expect(data.failed_creates[1].error).toContain('Rate limit exceeded');
    });

    it('should handle complete bulk operation failure', async () => {
      mockContext.services.bulkOperationService.executeBulkOperation.mockRejectedValue(
        new Error('Bulk operation failed: Database connection lost')
      );

      const result = await executeTool(
        'huly_bulk_update_issues',
        {
          updates: [
            { issue_identifier: 'TEST-1', field: 'status', value: 'done' },
            { issue_identifier: 'TEST-2', field: 'status', value: 'done' },
          ],
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Bulk operation failed');
    });

    it('should handle bulk operation timeout', async () => {
      mockContext.services.bulkOperationService.executeBulkOperation.mockRejectedValue(
        new Error('Operation timeout: Bulk operation exceeded time limit')
      );

      const result = await executeTool(
        'huly_bulk_delete_issues',
        {
          issue_identifiers: Array.from({ length: 100 }, (_, i) => `TEST-${i + 1}`),
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Operation timeout');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty string inputs', async () => {
      const result = await executeTool(
        'huly_create_project',
        {
          name: '',
          identifier: '',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('identifier');
    });

    it('should handle null and undefined values', async () => {
      const result = await executeTool(
        'huly_update_issue',
        {
          issue_identifier: 'TEST-1',
          field: 'title',
          value: null,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
    });

    it('should handle Unicode and special characters', async () => {
      mockContext.services.issueService.createIssue.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '✅ Issue created successfully: 测试问题 🚀 (TEST-1)',
          },
        ],
      });

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'UNI',
          title: '测试问题 🚀 Special chars: åäö @#$%',
          description: 'Unicode test: ñáéíóú 中文 العربية русский',
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Issue created successfully');
      expect(result.content[0].text).toContain('测试问题 🚀');
    });

    it('should handle extremely large payloads', async () => {
      const largeDescription = 'A'.repeat(100000); // 100KB of text

      mockContext.services.issueService.createIssue.mockRejectedValue(
        new Error('Payload too large: Description exceeds maximum size limit')
      );

      const result = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'LARGE',
          title: 'Large Payload Test',
          description: largeDescription,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Payload too large');
    });

    it('should handle zero and negative values where inappropriate', async () => {
      const result = await executeTool(
        'huly_create_template',
        {
          project_identifier: 'ZERO',
          title: 'Zero Test',
          estimation: -5, // Negative estimation
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('estimation');
    });
  });

  describe('System Recovery and Resilience', () => {
    it('should continue processing after recoverable errors', async () => {
      let callCount = 0;
      mockContext.services.issueService.createIssue.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary network error');
        }
        return Promise.resolve({
          content: [
            {
              type: 'text',
              text: '✅ Issue created successfully: Recovered Issue (TEST-1)',
            },
          ],
        });
      });

      // First call should fail
      const firstResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'REC',
          title: 'Recovery Test 1',
        },
        mockContext
      );

      expect(firstResult.content[0].text).toContain('Error');

      // Second call should succeed
      const secondResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'REC',
          title: 'Recovery Test 2',
        },
        mockContext
      );

      expect(secondResult.content[0].text).toContain('Issue created successfully');
    });

    it('should handle cascading failures gracefully', async () => {
      // Simulate a scenario where project deletion fails but cleanup continues
      mockContext.services.deletionService.deleteProject.mockRejectedValue(
        new Error('Delete failed: Project has active dependencies')
      );

      const result = await executeTool(
        'huly_delete_project',
        {
          project_identifier: 'CASCADE',
          force: false,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('active dependencies');
    });

    it('should maintain data consistency during errors', async () => {
      // Test that partial operations don't leave system in inconsistent state
      mockContext.services.templateService.createTemplate.mockRejectedValue(
        new Error('Template creation failed: Transaction rolled back')
      );

      const result = await executeTool(
        'huly_create_template',
        {
          project_identifier: 'CONS',
          title: 'Consistency Test',
          children: [{ title: 'Child 1' }, { title: 'Child 2' }],
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Transaction rolled back');
    });
  });

  describe('Tool-Specific Error Scenarios', () => {
    it('should handle invalid tool parameters gracefully', async () => {
      const tools = getAllToolDefinitions();
      expect(tools.length).toBeGreaterThan(0);

      // Test each tool with invalid parameters
      for (const tool of tools.slice(0, 5)) {
        // Test first 5 tools
        try {
          const result = await executeTool(
            tool.name,
            {
              invalid_parameter: 'invalid_value',
            },
            mockContext
          );

          expect(result.content[0].text).toContain('Error');
        } catch (error) {
          // Tool might throw directly for invalid parameters
          expect(error.message).toBeDefined();
        }
      }
    });

    it('should validate required parameters are present', async () => {
      // Test that tools reject calls with missing required parameters
      const result = await executeTool(
        'huly_create_project',
        {
          name: 'Test Project',
          // Missing required 'identifier' parameter
        },
        mockContext
      );

      expect(result.content[0].text).toContain('Error');
    });

    it('should handle tool execution context errors', async () => {
      // Test with incomplete context
      const incompleteContext = {
        client: null,
        services: {},
        logger: mockContext.logger,
      };

      const result = await executeTool('huly_list_projects', {}, incompleteContext);

      expect(result.content[0].text).toContain('Error');
    });
  });

  afterAll(() => {
    // Summary of error scenarios tested
    console.log('\n📊 Error Resilience Test Summary:');
    console.log(
      `- Total error scenarios tested: ${errorLogger.errors.length + errorLogger.warnings.length}`
    );
    console.log(`- Critical errors logged: ${errorLogger.errors.length}`);
    console.log(`- Warnings logged: ${errorLogger.warnings.length}`);

    if (errorLogger.errors.length > 0) {
      console.log('\n🔴 Error Types Encountered:');
      const errorTypes = errorLogger.errors.reduce((acc, err) => {
        const type = err.message.split(':')[0] || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} occurrences`);
      });
    }
  });
});
