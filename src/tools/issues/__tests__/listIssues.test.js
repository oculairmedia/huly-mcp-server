/**
 * Unit tests for listIssues tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../listIssues.js';

describe('listIssues tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      listIssues: jest.fn(),
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
      expect(definition.name).toBe('huly_list_issues');
      expect(definition.description).toBe('List issues in a specific project');
      expect(definition.inputSchema.required).toContain('project_identifier');
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should list issues successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const mockIssues = {
        content: [
          {
            type: 'text',
            text: 'Found 2 issues:\n\nPROJ-1: First issue\nPROJ-2: Second issue',
          },
        ],
      };

      mockIssueService.listIssues.mockResolvedValue(mockIssues);

      const result = await handler(args, mockContext);

      expect(mockIssueService.listIssues).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        undefined
      );
      expect(result).toEqual(mockIssues);
    });

    it('should use custom limit when provided', async () => {
      const args = {
        project_identifier: 'PROJ',
        limit: 100,
      };

      const mockIssues = {
        content: [
          {
            type: 'text',
            text: 'Found 100 issues',
          },
        ],
      };

      mockIssueService.listIssues.mockResolvedValue(mockIssues);

      const result = await handler(args, mockContext);

      expect(mockIssueService.listIssues).toHaveBeenCalledWith(mockContext.client, 'PROJ', 100);
      expect(result).toEqual(mockIssues);
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Project not found');
      mockIssueService.listIssues.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without project identifier', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid limit', () => {
      const args = {
        project_identifier: 'PROJ',
        limit: 0,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });

    it('should fail validation with non-numeric limit', () => {
      const args = {
        project_identifier: 'PROJ',
        limit: 'fifty',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });
  });
});
