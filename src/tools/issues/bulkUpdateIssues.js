/**
 * Bulk Update Issues Tool
 *
 * Updates multiple issues in a single operation with batch processing
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { BulkOperationService } from '../../services/BulkOperationService.js';
import trackerModule from '@hcengineering/tracker';

const tracker = trackerModule.default || trackerModule;

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_bulk_update_issues',
  description:
    'Update multiple issues in a single operation. Supports batch processing with progress tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        description: 'Array of update operations to perform',
        items: {
          type: 'object',
          properties: {
            issue_identifier: {
              type: 'string',
              description: 'Issue identifier (e.g., "LMP-1", "PROJ-123")',
            },
            field: {
              type: 'string',
              description: 'Field to update',
              enum: ['title', 'description', 'status', 'priority', 'component', 'milestone'],
            },
            value: {
              type: 'string',
              description:
                'New value for the field. Status accepts: backlog, todo, in-progress, done, canceled (case-insensitive). Priority accepts: urgent, high, medium, low, none/nopriority (case-insensitive).',
            },
          },
          required: ['issue_identifier', 'field', 'value'],
        },
        minItems: 1,
        maxItems: 1000, // Reasonable limit to prevent abuse
      },
      options: {
        type: 'object',
        description: 'Operation options',
        properties: {
          batch_size: {
            type: 'number',
            description: 'Number of issues to process in each batch (default: 10)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          continue_on_error: {
            type: 'boolean',
            description: 'Continue processing if an update fails (default: true)',
            default: true,
          },
          dry_run: {
            type: 'boolean',
            description: 'Validate updates without applying them (default: false)',
            default: false,
          },
        },
      },
    },
    required: ['updates'],
  },
  annotations: {
    title: 'Bulk Update Issues',
    readOnlyHint: false, // Modifies issue data
    destructiveHint: false, // Does not delete data
    idempotentHint: false, // May have different results on retry
    openWorldHint: true, // Interacts with external Huly system
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {import('../base/ToolInterface').ToolContext} context - Execution context
 * @returns {Promise<import('../base/ToolInterface').ToolResponse>}
 */
export async function handler(args, context) {
  const { client, services, logger } = context;
  const { issueService } = services;

  try {
    logger.info(`Starting bulk update of ${args.updates.length} issues`);

    const bulkService = new BulkOperationService({}, logger);

    // If dry run, just validate
    if (args.options?.dry_run) {
      logger.info('Performing dry run validation');

      // Manually validate each issue exists
      const validItems = [];
      const invalidItems = [];

      for (const update of args.updates) {
        try {
          // Check if issue exists
          const issue = await client.findOne(tracker.class.Issue, {
            identifier: update.issue_identifier,
          });
          if (!issue) {
            throw new Error(`Issue ${update.issue_identifier} not found`);
          }
          validItems.push(update);
        } catch (error) {
          invalidItems.push({
            item: update,
            error: error.message,
          });
        }
      }

      return createToolResponse(
        JSON.stringify(
          {
            success: true,
            dry_run: true,
            valid_count: validItems.length,
            invalid_count: invalidItems.length,
            validation_errors: invalidItems,
          },
          null,
          2
        )
      );
    }

    // Execute bulk update
    const result = await bulkService.executeBulkOperation({
      items: args.updates,
      operation: async (update) => {
        logger.debug(
          `Updating issue ${update.issue_identifier}: ${update.field} = ${update.value}`
        );
        return issueService.updateIssue(
          client,
          update.issue_identifier,
          update.field,
          update.value
        );
      },
      options: {
        batchSize: args.options?.batch_size || 10,
        continueOnError: args.options?.continue_on_error !== false,
        progressCallback: (progress) => {
          logger.info(
            `Bulk update progress: ${progress.processed}/${progress.total} ` +
              `(${progress.succeeded} succeeded, ${progress.failed} failed)`
          );
        },
      },
    });

    // Prepare summary of results
    const summary = {
      total: result.summary.total,
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
      elapsed_ms: result.summary.duration,
    };

    // Collect successful updates
    const successful_updates = result.results
      .filter((r) => r.success)
      .map((r) => ({
        issue_identifier: r.item.issue_identifier,
        field: r.item.field,
        value: r.item.value,
        issue: r.result.data,
      }));

    // Collect failed updates
    const failed_updates = result.results
      .filter((r) => !r.success)
      .map((r) => ({
        issue_identifier: r.item.issue_identifier,
        field: r.item.field,
        value: r.item.value,
        error: r.error,
      }));

    logger.info(
      `Bulk update completed: ${summary.succeeded} succeeded, ${summary.failed} failed in ${summary.elapsed_ms}ms`
    );

    return createToolResponse(
      JSON.stringify(
        {
          success: true,
          summary,
          successful_updates: successful_updates.length > 0 ? successful_updates : undefined,
          failed_updates: failed_updates.length > 0 ? failed_updates : undefined,
        },
        null,
        2
      )
    );
  } catch (error) {
    logger.error('Failed to execute bulk update:', error);
    return createErrorResponse(error);
  }
}

/**
 * Optional validation function
 * @param {Object} args - Tool arguments
 * @returns {Object|null} Validation errors or null
 */
export function validate(args) {
  const errors = {};

  // Validate updates array
  if (!args.updates || !Array.isArray(args.updates)) {
    errors.updates = 'Updates must be an array';
    return errors;
  }

  if (args.updates.length === 0) {
    errors.updates = 'At least one update is required';
    return errors;
  }

  if (args.updates.length > 1000) {
    errors.updates = 'Maximum 1000 updates allowed per operation';
    return errors;
  }

  // Validate each update
  const updateErrors = [];
  const validFields = ['title', 'description', 'status', 'priority', 'component', 'milestone'];

  args.updates.forEach((update, index) => {
    const itemErrors = {};

    // Validate issue_identifier
    if (!update.issue_identifier || update.issue_identifier.trim().length === 0) {
      itemErrors.issue_identifier = 'Issue identifier is required';
    }

    // Validate field
    if (!update.field || !validFields.includes(update.field)) {
      itemErrors.field = `Field must be one of: ${validFields.join(', ')}`;
    }

    // Validate value
    if (
      update.value === undefined ||
      update.value === null ||
      update.value.toString().trim().length === 0
    ) {
      itemErrors.value = 'Value is required';
    }

    if (Object.keys(itemErrors).length > 0) {
      updateErrors[index] = itemErrors;
    }
  });

  if (updateErrors.length > 0) {
    errors.updates = updateErrors;
  }

  // Validate options if provided
  if (args.options) {
    if (
      args.options.batch_size !== undefined &&
      (typeof args.options.batch_size !== 'number' ||
        args.options.batch_size < 1 ||
        args.options.batch_size > 100)
    ) {
      errors.batch_size = 'Batch size must be a number between 1 and 100';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
