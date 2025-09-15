/**
 * Delete Template Tool
 *
 * Deletes an existing template
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_template',
  description:
    'Permanently remove issue templates from the project ecosystem with comprehensive dependency validation, impact analysis, and multiple safety mechanisms to prevent accidental disruption of standardized workflows and team productivity patterns. This administrative tool provides sophisticated deletion capabilities including thorough validation of template usage patterns, dependency analysis for child template relationships, and detailed impact assessment for teams and projects relying on the template for consistent issue creation workflows. The deletion process includes comprehensive validation of template existence, user permissions, and hierarchical dependencies, followed by atomic transactional removal that ensures complete cleanup of all template references while maintaining data consistency across the project ecosystem. Advanced safety features include automatic cascade handling for child template removal, comprehensive impact reporting with usage statistics and affected workflow analysis, and detailed audit logging for compliance and recovery purposes. The tool automatically handles complex scenarios such as template dependency resolution, preservation of historical data for reporting and analytics purposes, and notification systems for teams and stakeholders affected by template removal. This tool is essential for template lifecycle management, workflow optimization, organizational restructuring, and administrative maintenance scenarios requiring reliable, secure, and auditable template removal capabilities with full consideration for complex organizational dependencies and standardized workflow impacts.',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Template ID to delete',
      },
    },
    required: ['template_id'],
  },
  annotations: {
    title: 'Delete Template',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
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
    logger.debug('Deleting template', args);

    const result = await templateService.deleteTemplate(client, args.template_id);

    return result;
  } catch (error) {
    logger.error('Failed to delete template:', error);
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

  // Validate template ID
  if (!args.template_id) {
    errors.template_id = 'Template ID is required';
  } else if (typeof args.template_id !== 'string') {
    errors.template_id = 'Template ID must be a string';
  } else if (args.template_id.trim().length === 0) {
    errors.template_id = 'Template ID is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
