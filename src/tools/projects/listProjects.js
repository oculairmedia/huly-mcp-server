/**
 * List Projects Tool
 *
 * Lists all projects in the Huly workspace
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_projects',
  description: 'List all projects in Huly workspace',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: {
    title: 'List Projects',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments (empty for this tool)
 * @param {import('../base/ToolInterface').ToolContext} context - Execution context
 * @returns {Promise<import('../base/ToolInterface').ToolResponse>}
 */
export async function handler(args, context) {
  const { client, services, logger } = context;
  const { projectService } = services;

  try {
    logger.debug('Listing all projects');

    // ProjectService.listProjects already returns a formatted response
    const result = await projectService.listProjects(client);

    return result;
  } catch (error) {
    logger.error('Failed to list projects:', error);
    return createErrorResponse(error);
  }
}

/**
 * Optional validation function
 * @param {Object} args - Tool arguments
 * @returns {Object|null} Validation errors or null
 */
export function validate(_args) {
  // No validation needed for this tool
  return null;
}
