/**
 * MCPHandler - Model Context Protocol handler
 *
 * Handles MCP protocol requests and responses, managing tool definitions
 * and request routing to appropriate services.
 */

import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HulyError } from '../core/HulyError.js';
import { toolDefinitions } from './toolDefinitions.js';
import { 
  initializeTools, 
  getAllToolDefinitions, 
  executeTool as executeRegisteredTool,
  hasTool 
} from '../tools/index.js';
import { createLoggerWithConfig } from '../utils/index.js';
import { getConfigManager } from '../config/index.js';

export class MCPHandler {
  constructor(server, services) {
    this.server = server;
    this.services = services;
    this.logger = createLoggerWithConfig(getConfigManager()).child('mcp-handler');
    this.useNewToolSystem = false; // Feature flag for gradual migration
    this.initialized = false;
    this.setupHandlers();
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize the new tool system
      await initializeTools();
      this.initialized = true;
      this.logger.info('Tool system initialized');
      
      // Check if we should use the new system
      const configManager = getConfigManager();
      this.useNewToolSystem = configManager.get('features.useNewToolSystem', false);
      
      if (this.useNewToolSystem) {
        this.logger.info('Using new modular tool system');
      } else {
        this.logger.info('Using legacy tool system');
      }
    } catch (error) {
      this.logger.error('Failed to initialize tool system:', error);
      // Fall back to legacy system
      this.useNewToolSystem = false;
    }
  }

  setupHandlers() {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      await this.initialize();
      
      if (this.useNewToolSystem) {
        // Use new tool system
        const tools = getAllToolDefinitions();
        return { tools };
      } else {
        // Use legacy definitions
        return {
          tools: toolDefinitions,
        };
      }
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      await this.initialize();

      try {
        if (this.useNewToolSystem && hasTool(name)) {
          // Use new tool system
          const context = {
            client: null, // Will be set in withClient
            services: this.services,
            config: getConfigManager().getHulyConfig(),
            logger: this.logger.child(name)
          };
          
          // Execute with client wrapper for reconnection support
          const { hulyClientWrapper } = this.services;
          return await hulyClientWrapper.withClient(async (client) => {
            context.client = client;
            return await executeRegisteredTool(name, args, context);
          });
        } else {
          // Use legacy execution
          return await this.executeTool(name, args);
        }
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
              text: `❌ Error: ${error.message}`,
            },
          ],
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
          return projectService.createComponent(
            client,
            args.project_identifier,
            args.label,
            args.description
          );

        case 'huly_list_components':
          return projectService.listComponents(client, args.project_identifier);

        case 'huly_create_milestone':
          return projectService.createMilestone(
            client,
            args.project_identifier,
            args.label,
            args.description,
            args.target_date,
            args.status
          );

        case 'huly_list_milestones':
          return projectService.listMilestones(client, args.project_identifier);

        case 'huly_list_github_repositories':
          return projectService.listGithubRepositories(client);

        case 'huly_assign_repository_to_project':
          return projectService.assignRepositoryToProject(
            client,
            args.project_identifier,
            args.repository_name
          );

        // Issue tools
        case 'huly_list_issues':
          return issueService.listIssues(client, args.project_identifier, args.limit);

        case 'huly_create_issue':
          return issueService.createIssue(
            client,
            args.project_identifier,
            args.title,
            args.description,
            args.priority
          );

        case 'huly_update_issue':
          return issueService.updateIssue(client, args.issue_identifier, args.field, args.value);

        case 'huly_create_subissue':
          return issueService.createSubissue(
            client,
            args.parent_issue_identifier,
            args.title,
            args.description,
            args.priority
          );

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
