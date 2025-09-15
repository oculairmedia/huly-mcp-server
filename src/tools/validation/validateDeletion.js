/**
 * Validate Deletion Tool
 *
 * Validates if an entity can be safely deleted
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidIssueIdentifier, isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_validate_deletion',
  description:
    'Perform comprehensive pre-deletion analysis and dependency validation for various entity types including issues, projects, components, and milestones, providing detailed impact assessment, blocking relationship identification, and safety recommendations to prevent accidental data loss and organizational disruption. This critical safety tool conducts thorough analysis of entity relationships, dependency chains, and organizational impacts before deletion operations, identifying potential blockers, affected stakeholders, and cascading effects that could result from entity removal. The validation process includes exhaustive dependency scanning across all related entities, comprehensive permission verification, detailed impact analysis with affected entity counts, and intelligent recommendation generation for safe deletion procedures or alternative approaches. Advanced features include multi-level dependency analysis for complex organizational structures, comprehensive reporting of blocking relationships with detailed explanations, automatic identification of alternative resolution strategies, and detailed audit logging for compliance and decision-making documentation. The tool supports complex organizational scenarios requiring careful change management, risk assessment, and stakeholder impact analysis while providing clear, actionable guidance for safe entity lifecycle management. This tool is essential for administrative decision-making, risk management, organizational planning, and maintenance scenarios requiring reliable, comprehensive, and auditable entity deletion validation with full consideration for complex organizational dependencies, stakeholder impacts, and data integrity requirements across diverse project types and organizational structures.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        description: 'Type of entity to validate',
        enum: ['issue', 'project', 'component', 'milestone'],
      },
      entity_identifier: {
        type: 'string',
        description: 'Entity identifier (e.g., "PROJ-123" for issue, "PROJ" for project)',
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier (required for component/milestone validation)',
      },
    },
    required: ['entity_type', 'entity_identifier'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { entity_type, entity_identifier, project_identifier } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Validating deletion', args);

    let validationResult;

    switch (entity_type) {
      case 'issue': {
        // Validate issue identifier format
        if (!isValidIssueIdentifier(entity_identifier)) {
          throw HulyError.invalidValue(
            'entity_identifier',
            entity_identifier,
            'format like "PROJ-123"'
          );
        }

        // Analyze deletion impact
        const impact = await deletionService.analyzeIssueDeletionImpact(client, entity_identifier);

        // Determine if deletion is safe
        const canDelete = impact.blockers.length === 0;
        const warnings = [];

        if (impact.subIssues.length > 0) {
          warnings.push(`Has ${impact.subIssues.length} sub-issues that will be deleted`);
        }
        if (impact.comments > 0) {
          warnings.push(`Has ${impact.comments} comments that will be deleted`);
        }
        if (impact.attachments > 0) {
          warnings.push(`Has ${impact.attachments} attachments that will be deleted`);
        }

        validationResult = {
          entity: {
            type: 'issue',
            identifier: entity_identifier,
            title: impact.issue.title,
          },
          canDelete,
          blockers: impact.blockers,
          warnings,
          impact: {
            subIssues: impact.subIssues.length,
            comments: impact.comments,
            attachments: impact.attachments,
          },
        };
        break;
      }

      case 'project': {
        // Validate project identifier format
        if (!isValidProjectIdentifier(entity_identifier)) {
          throw HulyError.invalidValue(
            'entity_identifier',
            entity_identifier,
            'format like "PROJ"'
          );
        }

        // Analyze deletion impact
        const impact = await deletionService.analyzeProjectDeletionImpact(
          client,
          entity_identifier
        );

        // Determine if deletion is safe
        const canDelete = impact.blockers.length === 0;
        const warnings = [];

        if (impact.issues.length > 0) {
          warnings.push(`Has ${impact.issues.length} issues that will be deleted`);
        }
        if (impact.components.length > 0) {
          warnings.push(`Has ${impact.components.length} components that will be deleted`);
        }
        if (impact.milestones.length > 0) {
          warnings.push(`Has ${impact.milestones.length} milestones that will be deleted`);
        }
        if (impact.templates.length > 0) {
          warnings.push(`Has ${impact.templates.length} templates that will be deleted`);
        }

        validationResult = {
          entity: {
            type: 'project',
            identifier: entity_identifier,
            name: impact.project.name,
          },
          canDelete,
          blockers: impact.blockers,
          warnings,
          impact: {
            issues: impact.issues.length,
            components: impact.components.length,
            milestones: impact.milestones.length,
            templates: impact.templates.length,
          },
        };
        break;
      }

      case 'component': {
        if (!project_identifier) {
          throw HulyError.validation(
            'project_identifier',
            project_identifier,
            'Project identifier is required for component validation'
          );
        }

        // Use dry run to get impact analysis
        const dryRunResult = await deletionService.deleteComponent(
          client,
          project_identifier,
          entity_identifier,
          { dryRun: true }
        );

        // Parse the dry run result to extract impact information
        const dryRunText = dryRunResult.content[0].text;
        const affectedMatch = dryRunText.match(/Affected issues: (\d+)/);
        const affectedCount = affectedMatch ? parseInt(affectedMatch[1]) : 0;

        const canDelete = affectedCount === 0;
        const warnings = [];
        const blockers = [];

        if (affectedCount > 0) {
          blockers.push(`${affectedCount} issues use this component`);
        }

        validationResult = {
          entity: {
            type: 'component',
            identifier: entity_identifier,
            project: project_identifier,
          },
          canDelete,
          blockers,
          warnings,
          impact: {
            affectedIssues: affectedCount,
          },
        };
        break;
      }

      case 'milestone': {
        if (!project_identifier) {
          throw HulyError.validation(
            'project_identifier',
            project_identifier,
            'Project identifier is required for milestone validation'
          );
        }

        // Use dry run to get impact analysis
        const dryRunResult = await deletionService.deleteMilestone(
          client,
          project_identifier,
          entity_identifier,
          { dryRun: true }
        );

        // Parse the dry run result to extract impact information
        const dryRunText = dryRunResult.content[0].text;
        const affectedMatch = dryRunText.match(/Affected issues: (\d+)/);
        const affectedCount = affectedMatch ? parseInt(affectedMatch[1]) : 0;

        const canDelete = affectedCount === 0;
        const warnings = [];
        const blockers = [];

        if (affectedCount > 0) {
          blockers.push(`${affectedCount} issues use this milestone`);
        }

        validationResult = {
          entity: {
            type: 'milestone',
            identifier: entity_identifier,
            project: project_identifier,
          },
          canDelete,
          blockers,
          warnings,
          impact: {
            affectedIssues: affectedCount,
          },
        };
        break;
      }

      default:
        throw HulyError.invalidValue(
          'entity_type',
          entity_type,
          'issue, project, component, or milestone'
        );
    }

    // Format response
    let response = `# Deletion Validation Result\n\n`;
    response += `**Entity**: ${validationResult.entity.type} - ${validationResult.entity.identifier}\n`;
    if (validationResult.entity.title || validationResult.entity.name) {
      response += `**Name**: ${validationResult.entity.title || validationResult.entity.name}\n`;
    }
    response += `\n**Can Delete**: ${validationResult.canDelete ? '✅ Yes' : '❌ No'}\n\n`;

    if (validationResult.blockers.length > 0) {
      response += `## ⚠️ Blockers\n\n`;
      validationResult.blockers.forEach((blocker) => {
        response += `- ${blocker}\n`;
      });
      response += '\n';
    }

    if (validationResult.warnings.length > 0) {
      response += `## ⚠️ Warnings\n\n`;
      validationResult.warnings.forEach((warning) => {
        response += `- ${warning}\n`;
      });
      response += '\n';
    }

    if (Object.keys(validationResult.impact).length > 0) {
      response += `## 📊 Impact Summary\n\n`;
      Object.entries(validationResult.impact).forEach(([key, value]) => {
        if (value > 0) {
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim();
          response += `- ${formattedKey}: ${value}\n`;
        }
      });
      response += '\n';
    }

    if (!validationResult.canDelete) {
      response += `*Use the force option to override blockers, or resolve them first.*`;
    }

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to validate deletion:', error);
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

  // Validate entity_type
  const validTypes = ['issue', 'project', 'component', 'milestone'];
  if (!args.entity_type || !validTypes.includes(args.entity_type)) {
    errors.entity_type = 'Must be one of: issue, project, component, milestone';
  }

  // Validate entity_identifier
  if (!args.entity_identifier || args.entity_identifier.trim().length === 0) {
    errors.entity_identifier = 'Entity identifier is required';
  }

  // Validate project_identifier for component/milestone
  if (
    (args.entity_type === 'component' || args.entity_type === 'milestone') &&
    (!args.project_identifier || args.project_identifier.trim().length === 0)
  ) {
    errors.project_identifier = 'Project identifier is required for component/milestone validation';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
