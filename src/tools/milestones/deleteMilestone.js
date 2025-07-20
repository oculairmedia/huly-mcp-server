/**
 * Delete Milestone Tool
 *
 * Deletes a milestone from a project with impact analysis
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_milestone',
  description: 'Delete a milestone from a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "PROJ")',
      },
      milestone_label: {
        type: 'string',
        description: 'Milestone label to delete',
      },
      force: {
        type: 'boolean',
        description: 'Force deletion even if issues use this milestone (default: false)',
        default: false,
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview deletion impact without actually deleting (default: false)',
        default: false,
      },
    },
    required: ['project_identifier', 'milestone_label'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { project_identifier, milestone_label, force = false, dry_run = false } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Deleting milestone', args);

    // Validate project identifier
    if (!isValidProjectIdentifier(project_identifier)) {
      throw HulyError.invalidValue(
        'project_identifier',
        project_identifier,
        'format like "PROJ" (1-5 uppercase letters)'
      );
    }

    // Validate milestone label
    if (!milestone_label || milestone_label.trim().length === 0) {
      throw HulyError.validation('milestone_label', milestone_label, 'Milestone label is required');
    }

    // Use DeletionService to handle the deletion
    const result = await deletionService.deleteMilestone(
      client,
      project_identifier,
      milestone_label.trim(),
      { force, dryRun: dry_run }
    );

    return {
      content: [
        {
          type: 'text',
          text: result.content[0].text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to delete milestone:', error);
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

  // Validate project_identifier
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }

  // Validate milestone_label
  if (!args.milestone_label || args.milestone_label.trim().length === 0) {
    errors.milestone_label = 'Milestone label is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
