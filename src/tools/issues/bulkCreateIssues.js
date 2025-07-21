/**
 * Bulk Create Issues Tool
 *
 * Creates multiple issues in a single operation with batch processing
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { BulkOperationService } from '../../services/BulkOperationService.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_bulk_create_issues',
  description:
    'Create multiple issues in a single operation. Supports batch processing with templates and defaults.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "LMP", "HULLY")',
      },
      issues: {
        type: 'array',
        description: 'Array of issues to create',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Issue title',
            },
            description: {
              type: 'string',
              description: 'Issue description (optional)',
            },
            priority: {
              type: 'string',
              description: 'Issue priority (optional, defaults to medium)',
              enum: ['low', 'medium', 'high', 'urgent'],
            },
            component: {
              type: 'string',
              description: 'Component name (optional)',
            },
            milestone: {
              type: 'string',
              description: 'Milestone name (optional)',
            },
            parent_issue: {
              type: 'string',
              description: 'Parent issue identifier for creating sub-issues (optional)',
            },
          },
          required: ['title'],
        },
        minItems: 1,
        maxItems: 100, // Reasonable limit to prevent abuse
      },
      defaults: {
        type: 'object',
        description: 'Default values to apply to all issues',
        properties: {
          priority: {
            type: 'string',
            description: 'Default priority',
            enum: ['low', 'medium', 'high', 'urgent'],
          },
          component: {
            type: 'string',
            description: 'Default component',
          },
          milestone: {
            type: 'string',
            description: 'Default milestone',
          },
        },
      },
      options: {
        type: 'object',
        description: 'Operation options',
        properties: {
          batch_size: {
            type: 'number',
            description: 'Number of issues to create in each batch (default: 10)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
          continue_on_error: {
            type: 'boolean',
            description: 'Continue processing if a creation fails (default: true)',
            default: true,
          },
          dry_run: {
            type: 'boolean',
            description: 'Validate issues without creating them (default: false)',
            default: false,
          },
        },
      },
    },
    required: ['project_identifier', 'issues'],
  },
  annotations: {
    title: 'Bulk Create Issues',
    readOnlyHint: false, // Creates new data
    destructiveHint: false, // Does not delete data
    idempotentHint: false, // Creates new issues each time
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
    logger.info(`Starting bulk creation of ${args.issues.length} issues`);

    const bulkService = new BulkOperationService({}, logger);

    // Apply defaults to all issues
    const issuesToCreate = args.issues.map((issue) => ({
      ...args.defaults,
      ...issue,
      project_identifier: args.project_identifier,
    }));

    // If dry run, just validate
    if (args.options?.dry_run) {
      logger.info('Performing dry run validation');

      // Validate each issue
      const validItems = [];
      const invalidItems = [];

      for (const issue of issuesToCreate) {
        const validationErrors = [];

        // Basic validation
        if (!issue.title || issue.title.trim().length === 0) {
          validationErrors.push('Title is required');
        }

        if (issue.priority && !['low', 'medium', 'high', 'urgent'].includes(issue.priority)) {
          validationErrors.push('Invalid priority value');
        }

        if (validationErrors.length > 0) {
          invalidItems.push({
            item: issue,
            errors: validationErrors,
          });
        } else {
          validItems.push(issue);
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

    // Execute bulk creation
    const result = await bulkService.executeBulkOperation({
      items: issuesToCreate,
      operation: async (issue) => {
        logger.debug(`Creating issue: ${issue.title}`);

        // Handle sub-issue creation differently
        if (issue.parent_issue) {
          return issueService.createSubissue(
            client,
            issue.parent_issue,
            issue.title,
            issue.description,
            issue.priority || 'medium',
            issue.component || null,
            issue.milestone || null
          );
        } else {
          return issueService.createIssue(
            client,
            issue.project_identifier,
            issue.title,
            issue.description,
            issue.priority || 'medium',
            issue.component || null,
            issue.milestone || null
          );
        }
      },
      options: {
        batchSize: args.options?.batch_size || 10,
        continueOnError: args.options?.continue_on_error !== false,
        progressCallback: (progress) => {
          logger.info(
            `Bulk create progress: ${progress.processed}/${progress.total} ` +
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

    // Collect successful creations
    const created_issues = result.results
      .filter((r) => r.success)
      .map((r) => ({
        title: r.item.title,
        identifier: r.result.data.identifier,
        project: r.result.data.project,
        status: r.result.data.status,
        priority: r.result.data.priority,
      }));

    // Collect failed creations
    const failed_issues = result.results
      .filter((r) => !r.success)
      .map((r) => ({
        title: r.item.title,
        error: r.error,
      }));

    logger.info(
      `Bulk create completed: ${summary.succeeded} succeeded, ${summary.failed} failed in ${summary.elapsed_ms}ms`
    );

    return createToolResponse(
      JSON.stringify(
        {
          success: true,
          summary,
          created_issues: created_issues.length > 0 ? created_issues : undefined,
          failed_issues: failed_issues.length > 0 ? failed_issues : undefined,
        },
        null,
        2
      )
    );
  } catch (error) {
    logger.error('Failed to execute bulk create:', error);
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

  // Validate project identifier
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }

  // Validate issues array
  if (!args.issues || !Array.isArray(args.issues)) {
    errors.issues = 'Issues must be an array';
    return errors;
  }

  if (args.issues.length === 0) {
    errors.issues = 'At least one issue is required';
    return errors;
  }

  if (args.issues.length > 100) {
    errors.issues = 'Maximum 100 issues allowed per operation';
    return errors;
  }

  // Validate each issue
  const issueErrors = [];
  const validPriorities = ['low', 'medium', 'high', 'urgent'];

  args.issues.forEach((issue, index) => {
    const itemErrors = {};

    // Validate title
    if (!issue.title || issue.title.trim().length === 0) {
      itemErrors.title = 'Title is required';
    }

    // Validate priority if provided
    if (issue.priority && !validPriorities.includes(issue.priority)) {
      itemErrors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
    }

    if (Object.keys(itemErrors).length > 0) {
      issueErrors[index] = itemErrors;
    }
  });

  if (issueErrors.length > 0) {
    errors.issues = issueErrors;
  }

  // Validate defaults if provided
  if (args.defaults) {
    if (args.defaults.priority && !validPriorities.includes(args.defaults.priority)) {
      errors.defaults = {
        priority: `Default priority must be one of: ${validPriorities.join(', ')}`,
      };
    }
  }

  // Validate options if provided
  if (args.options) {
    if (
      args.options.batch_size !== undefined &&
      (typeof args.options.batch_size !== 'number' ||
        args.options.batch_size < 1 ||
        args.options.batch_size > 50)
    ) {
      errors.batch_size = 'Batch size must be a number between 1 and 50';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
