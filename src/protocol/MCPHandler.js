/**
 * MCPHandler - Model Context Protocol handler
 *
 * Handles MCP protocol requests and responses, managing tool definitions
 * and request routing to appropriate services.
 */

import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { HulyError } from '../core/HulyError.js';
import { toolDefinitions } from './toolDefinitions.js';

export class MCPHandler {
  constructor(server, services) {
    this.server = server;
    this.services = services;
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolDefinitions
      };
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        return await this.executeTool(name, args);
      } catch (error) {
        // Handle HulyError instances with structured responses
        if (error instanceof HulyError) {
          return error.toMCPResponse();
        }

        // Handle generic errors
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async executeTool(name, args) {
    const { projectService, issueService, hulyClientWrapper } = this.services;

    // Use withClient for automatic reconnection on connection errors
    return hulyClientWrapper.withClient(async (client) => {
      switch (name) {
        // Project tools
        case 'huly_list_projects':
          return projectService.listProjects(client);

        case 'huly_create_project':
          return projectService.createProject(client, args.name, args.description, args.identifier);

        case 'huly_create_component':
          return projectService.createComponent(client, args.project_identifier, args.label, args.description);

        case 'huly_list_components':
          return projectService.listComponents(client, args.project_identifier);

        case 'huly_create_milestone':
          return projectService.createMilestone(client, args.project_identifier, args.label, args.description, args.target_date, args.status);

        case 'huly_list_milestones':
          return projectService.listMilestones(client, args.project_identifier);

        case 'huly_list_github_repositories':
          return projectService.listGithubRepositories(client);

        case 'huly_assign_repository_to_project':
          return projectService.assignRepositoryToProject(client, args.project_identifier, args.repository_name);

        // Issue tools
        case 'huly_list_issues':
          return issueService.listIssues(client, args.project_identifier, args.limit);

        case 'huly_create_issue':
          return issueService.createIssue(client, args.project_identifier, args.title, args.description, args.priority);

        case 'huly_update_issue':
          return issueService.updateIssue(client, args.issue_identifier, args.field, args.value);

        case 'huly_create_subissue':
          return issueService.createSubissue(client, args.parent_issue_identifier, args.title, args.description, args.priority);

        case 'huly_search_issues':
          return issueService.searchIssues(client, args);

        case 'huly_list_comments':
          return issueService.listComments(client, args.issue_identifier, args.limit);

        case 'huly_create_comment':
          return issueService.createComment(client, args.issue_identifier, args.message);

        case 'huly_get_issue_details':
          return issueService.getIssueDetails(client, args.issue_identifier);

        default:
          throw HulyError.invalidValue('tool', name, 'a valid tool name');
      }
    });
  }
}

// Export singleton factory
export function createMCPHandler(server, services) {
  return new MCPHandler(server, services);
}