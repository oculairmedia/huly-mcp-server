/**
 * Delete Milestone Tool
 *
 * Deletes a milestone from a project with impact analysis
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_milestone',
  description: 'Permanently remove project milestones with comprehensive dependency validation, impact analysis, and multiple safety mechanisms to prevent accidental disruption of project timelines and delivery planning. This administrative tool provides sophisticated deletion capabilities including dry-run preview mode for impact assessment, force deletion options for milestones with active issue associations, and detailed dependency analysis that identifies all affected issues, delivery schedules, and team commitments. The deletion process includes thorough validation of milestone existence, user permissions, and relationship dependencies, followed by atomic transactional removal that ensures complete cleanup of all milestone references while maintaining data consistency across the project ecosystem. Advanced safety features include comprehensive impact reporting with affected issue counts and delivery timeline implications, automatic notification systems for stakeholders and team members, and detailed audit logging for compliance and recovery purposes. The tool automatically handles complex scenarios such as milestone reassignment suggestions for orphaned issues, cascade cleanup of milestone-specific configurations, and preservation of historical data for reporting and analytics purposes. This tool is essential for project restructuring, timeline adjustments, milestone lifecycle management, and administrative maintenance scenarios requiring reliable, secure, and auditable milestone removal capabilities with full consideration for complex project dependencies and delivery commitment impacts.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "PROJ")',
      },
      milestone_label: {
        type: 'string',
        description: 'Milestone label to delete',
      },
      force: {
        type: 'boolean',
        description: 'Force deletion even if issues use this milestone (default: false)',
        default: false,
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview deletion impact without actually deleting (default: false)',
        default: false,
      },
    },
    required: ['project_identifier', 'milestone_label'],
  },
  annotations: {
    title: 'Delete Milestone',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { project_identifier, milestone_label, force = false, dry_run = false } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Deleting milestone', args);

    // Validate project identifier
    if (!isValidProjectIdentifier(project_identifier)) {
      throw HulyError.invalidValue(
        'project_identifier',
        project_identifier,
        'format like "PROJ" (1-5 uppercase letters)'
      );
    }

    // Validate milestone label
    if (!milestone_label || milestone_label.trim().length === 0) {
      throw HulyError.validation('milestone_label', milestone_label, 'Milestone label is required');
    }

    // Use DeletionService to handle the deletion
    const result = await deletionService.deleteMilestone(
      client,
      project_identifier,
      milestone_label.trim(),
      { force, dryRun: dry_run }
    );

    return {
      content: [
        {
          type: 'text',
          text: result.content[0].text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to delete milestone:', error);
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
  if (
    !args.project_identifier ||
    typeof args.project_identifier !== 'string' ||
    args.project_identifier.trim().length === 0
  ) {
    errors.project_identifier = 'Project identifier is required';
  } else if (args.project_identifier.trim().length > 5) {
    errors.project_identifier = 'Project identifier must be 1-5 characters';
  } else if (!/^[A-Z][A-Z0-9]*$/.test(args.project_identifier)) {
    errors.project_identifier =
      'Project identifier must start with uppercase letter and contain only uppercase letters and numbers';
  }

  // Validate milestone_label
  if (
    !args.milestone_label ||
    typeof args.milestone_label !== 'string' ||
    args.milestone_label.trim().length === 0
  ) {
    errors.milestone_label = 'Milestone label is required';
  }

  // Validate dry_run
  if (args.dry_run !== undefined && typeof args.dry_run !== 'boolean') {
    errors.dry_run = 'dry_run must be a boolean value';
  }

  // Validate force
  if (args.force !== undefined && typeof args.force !== 'boolean') {
    errors.force = 'force must be a boolean value';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
