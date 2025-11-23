/**
 * huly_issue_ops - Issue operations hub
 *
 * Consolidates create/update/delete/subissue and bulk operations for issues
 * into a single polymorphic MCP tool.
 */

import { createErrorResponse, createToolResponse } from '../base/ToolInterface.js';
import { coerceJsonFields } from '../base/jsonUtils.js';
import { BulkOperationService } from '../../services/BulkOperationService.js';
import trackerModule from '@hcengineering/tracker';

const tracker = trackerModule.default || trackerModule;

const TOOL_NAME = 'huly_issue_ops';

const ISSUE_FIELD_ENUM = ['title', 'description', 'status', 'priority', 'component', 'milestone'];

const IssueCreateDataSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Issue title',
    },
    description: {
      type: 'string',
      description: 'Issue description',
    },
    priority: {
      type: 'string',
      description: 'Issue priority',
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    component: {
      type: 'string',
      description: 'Component label',
    },
    milestone: {
      type: 'string',
      description: 'Milestone label',
    },
  },
  required: ['title'],
  additionalProperties: false,
};

const IssueDefaultsSchema = {
  type: 'object',
  properties: {
    priority: {
      type: 'string',
      description: 'Default priority for bulk create',
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    component: {
      type: 'string',
      description: 'Default component label',
    },
    milestone: {
      type: 'string',
      description: 'Default milestone label',
    },
  },
  additionalProperties: false,
};

const IssueUpdateDataSchema = {
  type: 'object',
  properties: {
    field: {
      type: 'string',
      enum: ISSUE_FIELD_ENUM,
    },
    value: {
      type: 'string',
      description: 'New value for the field',
    },
  },
  required: ['field', 'value'],
  additionalProperties: false,
};

const BulkCreateIssueSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Issue title',
    },
    description: {
      type: 'string',
      description: 'Issue description',
    },
    priority: {
      type: 'string',
      description: 'Issue priority',
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    component: {
      type: 'string',
      description: 'Component label',
    },
    milestone: {
      type: 'string',
      description: 'Milestone label',
    },
    parent_issue: {
      type: 'string',
      description: 'Optional parent issue identifier for subissues',
    },
  },
  required: ['title'],
  additionalProperties: false,
};

const BulkUpdateItemSchema = {
  type: 'object',
  properties: {
    issue_identifier: {
      type: 'string',
      description: 'Issue identifier',
    },
    field: {
      type: 'string',
      enum: ISSUE_FIELD_ENUM,
    },
    value: {
      type: 'string',
      description: 'New field value',
    },
  },
  required: ['issue_identifier', 'field', 'value'],
  additionalProperties: false,
};

const IssueOptionsSchema = {
  type: 'object',
  properties: {
    cascade: {
      type: 'boolean',
      description: 'Delete sub-issues as well (delete/bulk_delete).',
    },
    force: {
      type: 'boolean',
      description: 'Force deletion even with blocking references (delete/bulk_delete).',
    },
    dry_run: {
      type: 'boolean',
      description: 'Validate without executing mutations (all bulk operations).',
    },
    continue_on_error: {
      type: 'boolean',
      description: 'Continue processing if an item fails (bulk operations).',
    },
    batch_size: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      description: 'Batch size for bulk operations.',
    },
  },
  additionalProperties: false,
};

function normalizeBulkOptions(options = {}) {
  return {
    batchSize: options.batch_size ?? 10,
    continueOnError: options.continue_on_error ?? true,
    dryRun: options.dry_run ?? false,
  };
}

function normalizeDeletionOptions(options = {}) {
  return {
    cascade: options.cascade ?? true,
    force: options.force ?? false,
    dryRun: options.dry_run ?? false,
    continueOnError: options.continue_on_error ?? true,
    batchSize: options.batch_size ?? 10,
  };
}

export const definition = {
  name: TOOL_NAME,
  description:
    'Issue operations hub providing create/update/delete/subissue and bulk processing capabilities using discriminator-based parameters.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'create_subissue', 'bulk_create', 'bulk_update', 'bulk_delete'],
        description:
          'Operation to perform. Required fields by operation:\n' +
          "- create: project_identifier, data\n" +
          "- update: issue_identifier, update\n" +
          "- delete: issue_identifier\n" +
          "- create_subissue: parent_issue_identifier, data\n" +
          "- bulk_create: project_identifier, items\n" +
          "- bulk_update: updates\n" +
          "- bulk_delete: issue_identifiers",
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier (required for create and bulk_create operations).',
      },
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (required for update and delete operations).',
      },
      parent_issue_identifier: {
        type: 'string',
        description: 'Parent issue identifier (required for create_subissue).',
      },
      data: {
        description: 'Payload for create/create_subissue operations.',
        oneOf: [
          IssueCreateDataSchema,
          {
            type: 'string',
            description: 'JSON string representing IssueCreateData.',
          },
        ],
      },
      update: {
        description: 'Field/value pair for update operations.',
        oneOf: [
          IssueUpdateDataSchema,
          {
            type: 'string',
            description: 'JSON string representing IssueUpdateData.',
          },
        ],
      },
      items: {
        description: 'Issue definitions for bulk_create operations.',
        oneOf: [
          {
            type: 'array',
            items: BulkCreateIssueSchema,
            minItems: 1,
            maxItems: 100,
          },
          {
            type: 'string',
            description: 'JSON string representing an array of BulkCreateIssue objects.',
          },
        ],
      },
      defaults: {
        description: 'Default values applied to bulk_create items when omitted per item.',
        oneOf: [
          IssueDefaultsSchema,
          {
            type: 'string',
            description: 'JSON string representing IssueDefaults.',
          },
        ],
      },
      options: {
        description:
          'Optional settings. For delete operations use cascade/force/dry_run/continue_on_error/batch_size. For bulk operations use batch_size/continue_on_error/dry_run.',
        oneOf: [
          IssueOptionsSchema,
          {
            type: 'string',
            description: 'JSON string representing options payload.',
          },
        ],
      },
      issue_identifiers: {
        description: 'List of issue identifiers for bulk_delete operations.',
        oneOf: [
          {
            type: 'array',
            items: {
              type: 'string',
              description: 'Issue identifier (e.g., "HULLY-1").',
            },
            minItems: 1,
            maxItems: 1000,
          },
          {
            type: 'string',
            description: 'JSON string representing an array of issue identifiers.',
          },
        ],
      },
      updates: {
        description: 'Batch updates for bulk_update operations.',
        oneOf: [
          {
            type: 'array',
            items: BulkUpdateItemSchema,
            minItems: 1,
            maxItems: 1000,
          },
          {
            type: 'string',
            description: 'JSON string representing an array of BulkUpdateItem objects.',
          },
        ],
      },
    },
    required: ['operation'],
    additionalProperties: false,
    definitions: {
      IssueCreateData: IssueCreateDataSchema,
      IssueDefaults: IssueDefaultsSchema,
      IssueUpdateData: IssueUpdateDataSchema,
      BulkCreateIssue: BulkCreateIssueSchema,
      BulkUpdateItem: BulkUpdateItemSchema,
      IssueOptions: IssueOptionsSchema,
    },
  },
  annotations: {
    title: 'Issue Operations Hub',
    destructiveHint: true,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
};

async function handleCreate(args, context) {
  const { client, services } = context;
  const { issueService } = services;
  const { title, description, priority, component, milestone } = args.data;
  if (!title || !title.trim()) {
    return createErrorResponse('Validation failed: title is required');
  }
  return issueService.createIssue(
    client,
    args.project_identifier,
    title,
    description,
    priority,
    component,
    milestone
  );
}

async function handleUpdate(args, context) {
  const { client, services } = context;
  const { issueService } = services;
  const { field, value } = args.update;
  return issueService.updateIssue(client, args.issue_identifier, field, value);
}

async function handleDelete(args, context) {
  const { client, services } = context;
  const { issueService } = services;
  const options = normalizeDeletionOptions(args.options);
  return issueService.deleteIssue(client, args.issue_identifier, options);
}

async function handleCreateSubissue(args, context) {
  const { client, services } = context;
  const { issueService } = services;
  const { title, description, priority, component, milestone } = args.data;
  return issueService.createSubissue(
    client,
    args.parent_issue_identifier,
    title,
    description,
    priority,
    component,
    milestone
  );
}

async function handleBulkCreate(args, context) {
  const { client, services, logger } = context;
  const { issueService } = services;
  const options = normalizeBulkOptions(args.options);
  const bulkService = new BulkOperationService({}, logger);

  // Merge defaults with individual items
  const issuesToCreate = args.items.map((issue) => ({
    ...args.defaults,
    ...issue,
  }));

  if (options.dryRun) {
    const validationResults = issuesToCreate.map((issue) => {
      const errors = [];
      if (!issue.title || issue.title.trim().length === 0) {
        errors.push('Title is required');
      }
      if (
        issue.priority &&
        !['low', 'medium', 'high', 'urgent', 'NoPriority'].includes(issue.priority)
      ) {
        errors.push('Invalid priority value');
      }
      return {
        item: issue,
        valid: errors.length === 0,
        errors,
      };
    });

    const summary = {
      total: validationResults.length,
      valid: validationResults.filter((r) => r.valid).length,
      invalid: validationResults.filter((r) => !r.valid).length,
    };

    return createToolResponse(JSON.stringify({ summary, validationResults }, null, 2));
  }

  const operationResult = await bulkService.executeBulkOperation({
    items: issuesToCreate,
    operation: async (issue) => {
      if (issue.parent_issue) {
        return issueService.createSubissue(
          client,
          issue.parent_issue,
          issue.title,
          issue.description,
          issue.priority ?? args.defaults?.priority ?? 'medium',
          issue.component ?? args.defaults?.component ?? null,
          issue.milestone ?? args.defaults?.milestone ?? null
        );
      }
      return issueService.createIssue(
        client,
        args.project_identifier,
        issue.title,
        issue.description,
        issue.priority ?? args.defaults?.priority ?? 'medium',
        issue.component ?? args.defaults?.component ?? null,
        issue.milestone ?? args.defaults?.milestone ?? null
      );
    },
    options: {
      batchSize: options.batchSize,
      continueOnError: options.continueOnError,
      progressCallback: (progress) => {
        logger.info(
          `Bulk create progress: ${progress.processed}/${progress.total} (success: ${progress.succeeded}, failed: ${progress.failed})`
        );
      },
    },
  });

  const summary = {
    total: operationResult.summary.total,
    succeeded: operationResult.summary.succeeded,
    failed: operationResult.summary.failed,
    elapsed_ms: operationResult.summary.duration,
  };

  const createdIssues = operationResult.results
    .filter((entry) => entry.success)
    .map((entry) => ({
      title: entry.item.title,
      identifier: entry.result?.data?.identifier,
      project: entry.result?.data?.project,
      status: entry.result?.data?.status,
      priority: entry.result?.data?.priority,
    }));

  const failedIssues = operationResult.results
    .filter((entry) => !entry.success)
    .map((entry) => ({
      title: entry.item.title,
      error: entry.error,
    }));

  return createToolResponse(
    JSON.stringify(
      {
        success: true,
        summary,
        created_issues: createdIssues.length > 0 ? createdIssues : undefined,
        failed_issues: failedIssues.length > 0 ? failedIssues : undefined,
      },
      null,
      2
    )
  );
}

async function handleBulkUpdate(args, context) {
  const { client, services, logger } = context;
  const { issueService } = services;
  const options = normalizeBulkOptions(args.options);
  const bulkService = new BulkOperationService({}, logger);

  if (options.dryRun) {
    const validationResults = [];

    for (const update of args.updates) {
      try {
        const issue = await client.findOne(tracker.class.Issue, {
          identifier: update.issue_identifier,
        });
        if (!issue) {
          throw new Error(`Issue ${update.issue_identifier} not found`);
        }
        validationResults.push({
          item: update,
          valid: true,
        });
      } catch (error) {
        validationResults.push({
          item: update,
          valid: false,
          error: error.message,
        });
      }
    }

    const summary = {
      total: validationResults.length,
      valid: validationResults.filter((r) => r.valid).length,
      invalid: validationResults.filter((r) => !r.valid).length,
    };

    return createToolResponse(JSON.stringify({ summary, validationResults }, null, 2));
  }

  const operationResult = await bulkService.executeBulkOperation({
    items: args.updates,
    operation: async (update) =>
      issueService.updateIssue(client, update.issue_identifier, update.field, update.value),
    options: {
      batchSize: options.batchSize,
      continueOnError: options.continueOnError,
      progressCallback: (progress) => {
        logger.info(
          `Bulk update progress: ${progress.processed}/${progress.total} (success: ${progress.succeeded}, failed: ${progress.failed})`
        );
      },
    },
  });

  const summary = {
    total: operationResult.summary.total,
    succeeded: operationResult.summary.succeeded,
    failed: operationResult.summary.failed,
    elapsed_ms: operationResult.summary.duration,
  };

  const successfulUpdates = operationResult.results
    .filter((entry) => entry.success)
    .map((entry) => ({
      issue_identifier: entry.item.issue_identifier,
      field: entry.item.field,
      value: entry.item.value,
      issue: entry.result?.data,
    }));

  const failedUpdates = operationResult.results
    .filter((entry) => !entry.success)
    .map((entry) => ({
      issue_identifier: entry.item.issue_identifier,
      field: entry.item.field,
      value: entry.item.value,
      error: entry.error,
    }));

  return createToolResponse(
    JSON.stringify(
      {
        success: true,
        summary,
        successful_updates: successfulUpdates.length > 0 ? successfulUpdates : undefined,
        failed_updates: failedUpdates.length > 0 ? failedUpdates : undefined,
      },
      null,
      2
    )
  );
}

async function handleBulkDelete(args, context) {
  const { client, services } = context;
  const { issueService } = services;
  const options = normalizeDeletionOptions(args.options);
  return issueService.bulkDeleteIssues(client, args.issue_identifiers, options);
}

const OPERATION_HANDLERS = {
  create: handleCreate,
  update: handleUpdate,
  delete: handleDelete,
  create_subissue: handleCreateSubissue,
  bulk_create: handleBulkCreate,
  bulk_update: handleBulkUpdate,
  bulk_delete: handleBulkDelete,
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
  const errors = {};

  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  coerceJsonFields(args, errors, [
    { field: 'data', type: 'object' },
    { field: 'update', type: 'object' },
    { field: 'defaults', type: 'object' },
    { field: 'options', type: 'object' },
    { field: 'items', type: 'array' },
    { field: 'updates', type: 'array' },
    { field: 'issue_identifiers', type: 'array' },
  ]);

  const { operation } = args;
  if (!operation) {
    errors.operation = 'operation is required';
    return errors;
  }

  if (!OPERATION_HANDLERS[operation]) {
    errors.operation = `Unsupported operation: ${operation}`;
    return errors;
  }

  const requireFields = (fields) => {
    for (const field of fields) {
      if (args[field] === undefined || args[field] === null || args[field] === '') {
        errors[field] = `${field} is required when operation=${operation}`;
      }
    }
  };

  switch (operation) {
    case 'create': {
      requireFields(['project_identifier', 'data']);
      if (args.data && (!args.data.title || !args.data.title.trim())) {
        errors['data.title'] = 'data.title is required when operation=create';
      }
      break;
    }
    case 'update': {
      requireFields(['issue_identifier', 'update']);
      if (args.update) {
        if (!args.update.field) {
          errors['update.field'] = 'update.field is required when operation=update';
        }
        if (args.update.value === undefined || args.update.value === null || args.update.value === '') {
          errors['update.value'] = 'update.value is required when operation=update';
        }
      }
      break;
    }
    case 'delete': {
      requireFields(['issue_identifier']);
      break;
    }
    case 'create_subissue': {
      requireFields(['parent_issue_identifier', 'data']);
      if (args.data && (!args.data.title || !args.data.title.trim())) {
        errors['data.title'] = 'data.title is required when operation=create_subissue';
      }
      break;
    }
    case 'bulk_create': {
      requireFields(['project_identifier', 'items']);
      if (!Array.isArray(args.items) || args.items.length === 0) {
        errors.items = 'items must be a non-empty array when operation=bulk_create';
      } else {
        args.items.forEach((item, index) => {
          if (!item?.title || !item.title.trim()) {
            errors[`items[${index}].title`] = 'title is required for each bulk create item';
          }
        });
      }
      break;
    }
    case 'bulk_update': {
      requireFields(['updates']);
      if (!Array.isArray(args.updates) || args.updates.length === 0) {
        errors.updates = 'updates must be a non-empty array when operation=bulk_update';
      } else {
        args.updates.forEach((item, index) => {
          if (!item?.issue_identifier) {
            errors[`updates[${index}].issue_identifier`] = 'issue_identifier is required for each bulk update item';
          }
          if (!item?.field) {
            errors[`updates[${index}].field`] = 'field is required for each bulk update item';
          }
          if (item?.value === undefined || item?.value === null || item?.value === '') {
            errors[`updates[${index}].value`] = 'value is required for each bulk update item';
          }
        });
      }
      break;
    }
    case 'bulk_delete': {
      requireFields(['issue_identifiers']);
      if (!Array.isArray(args.issue_identifiers) || args.issue_identifiers.length === 0) {
        errors.issue_identifiers = 'issue_identifiers must be a non-empty array when operation=bulk_delete';
      }
      break;
    }
    default:
      break;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
