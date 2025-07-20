/**
 * Delete Issue Tool
 *
 * Deletes an issue and optionally its sub-issues from a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { validateIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_issue',
  description: 'Delete an issue and optionally its sub-issues',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "PROJ-123")',
      },
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
    },
    required: ['issue_identifier'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { issue_identifier, cascade = true, force = false, dry_run = false } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Deleting issue', args);

    // Validate issue identifier format
    if (!validateIdentifier(issue_identifier)) {
      throw HulyError.invalidValue('issue_identifier', issue_identifier, 'format like "PROJ-123"');
    }

    // Use DeletionService to handle the deletion
    const result = await deletionService.deleteIssue(client, issue_identifier, {
      cascade,
      force,
      dryRun: dry_run,
    });

    return {
      content: [
        {
          type: 'text',
          text: result.content[0].text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to delete issue:', error);
    return createErrorResponse(error);
  }
}
