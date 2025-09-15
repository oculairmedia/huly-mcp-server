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
  description: 'Retrieve a comprehensive listing of all projects within the current Huly workspace, providing essential project metadata including unique identifiers, display names, descriptions, creation timestamps, and current status information. This tool serves as the primary entry point for project discovery and workspace overview, enabling users to understand the organizational structure of their Huly instance. The response includes detailed project statistics such as issue counts, active milestones, and component breakdowns, making it invaluable for project managers, team leads, and stakeholders who need to assess project portfolios, track overall workspace activity, and identify projects for further investigation. The tool automatically handles workspace-level permissions and filters results based on user access rights, ensuring secure and appropriate data exposure across different organizational roles and responsibilities.',
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
