/**
 * Remove Child Template Tool
 *
 * Removes a child template from a parent template
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_remove_child_template',
  description: 'Remove a child template from a parent template by index',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Parent template ID',
      },
      child_index: {
        type: 'number',
        description: 'Index of the child template to remove (0-based)',
      },
    },
    required: ['template_id', 'child_index'],
  },
  annotations: {
    title: 'Remove Child Template',
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
    logger.debug('Removing child template', args);

    const result = await templateService.removeChildTemplate(
      client,
      args.template_id,
      args.child_index
    );

    return result;
  } catch (error) {
    logger.error('Failed to remove child template:', error);
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

  // Validate child index
  if (
    args.child_index === undefined ||
    typeof args.child_index !== 'number' ||
    args.child_index < 0
  ) {
    errors.child_index = 'Child index must be a non-negative number';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
