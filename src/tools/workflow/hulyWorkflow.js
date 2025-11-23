/**
 * huly_workflow - Workflow orchestrator
 *
 * Provides higher-level orchestrations that combine multiple entity and
 * issue operations into guided flows such as project setup and sprint planning.
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { coerceJsonFields } from '../base/jsonUtils.js';

const TOOL_NAME = 'huly_workflow';

const WorkflowOptionsSchema = {
  type: 'object',
  properties: {
    dry_run: {
      type: 'boolean',
      description: 'If true, describe actions without executing them.',
      default: false,
    },
  },
  additionalProperties: false,
};

const ComponentDescriptorSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['label'],
  additionalProperties: false,
};

const MilestoneSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    description: { type: 'string' },
    target_date: { type: 'string', format: 'date' },
    status: {
      type: 'string',
      enum: ['planned', 'in-progress', 'completed', 'blocked'],
      default: 'planned',
    },
  },
  required: ['label', 'target_date'],
  additionalProperties: false,
};

const TemplateSeedChildSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignee: { type: 'string' },
    component: { type: 'string' },
    milestone: { type: 'string' },
    estimation: { type: 'number', minimum: 0 },
  },
  required: ['title'],
  additionalProperties: false,
};

const TemplateSeedDataSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Template title' },
    description: { type: 'string', description: 'Template description' },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignee: { type: 'string', description: 'Assignee email' },
    component: { type: 'string', description: 'Component label' },
    milestone: { type: 'string', description: 'Milestone label' },
    estimation: { type: 'number', description: 'Estimation in hours', minimum: 0 },
    children: {
      type: 'array',
      items: TemplateSeedChildSchema,
    },
  },
  required: ['title'],
  additionalProperties: false,
};

const SprintPlanningBacklogFilterSchema = {
  type: 'object',
  description: 'Filters applied to issue backlog query',
  properties: {
    status: { type: 'string', description: 'Filter issues by status' },
    priority: { type: 'string', description: 'Filter issues by priority' },
    assignee: { type: 'string', description: 'Filter issues by assignee email or id' },
    component: { type: 'string', description: 'Filter issues by component label' },
    milestone: { type: 'string', description: 'Filter issues by milestone label' },
  },
  additionalProperties: false,
};

const ProjectSetupContextSchema = {
  type: 'object',
  properties: {
    project: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        identifier: {
          type: 'string',
          description: 'Project identifier (required for downstream steps)',
        },
        description: { type: 'string', description: 'Project description' },
      },
      required: ['name', 'identifier'],
      additionalProperties: false,
    },
    components: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'string',
            description: 'Component label to create using defaults.',
          },
          ComponentDescriptorSchema,
        ],
      },
    },
    milestones: {
      type: 'array',
      items: MilestoneSchema,
    },
    templates: {
      type: 'array',
      items: TemplateSeedDataSchema,
    },
    repository: {
      type: 'string',
      description: 'Repository to assign via integration hub',
    },
  },
  required: ['project'],
  additionalProperties: false,
};

const SprintPlanningContextSchema = {
  type: 'object',
  properties: {
    project_identifier: {
      type: 'string',
      description: 'Project identifier to plan the sprint for',
    },
    sprint_name: {
      type: 'string',
      description: 'Sprint name',
    },
    duration_weeks: {
      type: 'number',
      description: 'Sprint duration in weeks',
      minimum: 1,
    },
    team_capacity: {
      type: 'number',
      description: 'Team capacity (story points or hours)',
      minimum: 1,
    },
    backlog_filter: SprintPlanningBacklogFilterSchema,
    backlog_limit: {
      type: 'integer',
      description: 'Maximum number of issues returned from backlog query',
      minimum: 1,
      maximum: 100,
    },
  },
  required: ['project_identifier', 'sprint_name'],
  additionalProperties: false,
};

function describeProjectSetup(context) {
  const lines = [];
  const project = context.project ?? {};
  lines.push(`• Create project ${project.name ?? '(missing name)'} (${project.identifier ?? 'auto'})`);

  if (context.components?.length) {
    lines.push(`• Create ${context.components.length} component(s): ${context.components.join(', ')}`);
  }

  if (context.milestones?.length) {
    const labels = context.milestones.map((m) => m.label).join(', ');
    lines.push(`• Create ${context.milestones.length} milestone(s): ${labels}`);
  }

  if (context.repository) {
    lines.push(`• Assign repository ${context.repository}`);
  }

  if (context.templates?.length) {
    const templateTitles = context.templates.map((tpl) => tpl.title).join(', ');
    lines.push(`• Seed ${context.templates.length} template(s): ${templateTitles}`);
  }

  return lines.join('\n');
}

function buildWorkflowSummary(title, sections) {
  const text = [`${title}`, ''];
  for (const section of sections) {
    if (!section) continue;
    text.push(section);
    text.push('');
  }
  return createToolResponse(text.join('\n').trim());
}

async function runProjectSetup(args, context) {
  const { client, services, logger } = context;
  const { projectService, templateService } = services;
  const workflowContext = args.context ?? {};
  const project = workflowContext.project ?? {};
  const dryRun = args.options?.dry_run ?? false;

  if (!project.name) {
    throw new Error('context.project.name is required for project_setup workflow');
  }
  if (!project.identifier) {
    throw new Error('context.project.identifier is required for project_setup workflow');
  }

  if (dryRun) {
    const plan = describeProjectSetup(workflowContext);
    return buildWorkflowSummary('📝 Project Setup Plan (dry run)', [plan]);
  }

  const steps = [];

  // Step 1: Create project
  logger.info('Workflow project_setup: creating project');
  const createResult = await projectService.createProject(
    client,
    project.name,
    project.description,
    project.identifier
  );
  steps.push(createResult?.content?.[0]?.text ?? `Created project ${project.identifier}`);

  // Step 2: Create components
  if (workflowContext.components?.length) {
    for (const component of workflowContext.components) {
      logger.info('Workflow project_setup: creating component', { component });
      const componentLabel = typeof component === 'string' ? component : component?.label;
      const componentDescription = typeof component === 'object' ? component?.description : undefined;
      if (!componentLabel) {
        continue;
      }
      const componentResult = await projectService.createComponent(
        client,
        project.identifier,
        componentLabel,
        componentDescription
      );
      steps.push(componentResult?.content?.[0]?.text ?? `Created component ${componentLabel}`);
    }
  }

  // Step 3: Create milestones
  if (workflowContext.milestones?.length) {
    for (const milestone of workflowContext.milestones) {
      if (!milestone?.label || !milestone?.target_date) {
        throw new Error('Each milestone requires label and target_date');
      }
      logger.info('Workflow project_setup: creating milestone', { label: milestone.label });
      const milestoneResult = await projectService.createMilestone(
        client,
        project.identifier,
        milestone.label,
        milestone.description,
        milestone.target_date,
        milestone.status ?? 'planned'
      );
      steps.push(milestoneResult?.content?.[0]?.text ?? `Created milestone ${milestone.label}`);
    }
  }

  // Step 4: Seed templates if provided
  if (workflowContext.templates?.length) {
    for (const template of workflowContext.templates) {
      logger.info('Workflow project_setup: creating template', { title: template.title });
      const templateResult = await templateService.createTemplate(
        client,
        project.identifier,
        template
      );
      steps.push(templateResult?.content?.[0]?.text ?? `Created template ${template.title}`);
    }
  }

  // Step 5: Assign repository if provided
  if (workflowContext.repository) {
    logger.info('Workflow project_setup: assigning repository', {
      repository: workflowContext.repository,
    });
    const repoResult = await projectService.assignRepositoryToProject(
      client,
      project.identifier,
      workflowContext.repository
    );
    steps.push(repoResult?.content?.[0]?.text ?? `Assigned repository ${workflowContext.repository}`);
  }

  return buildWorkflowSummary('🚀 Project Setup Completed', steps);
}

async function runSprintPlanning(args, context) {
  const { client, services, logger } = context;
  const { issueService } = services;
  const workflowContext = args.context ?? {};
  const dryRun = args.options?.dry_run ?? false;

  if (!workflowContext.project_identifier) {
    throw new Error('context.project_identifier is required for sprint_planning workflow');
  }
  if (!workflowContext.sprint_name) {
    throw new Error('context.sprint_name is required for sprint_planning workflow');
  }

  const summaryLines = [
    `Sprint: ${workflowContext.sprint_name}`,
    `Project: ${workflowContext.project_identifier}`,
  ];

  if (workflowContext.duration_weeks) {
    summaryLines.push(`Duration: ${workflowContext.duration_weeks} week(s)`);
  }

  if (workflowContext.team_capacity) {
    summaryLines.push(`Capacity: ${workflowContext.team_capacity} story points`);
  }

  if (dryRun) {
    if (workflowContext.backlog_filter) {
      summaryLines.push(`Backlog filter: ${JSON.stringify(workflowContext.backlog_filter)}`);
    }
    return buildWorkflowSummary('📝 Sprint Planning Plan (dry run)', [summaryLines.join('\n')]);
  }

  logger.info('Workflow sprint_planning: querying backlog');
  const backlogFilters = {
    ...(workflowContext.backlog_filter || {}),
    project_identifier: workflowContext.project_identifier,
    limit: workflowContext.backlog_limit ?? 25,
  };
  const backlogResult = await issueService.searchIssues(client, backlogFilters);

  const backlogText = backlogResult?.content?.[0]?.text ?? 'No backlog data found.';
  const summary = summaryLines.join('\n');

  return buildWorkflowSummary('📅 Sprint Planning Summary', [summary, backlogText]);
}

const WORKFLOW_HANDLERS = {
  project_setup: runProjectSetup,
  sprint_planning: runSprintPlanning,
};

export const definition = {
  name: TOOL_NAME,
  description:
    'Workflow orchestrator enabling complex multi-step operations such as project setup and sprint planning through a single MCP tool.',
  inputSchema: {
    type: 'object',
    properties: {
      workflow_type: {
        type: 'string',
        enum: ['project_setup', 'sprint_planning'],
        description:
          'Workflow to execute. project_setup prepares a new project; sprint_planning gathers backlog insights.',
      },
      context: {
        description:
          'Workflow-specific context payload. For project_setup see definitions.ProjectSetupContext. For sprint_planning see definitions.SprintPlanningContext.',
        oneOf: [
          ProjectSetupContextSchema,
          SprintPlanningContextSchema,
          {
            type: 'string',
            description: 'JSON string representing one of the supported workflow contexts.',
          },
        ],
      },
      options: {
        description: 'Optional workflow execution parameters (e.g., dry_run).',
        oneOf: [
          WorkflowOptionsSchema,
          {
            type: 'string',
            description: 'JSON string representing WorkflowOptions.',
          },
        ],
      },
    },
    required: ['workflow_type', 'context'],
    additionalProperties: false,
    definitions: {
      WorkflowOptions: WorkflowOptionsSchema,
      ProjectSetupContext: ProjectSetupContextSchema,
      ProjectSetupComponent: ComponentDescriptorSchema,
      ProjectSetupMilestone: MilestoneSchema,
      SprintPlanningContext: SprintPlanningContextSchema,
      SprintPlanningBacklogFilter: SprintPlanningBacklogFilterSchema,
      TemplateSeedData: TemplateSeedDataSchema,
      TemplateSeedChild: TemplateSeedChildSchema,
    },
  },
  annotations: {
    title: 'Workflow Orchestrator',
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
};

export async function handler(args, context) {
  const { logger } = context;
  const { workflow_type: workflowType } = args;

  const handlerFn = WORKFLOW_HANDLERS[workflowType];
  if (!handlerFn) {
    return createErrorResponse(`Unsupported workflow_type: ${workflowType}`);
  }

  try {
    logger.info(`Executing workflow ${workflowType}`);
    return await handlerFn(args, context);
  } catch (error) {
    logger.error(`Failed to execute workflow ${workflowType}`, error);
    return createErrorResponse(error);
  }
}

export function validate(args) {
  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  const workflowType = args.workflow_type;
  if (!workflowType) {
    return { workflow_type: 'workflow_type is required' };
  }

  if (!WORKFLOW_HANDLERS[workflowType]) {
    return { workflow_type: `Unsupported workflow_type: ${workflowType}` };
  }

  const errors = {};

  coerceJsonFields(args, errors, [
    { field: 'context', type: 'object' },
    { field: 'options', type: 'object' },
  ]);

  if (!args.context || typeof args.context !== 'object' || Array.isArray(args.context)) {
    if (!errors.context) {
      errors.context = 'context is required';
    }
    return errors;
  }

  const context = args.context;
  if (workflowType === 'project_setup') {
    if (!context.project) {
      errors['context.project'] = 'context.project is required for project_setup';
    } else {
      if (!context.project.name) {
        errors['context.project.name'] = 'project name is required for project_setup';
      }
      if (!context.project.identifier) {
        errors['context.project.identifier'] = 'project identifier is required for project_setup';
      }
    }
  }

  if (workflowType === 'sprint_planning') {
    if (!context.project_identifier) {
      errors['context.project_identifier'] =
        'context.project_identifier is required for sprint_planning';
    }
    if (!context.sprint_name) {
      errors['context.sprint_name'] = 'context.sprint_name is required for sprint_planning';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
