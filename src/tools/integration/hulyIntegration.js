/**
 * huly_integration - Integration hub
 *
 * Consolidates GitHub integration tooling into a unified MCP endpoint using
 * discriminator-based parameters.
 */

import { createErrorResponse } from '../base/ToolInterface.js';

const TOOL_NAME = 'huly_integration';

const GITHUB_HANDLERS = {
  async list_resources(_args, context) {
    const { client, services } = context;
    const { projectService } = services;
    return projectService.listGithubRepositories(client);
  },
  async assign(args, context) {
    const { client, services } = context;
    const { projectService } = services;
    return projectService.assignRepositoryToProject(
      client,
      args.project_identifier,
      args.repository_name
    );
  },
};

const INTEGRATION_HANDLERS = {
  github: GITHUB_HANDLERS,
};

export const definition = {
  name: TOOL_NAME,
  description:
    'Integration hub for external services such as GitHub, enabling resource discovery and assignment via a single tool.',
  inputSchema: {
    type: 'object',
    properties: {
      integration_type: {
        type: 'string',
        enum: ['github'],
        description: 'Integration provider to target. Currently only "github" is supported.',
      },
      operation: {
        type: 'string',
        enum: ['list_resources', 'assign'],
        description:
          'Operation to perform. Required fields by operation:\n' +
          "- list_resources: no additional fields\n" +
          "- assign: project_identifier, repository_name",
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier to associate with the integration (required for assign).',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name in the format "owner/repo" (required for assign).',
      },
    },
    required: ['integration_type', 'operation'],
    additionalProperties: false,
  },
  annotations: {
    title: 'Integration Hub',
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
};

export async function handler(args, context) {
  const { integration_type: integrationType, operation } = args;
  const integrationHandlers = INTEGRATION_HANDLERS[integrationType];

  if (!integrationHandlers) {
    return createErrorResponse(`Unsupported integration_type: ${integrationType}`);
  }

  const operationHandler = integrationHandlers[operation];
  if (!operationHandler) {
    return createErrorResponse(`Unsupported operation "${operation}" for ${integrationType}`);
  }

  try {
    return await operationHandler(args, context);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export function validate(args) {
  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  const integrationType = args.integration_type;
  if (!integrationType) {
    return { integration_type: 'integration_type is required' };
  }

  const integrationHandlers = INTEGRATION_HANDLERS[integrationType];
  if (!integrationHandlers) {
    return { integration_type: `Unsupported integration_type: ${integrationType}` };
  }

  const operation = args.operation;
  if (!operation) {
    return { operation: 'operation is required' };
  }

  if (!integrationHandlers[operation]) {
    return { operation: `Unsupported operation ${operation} for ${integrationType}` };
  }

  const errors = {};
  if (integrationType === 'github' && operation === 'assign') {
    if (!args.project_identifier) {
      errors.project_identifier = 'project_identifier is required when assigning a repository';
    }
    if (!args.repository_name) {
      errors.repository_name = 'repository_name is required when assigning a repository';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
