/**
 * huly_entity - Universal entity manager
 *
 * Consolidates CRUD-style operations for projects, components, milestones, and comments
 * into a single polymorphic MCP tool.
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { coerceJsonFields } from '../base/jsonUtils.js';
import { HulyError } from '../../core/HulyError.js';
import trackerModule from '@hcengineering/tracker';

const tracker = trackerModule.default || trackerModule;

const TOOL_NAME = 'huly_entity';

const ProjectCreateDataSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Project name',
    },
    description: {
      type: 'string',
      description: 'Project description',
    },
    identifier: {
      type: 'string',
      description: 'Custom identifier (max 5 uppercase characters)',
      minLength: 1,
      maxLength: 5,
    },
  },
  required: ['name'],
  additionalProperties: false,
};

const ProjectUpdateDataSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'New project name',
    },
    description: {
      type: 'string',
      description: 'New project description',
    },
  },
  minProperties: 1,
  additionalProperties: false,
};

const ComponentCreateDataSchema = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Component label',
    },
    description: {
      type: 'string',
      description: 'Component description',
    },
  },
  required: ['label'],
  additionalProperties: false,
};

const ComponentUpdateDataSchema = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'New component label',
    },
    description: {
      type: 'string',
      description: 'New component description',
    },
  },
  minProperties: 1,
  additionalProperties: false,
};

const MilestoneCreateDataSchema = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Milestone label',
    },
    description: {
      type: 'string',
      description: 'Milestone description',
    },
    target_date: {
      type: 'string',
      format: 'date',
      description: 'Target date in ISO 8601 format (YYYY-MM-DD)',
    },
    status: {
      type: 'string',
      description: 'Milestone status',
      enum: ['planned', 'in-progress', 'completed', 'blocked'],
      default: 'planned',
    },
  },
  required: ['label', 'target_date'],
  additionalProperties: false,
};

const CommentCreateDataSchema = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'Comment message (markdown supported)',
    },
  },
  required: ['message'],
  additionalProperties: false,
};

const DeletionOptionsSchema = {
  type: 'object',
  properties: {
    cascade: {
      type: 'boolean',
      description: 'Cascade deletions to child entities when true.',
    },
    dry_run: {
      type: 'boolean',
      description: 'Preview deletions without executing them.',
    },
    force: {
      type: 'boolean',
      description: 'Force deletion even if there are blocking references.',
    },
  },
  additionalProperties: false,
};

/**
 * Normalize common deletion options from snake_case to camelCase used by services.
 * @param {Object|undefined} options
 * @returns {Object}
 */
function normalizeDeletionOptions(options = {}) {
  return {
    cascade: options.cascade ?? undefined,
    force: options.force ?? options.forceDeletion ?? undefined,
    dryRun: options.dry_run ?? options.dryRun ?? false,
  };
}

/**
 * Format a project document into a readable response payload.
 * @param {Object} project
 * @returns {Object}
 */
function formatProject(project) {
  const payload = {
    identifier: project.identifier,
    name: project.name,
    description: project.description ?? '',
    archived: Boolean(project.archived),
    private: Boolean(project.private),
    owners: project.owners?.length ? project.owners : [],
    createdOn: project.createdOn,
    modifiedOn: project.modifiedOn,
  };

  return createToolResponse(JSON.stringify(payload, null, 2));
}

/**
 * Format a component document into a response payload.
 * @param {Object} component
 * @returns {Object}
 */
function formatComponent(component) {
  const payload = {
    id: component._id,
    label: component.label,
    description: component.description ?? '',
    createdOn: component.createdOn,
    modifiedOn: component.modifiedOn,
  };

  return createToolResponse(JSON.stringify(payload, null, 2));
}

/**
 * Format a milestone document into a response payload.
 * @param {Object} milestone
 * @returns {Object}
 */
function formatMilestone(milestone) {
  const payload = {
    id: milestone._id,
    label: milestone.label,
    status: milestone.status,
    targetDate: milestone.targetDate,
    description: milestone.description ?? '',
  };
  return createToolResponse(JSON.stringify(payload, null, 2));
}

export const definition = {
  name: TOOL_NAME,
  description:
    'Universal entity manager providing CRUD-style operations across projects, components, milestones, and comments using discriminator-based parameters.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['project', 'component', 'milestone', 'comment'],
        description:
          'Entity type to target. Supported operations by entity:\n' +
          '- project: create, read, update, archive, delete\n' +
          '- component: create, read, update, delete\n' +
          '- milestone: create, read, delete\n' +
          '- comment: create',
      },
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'archive', 'delete'],
        description:
          'Operation to perform. Required fields vary per entity type:\n' +
          '- project create: data\n' +
          '- project read/archive/delete: project_identifier\n' +
          '- project update: project_identifier, data\n' +
          '- component create: project_identifier, data\n' +
          '- component read/delete: project_identifier, entity_identifier\n' +
          '- component update: project_identifier, entity_identifier, data\n' +
          '- milestone create: project_identifier, data\n' +
          '- milestone read/delete: project_identifier, entity_identifier\n' +
          '- comment create: issue_identifier, data',
      },
      project_identifier: {
        type: 'string',
        description:
          'Target project identifier (required for most component/milestone operations and project read/archive/delete).',
      },
      entity_identifier: {
        type: 'string',
        description: 'Component or milestone label depending on entity_type.',
      },
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (required when entity_type=comment).',
      },
      data: {
        description:
          'Payload used for create/update operations. For project create see definitions.ProjectCreateData, for project update see definitions.ProjectUpdateData, for components see definitions.ComponentCreateData and ComponentUpdateData, for milestones see definitions.MilestoneCreateData, for comments see definitions.CommentCreateData.',
        oneOf: [
          ProjectCreateDataSchema,
          ProjectUpdateDataSchema,
          ComponentCreateDataSchema,
          ComponentUpdateDataSchema,
          MilestoneCreateDataSchema,
          CommentCreateDataSchema,
          {
            type: 'string',
            description:
              'JSON string representing one of: ProjectCreateData, ProjectUpdateData, ComponentCreateData, ComponentUpdateData, MilestoneCreateData, CommentCreateData.',
          },
        ],
      },
      options: {
        description: 'Deletion options supporting cascade, dry_run, and force.',
        oneOf: [
          DeletionOptionsSchema,
          {
            type: 'string',
            description: 'JSON string representing DeletionOptions.',
          },
        ],
      },
    },
    required: ['entity_type', 'operation'],
    additionalProperties: false,
    definitions: {
      ProjectCreateData: ProjectCreateDataSchema,
      ProjectUpdateData: ProjectUpdateDataSchema,
      ComponentCreateData: ComponentCreateDataSchema,
      ComponentUpdateData: ComponentUpdateDataSchema,
      MilestoneCreateData: MilestoneCreateDataSchema,
      CommentCreateData: CommentCreateDataSchema,
      DeletionOptions: DeletionOptionsSchema,
    },
  },
  annotations: {
    title: 'Universal Entity Manager',
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
};

const ENTITY_OPERATIONS = {
  project: {
    async create(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const { name, description, identifier } = args.data;
      return projectService.createProject(client, name, description, identifier);
    },
    async read(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const project = await projectService.findProject(client, args.project_identifier);
      return formatProject(project);
    },
    async update(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const { name, description } = args.data;
      return projectService.updateProject(client, args.project_identifier, { name, description });
    },
    async archive(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      return projectService.archiveProject(client, args.project_identifier);
    },
    async delete(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const options = normalizeDeletionOptions(args.options);
      return projectService.deleteProject(client, args.project_identifier, options);
    },
  },
  component: {
    async create(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const { label, description } = args.data;
      return projectService.createComponent(client, args.project_identifier, label, description);
    },
    async read(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const project = await projectService.findProject(client, args.project_identifier);
      const component = await client.findOne(tracker.class.Component, {
        space: project._id,
        label: args.entity_identifier,
      });

      if (!component) {
        throw HulyError.notFound('component', args.entity_identifier);
      }

      return formatComponent(component);
    },
    async update(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const { label, description } = args.data;
      return projectService.updateComponent(
        client,
        args.project_identifier,
        args.entity_identifier, // current label
        label, // new label (optional)
        description // new description (optional)
      );
    },
    async delete(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const options = normalizeDeletionOptions(args.options);
      return projectService.deleteComponent(
        client,
        args.project_identifier,
        args.entity_identifier,
        options
      );
    },
  },
  milestone: {
    async create(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const { label, description, target_date, status } = args.data;
      return projectService.createMilestone(
        client,
        args.project_identifier,
        label,
        description,
        target_date,
        status
      );
    },
    async read(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const project = await projectService.findProject(client, args.project_identifier);
      const milestone = await client.findOne(tracker.class.Milestone, {
        space: project._id,
        label: args.entity_identifier,
      });

      if (!milestone) {
        throw HulyError.notFound('milestone', args.entity_identifier);
      }

      return formatMilestone(milestone);
    },
    async delete(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const options = normalizeDeletionOptions(args.options);
      return projectService.deleteMilestone(
        client,
        args.project_identifier,
        args.entity_identifier,
        options
      );
    },
  },
  comment: {
    async create(args, context) {
      const { client, services } = context;
      const { issueService } = services;
      return issueService.createComment(client, args.issue_identifier, args.data.message);
    },
  },
};

export async function handler(args, context) {
  const { logger } = context;
  const { entity_type: entityType, operation } = args;

  const entityHandlers = ENTITY_OPERATIONS[entityType];
  if (!entityHandlers) {
    return createErrorResponse(`Unsupported entity_type: ${entityType}`);
  }

  const operationHandler = entityHandlers[operation];
  if (!operationHandler) {
    return createErrorResponse(
      `Unsupported operation "${operation}" for entity_type "${entityType}"`
    );
  }

  try {
    logger.debug(`Executing ${TOOL_NAME}`, { entityType, operation });
    return await operationHandler(args, context);
  } catch (error) {
    logger.error(`Failed to execute ${TOOL_NAME}`, error);
    return createErrorResponse(error);
  }
}

export function validate(args) {
  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  const entityType = args.entity_type;
  if (!entityType) {
    return { entity_type: 'entity_type is required' };
  }

  const operation = args.operation;
  if (!operation) {
    return { operation: 'operation is required' };
  }

  const entityHandlers = ENTITY_OPERATIONS[entityType];
  if (!entityHandlers) {
    return { entity_type: `Unsupported entity_type: ${entityType}` };
  }

  if (!entityHandlers[operation]) {
    return { operation: `Unsupported operation ${operation} for entity_type ${entityType}` };
  }

  const errors = {};

  coerceJsonFields(args, errors, [
    { field: 'data', type: 'object' },
    { field: 'options', type: 'object' },
  ]);

  const requireField = (field, message) => {
    if (!args[field]) {
      errors[field] = message;
    }
  };
  const requireDataField = (field, message) => {
    if (
      !args.data ||
      args.data[field] === undefined ||
      args.data[field] === null ||
      args.data[field] === ''
    ) {
      errors[`data.${field}`] = message;
    }
  };

  switch (entityType) {
    case 'project':
      if (operation === 'create') {
        if (!args.data) {
          errors.data = 'data is required when creating a project';
        } else {
          requireDataField('name', 'name is required when creating a project');
        }
      } else if (operation === 'update') {
        requireField(
          'project_identifier',
          'project_identifier is required when updating a project'
        );
        if (!args.data) {
          errors.data = 'data is required when updating a project';
        } else {
          // At least one field must be provided
          if (!args.data.name && !args.data.description) {
            errors.data =
              'At least one of name or description must be provided when updating a project';
          }
        }
      } else {
        requireField('project_identifier', `${operation} requires project_identifier for projects`);
      }
      break;
    case 'component':
      if (operation === 'create') {
        requireField(
          'project_identifier',
          'project_identifier is required when creating a component'
        );
        if (!args.data) {
          errors.data = 'data is required when creating a component';
        } else {
          requireDataField('label', 'label is required when creating a component');
        }
      } else if (operation === 'update') {
        requireField(
          'project_identifier',
          'project_identifier is required when updating a component'
        );
        requireField(
          'entity_identifier',
          'entity_identifier (current label) is required when updating a component'
        );
        if (!args.data) {
          errors.data = 'data is required when updating a component';
        } else {
          if (!args.data.label && args.data.description === undefined) {
            errors.data =
              'At least one of label or description must be provided when updating a component';
          }
        }
      } else {
        requireField(
          'project_identifier',
          `${operation} requires project_identifier for components`
        );
        requireField('entity_identifier', `${operation} requires entity_identifier for components`);
      }
      break;
    case 'milestone':
      if (operation === 'create') {
        requireField(
          'project_identifier',
          'project_identifier is required when creating a milestone'
        );
        if (!args.data) {
          errors.data = 'data is required when creating a milestone';
        } else {
          requireDataField('label', 'label is required when creating a milestone');
          requireDataField('target_date', 'target_date is required when creating a milestone');
        }
      } else {
        requireField(
          'project_identifier',
          `${operation} requires project_identifier for milestones`
        );
        requireField('entity_identifier', `${operation} requires entity_identifier for milestones`);
      }
      break;
    case 'comment':
      requireField('issue_identifier', 'issue_identifier is required when creating a comment');
      if (!args.data) {
        errors.data = 'data is required when creating a comment';
      } else {
        requireDataField('message', 'message is required when creating a comment');
      }
      break;
    default:
      break;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
