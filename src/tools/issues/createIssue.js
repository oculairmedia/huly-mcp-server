/**
 * Create Issue Tool
 *
 * Creates a new issue in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_issue',
  description: 'Create a new issue in a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "LMP")',
      },
      title: {
        type: 'string',
        description: 'Issue title',
      },
      description: {
        type: 'string',
        description: 'Issue description',
      },
      priority: {
        type: 'string',
        description: 'Issue priority (low, medium, high, urgent)',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
    },
    required: ['project_identifier', 'title'],
  },
  annotations: {
    title: 'Create Issue',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
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
    logger.debug('Creating new issue', args);

    const result = await issueService.createIssue(
      client,
      args.project_identifier,
      args.title,
      args.description,
      args.priority
    );

    return result;
  } catch (error) {
    logger.error('Failed to create issue:', error);
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

  // Validate title
  if (!args.title || args.title.trim().length === 0) {
    errors.title = 'Issue title is required';
  }

  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (args.priority && !validPriorities.includes(args.priority)) {
    errors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
