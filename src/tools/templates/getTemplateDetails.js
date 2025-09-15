/**
 * Get Template Details Tool
 *
 * Gets detailed information about a specific template
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_get_template_details',
  description:
    'Retrieve exhaustive, detailed information about specific issue templates including complete hierarchical structure, child template relationships, configuration metadata, usage statistics, and all associated workflow patterns for comprehensive template analysis and management. This detailed inspection tool provides deep visibility into template architecture, default value configurations, child template dependencies, and organizational usage patterns through comprehensive reporting of template structure, inheritance relationships, and utilization metrics across projects and teams. The detailed view includes rich formatting support for markdown content, embedded configuration visualization, and cross-reference resolution for related templates, projects, and workflow integrations. Advanced features include permission-aware content filtering, comprehensive audit trail presentation, related template discovery through intelligent linking algorithms, and performance-optimized data retrieval for responsive user interfaces. The tool provides essential insights for template governance, workflow optimization, organizational standardization, and template lifecycle management, making it indispensable for template administration, team onboarding, workflow analysis, and organizational planning activities requiring complete understanding of template structure, usage patterns, and organizational impact across multiple project dimensions and team interactions.',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Template ID',
      },
    },
    required: ['template_id'],
  },
  annotations: {
    title: 'Get Template Details',
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
    logger.debug('Getting template details', args);

    const result = await templateService.getTemplateDetails(client, args.template_id);

    return result;
  } catch (error) {
    logger.error('Failed to get template details:', error);
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
  if (
    !args.template_id ||
    typeof args.template_id !== 'string' ||
    args.template_id.trim().length === 0
  ) {
    errors.template_id = 'Template ID is required and must be a string';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
