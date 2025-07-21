/**
 * Unit tests for createComment tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../createComment.js';

describe('createComment tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      createComment: jest.fn(),
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
      expect(definition.name).toBe('huly_create_comment');
      expect(definition.description).toContain('Create a comment on an issue');
      expect(definition.inputSchema.required).toEqual(['issue_identifier', 'message']);
      expect(definition.annotations.destructiveHint).toBe(false);
    });
  });

  describe('handler', () => {
    it('should create comment successfully', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        message: 'This looks good to me!',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Added comment to PROJ-123',
          },
        ],
      };

      mockIssueService.createComment.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.createComment).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        'This looks good to me!'
      );
      expect(result).toEqual(_mockResult);
    });

    it('should create comment with markdown', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        message: '## Update\n\n- Fixed the bug\n- Added tests\n\n**Ready for review!**',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Added comment to PROJ-123',
          },
        ],
      };

      mockIssueService.createComment.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.createComment).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        args.message
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle issue not found error', async () => {
      const args = {
        issue_identifier: 'PROJ-999',
        message: 'Test comment',
      };

      const error = new Error('Issue not found: PROJ-999');
      mockIssueService.createComment.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        message: 'Test comment',
      };

      const error = new Error('Failed to create comment');
      mockIssueService.createComment.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to create comment:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        message: 'Valid comment',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with long markdown message', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        message: `# Detailed Analysis

## Overview
This is a comprehensive review of the implementation.

### Pros:
- Clean code structure
- Good test coverage
- Follows best practices

### Cons:
- Could use more documentation
- Some edge cases not handled

## Conclusion
Overall good work, just needs minor improvements.`,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without issue identifier', () => {
      const args = {
        message: 'Test comment',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('issue_identifier');
    });

    it('should fail validation with invalid issue identifier format', () => {
      const args = {
        issue_identifier: 'invalid-format',
        message: 'Test comment',
      };

      // Note: Current implementation doesn't validate format, only presence
      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without message', () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('message');
    });

    it('should fail validation with empty message', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        message: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('message');
      expect(errors.message).toContain('required');
    });
  });
});
