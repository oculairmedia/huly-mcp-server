/**
 * Delete Project Tool
 *
 * Deletes an entire project including all its contents
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_project',
  description:
    'Delete an entire project including all issues, components, milestones, and templates',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier to delete (e.g., "PROJ")',
      },
      force: {
        type: 'boolean',
        description: 'Force deletion even with active issues or integrations (default: false)',
        default: false,
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview what will be deleted without actually deleting (default: false)',
        default: false,
      },
    },
    required: ['project_identifier'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { project_identifier, force = false, dry_run = false } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Deleting project', args);

    // Validate project identifier
    if (!isValidProjectIdentifier(project_identifier)) {
      throw HulyError.invalidValue(
        'project_identifier',
        project_identifier,
        'format like "PROJ" (1-5 uppercase letters)'
      );
    }

    // Add confirmation warning for project deletion
    if (!dry_run && !force) {
      logger.warn(`Attempting to delete project ${project_identifier} without force flag`);
    }

    // Use DeletionService to handle the deletion
    const result = await deletionService.deleteProject(client, project_identifier, {
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
    logger.error('Failed to delete project:', error);
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
  } else if (args.project_identifier.trim().length > 5) {
    errors.project_identifier = 'Project identifier must be 1-5 characters';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
