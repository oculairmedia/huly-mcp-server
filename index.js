#!/usr/bin/env node

/**
 * Huly MCP Server
 * 
 * Provides MCP tools for interacting with Huly project management platform
 * using the compatible SDK version 0.6.500
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import cors from 'cors';
import apiClient from '@hcengineering/api-client';
import trackerModule from '@hcengineering/tracker';
import coreModule from '@hcengineering/core';
import rankModule from '@hcengineering/rank';
import chunterModule from '@hcengineering/chunter';
import activityModule from '@hcengineering/activity';
import collaboratorClientModule from '@hcengineering/collaborator-client';
import statusManager from './StatusManager.js';
import { 
  HulyError, 
  ERROR_CODES,
  PRIORITY_MAP,
  DEFAULTS,
  VALIDATION_PATTERNS,
  VALID_UPDATE_FIELDS,
  createHulyClient
} from './src/core/index.js';
import {
  extractTextFromMarkup,
  extractTextFromDoc
} from './src/utils/index.js';
import { projectService, createIssueService } from './src/services/index.js';
import { createMCPHandler } from './src/protocol/index.js';
import { getConfigManager } from './src/config/index.js';

const tracker = trackerModule.default || trackerModule;
const chunter = chunterModule.default || chunterModule;
const activity = activityModule.default || activityModule;
const { generateId, makeCollabJsonId, makeCollabId } = coreModule;
const { makeRank } = rankModule;
const { getClient: getCollaboratorClient } = collaboratorClientModule;

// Create issueService instance with statusManager
const issueService = createIssueService(statusManager);

// Get configuration manager instance
const configManager = getConfigManager();

class HulyMCPServer {
  constructor() {
    this.configManager = configManager;
    const serverInfo = this.configManager.getServerInfo();
    
    this.server = new Server(
      {
        name: serverInfo.name,
        version: serverInfo.version,
        description: this.configManager.get('server.description')
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.hulyClientWrapper = createHulyClient(this.configManager.getHulyConfig());
    
    // Initialize MCP protocol handler
    this.mcpHandler = createMCPHandler(this.server, {
      projectService,
      issueService,
      hulyClientWrapper: this.hulyClientWrapper
    });
  }


  async connectToHuly() {
    return await this.hulyClientWrapper.getClient();
  }



  async cleanup() {
    // Disconnect from Huly when shutting down
    if (this.hulyClientWrapper) {
      await this.hulyClientWrapper.disconnect();
    }
  }

  async run(transportType = 'stdio') {
    // Set up cleanup handlers
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });

    if (transportType === 'http') {
      await this.runHttpServer();
    } else {
      await this.runStdioServer();
    }
  }

  async runStdioServer() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async runHttpServer() {
    const app = express();
    const port = this.configManager.get('transport.http.port');
    
    const corsConfig = this.configManager.get('transport.http.cors.enabled') 
      ? { origin: this.configManager.get('transport.http.cors.origin') }
      : false;
    
    if (corsConfig) {
      app.use(cors(corsConfig));
    }
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        server: this.configManager.get('server.name'),
        version: this.configManager.get('server.version')
      });
    });
    
    // MCP endpoint - proper JSON-RPC 2.0 implementation
    app.post('/mcp', async (req, res) => {
      try {
        const { jsonrpc, method, params, id } = req.body;
        
        // Validate JSON-RPC request
        if (jsonrpc !== '2.0' || !method) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: id || null
          });
        }

        let result;
        
        switch (method) {
          case 'initialize':
            result = {
              protocolVersion: this.configManager.get('protocol.version'),
              capabilities: {
                tools: {}
              },
              serverInfo: this.configManager.getServerInfo()
            };
            break;
            
          case 'tools/list':
            result = {
              tools: [
                {
                  name: 'huly_list_projects',
                  description: 'List all projects in Huly workspace',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                  }
                },
                {
                  name: 'huly_list_issues',
                  description: 'List issues in a specific project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "LMP")'
                      },
                      limit: {
                        type: 'number',
                        description: 'Maximum number of issues to return (default: 50)',
                        default: 50
                      }
                    },
                    required: ['project_identifier']
                  }
                },
                {
                  name: 'huly_create_issue',
                  description: 'Create a new issue in a project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "LMP")'
                      },
                      title: {
                        type: 'string',
                        description: 'Issue title'
                      },
                      description: {
                        type: 'string',
                        description: 'Issue description'
                      },
                      priority: {
                        type: 'string',
                        description: 'Issue priority (low, medium, high, urgent)',
                        enum: ['low', 'medium', 'high', 'urgent'],
                        default: 'medium'
                      }
                    },
                    required: ['project_identifier', 'title']
                  }
                },
                {
                  name: 'huly_update_issue',
                  description: 'Update an existing issue',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      issue_identifier: {
                        type: 'string',
                        description: 'Issue identifier (e.g., "LMP-1")'
                      },
                      field: {
                        type: 'string',
                        description: 'Field to update',
                        enum: ['title', 'description', 'status', 'priority', 'component', 'milestone']
                      },
                      value: {
                        type: 'string',
                        description: 'New value for the field. For status: accepts human-readable (backlog, todo, in-progress, done, canceled) or full format (tracker:status:Backlog, etc.)'
                      }
                    },
                    required: ['issue_identifier', 'field', 'value']
                  }
                },
                {
                  name: 'huly_create_project',
                  description: 'Create a new project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Project name'
                      },
                      description: {
                        type: 'string',
                        description: 'Project description'
                      },
                      identifier: {
                        type: 'string',
                        description: 'Project identifier (max 5 chars, uppercase)'
                      }
                    },
                    required: ['name']
                  }
                },
                {
                  name: 'huly_create_subissue',
                  description: 'Create a subissue under an existing parent issue',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      parent_issue_identifier: {
                        type: 'string',
                        description: 'Parent issue identifier (e.g., "LMP-1")'
                      },
                      title: {
                        type: 'string',
                        description: 'Subissue title'
                      },
                      description: {
                        type: 'string',
                        description: 'Subissue description'
                      },
                      priority: {
                        type: 'string',
                        description: 'Issue priority (low, medium, high, urgent)',
                        enum: ['low', 'medium', 'high', 'urgent'],
                        default: 'medium'
                      }
                    },
                    required: ['parent_issue_identifier', 'title']
                  }
                },
                {
                  name: 'huly_create_component',
                  description: 'Create a new component in a project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "WEBHOOK")'
                      },
                      label: {
                        type: 'string',
                        description: 'Component name'
                      },
                      description: {
                        type: 'string',
                        description: 'Component description'
                      }
                    },
                    required: ['project_identifier', 'label']
                  }
                },
                {
                  name: 'huly_list_components',
                  description: 'List all components in a project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "WEBHOOK")'
                      }
                    },
                    required: ['project_identifier']
                  }
                },
                {
                  name: 'huly_create_milestone',
                  description: 'Create a new milestone in a project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "WEBHOOK")'
                      },
                      label: {
                        type: 'string',
                        description: 'Milestone name'
                      },
                      description: {
                        type: 'string',
                        description: 'Milestone description'
                      },
                      target_date: {
                        type: 'string',
                        description: 'Target date (ISO 8601 format)'
                      },
                      status: {
                        type: 'string',
                        description: 'Milestone status',
                        enum: ['planned', 'in_progress', 'completed', 'canceled'],
                        default: 'planned'
                      }
                    },
                    required: ['project_identifier', 'label', 'target_date']
                  }
                },
                {
                  name: 'huly_list_milestones',
                  description: 'List all milestones in a project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "WEBHOOK")'
                      }
                    },
                    required: ['project_identifier']
                  }
                },
                {
                  name: 'huly_list_github_repositories',
                  description: 'List all GitHub repositories available in integrations',
                  inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                  }
                },
                {
                  name: 'huly_assign_repository_to_project',
                  description: 'Assign a GitHub repository to a Huly project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier (e.g., "WEBHOOK")'
                      },
                      repository_name: {
                        type: 'string',
                        description: 'GitHub repository name (e.g., "my-org/my-repo")'
                      }
                    },
                    required: ['project_identifier', 'repository_name']
                  }
                },
                {
                  name: 'huly_search_issues',
                  description: 'Search and filter issues with advanced capabilities',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'Search query for title and description (optional)'
                      },
                      project_identifier: {
                        type: 'string',
                        description: 'Project identifier to search within (optional for cross-project search)'
                      },
                      status: {
                        type: 'string',
                        description: 'Filter by status (e.g., "Backlog", "In Progress", "Done")'
                      },
                      priority: {
                        type: 'string',
                        description: 'Filter by priority (low, medium, high, urgent, NoPriority)',
                        enum: ['low', 'medium', 'high', 'urgent', 'NoPriority']
                      },
                      assignee: {
                        type: 'string',
                        description: 'Filter by assignee ID or username'
                      },
                      component: {
                        type: 'string',
                        description: 'Filter by component name'
                      },
                      milestone: {
                        type: 'string',
                        description: 'Filter by milestone name'
                      },
                      created_after: {
                        type: 'string',
                        description: 'Filter issues created after this date (ISO 8601 format)'
                      },
                      created_before: {
                        type: 'string',
                        description: 'Filter issues created before this date (ISO 8601 format)'
                      },
                      modified_after: {
                        type: 'string',
                        description: 'Filter issues modified after this date (ISO 8601 format)'
                      },
                      modified_before: {
                        type: 'string',
                        description: 'Filter issues modified before this date (ISO 8601 format)'
                      },
                      limit: {
                        type: 'number',
                        description: 'Maximum number of results to return (default: 50)',
                        default: 50
                      }
                    },
                    required: []
                  }
                },
                {
                  name: 'huly_list_comments',
                  description: 'List comments on an issue',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      issue_identifier: {
                        type: 'string',
                        description: 'Issue identifier (e.g., "LMP-1")'
                      },
                      limit: {
                        type: 'number',
                        description: 'Maximum number of comments to return (default: 50)',
                        default: 50
                      }
                    },
                    required: ['issue_identifier']
                  }
                },
                {
                  name: 'huly_create_comment',
                  description: 'Create a comment on an issue',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      issue_identifier: {
                        type: 'string',
                        description: 'Issue identifier (e.g., "LMP-1")'
                      },
                      message: {
                        type: 'string',
                        description: 'Comment message (supports markdown)'
                      }
                    },
                    required: ['issue_identifier', 'message']
                  }
                },
                {
                  name: 'huly_get_issue_details',
                  description: 'Get comprehensive details about a specific issue including full description, comments, and all metadata',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      issue_identifier: {
                        type: 'string',
                        description: 'Issue identifier (e.g., "LMP-1")'
                      }
                    },
                    required: ['issue_identifier']
                  }
                }
              ]
            };
            break;
            
          case 'tools/call':
            const client = await this.connectToHuly();
            const { name, arguments: args } = params;
            
            switch (name) {
              case 'huly_list_projects':
                result = await this.listProjects(client);
                break;
              case 'huly_list_issues':
                result = await issueService.listIssues(client, args.project_identifier, args.limit);
                break;
              case 'huly_create_issue':
                result = await issueService.createIssue(client, args.project_identifier, args.title, args.description, args.priority);
                break;
              case 'huly_update_issue':
                result = await issueService.updateIssue(client, args.issue_identifier, args.field, args.value);
                break;
              case 'huly_create_project':
                result = await projectService.createProject(client, args.name, args.description, args.identifier);
                break;
              case 'huly_create_subissue':
                result = await issueService.createSubissue(client, args.parent_issue_identifier, args.title, args.description, args.priority);
                break;
              case 'huly_create_component':
                result = await projectService.createComponent(client, args.project_identifier, args.label, args.description);
                break;
              case 'huly_list_components':
                result = await projectService.listComponents(client, args.project_identifier);
                break;
              case 'huly_create_milestone':
                result = await projectService.createMilestone(client, args.project_identifier, args.label, args.description, args.target_date, args.status);
                break;
              case 'huly_list_milestones':
                result = await projectService.listMilestones(client, args.project_identifier);
                break;
              case 'huly_list_github_repositories':
                result = await projectService.listGithubRepositories(client);
                break;
              case 'huly_assign_repository_to_project':
                result = await projectService.assignRepositoryToProject(client, args.project_identifier, args.repository_name);
                break;
              case 'huly_search_issues':
                result = await issueService.searchIssues(client, args);
                break;
              case 'huly_list_comments':
                result = await issueService.listComments(client, args.issue_identifier, args.limit);
                break;
              case 'huly_create_comment':
                result = await issueService.createComment(client, args.issue_identifier, args.message);
                break;
              case 'huly_get_issue_details':
                result = await issueService.getIssueDetails(client, args.issue_identifier);
                break;
              default:
                return res.status(400).json({
                  jsonrpc: '2.0',
                  error: { code: -32601, message: 'Method not found', data: { method: name } },
                  id
                });
            }
            break;
            
          default:
            return res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32601, message: 'Method not found', data: { method } },
              id
            });
        }
        
        res.json({
          jsonrpc: '2.0',
          result,
          id
        });
        
      } catch (error) {
        // Handle HulyError instances with structured responses
        if (error instanceof HulyError) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { 
              code: -32000, 
              message: error.message,
              data: {
                errorCode: error.code,
                details: error.details
              }
            },
            id: req.body.id || null
          });
        } else {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: error.message },
            id: req.body.id || null
          });
        }
      }
    });
    
    // List tools endpoint
    app.get('/tools', async (req, res) => {
      try {
        const tools = [
          {
            name: 'huly_list_projects',
            description: 'List all projects in Huly workspace',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'huly_list_issues',
            description: 'List issues in a specific project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "LMP")'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of issues to return (default: 50)',
                  default: 50
                }
              },
              required: ['project_identifier']
            }
          },
          {
            name: 'huly_create_issue',
            description: 'Create a new issue in a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "LMP")'
                },
                title: {
                  type: 'string',
                  description: 'Issue title'
                },
                description: {
                  type: 'string',
                  description: 'Issue description'
                },
                priority: {
                  type: 'string',
                  description: 'Issue priority (low, medium, high, urgent)',
                  enum: ['low', 'medium', 'high', 'urgent'],
                  default: 'medium'
                }
              },
              required: ['project_identifier', 'title']
            }
          },
          {
            name: 'huly_update_issue',
            description: 'Update an existing issue',
            inputSchema: {
              type: 'object',
              properties: {
                issue_identifier: {
                  type: 'string',
                  description: 'Issue identifier (e.g., "LMP-1")'
                },
                field: {
                  type: 'string',
                  description: 'Field to update',
                  enum: ['title', 'description', 'status', 'priority', 'component', 'milestone']
                },
                value: {
                  type: 'string',
                  description: 'New value for the field. For status: accepts human-readable (backlog, todo, in-progress, done, canceled) or full format (tracker:status:Backlog, etc.)'
                }
              },
              required: ['issue_identifier', 'field', 'value']
            }
          },
          {
            name: 'huly_create_project',
            description: 'Create a new project',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Project name'
                },
                description: {
                  type: 'string',
                  description: 'Project description'
                },
                identifier: {
                  type: 'string',
                  description: 'Project identifier (max 5 chars, uppercase)'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'huly_create_subissue',
            description: 'Create a subissue under an existing parent issue',
            inputSchema: {
              type: 'object',
              properties: {
                parent_issue_identifier: {
                  type: 'string',
                  description: 'Parent issue identifier (e.g., "LMP-1")'
                },
                title: {
                  type: 'string',
                  description: 'Subissue title'
                },
                description: {
                  type: 'string',
                  description: 'Subissue description'
                },
                priority: {
                  type: 'string',
                  description: 'Issue priority (low, medium, high, urgent)',
                  enum: ['low', 'medium', 'high', 'urgent'],
                  default: 'medium'
                }
              },
              required: ['parent_issue_identifier', 'title']
            }
          },
          {
            name: 'huly_create_component',
            description: 'Create a new component in a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "WEBHOOK")'
                },
                label: {
                  type: 'string',
                  description: 'Component name'
                },
                description: {
                  type: 'string',
                  description: 'Component description'
                }
              },
              required: ['project_identifier', 'label']
            }
          },
          {
            name: 'huly_list_components',
            description: 'List all components in a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "WEBHOOK")'
                }
              },
              required: ['project_identifier']
            }
          },
          {
            name: 'huly_create_milestone',
            description: 'Create a new milestone in a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "WEBHOOK")'
                },
                label: {
                  type: 'string',
                  description: 'Milestone name'
                },
                description: {
                  type: 'string',
                  description: 'Milestone description'
                },
                target_date: {
                  type: 'string',
                  description: 'Target date (ISO 8601 format)'
                },
                status: {
                  type: 'string',
                  description: 'Milestone status',
                  enum: ['planned', 'in_progress', 'completed', 'canceled'],
                  default: 'planned'
                }
              },
              required: ['project_identifier', 'label', 'target_date']
            }
          },
          {
            name: 'huly_list_milestones',
            description: 'List all milestones in a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "WEBHOOK")'
                }
              },
              required: ['project_identifier']
            }
          },
          {
            name: 'huly_list_github_repositories',
            description: 'List all GitHub repositories available in integrations',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'huly_assign_repository_to_project',
            description: 'Assign a GitHub repository to a Huly project',
            inputSchema: {
              type: 'object',
              properties: {
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier (e.g., "WEBHOOK")'
                },
                repository_name: {
                  type: 'string',
                  description: 'GitHub repository name (e.g., "my-org/my-repo")'
                }
              },
              required: ['project_identifier', 'repository_name']
            }
          },
          {
            name: 'huly_search_issues',
            description: 'Search and filter issues with advanced capabilities',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for title and description (optional)'
                },
                project_identifier: {
                  type: 'string',
                  description: 'Project identifier to search within (optional for cross-project search)'
                },
                status: {
                  type: 'string',
                  description: 'Filter by status (e.g., "Backlog", "In Progress", "Done")'
                },
                priority: {
                  type: 'string',
                  description: 'Filter by priority (low, medium, high, urgent, NoPriority)',
                  enum: ['low', 'medium', 'high', 'urgent', 'NoPriority']
                },
                assignee: {
                  type: 'string',
                  description: 'Filter by assignee ID or username'
                },
                component: {
                  type: 'string',
                  description: 'Filter by component name'
                },
                milestone: {
                  type: 'string',
                  description: 'Filter by milestone name'
                },
                created_after: {
                  type: 'string',
                  description: 'Filter issues created after this date (ISO 8601 format)'
                },
                created_before: {
                  type: 'string',
                  description: 'Filter issues created before this date (ISO 8601 format)'
                },
                modified_after: {
                  type: 'string',
                  description: 'Filter issues modified after this date (ISO 8601 format)'
                },
                modified_before: {
                  type: 'string',
                  description: 'Filter issues modified before this date (ISO 8601 format)'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 50)',
                  default: 50
                }
              },
              required: []
            }
          },
          {
            name: 'huly_list_comments',
            description: 'List comments on an issue',
            inputSchema: {
              type: 'object',
              properties: {
                issue_identifier: {
                  type: 'string',
                  description: 'Issue identifier (e.g., "LMP-1")'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of comments to return (default: 50)',
                  default: 50
                }
              },
              required: ['issue_identifier']
            }
          },
          {
            name: 'huly_create_comment',
            description: 'Create a comment on an issue',
            inputSchema: {
              type: 'object',
              properties: {
                issue_identifier: {
                  type: 'string',
                  description: 'Issue identifier (e.g., "LMP-1")'
                },
                message: {
                  type: 'string',
                  description: 'Comment message (supports markdown)'
                }
              },
              required: ['issue_identifier', 'message']
            }
          },
          {
            name: 'huly_get_issue_details',
            description: 'Get comprehensive details about a specific issue including full description, comments, and all metadata',
            inputSchema: {
              type: 'object',
              properties: {
                issue_identifier: {
                  type: 'string',
                  description: 'Issue identifier (e.g., "LMP-1")'
                }
              },
              required: ['issue_identifier']
            }
          }
        ];
        
        res.json({ tools });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Call tool endpoint
    app.post('/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const args = req.body;
        
        const client = await this.connectToHuly();
        let result;
        
        switch (toolName) {
          case 'huly_list_projects':
            result = await projectService.listProjects(client);
            break;
          case 'huly_list_issues':
            result = await issueService.listIssues(client, args.project_identifier, args.limit);
            break;
          case 'huly_create_issue':
            result = await issueService.createIssue(client, args.project_identifier, args.title, args.description, args.priority);
            break;
          case 'huly_update_issue':
            result = await issueService.updateIssue(client, args.issue_identifier, args.field, args.value);
            break;
          case 'huly_create_project':
            result = await projectService.createProject(client, args.name, args.description, args.identifier);
            break;
          case 'huly_create_subissue':
            result = await issueService.createSubissue(client, args.parent_issue_identifier, args.title, args.description, args.priority);
            break;
          case 'huly_create_component':
            result = await projectService.createComponent(client, args.project_identifier, args.label, args.description);
            break;
          case 'huly_list_components':
            result = await projectService.listComponents(client, args.project_identifier);
            break;
          case 'huly_create_milestone':
            result = await projectService.createMilestone(client, args.project_identifier, args.label, args.description, args.target_date, args.status);
            break;
          case 'huly_list_milestones':
            result = await projectService.listMilestones(client, args.project_identifier);
            break;
          case 'huly_list_github_repositories':
            result = await projectService.listGithubRepositories(client);
            break;
          case 'huly_assign_repository_to_project':
            result = await projectService.assignRepositoryToProject(client, args.project_identifier, args.repository_name);
            break;
          case 'huly_search_issues':
            result = await issueService.searchIssues(client, args);
            break;
          case 'huly_list_comments':
            result = await issueService.listComments(client, args.issue_identifier, args.limit);
            break;
          case 'huly_create_comment':
            result = await issueService.createComment(client, args.issue_identifier, args.message);
            break;
          case 'huly_get_issue_details':
            result = await issueService.getIssueDetails(client, args.issue_identifier);
            break;
          default:
            return res.status(404).json({ error: `Tool ${toolName} not found` });
        }
        
        res.json(result);
      } catch (error) {
        // Handle HulyError instances with structured responses
        if (error instanceof HulyError) {
          res.status(400).json({ 
            error: error.message,
            errorCode: error.code,
            details: error.details
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    });
    
    app.listen(port, () => {
      console.log(`Huly MCP Server running on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`List tools: http://localhost:${port}/tools`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const transportArg = args.find(arg => arg.startsWith('--transport='));
const transportType = transportArg ? transportArg.split('=')[1] : configManager.get('transport.defaultType');

// Run the server
const server = new HulyMCPServer();
server.run(transportType).catch(console.error);