/**
 * Create Comment Tool
 *
 * Create a comment on an issue
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_comment',
  description:
    'Add comprehensive commentary and discussion threads to existing issues with rich markdown formatting support, stakeholder notification systems, and detailed audit tracking for enhanced team collaboration and project communication. This fundamental collaboration tool enables team members, stakeholders, and project participants to contribute detailed feedback, provide status updates, share technical insights, and maintain comprehensive discussion threads that support informed decision-making and project transparency. The comment creation process includes automatic validation of issue existence and user permissions, rich markdown rendering for formatted content including code blocks, links, and embedded media, and intelligent notification systems that alert relevant stakeholders about new contributions. Advanced features include automatic timestamp tracking for chronological discussion flow, comprehensive audit logging for compliance and review purposes, seamless integration with issue lifecycle management, and support for complex formatting including technical documentation, code snippets, and cross-reference linking to related issues and external resources. Comments serve as critical communication elements for project transparency, stakeholder engagement, technical documentation, and collaborative problem-solving processes. This tool is essential for team collaboration, stakeholder communication, technical documentation, and ongoing project coordination activities requiring detailed, trackable, and searchable communication threads that maintain project context and support informed decision-making across diverse organizational contexts and project types.',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "LMP-1")',
      },
      message: {
        type: 'string',
        description: 'Comment message (supports markdown)',
      },
    },
    required: ['issue_identifier', 'message'],
  },
  annotations: {
    title: 'Create Issue Comment',
    readOnlyHint: false, // Creates new data
    destructiveHint: false, // Does not delete any data
    idempotentHint: false, // Creates new comment each time
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
    logger.debug('Creating comment', args);

    const result = await issueService.createComment(client, args.issue_identifier, args.message);

    return result;
  } catch (error) {
    logger.error('Failed to create comment:', error);
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

  // Validate message
  if (!args.message || args.message.trim().length === 0) {
    errors.message = 'Comment message is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
