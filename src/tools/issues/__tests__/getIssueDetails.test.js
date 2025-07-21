/**
 * Unit tests for getIssueDetails tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../getIssueDetails.js';

describe('getIssueDetails tool', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    mockIssueService = {
      getIssueDetails: jest.fn(),
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
      expect(definition.name).toBe('huly_get_issue_details');
      expect(definition.description).toContain('comprehensive details');
      expect(definition.inputSchema.required).toEqual(['issue_identifier']);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should get issue details successfully', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: `# PROJ-123: Fix critical bug

**Project**: My Project
**Status**: In Progress
**Priority**: High
**Created**: 2024-01-15
**Modified**: 2024-01-20
**Assignee**: developer@example.com
**Component**: Backend
**Milestone**: v1.0
**Comments**: 5
**Sub-issues**: 2

## Description

This is a critical bug that needs immediate attention.

## Recent Comments

### developer@example.com - 2024-01-20
Working on this now.

### tester@example.com - 2024-01-19
Confirmed the issue in production.`,
          },
        ],
      };

      mockIssueService.getIssueDetails.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockIssueService.getIssueDetails).toHaveBeenCalledWith(mockContext.client, 'PROJ-123');
      expect(result).toEqual(_mockResult);
    });

    it('should handle issue not found', async () => {
      const args = {
        issue_identifier: 'PROJ-999',
      };

      const error = new Error('Issue not found: PROJ-999');
      mockIssueService.getIssueDetails.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const error = new Error('Database connection failed');
      mockIssueService.getIssueDetails.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with valid issue identifier', () => {
      const args = {
        issue_identifier: 'PROJ-123',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with different project formats', () => {
      const validIdentifiers = ['A-1', 'AB-123', 'ABC-1234', 'ABCD-12345', 'ABCDE-123456'];

      validIdentifiers.forEach((identifier) => {
        const args = { issue_identifier: identifier };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without issue identifier', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('issue_identifier');
      expect(errors.issue_identifier).toContain('required');
    });

    it('should fail validation with empty issue identifier', () => {
      const args = {
        issue_identifier: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('issue_identifier');
    });

    it('should pass validation with various issue identifier formats', () => {
      const validIdentifiers = [
        'invalid',
        'PROJ',
        '123',
        'proj-123',
        'PROJ_123',
        'PROJ-',
        '-123',
        'PROJ--123',
        'TOOLONG-123',
      ];

      validIdentifiers.forEach((identifier) => {
        const args = { issue_identifier: identifier };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });
  });
});
