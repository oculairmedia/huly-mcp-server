/**
 * Tests for BulkOperationService
 */

/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { BulkOperationService } from '../BulkOperationService.js';
import { Logger } from '../../utils/Logger.js';

describe('BulkOperationService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = new Logger({ silent: true });
    service = new BulkOperationService({}, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(service.config.batchSize).toBe(25);
      expect(service.config.batchDelay).toBe(100);
      expect(service.config.enableProgress).toBe(true);
      expect(service.config.enableTransactions).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        batchSize: 50,
        batchDelay: 200,
      };
      const customService = new BulkOperationService(customConfig, mockLogger);
      expect(customService.config.batchSize).toBe(50);
      expect(customService.config.batchDelay).toBe(200);
    });
  });

  describe('executeBulkOperation', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await service.executeBulkOperation({
        items,
        operation,
        options: { batchSize: 3, batchDelay: 0 },
      });

      expect(operation).toHaveBeenCalledTimes(10);
      expect(result.summary.total).toBe(10);
      expect(result.summary.succeeded).toBe(10);
      expect(result.summary.failed).toBe(0);
    });

    it('should handle operation failures', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const operation = jest
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ success: true });

      const result = await service.executeBulkOperation({
        items,
        operation,
        options: { batchDelay: 0 },
      });

      expect(result.summary.succeeded).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Failed');
    });

    it('should report progress during operation', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      const operation = jest.fn().mockResolvedValue({ success: true });
      const progressCallback = jest.fn();

      await service.executeBulkOperation({
        items,
        operation,
        options: {
          batchSize: 2,
          batchDelay: 0,
          progressCallback,
        },
      });

      // Progress should be reported after each batch
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('validateBulkOperation', () => {
    it('should validate empty items', async () => {
      const result = await service.validateBulkOperation([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No items provided for bulk operation');
    });

    it('should check for duplicates when requested', async () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'A' },
      ];

      const result = await service.validateBulkOperation(items, {
        checkDuplicates: true,
        uniqueField: 'name',
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('duplicate items');
    });

    it('should validate individual items with custom validator', async () => {
      const items = [
        { id: 1, name: 'Valid' },
        { id: 2, name: '' },
      ];

      const itemValidator = jest.fn().mockImplementation((item) => ({
        valid: item.name.length > 0,
        errors: item.name.length === 0 ? ['Name is required'] : [],
      }));

      const result = await service.validateBulkOperation(items, {
        itemValidator,
      });

      expect(itemValidator).toHaveBeenCalledTimes(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('batch creation', () => {
    it('should create correct number of batches', () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const batches = service._createBatches(items, 3);

      expect(batches).toHaveLength(4);
      expect(batches[0]).toEqual([0, 1, 2]);
      expect(batches[1]).toEqual([3, 4, 5]);
      expect(batches[2]).toEqual([6, 7, 8]);
      expect(batches[3]).toEqual([9]);
    });
  });

  describe('operation tracking', () => {
    it('should track operation status', async () => {
      const items = [{ id: 1 }];
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true };
      };

      const promise = service.executeBulkOperation({
        items,
        operation,
      });

      // Check status while operation is running
      const activeOps = Array.from(service.activeOperations.values());
      expect(activeOps).toHaveLength(1);
      expect(activeOps[0].status).toBe('in_progress');

      await promise;
    });

    it('should provide operation status', async () => {
      const items = [{ id: 1 }];
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await service.executeBulkOperation({
        items,
        operation,
      });

      const status = service.getOperationStatus(result.operationId);
      expect(status).toBeTruthy();
      expect(status.status).toBe('completed');
      expect(status.progress.percentage).toBe(100);
    });
  });

  describe('time estimation', () => {
    it('should estimate remaining time', () => {
      const operationState = {
        processed: 50,
        total: 100,
        startTime: Date.now() - 5000, // 5 seconds ago
      };

      const estimate = service._estimateTimeRemaining(operationState);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(10); // Should be around 5 seconds
    });
  });
});
