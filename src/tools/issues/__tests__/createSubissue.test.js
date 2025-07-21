/**
 * Unit tests for createSubissue tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../createSubissue.js';

describe('createSubissue tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      createSubissue: jest.fn(),
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
      expect(definition.name).toBe('huly_create_subissue');
      expect(definition.description).toContain('Create a subissue');
      expect(definition.inputSchema.required).toEqual(['parent_issue_identifier', 'title']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should create subissue successfully', async () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: 'Implement unit tests',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Created sub-issue PROJ-124: "Implement unit tests"\n\nParent: PROJ-123\nPriority: medium\nStatus: Backlog\nProject: My Project',
          },
        ],
      };

      mockIssueService.createSubissue.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.createSubissue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        'Implement unit tests',
        undefined,
        'medium'
      );
      expect(result).toEqual(mockResult);
    });

    it('should create subissue with description and priority', async () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: 'Fix validation bug',
        description: 'The validation is not working correctly for edge cases',
        priority: 'high',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Created sub-issue PROJ-125: "Fix validation bug"\n\nParent: PROJ-123\nPriority: high\nStatus: Backlog\nProject: My Project',
          },
        ],
      };

      mockIssueService.createSubissue.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.createSubissue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        'Fix validation bug',
        'The validation is not working correctly for edge cases',
        'high'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle parent issue not found', async () => {
      const args = {
        parent_issue_identifier: 'PROJ-999',
        title: 'Orphan subissue',
      };

      const error = new Error('Parent issue not found: PROJ-999');
      mockIssueService.createSubissue.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: 'Test subissue',
      };

      const error = new Error('Failed to create subissue');
      mockIssueService.createSubissue.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: 'Valid subissue title',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all fields', () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: 'Complete subissue',
        description: 'This is a detailed description',
        priority: 'urgent',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without parent issue identifier', () => {
      const args = {
        title: 'Orphan subissue',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('parent_issue_identifier');
    });

    it('should fail validation with invalid parent issue format', () => {
      const args = {
        parent_issue_identifier: 'invalid-format',
        title: 'Test subissue',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('parent_issue_identifier');
      expect(errors.parent_issue_identifier).toContain('format');
    });

    it('should fail validation without title', () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('title');
    });

    it('should fail validation with empty title', () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('title');
    });

    it('should fail validation with invalid priority', () => {
      const args = {
        parent_issue_identifier: 'PROJ-123',
        title: 'Test subissue',
        priority: 'invalid',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('priority');
    });

    it('should accept all valid priorities', () => {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];

      validPriorities.forEach((priority) => {
        const args = {
          parent_issue_identifier: 'PROJ-123',
          title: 'Test subissue',
          priority,
        };

        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });
  });
});
