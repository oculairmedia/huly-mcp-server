/**
 * List GitHub Repositories Tool
 *
 * Lists all GitHub repositories available in integrations
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_github_repositories',
  description: 'List all GitHub repositories available in integrations',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: {
    title: 'List GitHub Repositories',
    readOnlyHint: true, // Only reads repository data
    destructiveHint: false, // Does not delete any data
    idempotentHint: true, // Same request returns same results
    openWorldHint: true, // Interacts with external Huly/GitHub systems
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
    logger.debug('Listing GitHub repositories');

    const result = await projectService.listGithubRepositories(client);

    return result;
  } catch (error) {
    logger.error('Failed to list GitHub repositories:', error);
    return createErrorResponse(error);
  }
}

/**
 * Optional validation function
 * @param {Object} args - Tool arguments
 * @returns {Object|null} Validation errors or null
 */
export function validate(args) {
  // No validation needed for this tool
  return null;
}
