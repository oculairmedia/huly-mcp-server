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
  description:
    'Retrieve a comprehensive inventory of all GitHub repositories available through configured integrations, providing detailed repository metadata including names, descriptions, visibility settings, integration status, and connection health for effective repository management and project coordination. This essential integration tool enables project managers and development teams to understand available repository options, assess integration capabilities, and make informed decisions about repository assignments and development workflow coordination. The repository listing includes rich details such as repository URLs, branch information, integration timestamps, access permissions, and recent activity summaries that facilitate repository selection and project planning decisions. Advanced features include automatic permission filtering to ensure secure access to authorized repositories, intelligent sorting by repository activity and integration status, comprehensive error handling for integration connectivity issues, and real-time validation of repository accessibility and permissions. The tool provides essential insights for development workflow planning, repository governance, and integration management, making it indispensable for project initialization, development team coordination, repository assignment planning, and ongoing integration management activities that require clear understanding of available development resources and external system connectivity across diverse project types and organizational contexts.',
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
export function validate(_args) {
  // No validation needed for this tool
  return null;
}
