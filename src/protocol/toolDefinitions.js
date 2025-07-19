/**
 * Tool Definitions - MCP tool schemas and metadata
 *
 * Defines all available tools with their input schemas and descriptions
 * for the Model Context Protocol.
 */

export const toolDefinitions = [
  // Project Management Tools
  {
    name: 'huly_list_projects',
    description: 'List all projects in Huly workspace',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'huly_create_project',
    description: 'Create a new project',
    inputSchema: {
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
          description: 'Project identifier (max 5 chars, uppercase)',
        },
      },
      required: ['name'],
    },
  },

  // Issue Management Tools
  {
    name: 'huly_list_issues',
    description: 'List issues in a specific project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "LMP")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of issues to return (default: 50)',
          default: 50,
        },
      },
      required: ['project_identifier'],
    },
  },
  {
    name: 'huly_create_issue',
    description: 'Create a new issue in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "LMP")',
        },
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
          description: 'Issue priority (low, medium, high, urgent)',
          enum: ['low', 'medium', 'high', 'urgent'],
          default: 'medium',
        },
      },
      required: ['project_identifier', 'title'],
    },
  },
  {
    name: 'huly_update_issue',
    description: 'Update an existing issue',
    inputSchema: {
      type: 'object',
      properties: {
        issue_identifier: {
          type: 'string',
          description: 'Issue identifier (e.g., "LMP-1")',
        },
        field: {
          type: 'string',
          description: 'Field to update',
          enum: ['title', 'description', 'status', 'priority', 'component', 'milestone'],
        },
        value: {
          type: 'string',
          description:
            'New value for the field. For status: accepts human-readable (backlog, todo, in-progress, done, canceled) or full format (tracker:status:Backlog, etc.)',
        },
      },
      required: ['issue_identifier', 'field', 'value'],
    },
  },
  {
    name: 'huly_create_subissue',
    description: 'Create a subissue under an existing parent issue',
    inputSchema: {
      type: 'object',
      properties: {
        parent_issue_identifier: {
          type: 'string',
          description: 'Parent issue identifier (e.g., "LMP-1")',
        },
        title: {
          type: 'string',
          description: 'Subissue title',
        },
        description: {
          type: 'string',
          description: 'Subissue description',
        },
        priority: {
          type: 'string',
          description: 'Issue priority (low, medium, high, urgent)',
          enum: ['low', 'medium', 'high', 'urgent'],
          default: 'medium',
        },
      },
      required: ['parent_issue_identifier', 'title'],
    },
  },
  {
    name: 'huly_search_issues',
    description: 'Search and filter issues with advanced capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier to search within (optional for cross-project search)',
        },
        query: {
          type: 'string',
          description: 'Search query for title and description (optional)',
        },
        status: {
          type: 'string',
          description: 'Filter by status (e.g., "Backlog", "In Progress", "Done")',
        },
        priority: {
          type: 'string',
          description: 'Filter by priority (low, medium, high, urgent, NoPriority)',
          enum: ['low', 'medium', 'high', 'urgent', 'NoPriority'],
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee ID or username',
        },
        component: {
          type: 'string',
          description: 'Filter by component name',
        },
        milestone: {
          type: 'string',
          description: 'Filter by milestone name',
        },
        created_after: {
          type: 'string',
          description: 'Filter issues created after this date (ISO 8601 format)',
        },
        created_before: {
          type: 'string',
          description: 'Filter issues created before this date (ISO 8601 format)',
        },
        modified_after: {
          type: 'string',
          description: 'Filter issues modified after this date (ISO 8601 format)',
        },
        modified_before: {
          type: 'string',
          description: 'Filter issues modified before this date (ISO 8601 format)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
          default: 50,
        },
      },
      required: [],
    },
  },
  {
    name: 'huly_get_issue_details',
    description:
      'Get comprehensive details about a specific issue including full description, comments, and all metadata',
    inputSchema: {
      type: 'object',
      properties: {
        issue_identifier: {
          type: 'string',
          description: 'Issue identifier (e.g., "LMP-1")',
        },
      },
      required: ['issue_identifier'],
    },
  },

  // Component Management Tools
  {
    name: 'huly_create_component',
    description: 'Create a new component in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "WEBHOOK")',
        },
        label: {
          type: 'string',
          description: 'Component name',
        },
        description: {
          type: 'string',
          description: 'Component description',
        },
      },
      required: ['project_identifier', 'label'],
    },
  },
  {
    name: 'huly_list_components',
    description: 'List all components in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "WEBHOOK")',
        },
      },
      required: ['project_identifier'],
    },
  },

  // Milestone Management Tools
  {
    name: 'huly_create_milestone',
    description: 'Create a new milestone in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "WEBHOOK")',
        },
        label: {
          type: 'string',
          description: 'Milestone name',
        },
        description: {
          type: 'string',
          description: 'Milestone description',
        },
        target_date: {
          type: 'string',
          description: 'Target date (ISO 8601 format)',
        },
        status: {
          type: 'string',
          description: 'Milestone status',
          enum: ['planned', 'in_progress', 'completed', 'canceled'],
          default: 'planned',
        },
      },
      required: ['project_identifier', 'label', 'target_date'],
    },
  },
  {
    name: 'huly_list_milestones',
    description: 'List all milestones in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "WEBHOOK")',
        },
      },
      required: ['project_identifier'],
    },
  },

  // GitHub Integration Tools
  {
    name: 'huly_list_github_repositories',
    description: 'List all GitHub repositories available in integrations',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'huly_assign_repository_to_project',
    description: 'Assign a GitHub repository to a Huly project',
    inputSchema: {
      type: 'object',
      properties: {
        project_identifier: {
          type: 'string',
          description: 'Project identifier (e.g., "WEBHOOK")',
        },
        repository_name: {
          type: 'string',
          description: 'GitHub repository name (e.g., "my-org/my-repo")',
        },
      },
      required: ['project_identifier', 'repository_name'],
    },
  },

  // Comment Management Tools
  {
    name: 'huly_list_comments',
    description: 'List comments on an issue',
    inputSchema: {
      type: 'object',
      properties: {
        issue_identifier: {
          type: 'string',
          description: 'Issue identifier (e.g., "LMP-1")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of comments to return (default: 50)',
          default: 50,
        },
      },
      required: ['issue_identifier'],
    },
  },
  {
    name: 'huly_create_comment',
    description: 'Create a comment on an issue',
    inputSchema: {
      type: 'object',
      properties: {
        issue_identifier: {
          type: 'string',
          description: 'Issue identifier (e.g., "LMP-1")',
        },
        message: {
          type: 'string',
          description: 'Comment message (supports markdown)',
        },
      },
      required: ['issue_identifier', 'message'],
    },
  },
];

// Create a map for quick tool lookup
export const toolMap = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

// Helper to validate tool name
export function isValidTool(name) {
  return toolMap.has(name);
}

// Helper to get tool definition
export function getToolDefinition(name) {
  return toolMap.get(name);
}
