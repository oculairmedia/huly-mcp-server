/**
 * Tests for Bulk Create Issues Tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handler, validate, definition } from '../bulkCreateIssues.js';

describe('bulkCreateIssues', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIssueService = {
      createIssue: jest.fn(),
      createSubissue: jest.fn(),
    };

    mockContext = {
      client: { mock: 'client' },
      services: {
        issueService: mockIssueService,
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_bulk_create_issues');
      expect(definition.description).toContain('Create multiple issues');
      expect(definition.inputSchema.properties.issues).toBeDefined();
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'issues']);
    });

    it('should have correct annotations', () => {
      expect(definition.annotations).toEqual({
        title: 'Bulk Create Issues',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      });
    });
  });

  describe('validation', () => {
    it('should validate valid input', () => {
      const args = {
        project_identifier: 'PROJ',
        issues: [
          {
            title: 'Issue 1',
            description: 'Description 1',
            priority: 'high',
          },
          {
            title: 'Issue 2',
            priority: 'medium',
          },
        ],
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should reject missing project identifier', () => {
      const errors = validate({
        issues: [{ title: 'Issue 1' }],
      });
      expect(errors).toEqual({
        project_identifier: 'Project identifier is required',
      });
    });

    it('should reject missing issues', () => {
      const errors = validate({
        project_identifier: 'PROJ',
      });
      expect(errors).toEqual({
        issues: 'Issues must be an array',
      });
    });

    it('should reject empty issues array', () => {
      const errors = validate({
        project_identifier: 'PROJ',
        issues: [],
      });
      expect(errors).toEqual({
        issues: 'At least one issue is required',
      });
    });

    it('should reject too many issues', () => {
      const issues = Array(101).fill({ title: 'Issue' });
      const errors = validate({
        project_identifier: 'PROJ',
        issues,
      });
      expect(errors).toEqual({
        issues: 'Maximum 100 issues allowed per operation',
      });
    });

    it('should validate each issue', () => {
      const args = {
        project_identifier: 'PROJ',
        issues: [
          {
            title: '',
            priority: 'high',
          },
          {
            title: 'Valid Issue',
            priority: 'invalid',
          },
          {
            description: 'No title',
          },
        ],
      };

      const errors = validate(args);
      expect(errors.issues[0]).toEqual({
        title: 'Title is required',
      });
      expect(errors.issues[1]).toEqual({
        priority: 'Priority must be one of: low, medium, high, urgent',
      });
      expect(errors.issues[2]).toEqual({
        title: 'Title is required',
      });
    });

    it('should validate defaults', () => {
      const args = {
        project_identifier: 'PROJ',
        issues: [{ title: 'Issue 1' }],
        defaults: {
          priority: 'invalid',
        },
      };

      const errors = validate(args);
      expect(errors).toEqual({
        defaults: {
          priority: 'Default priority must be one of: low, medium, high, urgent',
        },
      });
    });

    it('should validate batch_size option', () => {
      const args = {
        project_identifier: 'PROJ',
        issues: [{ title: 'Issue 1' }],
        options: {
          batch_size: 51,
        },
      };

      const errors = validate(args);
      expect(errors).toEqual({
        batch_size: 'Batch size must be a number between 1 and 50',
      });
    });
  });

  describe('handler', () => {
    const validArgs = {
      project_identifier: 'PROJ',
      issues: [
        {
          title: 'Issue 1',
          description: 'Description 1',
          priority: 'high',
        },
        {
          title: 'Issue 2',
          priority: 'medium',
        },
      ],
    };

    it('should execute bulk create successfully', async () => {
      // Mock successful creations
      mockIssueService.createIssue
        .mockResolvedValueOnce({
          success: true,
          data: {
            _id: '1',
            identifier: 'PROJ-101',
            title: 'Issue 1',
            project: 'PROJ',
            status: 'Backlog',
            priority: 'High',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            _id: '2',
            identifier: 'PROJ-102',
            title: 'Issue 2',
            project: 'PROJ',
            status: 'Backlog',
            priority: 'Medium',
          },
        });

      const result = await handler(validArgs, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.succeeded).toBe(2);
      expect(data.summary.failed).toBe(0);
      expect(data.created_issues).toHaveLength(2);
      expect(data.created_issues[0].identifier).toBe('PROJ-101');
      expect(data.created_issues[1].identifier).toBe('PROJ-102');

      // Verify issue service was called correctly
      expect(mockIssueService.createIssue).toHaveBeenCalledTimes(2);
      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Issue 1',
        'Description 1',
        'high'
      );
    });

    it('should handle partial failures', async () => {
      // Mock one success and one failure
      mockIssueService.createIssue
        .mockResolvedValueOnce({
          success: true,
          data: {
            _id: '1',
            identifier: 'PROJ-101',
            title: 'Issue 1',
            project: 'PROJ',
            status: 'Backlog',
            priority: 'High',
          },
        })
        .mockRejectedValueOnce(new Error('Failed to create issue'));

      const result = await handler(validArgs, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBe(1);
      expect(data.summary.failed).toBe(1);
      expect(data.created_issues).toHaveLength(1);
      expect(data.failed_issues).toHaveLength(1);
      expect(data.failed_issues[0].error).toBe('Failed to create issue');
    });

    it('should apply defaults to all issues', async () => {
      const argsWithDefaults = {
        project_identifier: 'PROJ',
        issues: [
          { title: 'Issue 1' },
          { title: 'Issue 2', priority: 'high' }, // Override default
        ],
        defaults: {
          priority: 'low',
          component: 'Backend',
        },
      };

      mockIssueService.createIssue.mockResolvedValue({
        success: true,
        data: {
          _id: '1',
          identifier: 'PROJ-101',
          title: 'Issue',
          project: 'PROJ',
          status: 'Backlog',
          priority: 'Low',
        },
      });

      await handler(argsWithDefaults, mockContext);

      // First issue should use default priority
      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Issue 1',
        undefined,
        'low'
      );

      // Second issue should override default priority
      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Issue 2',
        undefined,
        'high'
      );
    });

    it('should handle dry run mode', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.dry_run).toBe(true);
      expect(data.valid_count).toBe(2);
      expect(data.invalid_count).toBe(0);

      // Verify no issues were created
      expect(mockIssueService.createIssue).not.toHaveBeenCalled();
    });

    it('should validate issues in dry run', async () => {
      const argsWithDryRun = {
        project_identifier: 'PROJ',
        issues: [
          { title: 'Valid Issue', priority: 'high' },
          { title: '', priority: 'medium' },
          { title: 'Invalid Priority', priority: 'super-high' },
        ],
        options: {
          dry_run: true,
        },
      };

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.valid_count).toBe(1);
      expect(data.invalid_count).toBe(2);
      expect(data.validation_errors).toHaveLength(2);
    });

    it('should create sub-issues when parent_issue is provided', async () => {
      const argsWithSubissues = {
        project_identifier: 'PROJ',
        issues: [
          {
            title: 'Sub-issue 1',
            parent_issue: 'PROJ-100',
            priority: 'high',
          },
          {
            title: 'Regular issue',
            priority: 'medium',
          },
        ],
      };

      mockIssueService.createSubissue.mockResolvedValue({
        success: true,
        data: {
          _id: '1',
          identifier: 'PROJ-101',
          title: 'Sub-issue 1',
          parent: 'PROJ-100',
          project: 'PROJ',
          status: 'Backlog',
          priority: 'High',
        },
      });

      mockIssueService.createIssue.mockResolvedValue({
        success: true,
        data: {
          _id: '2',
          identifier: 'PROJ-102',
          title: 'Regular issue',
          project: 'PROJ',
          status: 'Backlog',
          priority: 'Medium',
        },
      });

      const result = await handler(argsWithSubissues, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBe(2);

      // Verify correct service methods were called
      expect(mockIssueService.createSubissue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-100',
        'Sub-issue 1',
        undefined,
        'high'
      );
      expect(mockIssueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Regular issue',
        undefined,
        'medium'
      );
    });

    it('should respect batch size', async () => {
      const largeBatch = {
        project_identifier: 'PROJ',
        issues: Array(25)
          .fill(null)
          .map((_, i) => ({
            title: `Issue ${i + 1}`,
            priority: 'medium',
          })),
        options: {
          batch_size: 5,
        },
      };

      // Mock all creations as successful
      mockIssueService.createIssue.mockResolvedValue({
        success: true,
        data: {
          _id: '1',
          identifier: 'PROJ-101',
          title: 'Issue',
          project: 'PROJ',
          status: 'Backlog',
          priority: 'Medium',
        },
      });

      const result = await handler(largeBatch, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(25);
      expect(data.summary.succeeded).toBe(25);

      // Check that progress was logged multiple times
      const progressLogs = mockContext.logger.info.mock.calls.filter((call) =>
        call[0].includes('Bulk create progress')
      );
      expect(progressLogs.length).toBeGreaterThan(1);
    });

    it('should stop on error when continue_on_error is false', async () => {
      const argsWithStopOnError = {
        project_identifier: 'PROJ',
        issues: [
          { title: 'Issue 1', priority: 'high' },
          { title: 'Issue 2', priority: 'medium' },
          { title: 'Issue 3', priority: 'low' },
        ],
        options: {
          continue_on_error: false,
        },
      };

      // Mock first success, second failure
      mockIssueService.createIssue
        .mockResolvedValueOnce({
          success: true,
          data: { _id: '1', identifier: 'PROJ-101' },
        })
        .mockRejectedValueOnce(new Error('Creation failed'));

      const result = await handler(argsWithStopOnError, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Creation failed');

      // Should have only tried 2 creations (stopped after failure)
      expect(mockIssueService.createIssue).toHaveBeenCalledTimes(2);
    });
  });
});
