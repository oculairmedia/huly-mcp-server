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
  description: 'Establish sophisticated issue templates with hierarchical child template support, enabling standardized issue creation workflows, consistent project structures, and efficient team onboarding through reusable issue patterns and automated workflow generation. This powerful template system supports complex organizational structures with parent-child template relationships, comprehensive metadata inheritance, and flexible customization options that streamline issue creation while maintaining consistency across projects and teams. The template creation process includes rich configuration options for default values including priority levels, estimation hours, assignee assignments, component associations, and milestone planning, along with detailed descriptions supporting markdown formatting for comprehensive template documentation. Advanced features include hierarchical child template management for complex workflow decomposition, automatic validation of template structure and dependencies, comprehensive permission inheritance from parent projects, and seamless integration with issue creation workflows for immediate template utilization. Templates serve as critical organizational elements for standardizing work patterns, enabling efficient project initialization, supporting team onboarding processes, and maintaining consistency across diverse project types and development methodologies. This tool is essential for establishing organizational standards, creating reusable workflow patterns, supporting agile development practices, and enabling efficient project scaling through standardized, repeatable issue creation processes that maintain quality and consistency across diverse organizational contexts.',
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

  // Validate project_identifier
  if (!args.project_identifier) {
    errors.project_identifier = 'Project identifier is required';
  } else if (!/^[A-Z][A-Z0-9]*$/.test(args.project_identifier)) {
    errors.project_identifier =
      'Project identifier must start with uppercase letter and contain only uppercase letters and numbers';
  }

  // Validate title
  if (!args.title || args.title.trim().length === 0) {
    errors.title = 'Template title is required';
  }

  // Validate priority
  if (args.priority && !['low', 'medium', 'high', 'urgent'].includes(args.priority)) {
    errors.priority = 'Priority must be one of: low, medium, high, urgent';
  }

  // Validate estimation
  if (
    args.estimation !== undefined &&
    (typeof args.estimation !== 'number' || args.estimation < 0)
  ) {
    errors.estimation = 'Estimation must be a non-negative number';
  }

  // Validate assignee email format
  if (args.assignee && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.assignee)) {
    errors.assignee = 'Assignee must be a valid email address';
  }

  // Validate children
  if (args.children && Array.isArray(args.children)) {
    const childErrors = [];
    args.children.forEach((child, index) => {
      const childError = {};

      if (!child.title || child.title.trim().length === 0) {
        childError.title = 'Child template title is required';
      }

      if (child.priority && !['low', 'medium', 'high', 'urgent'].includes(child.priority)) {
        childError.priority = 'Child priority must be one of: low, medium, high, urgent';
      }

      if (
        child.estimation !== undefined &&
        (typeof child.estimation !== 'number' || child.estimation < 0)
      ) {
        childError.estimation = 'Child estimation must be a non-negative number';
      }

      if (child.assignee && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(child.assignee)) {
        childError.assignee = 'Child assignee must be a valid email address';
      }

      if (Object.keys(childError).length > 0) {
        childErrors[index] = childError;
      }
    });

    if (childErrors.length > 0) {
      errors.children = childErrors;
    }
  } else if (args.children && !Array.isArray(args.children)) {
    errors.children = 'Children must be an array';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
