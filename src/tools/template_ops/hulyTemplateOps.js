/**
 * huly_template_ops - Template operations hub
 *
 * Consolidates template lifecycle management into a single MCP tool driven by
 * discriminator-based parameters.
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { coerceJsonFields } from '../base/jsonUtils.js';

const TOOL_NAME = 'huly_template_ops';

const ChildTemplateDataSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Child template title',
    },
    description: {
      type: 'string',
      description: 'Child template description (markdown supported)',
    },
    priority: {
      type: 'string',
      description: 'Child template priority',
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignee: {
      type: 'string',
      description: 'Child template assignee email',
    },
    component: {
      type: 'string',
      description: 'Child template component label',
    },
    milestone: {
      type: 'string',
      description: 'Child template milestone label',
    },
    estimation: {
      type: 'number',
      description: 'Child template estimation (hours)',
      minimum: 0,
    },
  },
  required: ['title'],
  additionalProperties: false,
};

const TemplateDataSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Template title',
    },
    description: {
      type: 'string',
      description: 'Template description (markdown supported)',
    },
    priority: {
      type: 'string',
      description: 'Default priority for instantiated issues',
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignee: {
      type: 'string',
      description: 'Default assignee email',
    },
    component: {
      type: 'string',
      description: 'Default component label',
    },
    milestone: {
      type: 'string',
      description: 'Default milestone label',
    },
    estimation: {
      type: 'number',
      description: 'Default estimation in hours',
      minimum: 0,
    },
    children: {
      type: 'array',
      description: 'Child templates to attach',
      items: ChildTemplateDataSchema,
    },
  },
  required: ['title'],
  additionalProperties: false,
};

const TemplateOverridesSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Override issue title',
    },
    description: {
      type: 'string',
      description: 'Override description',
    },
    priority: {
      type: 'string',
      description: 'Override priority',
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    assignee: {
      type: 'string',
      description: 'Override assignee email',
    },
    component: {
      type: 'string',
      description: 'Override component label',
    },
    milestone: {
      type: 'string',
      description: 'Override milestone label',
    },
    estimation: {
      type: 'number',
      description: 'Override estimation (hours)',
      minimum: 0,
    },
    include_children: {
      type: 'boolean',
      description: 'Whether to include child templates when instantiating',
      default: true,
    },
  },
  additionalProperties: false,
};

export const definition = {
  name: TOOL_NAME,
  description:
    'Template operations hub providing create/update/delete/child management and instantiation capabilities via discriminator-based parameters.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'add_child', 'remove_child', 'instantiate'],
        description:
          'Operation to perform. Required fields by operation:\n' +
          "- create: project_identifier, data\n" +
          "- update: template_id, field, value\n" +
          "- delete: template_id\n" +
          "- add_child: template_id, data\n" +
          "- remove_child: template_id, child_index\n" +
          "- instantiate: template_id (overrides optional)",
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier hosting the template (required for create).',
      },
      data: {
        description:
          'Template or child template payload depending on operation. See definitions.TemplateData and definitions.ChildTemplateData.',
        oneOf: [
          TemplateDataSchema,
          ChildTemplateDataSchema,
          {
            type: 'string',
            description:
              'JSON string representing TemplateData (for create) or ChildTemplateData (for add_child).',
          },
        ],
      },
      template_id: {
        type: 'string',
        description: 'Template identifier used by update/delete/add_child/remove_child/instantiate.',
      },
      field: {
        type: 'string',
        enum: ['title', 'description', 'priority', 'assignee', 'component', 'milestone', 'estimation'],
        description: 'Field to update when operation=update.',
      },
      value: {
        type: 'string',
        description: 'New value applied to the selected field when operation=update.',
      },
      child_index: {
        type: 'integer',
        minimum: 0,
        description: 'Zero-based index of the child template to remove when operation=remove_child.',
      },
      overrides: {
        description: 'Optional overrides applied during instantiate.',
        oneOf: [
          TemplateOverridesSchema,
          {
            type: 'string',
            description: 'JSON string representing TemplateOverrides.',
          },
        ],
      },
    },
    required: ['operation'],
    additionalProperties: false,
    definitions: {
      TemplateData: TemplateDataSchema,
      ChildTemplateData: ChildTemplateDataSchema,
      TemplateOverrides: TemplateOverridesSchema,
    },
  },
  annotations: {
    title: 'Template Operations Hub',
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
};

const OPERATION_HANDLERS = {
  async create(args, context) {
    const { client, services } = context;
    const { templateService } = services;
    return templateService.createTemplate(client, args.project_identifier, args.data);
  },
  async update(args, context) {
    const { client, services } = context;
    const { templateService } = services;
    return templateService.updateTemplate(client, args.template_id, args.field, args.value);
  },
  async delete(args, context) {
    const { client, services } = context;
    const { templateService } = services;
    return templateService.deleteTemplate(client, args.template_id);
  },
  async add_child(args, context) {
    const { client, services } = context;
    const { templateService } = services;
    return templateService.addChildTemplate(client, args.template_id, args.data);
  },
  async remove_child(args, context) {
    const { client, services } = context;
    const { templateService } = services;
    return templateService.removeChildTemplate(client, args.template_id, args.child_index);
  },
  async instantiate(args, context) {
    const { client, services } = context;
    const { templateService } = services;
    const overrides = { ...(args.overrides || {}) };
    if (Object.prototype.hasOwnProperty.call(overrides, 'include_children')) {
      overrides.includeChildren = overrides.include_children;
      delete overrides.include_children;
    }
    return templateService.createIssueFromTemplate(client, args.template_id, overrides);
  },
};

export async function handler(args, context) {
  const { logger } = context;
  const { operation } = args;

  const handlerFn = OPERATION_HANDLERS[operation];
  if (!handlerFn) {
    return createErrorResponse(`Unsupported operation: ${operation}`);
  }

  try {
    logger.debug(`Executing ${TOOL_NAME}`, { operation });
    return await handlerFn(args, context);
  } catch (error) {
    logger.error(`Failed to execute ${TOOL_NAME}`, error);
    return createErrorResponse(error);
  }
}

export function validate(args) {
  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  const { operation } = args;
  if (!operation) {
    return { operation: 'operation is required' };
  }

  if (!OPERATION_HANDLERS[operation]) {
    return { operation: `Unsupported operation: ${operation}` };
  }

  const errors = {};

  coerceJsonFields(args, errors, [
    { field: 'data', type: 'object' },
    { field: 'overrides', type: 'object' },
  ]);

  const requireField = (field, message) => {
    if (args[field] === undefined || args[field] === null || args[field] === '') {
      errors[field] = message;
    }
  };
  const requireDataField = (field, message) => {
    if (!args.data || !args.data[field] || !String(args.data[field]).trim()) {
      errors[`data.${field}`] = message;
    }
  };

  switch (operation) {
    case 'create':
      requireField('project_identifier', 'project_identifier is required when creating a template');
      if (!args.data) {
        errors.data = 'data is required when creating a template';
      } else {
        requireDataField('title', 'title is required when creating a template');
      }
      break;
    case 'update':
      requireField('template_id', 'template_id is required when updating a template');
      requireField('field', 'field is required when updating a template');
      requireField('value', 'value is required when updating a template');
      break;
    case 'delete':
      requireField('template_id', 'template_id is required when deleting a template');
      break;
    case 'add_child':
      requireField('template_id', 'template_id is required when adding a child template');
      if (!args.data) {
        errors.data = 'data is required when adding a child template';
      } else {
        requireDataField('title', 'title is required when adding a child template');
      }
      break;
    case 'remove_child':
      requireField('template_id', 'template_id is required when removing a child template');
      if (args.child_index === undefined || args.child_index === null || args.child_index < 0) {
        errors.child_index = 'child_index must be a non-negative integer when removing a child template';
      }
      break;
    case 'instantiate':
      requireField('template_id', 'template_id is required when instantiating a template');
      break;
    default:
      break;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
