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
    logger.debug('Creating issue from template', args);

    const overrides = {};

    // Add overrides if provided
    if (args.title !== undefined) overrides.title = args.title;
    if (args.priority !== undefined) overrides.priority = args.priority;
    if (args.assignee !== undefined) overrides.assignee = args.assignee;
    if (args.component !== undefined) overrides.component = args.component;
    if (args.milestone !== undefined) overrides.milestone = args.milestone;
    if (args.estimation !== undefined) overrides.estimation = args.estimation;
    if (args.include_children !== undefined) overrides.includeChildren = args.include_children;

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
  if (!args.template_id || args.template_id.trim().length === 0) {
    errors.template_id = 'Template ID is required';
  }

  // Validate estimation if provided
  if (
    args.estimation !== undefined &&
    (typeof args.estimation !== 'number' || args.estimation < 0)
  ) {
    errors.estimation = 'Estimation must be a non-negative number';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
