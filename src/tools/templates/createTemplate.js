/**
 * Create Template Tool
 *
 * Creates a new issue template in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_template',
  description: 'Create a new issue template with optional child templates',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "LMP")',
      },
      title: {
        type: 'string',
        description: 'Template title',
      },
      description: {
        type: 'string',
        description: 'Template description (markdown supported)',
      },
      priority: {
        type: 'string',
        description: 'Default priority (low, medium, high, urgent)',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
      estimation: {
        type: 'number',
        description: 'Default estimation in hours',
        default: 0,
      },
      assignee: {
        type: 'string',
        description: 'Default assignee email (optional)',
      },
      component: {
        type: 'string',
        description: 'Default component name (optional)',
      },
      milestone: {
        type: 'string',
        description: 'Default milestone name (optional)',
      },
      children: {
        type: 'array',
        description: 'Child templates for hierarchical issue creation',
        items: {
          type: 'object',
          properties: {
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
              description: 'Child priority',
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            estimation: {
              type: 'number',
              description: 'Child estimation in hours',
              default: 0,
            },
            assignee: {
              type: 'string',
              description: 'Child assignee email',
            },
            component: {
              type: 'string',
              description: 'Child component name',
            },
            milestone: {
              type: 'string',
              description: 'Child milestone name',
            },
          },
          required: ['title'],
        },
      },
    },
    required: ['project_identifier', 'title'],
  },
  annotations: {
    title: 'Create Template',
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
    logger.debug('Creating template', args);

    const templateData = {
      title: args.title,
      description: args.description || '',
      priority: args.priority || 'medium',
      estimation: args.estimation || 0,
      assignee: args.assignee,
      component: args.component,
      milestone: args.milestone,
      children: args.children || [],
    };

    const result = await templateService.createTemplate(
      client,
      args.project_identifier,
      templateData
    );

    return result;
  } catch (error) {
    logger.error('Failed to create template:', error);
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

  // Validate title
  if (!args.title || args.title.trim().length === 0) {
    errors.title = 'Template title is required';
  }

  // Validate estimation
  if (
    args.estimation !== undefined &&
    (typeof args.estimation !== 'number' || args.estimation < 0)
  ) {
    errors.estimation = 'Estimation must be a non-negative number';
  }

  // Validate children
  if (args.children && Array.isArray(args.children)) {
    const childErrors = [];
    args.children.forEach((child, index) => {
      const childError = {};

      if (!child.title || child.title.trim().length === 0) {
        childError.title = 'Child template title is required';
      }

      if (
        child.estimation !== undefined &&
        (typeof child.estimation !== 'number' || child.estimation < 0)
      ) {
        childError.estimation = 'Child estimation must be a non-negative number';
      }

      if (Object.keys(childError).length > 0) {
        childErrors[index] = childError;
      }
    });

    if (childErrors.length > 0) {
      errors.children = childErrors;
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
