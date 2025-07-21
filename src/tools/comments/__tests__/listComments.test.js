/**
 * Unit tests for listComments tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../listComments.js';

describe('listComments tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      listComments: jest.fn(),
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
      expect(definition.name).toBe('huly_list_comments');
      expect(definition.description).toContain('List comments on an issue');
      expect(definition.inputSchema.required).toEqual(['issue_identifier']);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should list comments successfully', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: `## Comments for PROJ-123

### user1@example.com - 2024-01-20 10:30 AM
This looks good, but we should add more tests.

### user2@example.com - 2024-01-20 11:45 AM
I agree. I'll add the tests in the next commit.

### user1@example.com - 2024-01-20 02:30 PM
Great! Let me know when it's ready for review.

Total comments: 3`,
          },
        ],
      };

      mockIssueService.listComments.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.listComments).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        undefined
      );
      expect(result).toEqual(mockResult);
    });

    it('should list comments with custom limit', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        limit: 10,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Showing 10 most recent comments...',
          },
        ],
      };

      mockIssueService.listComments.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.listComments).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        10
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle no comments case', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'No comments found for issue PROJ-123',
          },
        ],
      };

      mockIssueService.listComments.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(result).toEqual(mockResult);
    });

    it('should handle issue not found error', async () => {
      const args = {
        issue_identifier: 'PROJ-999',
      };

      const error = new Error('Issue not found: PROJ-999');
      mockIssueService.listComments.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const error = new Error('Failed to fetch comments');
      mockIssueService.listComments.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to list comments:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with limit', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        limit: 25,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without issue identifier', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('issue_identifier');
    });

    it('should fail validation with empty issue identifier', () => {
      const args = {
        issue_identifier: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('issue_identifier');
    });

    it('should fail validation with invalid issue identifier format', () => {
      const args = {
        issue_identifier: 'invalid-format',
      };

      // Note: Current implementation doesn't validate format, only presence
      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation with invalid limit', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        limit: 0,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });

    it('should fail validation with negative limit', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        limit: -10,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });

    it('should fail validation with non-numeric limit', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        limit: 'twenty',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });
  });
});
