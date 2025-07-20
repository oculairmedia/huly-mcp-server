/**
 * Create Milestone Tool
 *
 * Creates a new milestone in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_milestone',
  description: 'Create a new milestone in a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")',
      },
      label: {
        type: 'string',
        description: 'Milestone name',
      },
      description: {
        type: 'string',
        description: 'Milestone description',
      },
      target_date: {
        type: 'string',
        description: 'Target date (ISO 8601 format)',
      },
      status: {
        type: 'string',
        description: 'Milestone status',
        enum: ['planned', 'in_progress', 'completed', 'canceled'],
        default: 'planned',
      },
    },
    required: ['project_identifier', 'label', 'target_date'],
  },
  annotations: {
    title: 'Create Project Milestone',
    readOnlyHint: false, // Creates new data
    destructiveHint: false, // Does not delete any data
    idempotentHint: false, // Creates new milestone each time
    openWorldHint: true, // Interacts with external Huly system
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
  const { projectService } = services;

  try {
    logger.debug('Creating new milestone', args);

    const result = await projectService.createMilestone(
      client,
      args.project_identifier,
      args.label,
      args.description,
      args.target_date,
      args.status
    );

    return result;
  } catch (error) {
    logger.error('Failed to create milestone:', error);
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

  // Validate project identifier
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }

  // Validate label
  if (!args.label || args.label.trim().length === 0) {
    errors.label = 'Milestone label is required';
  }

  // Validate target date
  if (!args.target_date || args.target_date.trim().length === 0) {
    errors.target_date = 'Target date is required';
  } else {
    // Validate ISO 8601 format
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
    if (!dateRegex.test(args.target_date)) {
      errors.target_date =
        'Target date must be in ISO 8601 format (e.g., "2024-12-31" or "2024-12-31T23:59:59Z")';
    } else {
      const date = new Date(args.target_date);
      if (isNaN(date.getTime())) {
        errors.target_date = 'Invalid date';
      }
    }
  }

  // Validate status if provided
  if (args.status) {
    const validStatuses = ['planned', 'in_progress', 'completed', 'canceled'];
    if (!validStatuses.includes(args.status)) {
      errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
