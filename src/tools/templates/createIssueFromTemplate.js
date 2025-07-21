/**
 * Create Issue From Template Tool
 *
 * Creates issues from a template with optional overrides
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_issue_from_template',
  description:
    'Create issues from a template, including all child issues if the template has children',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Template ID to use',
      },
      title: {
        type: 'string',
        description: 'Override the template title (optional)',
      },
      priority: {
        type: 'string',
        description: 'Override the template priority (optional)',
        enum: ['low', 'medium', 'high', 'urgent'],
      },
      assignee: {
        type: 'string',
        description: 'Override the template assignee email (optional)',
      },
      component: {
        type: 'string',
        description: 'Override the template component (optional)',
      },
      milestone: {
        type: 'string',
        description: 'Override the template milestone (optional)',
      },
      estimation: {
        type: 'number',
        description: 'Override the template estimation in hours (optional)',
      },
      include_children: {
        type: 'boolean',
        description: 'Include child issues from template (default: true)',
        default: true,
      },
    },
    required: ['template_id'],
  },
  annotations: {
    title: 'Create Issue From Template',
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
    logger.debug('Creating issue from template', args);

    const overrides = {
      title: args.title,
      priority: args.priority,
      assignee: args.assignee,
      component: args.component,
      milestone: args.milestone,
      estimation: args.estimation,
      includeChildren: args.include_children ?? true,
    };

    const result = await templateService.createIssueFromTemplate(
      client,
      args.template_id,
      overrides
    );

    return result;
  } catch (error) {
    logger.error('Failed to create issue from template:', error);
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

  // Validate estimation if provided
  if (
    args.estimation !== undefined &&
    (typeof args.estimation !== 'number' || args.estimation < 0)
  ) {
    errors.estimation = 'Estimation must be a non-negative number';
  }

  // Validate include_children if provided
  if (args.include_children !== undefined && typeof args.include_children !== 'boolean') {
    errors.include_children = 'include_children must be a boolean value';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
