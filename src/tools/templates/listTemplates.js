/**
 * List Templates Tool
 *
 * Lists all templates in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_templates',
  description: 'Retrieve a comprehensive inventory of all issue templates within a specified project, providing detailed template metadata including names, descriptions, hierarchical structures, usage statistics, and configuration details for effective template management and workflow optimization. This essential organizational tool enables project managers and team members to understand available template options, assess template utilization patterns, and make informed decisions about workflow standardization and team productivity enhancement. The template listing includes rich details such as child template counts, default configuration summaries, creation timestamps, recent usage statistics, and template complexity indicators that facilitate template selection and organizational planning decisions. Advanced features include configurable result limits for performance optimization, automatic permission filtering to ensure secure access to authorized templates, intelligent sorting by usage frequency and creation date, and comprehensive error handling for invalid project references. The tool provides essential insights for template management, workflow analysis, and organizational planning, making it indispensable for project initialization, team onboarding, template governance, and ongoing project management activities that require clear understanding of available workflow patterns and standardized issue creation processes across diverse development and operational contexts.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "LMP")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of templates to return (default: 50)',
        default: 50,
      },
    },
    required: ['project_identifier'],
  },
  annotations: {
    title: 'List Templates',
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
    logger.debug('Listing templates', args);

    const result = await templateService.listTemplates(client, args.project_identifier, args.limit);

    return result;
  } catch (error) {
    logger.error('Failed to list templates:', error);
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

  // Validate limit
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
