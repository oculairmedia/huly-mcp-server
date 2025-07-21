/**
 * BulkOperationService
 *
 * Core service for handling bulk operations on Huly entities
 * Provides batch processing, transaction support, and progress tracking
 */

import { HulyError } from '../core/HulyError.js';
import { OPERATION_TIMEOUT } from '../core/constants.js';

/**
 * Configuration for bulk operations
 */
const DEFAULT_CONFIG = {
  batchSize: 25,
  batchDelay: 100, // ms between batches
  enableProgress: true,
  enableTransactions: true,
  continueOnError: true, // Continue processing even if some items fail
  timeout: OPERATION_TIMEOUT * 10, // Extended timeout for bulk operations
};

/**
 * BulkOperationService class
 * Handles bulk operations with batch processing and transaction support
 */
export class BulkOperationService {
  /**
   * @param {Object} config - Service configuration
   * @param {import('../utils/Logger').Logger} logger - Logger instance
   */
  constructor(config = {}, logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
    this.activeOperations = new Map();
  }

  /**
   * Execute a bulk operation with batch processing
   * @param {Object} params - Operation parameters
   * @param {Array} params.items - Items to process
   * @param {Function} params.operation - Operation function to apply to each item
   * @param {Object} params.options - Operation options
   * @returns {Promise<Object>} Operation results
   */
  async executeBulkOperation({ items, operation, options = {} }) {
    const operationId = this._generateOperationId();
    const operationOptions = { ...this.config, ...options };

    this.logger.info(`Starting bulk operation ${operationId}`, {
      itemCount: items.length,
      batchSize: operationOptions.batchSize,
    });

    // Initialize operation tracking
    const operationState = {
      id: operationId,
      total: items.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      errors: [],
      startTime: Date.now(),
      status: 'in_progress',
      progressCallback: options.progressCallback,
    };

    this.activeOperations.set(operationId, operationState);

    try {
      // Process items in batches
      const results = await this._processBatches(
        items,
        operation,
        operationOptions,
        operationState
      );

      operationState.status = 'completed';
      operationState.endTime = Date.now();
      operationState.duration = operationState.endTime - operationState.startTime;

      this.logger.info(`Completed bulk operation ${operationId}`, {
        duration: operationState.duration,
        succeeded: operationState.succeeded,
        failed: operationState.failed,
      });

      return {
        operationId,
        summary: {
          total: operationState.total,
          succeeded: operationState.succeeded,
          failed: operationState.failed,
          duration: operationState.duration,
        },
        results: results,
        errors: operationState.errors,
      };
    } catch (error) {
      operationState.status = 'failed';
      operationState.error = error.message;

      this.logger.error(`Bulk operation ${operationId} failed`, error);
      throw new HulyError('BULK_OPERATION_FAILED', error.message || 'Bulk operation failed', {
        operationId,
        error: error.message,
      });
    } finally {
      // Clean up after a delay
      const cleanupTimer = setTimeout(() => {
        this.activeOperations.delete(operationId);
      }, 60000); // Keep for 1 minute for status queries

      // Allow cleanup timer to be cleared in tests
      if (process.env.NODE_ENV === 'test') {
        cleanupTimer.unref();
      }
    }
  }

  /**
   * Process items in batches
   * @private
   */
  async _processBatches(items, operation, options, operationState) {
    const results = [];
    const batches = this._createBatches(items, options.batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      this.logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`, {
        batchSize: batch.length,
        operationId: operationState.id,
      });

      // Process batch
      const batchResults = await this._processBatch(batch, operation, operationState, options);

      results.push(...batchResults);

      // Update progress
      operationState.processed += batch.length;
      this._reportProgress(operationState);

      // Check if we should stop on error
      if (!options.continueOnError && operationState.failed > 0) {
        this.logger.warn(`Stopping bulk operation due to failure (continueOnError: false)`);
        // Mark remaining items as skipped
        const remainingCount = items.length - operationState.processed;
        if (remainingCount > 0) {
          operationState.skipped = remainingCount;
          this.logger.info(`Skipped ${remainingCount} remaining items`);
        }
        // Throw error to indicate operation was stopped
        throw new Error(operationState.errors[operationState.errors.length - 1].error);
      }

      // Delay between batches (except for last batch)
      if (batchIndex < batches.length - 1 && options.batchDelay > 0) {
        await this._delay(options.batchDelay);
      }
    }

    return results;
  }

  /**
   * Process a single batch of items
   * @private
   */
  async _processBatch(batch, operation, operationState, options) {
    const batchResults = [];

    // If continueOnError is false, process sequentially to stop on first error
    if (options && !options.continueOnError) {
      for (const item of batch) {
        try {
          const result = await operation(item, batch.indexOf(item));
          operationState.succeeded++;
          batchResults.push({ success: true, item, result });
        } catch (error) {
          operationState.failed++;
          operationState.errors.push({
            item,
            error: error.message,
            stack: error.stack,
          });
          batchResults.push({ success: false, item, error: error.message });
          // Stop processing remaining items in batch
          break;
        }
      }
    } else {
      // Process items in parallel within the batch
      const promises = batch.map(async (item, index) => {
        try {
          const result = await operation(item, index);
          operationState.succeeded++;
          return { success: true, item, result };
        } catch (error) {
          operationState.failed++;
          operationState.errors.push({
            item,
            error: error.message,
            stack: error.stack,
          });
          return { success: false, item, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      batchResults.push(...results);
    }

    return batchResults;
  }

  /**
   * Create batches from items array
   * @private
   */
  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Report operation progress
   * @private
   */
  _reportProgress(operationState) {
    if (!this.config.enableProgress) return;

    const progress = {
      operationId: operationState.id,
      processed: operationState.processed,
      total: operationState.total,
      percentage: Math.round((operationState.processed / operationState.total) * 100),
      succeeded: operationState.succeeded,
      failed: operationState.failed,
      estimatedTimeRemaining: this._estimateTimeRemaining(operationState),
    };

    this.logger.debug('Bulk operation progress', progress);

    // TODO: Emit progress event or call progress callback
    if (operationState.progressCallback) {
      operationState.progressCallback(progress);
    }
  }

  /**
   * Estimate time remaining for operation
   * @private
   */
  _estimateTimeRemaining(operationState) {
    if (operationState.processed === 0) return null;

    const elapsedTime = Date.now() - operationState.startTime;
    const avgTimePerItem = elapsedTime / operationState.processed;
    const remainingItems = operationState.total - operationState.processed;
    const estimatedTime = remainingItems * avgTimePerItem;

    return Math.round(estimatedTime / 1000); // Return in seconds
  }

  /**
   * Execute operations in a transaction
   * @param {Function} client - Huly client instance
   * @param {Array} operations - Array of operations to execute
   * @returns {Promise<Object>} Transaction results
   */
  async executeInTransaction(client, operations) {
    if (!this.config.enableTransactions) {
      throw new HulyError('TRANSACTIONS_DISABLED', 'Transactions are disabled');
    }

    this.logger.debug('Starting transaction', { operationCount: operations.length });

    // TODO: Implement actual transaction logic when Huly SDK supports it
    // For now, we'll execute operations sequentially and track state
    const transactionState = {
      operations: [],
      completed: [],
      failed: null,
    };

    try {
      for (const operation of operations) {
        const result = await operation();
        transactionState.completed.push(result);
      }

      return {
        success: true,
        results: transactionState.completed,
      };
    } catch (error) {
      transactionState.failed = error;

      // TODO: Implement rollback logic
      this.logger.error('Transaction failed, rollback needed', error);

      throw new HulyError('TRANSACTION_FAILED', 'Transaction failed', {
        completed: transactionState.completed.length,
        total: operations.length,
        error: error.message,
      });
    }
  }

  /**
   * Validate bulk operation parameters
   * @param {Array} items - Items to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation results
   */
  async validateBulkOperation(items, options = {}) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check item count
    if (!items || items.length === 0) {
      validation.valid = false;
      validation.errors.push('No items provided for bulk operation');
    }

    // Check for duplicates if needed
    if (options.checkDuplicates) {
      const duplicates = this._findDuplicates(items, options.uniqueField);
      if (duplicates.length > 0) {
        validation.warnings.push(`Found ${duplicates.length} duplicate items`);
      }
    }

    // Validate individual items if validator provided
    if (options.itemValidator) {
      for (const item of items) {
        try {
          const itemValidation = await options.itemValidator(item);
          if (!itemValidation.valid) {
            validation.errors.push({
              item,
              errors: itemValidation.errors,
            });
          }
        } catch (error) {
          validation.errors.push({
            item,
            error: error.message,
          });
        }
      }
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  /**
   * Get status of an active operation
   * @param {string} operationId - Operation ID
   * @returns {Object|null} Operation status
   */
  getOperationStatus(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return null;

    return {
      id: operation.id,
      status: operation.status,
      progress: {
        processed: operation.processed,
        total: operation.total,
        percentage: Math.round((operation.processed / operation.total) * 100),
        succeeded: operation.succeeded,
        failed: operation.failed,
      },
      duration: operation.endTime ? operation.duration : Date.now() - operation.startTime,
      estimatedTimeRemaining: this._estimateTimeRemaining(operation),
    };
  }

  /**
   * Cancel an active operation
   * @param {string} operationId - Operation ID
   * @returns {boolean} Whether cancellation was successful
   */
  cancelOperation(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation || operation.status !== 'in_progress') {
      return false;
    }

    operation.status = 'cancelled';
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;

    this.logger.info(`Cancelled bulk operation ${operationId}`);
    return true;
  }

  /**
   * Helper method to delay execution
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique operation ID
   * @private
   */
  _generateOperationId() {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Find duplicate items in array
   * @private
   */
  _findDuplicates(items, uniqueField) {
    if (!uniqueField) return [];

    const seen = new Set();
    const duplicates = [];

    for (const item of items) {
      const key = item[uniqueField];
      if (seen.has(key)) {
        duplicates.push(item);
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }
}
