/**
 * CreateIssue Tool Tests
 *
 * Tests for the issue creation tool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Import the tool
import { definition, handler, validate } from '../../../../src/tools/issues/createIssue.js';

describe('CreateIssue Tool Tests', () => {
  let mockContext;
  let mockClient;
  let mockLogger;
  let mockIssueService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockClient = {};

    mockIssueService = {
      createIssue: jest.fn(),
    };

    mockContext = {
      client: mockClient,
      services: {
        issueService: mockIssueService,
      },
      logger: mockLogger,
    };
  });

  describe('Definition', () => {
    test('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_create_issue');
      expect(definition.description).toContain('Create a new issue');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'title']);
      expect(definition.inputSchema.properties.priority.default).toBe('medium');
    });
  });

  describe('Handler', () => {
    test('should create issue with minimal required fields', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Test Issue',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'Issue created successfully',
          },
        ],
      };

      mockIssueService.createIssue.mockResolvedValueOnce(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating new issue', args);
      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockClient,
        'PROJ',
        'Test Issue',
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result).toBe(_mockResult);
    });

    test('should create issue with all fields', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Critical Bug',
        description: 'This is a critical bug that needs immediate attention',
        priority: 'urgent',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'Issue PROJ-123 created successfully',
          },
        ],
      };

      mockIssueService.createIssue.mockResolvedValueOnce(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating new issue', args);
      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockClient,
        'PROJ',
        'Critical Bug',
        'This is a critical bug that needs immediate attention',
        'urgent',
        undefined,
        undefined
      );
      expect(result).toBe(_mockResult);
    });

    test('should handle empty description', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Test Issue',
        description: '',
        priority: 'medium',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'Issue created',
          },
        ],
      };

      mockIssueService.createIssue.mockResolvedValueOnce(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockClient,
        'PROJ',
        'Test Issue',
        '',
        'medium',
        undefined,
        undefined
      );
      expect(result).toBe(_mockResult);
    });

    test('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Test Issue',
      };

      const error = new Error('Failed to create issue: Project not found');
      mockIssueService.createIssue.mockRejectedValueOnce(error);

      const result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create issue:', error);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Failed to create issue: Project not found');
    });

    test('should handle network errors', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Test Issue',
        priority: 'high',
      };

      const error = new Error('Network timeout');
      mockIssueService.createIssue.mockRejectedValueOnce(error);

      const result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create issue:', error);
      expect(result.content[0].text).toContain('Network timeout');
    });
  });

  describe('Validate Function', () => {
    test('should validate required fields', () => {
      const errors = validate({});
      expect(errors).toHaveProperty('project_identifier');
      expect(errors).toHaveProperty('title');
    });

    test('should validate empty project_identifier', () => {
      const errors = validate({
        project_identifier: '  ',
        title: 'Test',
      });
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('required');
    });

    test('should validate empty title', () => {
      const errors = validate({
        project_identifier: 'PROJ',
        title: '  ',
      });
      expect(errors).toHaveProperty('title');
      expect(errors.title).toContain('required');
    });

    test('should validate invalid priority', () => {
      const errors = validate({
        project_identifier: 'PROJ',
        title: 'Test',
        priority: 'critical',
      });
      expect(errors).toHaveProperty('priority');
      expect(errors.priority).toContain('must be one of');
    });

    test('should pass validation with valid minimal input', () => {
      const errors = validate({
        project_identifier: 'PROJ',
        title: 'Test Issue',
      });
      expect(errors).toBeNull();
    });

    test('should pass validation with all valid fields', () => {
      const errors = validate({
        project_identifier: 'PROJ',
        title: 'Test Issue',
        description: 'Description',
        priority: 'high',
      });
      expect(errors).toBeNull();
    });

    test('should accept all valid priorities', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];

      for (const priority of priorities) {
        const errors = validate({
          project_identifier: 'PROJ',
          title: 'Test',
          priority,
        });
        expect(errors).toBeNull();
      }
    });

    test('should ignore extra fields', () => {
      const errors = validate({
        project_identifier: 'PROJ',
        title: 'Test',
        extraField: 'value',
      });
      expect(errors).toBeNull();
    });
  });
});
