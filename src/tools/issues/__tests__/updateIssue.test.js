/**
 * Unit tests for updateIssue tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../updateIssue.js';

describe('updateIssue tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      updateIssue: jest.fn(),
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
      expect(definition.name).toBe('huly_update_issue');
      expect(definition.description).toContain('Update an existing issue');
      expect(definition.inputSchema.required).toEqual(['issue_identifier', 'field', 'value']);
      expect(definition.annotations.destructiveHint).toBe(false);
    });
  });

  describe('handler', () => {
    it('should update issue title successfully', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'title',
        value: 'Updated Title',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Updated issue PROJ-123\n\ntitle: Updated Title',
          },
        ],
      };

      mockIssueService.updateIssue.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        'title',
        'Updated Title'
      );
      expect(result).toEqual(mockResult);
    });

    it('should update issue status successfully', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'status',
        value: 'done',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Updated issue PROJ-123\n\nstatus: Done',
          },
        ],
      };

      mockIssueService.updateIssue.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123',
        'status',
        'done'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle service errors', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'title',
        value: 'New Title',
      };

      const error = new Error('Issue not found');
      mockIssueService.updateIssue.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'title',
        value: 'New Title',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without issue identifier', () => {
      const args = {
        field: 'title',
        value: 'New Title',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('issue_identifier');
    });

    it('should pass validation with various issue identifier formats', () => {
      const validFormats = ['PROJ-123', 'ABC-1', 'TEST-9999', 'lowercase-123'];

      validFormats.forEach((identifier) => {
        const args = {
          issue_identifier: identifier,
          field: 'title',
          value: 'New Title',
        };

        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without field', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        value: 'New Value',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('field');
    });

    it('should fail validation with invalid field', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'invalid_field',
        value: 'New Value',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('field');
    });

    it('should fail validation without value', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'title',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('value');
    });

    it('should fail validation with empty value for required fields', () => {
      const args = {
        issue_identifier: 'PROJ-123',
        field: 'title',
        value: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('value');
    });

    it('should accept all valid fields', () => {
      const validFields = ['title', 'description', 'status', 'priority', 'component', 'milestone'];

      validFields.forEach((field) => {
        const args = {
          issue_identifier: 'PROJ-123',
          field,
          value: 'Some Value', // All fields require non-empty values in current implementation
        };

        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });
  });
});
