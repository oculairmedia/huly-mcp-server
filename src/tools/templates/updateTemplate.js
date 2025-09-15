/**
 * Update Template Tool
 *
 * Updates an existing template
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_update_template',
  description:
    'Modify specific fields and configurations of existing issue templates with comprehensive validation, atomic update operations, and detailed change tracking that maintains template integrity and organizational workflow consistency. This versatile template management tool supports updates to critical template properties including title, description, priority defaults, estimation values, assignee configurations, component associations, and milestone planning, with intelligent validation that ensures template structure integrity and workflow compatibility. The update mechanism provides real-time validation of field values, automatic relationship verification for component and milestone references, comprehensive error handling for invalid template configurations, and atomic transaction management that prevents partial updates or template corruption. Advanced features include automatic timestamp tracking for modification history, notification triggers for stakeholder updates about template changes, and comprehensive audit logging for compliance and change management purposes. The tool maintains complete backward compatibility with existing workflows while supporting modern template configuration patterns, making it essential for template lifecycle management, workflow optimization, organizational standardization, and administrative maintenance scenarios requiring reliable, auditable template modification capabilities with full consideration for complex organizational dependencies and standardized workflow impacts across diverse project types and team structures.',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Template ID',
      },
      field: {
        type: 'string',
        description: 'Field to update',
        enum: [
          'title',
          'description',
          'priority',
          'estimation',
          'assignee',
          'component',
          'milestone',
        ],
      },
      value: {
        type: 'string',
        description: 'New value for the field',
      },
    },
    required: ['template_id', 'field', 'value'],
  },
  annotations: {
    title: 'Update Template',
    readOnlyHint: false,
    destructiveHint: false,
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
    logger.debug('Updating template', args);

    const result = await templateService.updateTemplate(
      client,
      args.template_id,
      args.field,
      args.value
    );

    return result;
  } catch (error) {
    logger.error('Failed to update template:', error);
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
  if (!args.template_id || args.template_id.trim().length === 0) {
    errors.template_id = 'Template ID is required';
  }

  // Validate field
  const validFields = [
    'title',
    'description',
    'priority',
    'estimation',
    'assignee',
    'component',
    'milestone',
  ];
  if (!args.field || !validFields.includes(args.field)) {
    errors.field = `Field must be one of: ${validFields.join(', ')}`;
  }

  // Validate value
  if (
    args.value === undefined ||
    args.value === null ||
    (typeof args.value === 'string' && args.value.trim() === '')
  ) {
    errors.value = 'Value is required';
  }

  // Field-specific validation
  if (args.field === 'estimation' && args.value !== undefined) {
    const estimation = parseFloat(args.value);
    if (isNaN(estimation) || estimation < 0) {
      errors.value = 'Estimation must be a non-negative number';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
