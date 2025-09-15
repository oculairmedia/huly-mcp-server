/**
 * List Issues Tool
 *
 * Lists issues in a specific project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_issues',
  description:
    'Retrieve a comprehensive, chronologically-ordered listing of issues within a specified project, providing essential issue metadata including identifiers, titles, status, priority, assignee information, and creation timestamps for effective project oversight and team coordination. This fundamental tool supports configurable result limits (1-500 issues) with intelligent pagination and performance optimization, making it suitable for both quick project overviews and detailed issue analysis scenarios. The listing includes rich issue details such as component associations, milestone assignments, progress indicators, and recent activity summaries, enabling project managers and team members to quickly assess project health, identify bottlenecks, and prioritize work items. The tool automatically applies user permission filtering to ensure secure access to authorized issues while providing consistent sorting by creation date (most recent first) for intuitive navigation. Advanced features include automatic truncation handling for large result sets, comprehensive error handling for invalid project references, and optimized query performance for responsive user interfaces, making this tool essential for daily project management activities, sprint planning sessions, and stakeholder reporting requirements.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "LMP")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50, min: 1, max: 500)',
        default: 50,
        minimum: 1,
        maximum: 500,
      },
    },
    required: ['project_identifier'],
  },
  annotations: {
    title: 'List Issues',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
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
  const { issueService } = services;

  try {
    logger.debug('Listing issues', args);

    const result = await issueService.listIssues(client, args.project_identifier, args.limit);

    return result;
  } catch (error) {
    logger.error('Failed to list issues:', error);
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
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }

  // Validate limit if provided
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
