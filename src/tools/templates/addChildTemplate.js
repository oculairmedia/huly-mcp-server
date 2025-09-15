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
  description: 'Extend existing issue templates with additional child template configurations to create sophisticated hierarchical workflow patterns and complex issue decomposition structures that support advanced project management and team coordination scenarios. This template enhancement tool enables dynamic expansion of template hierarchies by adding new child templates with comprehensive configuration options including title, description, priority defaults, estimation values, assignee assignments, component associations, and milestone planning. The child template addition process includes thorough validation of parent template existence, user permissions, and hierarchical structure integrity, followed by atomic integration that maintains template consistency and workflow reliability. Advanced features include automatic inheritance validation for parent template properties, comprehensive error handling for configuration conflicts, detailed audit logging for template modification tracking, and seamless integration with existing template instantiation workflows. The tool supports complex organizational scenarios requiring flexible template evolution, workflow customization, and iterative template development while maintaining backward compatibility with existing template usage patterns. This tool is essential for template lifecycle management, workflow optimization, organizational adaptation, and administrative scenarios requiring reliable, auditable template hierarchy modification capabilities with full consideration for complex organizational dependencies and standardized workflow evolution across diverse project types and team structures.',
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
    logger.debug('Adding child template', args);

    const childData = {
      title: args.title,
      description: args.description,
      priority: args.priority || 'medium',
      estimation: args.estimation || 0,
      assignee: args.assignee,
      component: args.component,
      milestone: args.milestone,
    };

    const result = await templateService.addChildTemplate(client, args.template_id, childData);

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
  if (
    !args.template_id ||
    typeof args.template_id !== 'string' ||
    args.template_id.trim().length === 0
  ) {
    errors.template_id = 'Template ID is required';
  }

  // Validate title
  if (!args.title || typeof args.title !== 'string' || args.title.trim().length === 0) {
    errors.title = 'Child template title is required';
  }

  // Validate priority if provided
  if (args.priority !== undefined && !['low', 'medium', 'high', 'urgent'].includes(args.priority)) {
    errors.priority = 'Priority must be one of: low, medium, high, urgent';
  }

  // Validate assignee email format if provided
  if (
    args.assignee !== undefined &&
    args.assignee &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.assignee)
  ) {
    errors.assignee = 'Assignee must be a valid email address';
  }

  // Validate estimation
  if (
    args.estimation !== undefined &&
    (typeof args.estimation !== 'number' || args.estimation < 0)
  ) {
    errors.estimation = 'Estimation must be a non-negative number';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
