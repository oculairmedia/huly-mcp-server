/**
 * Get Issue Details Tool
 *
 * Get comprehensive details about a specific issue including full description, comments, and all metadata
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_get_issue_details',
  description:
    'Get comprehensive details about a specific issue including full description, comments, and all metadata',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "LMP-1")',
      },
    },
    required: ['issue_identifier'],
  },
  annotations: {
    title: 'Get Issue Details',
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
    logger.debug('Getting issue details', args);

    const result = await issueService.getIssueDetails(client, args.issue_identifier);

    return result;
  } catch (error) {
    logger.error('Failed to get issue details:', error);
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

  // Validate issue_identifier
  if (!args.issue_identifier || args.issue_identifier.trim().length === 0) {
    errors.issue_identifier = 'Issue identifier is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
