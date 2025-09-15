/**
 * List Comments Tool
 *
 * List comments on an issue
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_comments',
  description: 'Retrieve a comprehensive, chronologically-ordered listing of all comments and discussion threads associated with a specific issue, providing detailed comment metadata including author information, timestamps, content formatting, and interaction history for effective communication tracking and project transparency. This essential collaboration tool enables team members, project managers, and stakeholders to review complete discussion histories, understand decision-making processes, and maintain comprehensive context for issue resolution and project coordination. The comment listing includes rich details such as author profiles, creation and modification timestamps, markdown-rendered content with proper formatting, and interaction indicators that facilitate communication analysis and stakeholder engagement assessment. Advanced features include configurable result limits for performance optimization, automatic permission filtering to ensure secure access to authorized comments, intelligent sorting by chronological order for natural discussion flow, and comprehensive error handling for invalid issue references. The tool provides essential insights for communication analysis, stakeholder engagement tracking, and project transparency, making it indispensable for issue review processes, stakeholder reporting, team coordination, and ongoing project management activities that require complete understanding of discussion context, decision rationale, and collaborative problem-solving processes across diverse organizational contexts and project types.',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "LMP-1")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of comments to return (default: 50)',
        default: 50,
      },
    },
    required: ['issue_identifier'],
  },
  annotations: {
    title: 'List Issue Comments',
    readOnlyHint: true, // Only reads comment data
    destructiveHint: false, // Does not delete any data
    idempotentHint: true, // Same request returns same results
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
  const { issueService } = services;

  try {
    logger.debug('Listing comments', args);

    const result = await issueService.listComments(client, args.issue_identifier, args.limit);

    return result;
  } catch (error) {
    logger.error('Failed to list comments:', error);
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

  // Validate limit if provided
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
