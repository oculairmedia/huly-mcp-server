/**
 * Integration Tests for Bulk Update Issues Tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handler, validate, definition } from '../bulkUpdateIssues.js';

describe('bulkUpdateIssues integration', () => {
  let mockContext;
  let mockIssueService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockIssueService = {
      updateIssue: jest.fn(),
      getIssue: jest.fn(),
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
      expect(definition.name).toBe('huly_bulk_update_issues');
      expect(definition.description).toContain('Update multiple issues');
      expect(definition.inputSchema.properties.updates).toBeDefined();
      expect(definition.inputSchema.required).toEqual(['updates']);
    });

    it('should have correct annotations', () => {
      expect(definition.annotations).toEqual({
        title: 'Bulk Update Issues',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      });
    });
  });

  describe('validation', () => {
    it('should validate valid updates', () => {
      const args = {
        updates: [
          {
            issue_identifier: 'PROJ-1',
            field: 'status',
            value: 'done',
          },
          {
            issue_identifier: 'PROJ-2',
            field: 'priority',
            value: 'high',
          },
        ],
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should reject missing updates', () => {
      const errors = validate({});
      expect(errors).toEqual({
        updates: 'Updates must be an array',
      });
    });

    it('should reject empty updates array', () => {
      const errors = validate({ updates: [] });
      expect(errors).toEqual({
        updates: 'At least one update is required',
      });
    });

    it('should reject too many updates', () => {
      const updates = Array(1001).fill({
        issue_identifier: 'PROJ-1',
        field: 'status',
        value: 'done',
      });
      const errors = validate({ updates });
      expect(errors).toEqual({
        updates: 'Maximum 1000 updates allowed per operation',
      });
    });

    it('should validate each update item', () => {
      const args = {
        updates: [
          {
            issue_identifier: '',
            field: 'status',
            value: 'done',
          },
          {
            issue_identifier: 'PROJ-2',
            field: 'invalid_field',
            value: 'high',
          },
          {
            issue_identifier: 'PROJ-3',
            field: 'priority',
            value: '',
          },
        ],
      };

      const errors = validate(args);
      expect(errors.updates[0]).toEqual({
        issue_identifier: 'Issue identifier is required',
      });
      expect(errors.updates[1]).toEqual({
        field: 'Field must be one of: title, description, status, priority, component, milestone',
      });
      expect(errors.updates[2]).toEqual({
        value: 'Value is required',
      });
    });

    it('should validate batch_size option', () => {
      const args = {
        updates: [
          {
            issue_identifier: 'PROJ-1',
            field: 'status',
            value: 'done',
          },
        ],
        options: {
          batch_size: 101,
        },
      };

      const errors = validate(args);
      expect(errors).toEqual({
        batch_size: 'Batch size must be a number between 1 and 100',
      });
    });
  });

  describe('handler', () => {
    const validArgs = {
      updates: [
        {
          issue_identifier: 'PROJ-1',
          field: 'status',
          value: 'done',
        },
        {
          issue_identifier: 'PROJ-2',
          field: 'priority',
          value: 'high',
        },
      ],
    };

    it('should execute bulk update successfully', async () => {
      // Mock successful updates
      mockIssueService.updateIssue
        .mockResolvedValueOnce({
          success: true,
          data: { _id: '1', identifier: 'PROJ-1', status: 'Done' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { _id: '2', identifier: 'PROJ-2', priority: 'High' },
        });

      const result = await handler(validArgs, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = result.content[0].text;
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.succeeded).toBe(2);
      expect(data.summary.failed).toBe(0);
      expect(data.successful_updates).toHaveLength(2);
      expect(data.failed_updates).toBeUndefined();

      // Verify issue service was called correctly
      expect(mockIssueService.updateIssue).toHaveBeenCalledTimes(2);
      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-1',
        'status',
        'done'
      );
      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-2',
        'priority',
        'high'
      );
    });

    it('should handle partial failures', async () => {
      // Mock one success and one failure
      mockIssueService.updateIssue
        .mockResolvedValueOnce({
          success: true,
          data: { _id: '1', identifier: 'PROJ-1', status: 'Done' },
        })
        .mockRejectedValueOnce(new Error('Issue not found'));

      const result = await handler(validArgs, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = result.content[0].text;
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBe(1);
      expect(data.summary.failed).toBe(1);
      expect(data.successful_updates).toHaveLength(1);
      expect(data.failed_updates).toHaveLength(1);
      expect(data.failed_updates[0].error).toBe('Issue not found');
    });

    it('should handle dry run mode', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      // Mock issue existence checks
      mockIssueService.getIssue
        .mockResolvedValueOnce({ success: true, data: { _id: '1', identifier: 'PROJ-1' } })
        .mockResolvedValueOnce({ success: true, data: { _id: '2', identifier: 'PROJ-2' } });

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = result.content[0].text;
      expect(data.success).toBe(true);
      expect(data.dry_run).toBe(true);
      expect(data.valid_count).toBe(2);
      expect(data.invalid_count).toBe(0);
      
      // Verify no updates were made
      expect(mockIssueService.updateIssue).not.toHaveBeenCalled();
      
      // Verify existence checks were made
      expect(mockIssueService.getIssue).toHaveBeenCalledTimes(2);
    });

    it('should validate issues exist in dry run', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      // Mock one existing and one non-existing issue
      mockIssueService.getIssue
        .mockResolvedValueOnce({ success: true, data: { _id: '1' } })
        .mockRejectedValueOnce(new Error('Issue PROJ-2 not found'));

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = result.content[0].text;
      expect(data.success).toBe(true);
      expect(data.valid_count).toBe(1);
      expect(data.invalid_count).toBe(1);
      expect(data.validation_errors).toHaveLength(1);
      expect(data.validation_errors[0].error).toBe('Issue PROJ-2 not found');
    });

    it('should respect batch size', async () => {
      const largeBatch = {
        updates: Array(25).fill(null).map((_, i) => ({
          issue_identifier: `PROJ-${i + 1}`,
          field: 'status',
          value: 'done',
        })),
        options: {
          batch_size: 5,
        },
      };

      // Mock all updates as successful
      mockIssueService.updateIssue.mockResolvedValue({
        success: true,
        data: { status: 'Done' },
      });

      const result = await handler(largeBatch, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = result.content[0].text;
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(25);
      expect(data.summary.succeeded).toBe(25);
      
      // Check that progress was logged multiple times
      const progressLogs = mockContext.logger.info.mock.calls.filter(
        call => call[0].includes('Bulk update progress')
      );
      expect(progressLogs.length).toBeGreaterThan(1);
    });

    it('should handle complete failure gracefully', async () => {
      // Mock all updates failing
      mockIssueService.updateIssue.mockRejectedValue(new Error('Service unavailable'));

      const result = await handler(validArgs, mockContext);

      expect(result.content[0].type).toBe('text');
      const data = result.content[0].text;
      expect(data.success).toBe(true); // Tool succeeds even if all updates fail
      expect(data.summary.succeeded).toBe(0);
      expect(data.summary.failed).toBe(2);
      expect(data.failed_updates).toHaveLength(2);
    });

    it('should stop on error when continue_on_error is false', async () => {
      const argsWithStopOnError = {
        updates: [
          { issue_identifier: 'PROJ-1', field: 'status', value: 'done' },
          { issue_identifier: 'PROJ-2', field: 'status', value: 'done' },
          { issue_identifier: 'PROJ-3', field: 'status', value: 'done' },
        ],
        options: {
          continue_on_error: false,
        },
      };

      // Mock first success, second failure
      mockIssueService.updateIssue
        .mockResolvedValueOnce({ success: true, data: { status: 'Done' } })
        .mockRejectedValueOnce(new Error('Update failed'));

      const result = await handler(argsWithStopOnError, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Update failed');
      
      // Should have only tried 2 updates (stopped after failure)
      expect(mockIssueService.updateIssue).toHaveBeenCalledTimes(2);
    });
  });
});