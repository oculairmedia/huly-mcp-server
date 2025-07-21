/**
 * List Milestones Tool
 *
 * Lists all milestones in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_milestones',
  description: 'List all milestones in a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")',
      },
    },
    required: ['project_identifier'],
  },
  annotations: {
    title: 'List Project Milestones',
    readOnlyHint: true, // Only reads milestone data
    destructiveHint: false, // Does not delete any data
    idempotentHint: true, // Same request returns same results
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
  const { projectService } = services;

  try {
    logger.debug('Listing milestones for project', args);

    const result = await projectService.listMilestones(client, args.project_identifier);

    return result;
  } catch (error) {
    logger.error('Failed to list milestones:', error);
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
  if (
    !args.project_identifier ||
    typeof args.project_identifier !== 'string' ||
    args.project_identifier.trim().length === 0
  ) {
    errors.project_identifier = 'Project identifier is required';
  } else if (args.project_identifier.trim().length > 5) {
    errors.project_identifier = 'Project identifier must be 1-5 characters';
  } else if (!/^[A-Z][A-Z0-9]*$/.test(args.project_identifier)) {
    errors.project_identifier =
      'Project identifier must start with uppercase letter and contain only uppercase letters and numbers';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
