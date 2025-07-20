/**
 * Search Templates Tool
 *
 * Search for templates by title and description
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_search_templates',
  description: 'Search for templates by title and description',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for template title and description',
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier to search within (optional for cross-project search)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50)',
        default: 50,
      },
    },
    required: ['query'],
  },
  annotations: {
    title: 'Search Templates',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
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
  const { templateService } = services;

  try {
    logger.debug('Searching templates', args);

    const result = await templateService.searchTemplates(
      client,
      args.query,
      args.project_identifier,
      args.limit
    );

    return result;
  } catch (error) {
    logger.error('Failed to search templates:', error);
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

  // Validate query
  if (!args.query || args.query.trim().length === 0) {
    errors.query = 'Search query is required';
  }

  // Validate limit
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}