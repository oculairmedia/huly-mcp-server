/**
 * huly_query - Universal query engine
 *
 * Aggregates list/search/get queries for primary entities using a single
 * MCP tool definition driven by discriminator parameters.
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { coerceJsonFields } from '../base/jsonUtils.js';

const TOOL_NAME = 'huly_query';

const ListOptionsSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 500,
      description: 'Maximum number of records to return',
    },
    offset: {
      type: 'integer',
      minimum: 0,
      description: 'Offset for pagination (currently advisory)',
    },
    sort: {
      type: 'string',
      description: 'Sort expression when supported',
    },
    include_details: {
      type: 'boolean',
      description: 'Whether to include verbose entity details when available',
    },
    include_descriptions: {
      type: 'boolean',
      description: 'Whether to include issue descriptions (default: true). Set to false for 80-90% token reduction.',
    },
  },
  additionalProperties: false,
};

const IssueSearchFiltersSchema = {
  type: 'object',
  properties: {
    project_identifier: {
      type: 'string',
      description: 'Optional project identifier to scope the search',
    },
    query: {
      type: 'string',
      description: 'Search term for issue titles/descriptions',
    },
    status: {
      type: 'string',
      description: 'Filter by status',
    },
    priority: {
      type: 'string',
      description: 'Filter by priority',
    },
    assignee: {
      type: 'string',
      description: 'Filter by assignee email or identifier',
    },
    component: {
      type: 'string',
      description: 'Filter by component label',
    },
    milestone: {
      type: 'string',
      description: 'Filter by milestone label',
    },
    created_after: {
      type: 'string',
      format: 'date',
      description: 'ISO date lower bound for creation date',
    },
    created_before: {
      type: 'string',
      format: 'date',
      description: 'ISO date upper bound for creation date',
    },
    modified_after: {
      type: 'string',
      format: 'date',
      description: 'ISO date lower bound for last modification date',
    },
    modified_before: {
      type: 'string',
      format: 'date',
      description: 'ISO date upper bound for last modification date',
    },
  },
  additionalProperties: false,
};

function normalizeLimit(options) {
  if (!options?.limit) {
    return undefined;
  }
  const parsed = Number(options.limit);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function formatProject(project) {
  const payload = {
    identifier: project.identifier,
    name: project.name,
    description: project.description ?? '',
    archived: Boolean(project.archived),
    private: Boolean(project.private),
    owners: project.owners ?? [],
    createdOn: project.createdOn,
    modifiedOn: project.modifiedOn,
  };
  return createToolResponse(JSON.stringify(payload, null, 2));
}

export const definition = {
  name: TOOL_NAME,
  description:
    'Universal query engine for Huly entities supporting list, search, and get operations across projects, issues, templates, components, milestones, and comments.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['project', 'component', 'milestone', 'issue', 'template', 'comment'],
        description:
          'Entity type to query. Supported combinations:\n' +
          "- project: list, get\n" +
          "- component: list\n" +
          "- milestone: list\n" +
          "- issue: list, search, get\n" +
          "- template: list, search, get\n" +
          "- comment: list",
      },
      mode: {
        type: 'string',
        enum: ['list', 'search', 'get'],
        description:
          'Query mode. Required fields by mode:\n' +
          "- list: may require project_identifier or issue_identifier depending on entity_type\n" +
          "- search: requires filters or query depending on entity_type\n" +
          "- get: requires the entity identifier (project_identifier, issue_identifier, or template_id)",
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier used for project/component/milestone/issue/template list modes and project get.',
      },
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier used for comment list and issue get operations.',
      },
      template_id: {
        type: 'string',
        description: 'Template identifier used for template get operations.',
      },
      query: {
        type: 'string',
        description: 'Search term used by template search operations.',
      },
      filters: {
        description: 'Filter set used by issue search operations.',
        oneOf: [
          IssueSearchFiltersSchema,
          {
            type: 'string',
            description: 'JSON string representing IssueSearchFilters.',
          },
        ],
      },
      options: {
        description: 'Standard list options supporting pagination, sorting, and detail flags.',
        oneOf: [
          ListOptionsSchema,
          {
            type: 'string',
            description: 'JSON string representing ListOptions.',
          },
        ],
      },
    },
    required: ['entity_type', 'mode'],
    additionalProperties: false,
    definitions: {
      ListOptions: ListOptionsSchema,
      IssueSearchFilters: IssueSearchFiltersSchema,
    },
  },
  annotations: {
    title: 'Universal Query Engine',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

const HANDLERS = {
  project: {
    async list(_args, context) {
      const { client, services } = context;
      const { projectService } = services;
      return projectService.listProjects(client);
    },
    async get(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      const project = await projectService.findProject(client, args.project_identifier);
      return formatProject(project);
    },
  },
  component: {
    async list(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      return projectService.listComponents(client, args.project_identifier);
    },
  },
  milestone: {
    async list(args, context) {
      const { client, services } = context;
      const { projectService } = services;
      return projectService.listMilestones(client, args.project_identifier);
    },
  },
  issue: {
    async list(args, context) {
      const { client, services } = context;
      const { issueService } = services;
      const limit = normalizeLimit(args.options);
      const includeDescriptions = args.options?.include_descriptions ?? true;
      return issueService.listIssues(client, args.project_identifier, limit, includeDescriptions);
    },
    async search(args, context) {
      const { client, services } = context;
      const { issueService } = services;
      const filters = { ...(args.filters || {}) };
      const limit = normalizeLimit(args.options);
      if (limit) {
        filters.limit = limit;
      }
      const includeDescriptions = args.options?.include_descriptions ?? true;
      return issueService.searchIssues(client, filters, includeDescriptions);
    },
    async get(args, context) {
      const { client, services } = context;
      const { issueService } = services;
      const includeDescriptions = args.options?.include_descriptions ?? true;
      return issueService.getIssueDetails(client, args.issue_identifier, includeDescriptions);
    },
  },
  template: {
    async list(args, context) {
      const { client, services } = context;
      const { templateService } = services;
      const limit = normalizeLimit(args.options);
      return templateService.listTemplates(client, args.project_identifier, limit);
    },
    async search(args, context) {
      const { client, services } = context;
      const { templateService } = services;
      const limit = normalizeLimit(args.options);
      return templateService.searchTemplates(
        client,
        args.query,
        args.project_identifier ?? null,
        limit
      );
    },
    async get(args, context) {
      const { client, services } = context;
      const { templateService } = services;
      return templateService.getTemplateDetails(client, args.template_id);
    },
  },
  comment: {
    async list(args, context) {
      const { client, services } = context;
      const { issueService } = services;
      const limit = normalizeLimit(args.options);
      return issueService.listComments(client, args.issue_identifier, limit);
    },
  },
};

export async function handler(args, context) {
  const { logger } = context;
  const { entity_type: entityType, mode } = args;

  const entityHandlers = HANDLERS[entityType];
  if (!entityHandlers) {
    return createErrorResponse(`Unsupported entity_type: ${entityType}`);
  }

  const operationHandler = entityHandlers[mode];
  if (!operationHandler) {
    return createErrorResponse(`Unsupported mode "${mode}" for entity_type "${entityType}"`);
  }

  try {
    logger.debug(`Executing ${TOOL_NAME}`, { entityType, mode });
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

  const mode = args.mode;
  if (!mode) {
    return { mode: 'mode is required' };
  }

  const entityHandlers = HANDLERS[entityType];
  if (!entityHandlers) {
    return { entity_type: `Unsupported entity_type: ${entityType}` };
  }

  if (!entityHandlers[mode]) {
    return { mode: `Unsupported mode ${mode} for entity_type ${entityType}` };
  }

  const errors = {};

  coerceJsonFields(args, errors, [
    { field: 'filters', type: 'object' },
    { field: 'options', type: 'object' },
  ]);

  const ensureField = (field, message) => {
    if (!args[field]) {
      errors[field] = message;
    }
  };

  switch (entityType) {
    case 'project':
      if (mode === 'get') {
        ensureField('project_identifier', 'project_identifier is required when mode=get for projects');
      }
      break;
    case 'component':
    case 'milestone':
      if (mode === 'list') {
        ensureField('project_identifier', 'project_identifier is required when listing components/milestones');
      }
      break;
    case 'issue':
      if (mode === 'list') {
        ensureField('project_identifier', 'project_identifier is required when listing issues');
      }
      if (mode === 'search') {
        if (!args.filters || Object.keys(args.filters).length === 0) {
          errors.filters = 'filters are required when searching issues';
        }
      }
      if (mode === 'get') {
        ensureField('issue_identifier', 'issue_identifier is required when mode=get for issues');
      }
      break;
    case 'template':
      if (mode === 'list') {
        ensureField('project_identifier', 'project_identifier is required when listing templates');
      }
      if (mode === 'search') {
        ensureField('query', 'query is required when searching templates');
      }
      if (mode === 'get') {
        ensureField('template_id', 'template_id is required when mode=get for templates');
      }
      break;
    case 'comment':
      ensureField('issue_identifier', 'issue_identifier is required when listing comments');
      break;
    default:
      break;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
