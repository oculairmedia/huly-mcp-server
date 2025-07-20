/**
 * Tests for Bulk Update Issues Tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handler, validate, definition } from '../bulkUpdateIssues.js';

// Create a mock module for BulkOperationService
const mockBulkOperationService = jest.fn();
const mockExecuteBulkOperation = jest.fn();
const mockValidateBulkOperation = jest.fn();

// Override the module resolver to return our mock
jest.unstable_mockModule('../../../services/BulkOperationService.js', () => ({
  BulkOperationService: mockBulkOperationService,
}));

describe('bulkUpdateIssues', () => {
  let mockContext;
  let mockIssueService;
  let mockBulkService;

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

    // Setup BulkOperationService mock
    mockBulkService = {
      executeBulkOperation: mockExecuteBulkOperation,
      validateBulkOperation: mockValidateBulkOperation,
    };
    mockBulkOperationService.mockImplementation(() => mockBulkService);
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
      const mockResults = {
        processed: 2,
        results: [
          {
            index: 0,
            success: true,
            result: {
              success: true,
              data: { _id: '1', identifier: 'PROJ-1', status: 'Done' },
            },
          },
          {
            index: 1,
            success: true,
            result: {
              success: true,
              data: { _id: '2', identifier: 'PROJ-2', priority: 'High' },
            },
          },
        ],
        elapsed: 150,
      };

      mockExecuteBulkOperation.mockResolvedValue(mockResults);

      const result = await handler(validArgs, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.summary).toEqual({
        total: 2,
        succeeded: 2,
        failed: 0,
        elapsed_ms: 150,
      });
      expect(result.data.successful_updates).toHaveLength(2);
      expect(result.data.failed_updates).toBeUndefined();
    });

    it('should handle partial failures', async () => {
      const mockResults = {
        processed: 2,
        results: [
          {
            index: 0,
            success: true,
            result: {
              success: true,
              data: { _id: '1', identifier: 'PROJ-1', status: 'Done' },
            },
          },
          {
            index: 1,
            success: false,
            error: 'Issue not found',
          },
        ],
        elapsed: 200,
      };

      mockExecuteBulkOperation.mockResolvedValue(mockResults);

      const result = await handler(validArgs, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.summary.succeeded).toBe(1);
      expect(result.data.summary.failed).toBe(1);
      expect(result.data.successful_updates).toHaveLength(1);
      expect(result.data.failed_updates).toHaveLength(1);
      expect(result.data.failed_updates[0].error).toBe('Issue not found');
    });

    it('should handle dry run mode', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      mockIssueService.getIssue.mockResolvedValue({
        success: true,
        data: { _id: '1', identifier: 'PROJ-1' },
      });

      mockValidateBulkOperation.mockResolvedValue({
        validItems: validArgs.updates,
        invalidItems: [],
      });

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.dry_run).toBe(true);
      expect(result.data.valid_count).toBe(2);
      expect(result.data.invalid_count).toBe(0);
      expect(mockExecuteBulkOperation).not.toHaveBeenCalled();
    });

    it('should validate issues exist in dry run', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      mockIssueService.getIssue
        .mockResolvedValueOnce({ success: true, data: { _id: '1' } })
        .mockRejectedValueOnce(new Error('Not found'));

      mockValidateBulkOperation.mockImplementation(async (items, options) => {
        const results = await Promise.allSettled(
          items.map((item) => options.customValidation(item))
        );
        return {
          validItems: items.filter((_, index) => results[index].status === 'fulfilled'),
          invalidItems: items
            .map((item, index) => ({
              item,
              error: results[index].reason?.message,
            }))
            .filter((_, index) => results[index].status === 'rejected'),
        };
      });

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.valid_count).toBe(1);
      expect(result.data.invalid_count).toBe(1);
    });

    it('should pass options to bulk service', async () => {
      const argsWithOptions = {
        ...validArgs,
        options: {
          batch_size: 5,
          continue_on_error: false,
        },
      };

      mockExecuteBulkOperation.mockResolvedValue({
        processed: 2,
        results: [],
        elapsed: 100,
      });

      await handler(argsWithOptions, mockContext);

      expect(mockExecuteBulkOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            batchSize: 5,
            continueOnError: false,
          }),
        })
      );
    });

    it('should handle complete failure', async () => {
      mockExecuteBulkOperation.mockRejectedValue(new Error('Service unavailable'));

      const result = await handler(validArgs, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to execute bulk update:',
        expect.any(Error)
      );
    });

    it('should log progress updates', async () => {
      let progressCallback;
      mockExecuteBulkOperation.mockImplementation(async ({ options }) => {
        progressCallback = options.progressCallback;
        // Simulate progress updates
        progressCallback({ processed: 1, total: 2, succeeded: 1, failed: 0 });
        progressCallback({ processed: 2, total: 2, succeeded: 1, failed: 1 });
        return {
          processed: 2,
          results: [],
          elapsed: 100,
        };
      });

      await handler(validArgs, mockContext);

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Bulk update progress: 1/2 (1 succeeded, 0 failed)'
      );
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Bulk update progress: 2/2 (1 succeeded, 1 failed)'
      );
    });
  });
});