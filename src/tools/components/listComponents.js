/**
 * List Components Tool
 *
 * Lists all components in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_components',
  description: 'Retrieve a comprehensive inventory of all organizational components within a specified project, providing detailed component metadata including names, descriptions, creation timestamps, and usage statistics for effective project structure analysis and team coordination. This essential organizational tool enables project managers and team members to understand the architectural and functional organization of their projects through complete component visibility, supporting informed decision-making for issue categorization, team assignment, and workflow optimization. The component listing includes rich details such as associated issue counts, active milestone relationships, team ownership information, and recent activity summaries that facilitate project planning and resource allocation decisions. Advanced features include automatic permission filtering to ensure secure access to authorized components, intelligent sorting by usage frequency and creation date, and comprehensive error handling for invalid project references. The tool provides essential insights for project structure assessment, component utilization analysis, and organizational planning, making it indispensable for project initialization, team onboarding, architectural reviews, and ongoing project management activities that require clear understanding of project organization and component-based workflow structures across diverse development and operational contexts.',
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
    title: 'List Project Components',
    readOnlyHint: true, // Only reads component data
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
    logger.debug('Listing components for project', args);

    const result = await projectService.listComponents(client, args.project_identifier);

    return result;
  } catch (error) {
    logger.error('Failed to list components:', error);
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
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
