/**
 * Unit tests for searchIssues tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../searchIssues.js';

describe('searchIssues tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      searchIssues: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        issueService: mockIssueService,
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_search_issues');
      expect(definition.description).toContain('Search and filter issues');
      expect(definition.inputSchema.properties).toHaveProperty('query');
      expect(definition.inputSchema.properties).toHaveProperty('project_identifier');
      expect(definition.inputSchema.properties).toHaveProperty('status');
      expect(definition.inputSchema.properties).toHaveProperty('priority');
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should search issues by query', async () => {
      const args = {
        query: 'bug fix',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Found 3 issues matching "bug fix"',
          },
        ],
      };

      mockIssueService.searchIssues.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.searchIssues).toHaveBeenCalledWith(mockContext.client, args);
      expect(result).toEqual(mockResult);
    });

    it('should search with multiple filters', async () => {
      const args = {
        project_identifier: 'PROJ',
        status: 'in-progress',
        priority: 'high',
        assignee: 'user@example.com',
        limit: 20,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Found 5 high priority issues in progress',
          },
        ],
      };

      mockIssueService.searchIssues.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.searchIssues).toHaveBeenCalledWith(mockContext.client, args);
      expect(result).toEqual(mockResult);
    });

    it('should search with date filters', async () => {
      const args = {
        created_after: '2024-01-01',
        modified_before: '2024-12-31',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Found 10 issues in date range',
          },
        ],
      };

      mockIssueService.searchIssues.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.searchIssues).toHaveBeenCalledWith(mockContext.client, args);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty search results', async () => {
      const args = {
        query: 'nonexistent',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'No issues found matching your search criteria',
          },
        ],
      };

      mockIssueService.searchIssues.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(result).toEqual(mockResult);
    });

    it('should handle service errors', async () => {
      const args = {
        query: 'test',
      };

      const error = new Error('Search service unavailable');
      mockIssueService.searchIssues.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with just query', () => {
      const args = {
        query: 'bug',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all filters', () => {
      const args = {
        query: 'bug',
        project_identifier: 'PROJ',
        status: 'done',
        priority: 'high',
        assignee: 'user@example.com',
        component: 'backend',
        milestone: 'v1.0',
        created_after: '2024-01-01',
        created_before: '2024-12-31',
        modified_after: '2024-01-01',
        modified_before: '2024-12-31',
        limit: 50,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation without any parameters', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation with invalid priority', () => {
      const args = {
        priority: 'invalid',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('priority');
    });

    it('should fail validation with invalid date format', () => {
      const args = {
        created_after: 'not-a-date',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('created_after');
    });

    it('should fail validation with invalid limit', () => {
      const args = {
        limit: -1,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });

    it('should fail validation with non-numeric limit', () => {
      const args = {
        limit: 'fifty',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });
  });
});
