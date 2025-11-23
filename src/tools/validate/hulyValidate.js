/**
 * huly_validate - Universal validation engine
 *
 * Consolidates deletion validation and impact previews into a single MCP tool
 * using discriminator-based input parameters.
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { isValidIssueIdentifier, isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

const TOOL_NAME = 'huly_validate';

function formatDeletionValidationResult(result, detailed) {
  if (!detailed) {
    return createToolResponse(
      JSON.stringify(
        {
          success: result.canDelete,
          entity: result.entity,
          blockers: result.blockers,
          warnings: result.warnings,
        },
        null,
        2
      )
    );
  }

  return createToolResponse(JSON.stringify(result, null, 2));
}

function formatImpactPreview(title, text) {
  return createToolResponse(`${title}\n\n${text}`);
}

async function validateDeletion(args, context) {
  const { client, services } = context;
  const { deletionService } = services;
  const { entity_type: entityType, entity_identifier: identifier, project_identifier } = args;
  const detailed = args.options?.detailed ?? false;

  switch (entityType) {
    case 'issue': {
      if (!isValidIssueIdentifier(identifier)) {
        throw HulyError.invalidValue('entity_identifier', identifier, 'format like "PROJ-123"');
      }

      const impact = await deletionService.analyzeIssueDeletionImpact(client, identifier);
      const result = {
        entity: {
          type: 'issue',
          identifier,
          title: impact.issue.title,
        },
        canDelete: impact.blockers.length === 0,
        blockers: impact.blockers,
        warnings: [],
        impact: {
          subIssues: impact.subIssues.length,
          comments: impact.comments,
          attachments: impact.attachments,
        },
      };

      if (impact.subIssues.length > 0) {
        result.warnings.push(`Has ${impact.subIssues.length} sub-issues`);
      }
      if (impact.comments > 0) {
        result.warnings.push(`Has ${impact.comments} comments`);
      }
      if (impact.attachments > 0) {
        result.warnings.push(`Has ${impact.attachments} attachments`);
      }

      return formatDeletionValidationResult(result, detailed);
    }

    case 'project': {
      if (!isValidProjectIdentifier(identifier)) {
        throw HulyError.invalidValue('entity_identifier', identifier, 'format like "PROJ"');
      }

      const impact = await deletionService.analyzeProjectDeletionImpact(client, identifier);
      const result = {
        entity: {
          type: 'project',
          identifier,
          name: impact.project.name,
        },
        canDelete: impact.blockers.length === 0,
        blockers: impact.blockers,
        warnings: [],
        impact: {
          issues: impact.issues.length,
          components: impact.components.length,
          milestones: impact.milestones.length,
          templates: impact.templates.length,
        },
      };

      if (impact.issues.length > 0) {
        result.warnings.push(`Has ${impact.issues.length} issues`);
      }
      if (impact.components.length > 0) {
        result.warnings.push(`Has ${impact.components.length} components`);
      }
      if (impact.milestones.length > 0) {
        result.warnings.push(`Has ${impact.milestones.length} milestones`);
      }
      if (impact.templates.length > 0) {
        result.warnings.push(`Has ${impact.templates.length} templates`);
      }

      return formatDeletionValidationResult(result, detailed);
    }

    case 'component': {
      if (!project_identifier) {
        throw HulyError.validation(
          'project_identifier',
          project_identifier,
          'Project identifier is required for component validation'
        );
      }

      const preview = await deletionService.deleteComponent(client, project_identifier, identifier, {
        dryRun: true,
      });

      return formatDeletionValidationResult(
        {
          entity: {
            type: 'component',
            identifier,
            project: project_identifier,
          },
          canDelete: !/Affected issues: \d+/.test(preview.content?.[0]?.text ?? ''),
          blockers: preview.content?.[0]?.text?.includes('Affected issues:')
            ? ['Component is used by existing issues']
            : [],
          warnings: [],
          impact: {
            preview: preview.content?.[0]?.text,
          },
        },
        detailed
      );
    }

    case 'milestone': {
      if (!project_identifier) {
        throw HulyError.validation(
          'project_identifier',
          project_identifier,
          'Project identifier is required for milestone validation'
        );
      }

      const preview = await deletionService.deleteMilestone(client, project_identifier, identifier, {
        dryRun: true,
      });

      return formatDeletionValidationResult(
        {
          entity: {
            type: 'milestone',
            identifier,
            project: project_identifier,
          },
          canDelete: !/Affected issues: \d+/.test(preview.content?.[0]?.text ?? ''),
          blockers: preview.content?.[0]?.text?.includes('Affected issues:')
            ? ['Milestone is used by existing issues']
            : [],
          warnings: [],
          impact: {
            preview: preview.content?.[0]?.text,
          },
        },
        detailed
      );
    }

    default:
      throw new Error(`Unsupported entity_type for deletion validation: ${entityType}`);
  }
}

async function previewImpact(args, context) {
  const { client, services } = context;
  const { deletionService } = services;
  const { entity_type: entityType, entity_identifier: identifier, project_identifier } = args;

  switch (entityType) {
    case 'issue': {
      const impact = await deletionService.analyzeIssueDeletionImpact(client, identifier);
      return createToolResponse(
        JSON.stringify(
          {
            entity: {
              type: 'issue',
              identifier,
              title: impact.issue.title,
            },
            summary: {
              blockers: impact.blockers,
              subIssues: impact.subIssues.length,
              comments: impact.comments,
              attachments: impact.attachments,
            },
            subIssues: impact.subIssues,
          },
          null,
          2
        )
      );
    }

    case 'project': {
      const impact = await deletionService.analyzeProjectDeletionImpact(client, identifier);
      return createToolResponse(JSON.stringify(impact, null, 2));
    }

    case 'component': {
      if (!project_identifier) {
        throw HulyError.validation(
          'project_identifier',
          project_identifier,
          'Project identifier is required for component impact preview'
        );
      }
      const preview = await deletionService.deleteComponent(client, project_identifier, identifier, {
        dryRun: true,
      });
      return formatImpactPreview(
        `Component Deletion Preview: ${identifier}`,
        preview.content?.[0]?.text ?? 'No preview available.'
      );
    }

    case 'milestone': {
      if (!project_identifier) {
        throw HulyError.validation(
          'project_identifier',
          project_identifier,
          'Project identifier is required for milestone impact preview'
        );
      }
      const preview = await deletionService.deleteMilestone(client, project_identifier, identifier, {
        dryRun: true,
      });
      return formatImpactPreview(
        `Milestone Deletion Preview: ${identifier}`,
        preview.content?.[0]?.text ?? 'No preview available.'
      );
    }

    default:
      throw new Error(`Unsupported entity_type for impact preview: ${entityType}`);
  }
}

const VALIDATION_HANDLERS = {
  deletion: validateDeletion,
  impact_preview: previewImpact,
};

export const definition = {
  name: TOOL_NAME,
  description:
    'Universal validation engine covering deletion readiness checks and impact previews with consistent structured responses.',
  inputSchema: {
    type: 'object',
    properties: {
      validation_type: {
        type: 'string',
        enum: ['deletion', 'impact_preview'],
        description:
          'Validation mode. "deletion" checks readiness for deletion. "impact_preview" returns contextual impact information.',
      },
      entity_type: {
        type: 'string',
        enum: ['issue', 'project', 'component', 'milestone'],
        description:
          'Entity type being validated. component/milestone validations require project_identifier.',
      },
      entity_identifier: {
        type: 'string',
        description: 'Identifier of the entity (e.g., PROJ-123 or project key).',
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier required when entity_type is component or milestone.',
      },
      options: {
        type: 'object',
        description: 'Optional validation flags.',
        properties: {
          detailed: {
            type: 'boolean',
            description: 'Return full detail payload for deletion validations.',
            default: false,
          },
        },
        additionalProperties: false,
      },
    },
    required: ['validation_type', 'entity_type', 'entity_identifier'],
    additionalProperties: false,
  },
  annotations: {
    title: 'Universal Validation Engine',
    destructiveHint: false,
    idempotentHint: true,
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function handler(args, context) {
  const { validation_type: validationType } = args;
  const handlerFn = VALIDATION_HANDLERS[validationType];

  if (!handlerFn) {
    return createErrorResponse(`Unsupported validation_type: ${validationType}`);
  }

  try {
    return await handlerFn(args, context);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export function validate(args) {
  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  const validationType = args.validation_type;
  if (!validationType) {
    return { validation_type: 'validation_type is required' };
  }

  if (!VALIDATION_HANDLERS[validationType]) {
    return { validation_type: `Unsupported validation_type: ${validationType}` };
  }

  const errors = {};
  if (!args.entity_type) {
    errors.entity_type = 'entity_type is required';
  }

  if (!args.entity_identifier) {
    errors.entity_identifier = 'entity_identifier is required';
  }

  if ((args.entity_type === 'component' || args.entity_type === 'milestone') && !args.project_identifier) {
    errors.project_identifier = `project_identifier is required when entity_type=${args.entity_type}`;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
