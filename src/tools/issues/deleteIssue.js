/**
 * Delete Issue Tool
 *
 * Deletes an issue and optionally its sub-issues from a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidIssueIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_issue',
  description: 'Permanently remove issues from the Huly workspace with comprehensive deletion capabilities including optional cascade deletion of sub-issues, thorough dependency validation, and multiple safety mechanisms to prevent accidental data loss. This powerful administrative tool provides flexible deletion modes including dry-run preview for impact assessment, force deletion for issues with blocking dependencies, and intelligent cascade handling that can automatically remove entire sub-issue hierarchies while maintaining data consistency. The deletion process includes comprehensive validation checks for issue existence, user permissions, and dependency relationships, followed by atomic transactional deletion that ensures complete removal of all associated data including comments, attachments, time tracking records, and external system references. Advanced safety features include detailed impact analysis reporting, comprehensive audit logging for compliance requirements, and automatic notification systems for affected stakeholders and team members. This tool is essential for issue lifecycle management, project cleanup operations, data privacy compliance, and workspace maintenance scenarios requiring reliable, secure, and auditable issue removal capabilities with full consideration for complex organizational dependencies and relationships.',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "PROJ-123")',
      },
      cascade: {
        type: 'boolean',
        description: 'Delete sub-issues as well (default: true)',
        default: true,
      },
      force: {
        type: 'boolean',
        description: 'Force deletion even with blocking references (default: false)',
        default: false,
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview deletion impact without actually deleting (default: false)',
        default: false,
      },
    },
    required: ['issue_identifier'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { issue_identifier, cascade = true, force = false, dry_run = false } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Deleting issue', args);

    // Validate issue identifier format
    if (!isValidIssueIdentifier(issue_identifier)) {
      throw HulyError.invalidValue('issue_identifier', issue_identifier, 'format like "PROJ-123"');
    }

    // Use DeletionService to handle the deletion
    const result = await deletionService.deleteIssue(client, issue_identifier, {
      cascade,
      force,
      dryRun: dry_run,
    });

    return {
      content: [
        {
          type: 'text',
          text: result.content[0].text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to delete issue:', error);
    return createErrorResponse(error);
  }
}
