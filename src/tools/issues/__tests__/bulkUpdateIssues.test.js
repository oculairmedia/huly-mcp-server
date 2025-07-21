/**
 * Tests for Bulk Update Issues Tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Create a mock module for BulkOperationService
const mockBulkOperationService = jest.fn();
const mockExecuteBulkOperation = jest.fn();
const mockValidateBulkOperation = jest.fn();

// Mock the base logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Override the module resolver to return our mock
jest.unstable_mockModule('../../../services/BulkOperationService.js', () => ({
  BulkOperationService: mockBulkOperationService,
}));

// Import after mocking
const { handler, validate, definition } = await import('../bulkUpdateIssues.js');

describe('bulkUpdateIssues', () => {
  let mockContext;
  let mockIssueService;
  let mockBulkService;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the BulkOperationService mock
    mockBulkOperationService.mockClear();
    mockExecuteBulkOperation.mockClear();
    mockValidateBulkOperation.mockClear();

    mockIssueService = {
      updateIssue: jest.fn(),
      getIssue: jest.fn(),
    };

    mockClient = {
      findOne: jest.fn(),
    };

    mockContext = {
      client: mockClient,
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
    mockBulkOperationService.mockImplementation((config, logger) => {
      // Store the logger for later verification if needed
      mockBulkService._logger = logger || mockLogger;
      return mockBulkService;
    });
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

      // Mock the executeBulkOperation to simulate processing
      mockExecuteBulkOperation.mockImplementation(async ({ items, operation, options }) => {
        const results = [];
        for (let i = 0; i < items.length; i++) {
          try {
            const updateResult = await operation(items[i], i);
            results.push({
              index: i,
              success: true,
              item: items[i],
              result: updateResult,
            });
          } catch (error) {
            results.push({
              index: i,
              success: false,
              item: items[i],
              error: error.message,
            });
          }
        }

        // Call progress callback if provided
        if (options.progressCallback) {
          options.progressCallback({
            processed: items.length,
            total: items.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
          });
        }

        return {
          summary: {
            total: items.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            duration: 150,
          },
          results,
          errors: [],
        };
      });

      const result = await handler(validArgs, mockContext);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const parsedData = JSON.parse(result.content[0].text);
      expect(parsedData.success).toBe(true);
      expect(parsedData.summary).toMatchObject({
        total: 2,
        succeeded: 2,
        failed: 0,
      });
      expect(parsedData.summary.elapsed_ms).toBeGreaterThan(0);
      expect(parsedData.successful_updates).toHaveLength(2);
      expect(parsedData.failed_updates).toBeUndefined();
    });

    it('should handle partial failures', async () => {
      // Mock one success and one failure
      mockIssueService.updateIssue
        .mockResolvedValueOnce({
          success: true,
          data: { _id: '1', identifier: 'PROJ-1', status: 'Done' },
        })
        .mockRejectedValueOnce(new Error('Issue not found'));

      // Mock the executeBulkOperation to simulate processing
      mockExecuteBulkOperation.mockImplementation(async ({ items, operation, options }) => {
        const results = [];
        for (let i = 0; i < items.length; i++) {
          try {
            const updateResult = await operation(items[i], i);
            results.push({
              index: i,
              success: true,
              item: items[i],
              result: updateResult,
            });
          } catch (error) {
            results.push({
              index: i,
              success: false,
              item: items[i],
              error: error.message,
            });
          }
        }

        // Call progress callback if provided
        if (options.progressCallback) {
          options.progressCallback({
            processed: items.length,
            total: items.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
          });
        }

        return {
          summary: {
            total: items.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            duration: 150,
          },
          results,
          errors: [],
        };
      });

      const result = await handler(validArgs, mockContext);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const parsedData = JSON.parse(result.content[0].text);
      expect(parsedData.success).toBe(true);
      expect(parsedData.summary.succeeded).toBe(1);
      expect(parsedData.summary.failed).toBe(1);
      expect(parsedData.successful_updates).toHaveLength(1);
      expect(parsedData.failed_updates).toHaveLength(1);
      expect(parsedData.failed_updates[0].error).toBe('Issue not found');
    });

    it('should handle dry run mode', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      // Mock client.findOne for dry run validation
      mockClient.findOne.mockResolvedValue({ _id: '1', identifier: 'PROJ-1' });

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const parsedData = JSON.parse(result.content[0].text);
      expect(parsedData.success).toBe(true);
      expect(parsedData.dry_run).toBe(true);
      expect(parsedData.valid_count).toBe(2);
      expect(parsedData.invalid_count).toBe(0);
      expect(mockExecuteBulkOperation).not.toHaveBeenCalled();
    });

    it('should validate issues exist in dry run', async () => {
      const argsWithDryRun = {
        ...validArgs,
        options: {
          dry_run: true,
        },
      };

      // Mock client.findOne for dry run validation
      mockClient.findOne
        .mockResolvedValueOnce({ _id: '1', identifier: 'PROJ-1' })
        .mockResolvedValueOnce(null); // Second issue not found

      const result = await handler(argsWithDryRun, mockContext);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const parsedData = JSON.parse(result.content[0].text);
      expect(parsedData.success).toBe(true);
      expect(parsedData.valid_count).toBe(1);
      expect(parsedData.invalid_count).toBe(1);
      expect(parsedData.validation_errors).toHaveLength(1);
      expect(parsedData.validation_errors[0].error).toBe('Issue PROJ-2 not found');
    });

    it('should pass options to bulk service', async () => {
      const argsWithOptions = {
        ...validArgs,
        options: {
          batch_size: 5,
          continue_on_error: false,
        },
      };

      // Clear previous mocks and set up fresh implementation
      mockExecuteBulkOperation.mockClear();
      mockExecuteBulkOperation.mockImplementation(async ({ items, _operation, _options }) => {
        // Just verify the options are passed correctly
        return {
          summary: {
            total: 2,
            succeeded: 2,
            failed: 0,
            duration: 100,
          },
          results: items.map((item, i) => ({
            success: true,
            item,
            result: { success: true, data: { _id: `${i + 1}` } },
          })),
          errors: [],
        };
      });

      await handler(argsWithOptions, mockContext);

      // Check that bulk operation service was instantiated
      expect(mockBulkOperationService).toHaveBeenCalled();

      // Check that executeBulkOperation was called with correct options
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
      // Clear any previous implementations
      mockExecuteBulkOperation.mockReset();
      mockExecuteBulkOperation.mockRejectedValue(new Error('Service unavailable'));

      const result = await handler(validArgs, mockContext);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      // Check that an error was returned
      expect(result.content[0].text).toMatch(/^Error: /);
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to execute bulk update:',
        expect.any(Error)
      );
    });

    it('should log progress updates', async () => {
      // Mock the executeBulkOperation with progress updates
      mockExecuteBulkOperation.mockImplementation(async ({ items, operation, options }) => {
        const results = [];

        // Process items and send progress updates
        for (let i = 0; i < items.length; i++) {
          try {
            const updateResult = await operation(items[i], i);
            results.push({
              success: true,
              item: items[i],
              result: updateResult,
            });
          } catch (error) {
            results.push({
              success: false,
              item: items[i],
              error: error.message,
            });
          }

          // Send progress update after each item
          if (options.progressCallback) {
            options.progressCallback({
              processed: i + 1,
              total: items.length,
              succeeded: results.filter((r) => r.success).length,
              failed: results.filter((r) => !r.success).length,
            });
          }
        }

        return {
          summary: {
            total: items.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            duration: 100,
          },
          results,
          errors: [],
        };
      });

      // Mock successful and failed updates
      mockIssueService.updateIssue
        .mockResolvedValueOnce({
          success: true,
          data: { _id: '1', identifier: 'PROJ-1', status: 'Done' },
        })
        .mockRejectedValueOnce(new Error('Update failed'));

      await handler(validArgs, mockContext);

      // Check that progress was logged
      const progressCalls = mockContext.logger.info.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Bulk update progress:')
      );
      expect(progressCalls.length).toBeGreaterThanOrEqual(1);

      // Verify the final progress shows 1 succeeded and 1 failed
      const lastProgressCall = progressCalls[progressCalls.length - 1];
      expect(lastProgressCall[0]).toContain('1 succeeded, 1 failed');
    });
  });
});
