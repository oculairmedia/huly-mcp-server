/**
 * Bulk Delete Issues Tool
 *
 * Deletes multiple issues in a single operation with progress tracking
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidIssueIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_bulk_delete_issues',
  description:
    'Delete multiple issues in a single operation. Supports batch processing with progress tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifiers: {
        type: 'array',
        description: 'Array of issue identifiers to delete (e.g., ["PROJ-1", "PROJ-2"])',
        items: {
          type: 'string',
        },
        minItems: 1,
        maxItems: 1000,
      },
      options: {
        type: 'object',
        description: 'Operation options',
        properties: {
          cascade: {
            type: 'boolean',
            description: 'Delete sub-issues as well (default: true)',
            default: true,
          },
          force: {
            type: 'boolean',
            description: 'Force deletion even with blocking references (default: false)',
            default: false,
          },
          dry_run: {
            type: 'boolean',
            description: 'Preview deletion impact without actually deleting (default: false)',
            default: false,
          },
          continue_on_error: {
            type: 'boolean',
            description: 'Continue processing if a deletion fails (default: true)',
            default: true,
          },
          batch_size: {
            type: 'number',
            description: 'Number of issues to delete in each batch (default: 10)',
            default: 10,
            minimum: 1,
            maximum: 50,
          },
        },
      },
    },
    required: ['issue_identifiers'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { issue_identifiers, options = {} } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Bulk deleting issues', { count: issue_identifiers.length, options });

    // Validate all issue identifiers
    const invalidIdentifiers = issue_identifiers.filter((id) => !isValidIssueIdentifier(id));
    if (invalidIdentifiers.length > 0) {
      throw HulyError.validation(
        'issue_identifiers',
        invalidIdentifiers,
        'All identifiers must be in format "PROJ-123"'
      );
    }

    // Check for duplicates
    const uniqueIdentifiers = [...new Set(issue_identifiers)];
    if (uniqueIdentifiers.length !== issue_identifiers.length) {
      logger.warn('Duplicate issue identifiers detected, using unique set');
    }

    // Use DeletionService to handle bulk deletion
    const result = await deletionService.bulkDeleteIssues(client, uniqueIdentifiers, options);

    return {
      content: [
        {
          type: 'text',
          text: result.content[0].text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to bulk delete issues:', error);
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

  // Validate issue_identifiers
  if (!args.issue_identifiers || !Array.isArray(args.issue_identifiers)) {
    errors.issue_identifiers = 'Must be an array of issue identifiers';
  } else if (args.issue_identifiers.length === 0) {
    errors.issue_identifiers = 'At least one issue identifier is required';
  } else if (args.issue_identifiers.length > 1000) {
    errors.issue_identifiers = 'Maximum 1000 issues can be deleted at once';
  }

  // Validate options if provided
  if (args.options && typeof args.options !== 'object') {
    errors.options = 'Options must be an object';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
