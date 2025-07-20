/**
 * Add Child Template Tool
 *
 * Adds a child template to an existing template
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_add_child_template',
  description: 'Add a child template to an existing template for hierarchical issue creation',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Parent template ID',
      },
      title: {
        type: 'string',
        description: 'Child template title',
      },
      description: {
        type: 'string',
        description: 'Child template description',
      },
      priority: {
        type: 'string',
        description: 'Child template priority',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
      estimation: {
        type: 'number',
        description: 'Child template estimation in hours',
        default: 0,
      },
      assignee: {
        type: 'string',
        description: 'Child template assignee email (optional)',
      },
      component: {
        type: 'string',
        description: 'Child template component (optional)',
      },
      milestone: {
        type: 'string',
        description: 'Child template milestone (optional)',
      },
    },
    required: ['template_id', 'title'],
  },
  annotations: {
    title: 'Add Child Template',
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
    logger.debug('Adding child template', args);

    const childData = {
      title: args.title,
      description: args.description || '',
      priority: args.priority || 'medium',
      estimation: args.estimation || 0,
      assignee: args.assignee,
      component: args.component,
      milestone: args.milestone,
    };

    const result = await templateService.addChildTemplate(
      client,
      args.template_id,
      childData
    );

    return result;
  } catch (error) {
    logger.error('Failed to add child template:', error);
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

  // Validate title
  if (!args.title || args.title.trim().length === 0) {
    errors.title = 'Child template title is required';
  }

  // Validate estimation
  if (args.estimation !== undefined && (typeof args.estimation !== 'number' || args.estimation < 0)) {
    errors.estimation = 'Estimation must be a non-negative number';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}