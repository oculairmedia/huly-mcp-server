/**
 * Delete Component Tool
 *
 * Deletes a component from a project with impact analysis
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_component',
  description:
    'Permanently remove organizational components from projects with comprehensive dependency validation, impact analysis, and multiple safety mechanisms to prevent accidental disruption of project structure and issue organization. This administrative tool provides sophisticated deletion capabilities including dry-run preview mode for impact assessment, force deletion options for components with active issue associations, and detailed dependency analysis that identifies all affected issues, workflows, and team assignments. The deletion process includes thorough validation of component existence, user permissions, and relationship dependencies, followed by atomic transactional removal that ensures complete cleanup of all component references while maintaining data consistency across the project ecosystem. Advanced safety features include comprehensive impact reporting with affected issue counts, automatic notification systems for stakeholders and team members, and detailed audit logging for compliance and recovery purposes. The tool automatically handles complex scenarios such as component reassignment suggestions for orphaned issues, cascade cleanup of component-specific configurations, and preservation of historical data for reporting and analytics purposes. This tool is essential for project restructuring, organizational cleanup, component lifecycle management, and administrative maintenance scenarios requiring reliable, secure, and auditable component removal capabilities with full consideration for complex project dependencies and team workflow impacts.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "PROJ")',
      },
      component_label: {
        type: 'string',
        description: 'Component label to delete',
      },
      force: {
        type: 'boolean',
        description: 'Force deletion even if issues use this component (default: false)',
        default: false,
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview deletion impact without actually deleting (default: false)',
        default: false,
      },
    },
    required: ['project_identifier', 'component_label'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { project_identifier, component_label, force = false, dry_run = false } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Deleting component', args);

    // Validate project identifier
    if (!isValidProjectIdentifier(project_identifier)) {
      throw HulyError.invalidValue(
        'project_identifier',
        project_identifier,
        'format like "PROJ" (1-5 uppercase letters)'
      );
    }

    // Validate component label
    if (!component_label || component_label.trim().length === 0) {
      throw HulyError.validation('component_label', component_label, 'Component label is required');
    }

    // Use DeletionService to handle the deletion
    const result = await deletionService.deleteComponent(
      client,
      project_identifier,
      component_label.trim(),
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
    logger.error('Failed to delete component:', error);
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

  // Validate component_label
  if (!args.component_label || args.component_label.trim().length === 0) {
    errors.component_label = 'Component label is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
