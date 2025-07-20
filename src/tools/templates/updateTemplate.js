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
  description: 'Update an existing template',
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
        enum: ['title', 'description', 'priority', 'estimation', 'assignee', 'component', 'milestone'],
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
  const validFields = ['title', 'description', 'priority', 'estimation', 'assignee', 'component', 'milestone'];
  if (!args.field || !validFields.includes(args.field)) {
    errors.field = `Field must be one of: ${validFields.join(', ')}`;
  }

  // Validate value
  if (args.value === undefined || args.value === null) {
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