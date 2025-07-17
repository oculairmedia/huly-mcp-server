#!/usr/bin/env node

/**
 * Huly MCP Server
 * 
 * Provides MCP tools for interacting with Huly project management platform
 * using the compatible SDK version 0.6.500
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import apiClient from '@hcengineering/api-client';
import trackerModule from '@hcengineering/tracker';
import coreModule from '@hcengineering/core';
import rankModule from '@hcengineering/rank';
import WebSocket from 'ws';

const { connect } = apiClient;
const tracker = trackerModule.default || trackerModule;
const { generateId } = coreModule;
const { makeRank } = rankModule;

// Huly connection configuration
const HULY_CONFIG = {
  url: process.env.HULY_URL || 'https://pm.oculair.ca',
  email: process.env.HULY_EMAIL || 'emanuvaderland@gmail.com',
  password: process.env.HULY_PASSWORD || 'k2a8yy7sFWVZ6eL',
  workspace: process.env.HULY_WORKSPACE || 'agentspace'
};

class HulyMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'huly-mcp-server',
        version: '1.0.0',
        description: 'MCP server for Huly project management platform'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.hulyClient = null;
    this.setupHandlers();
  }

  async connectToHuly() {
    if (this.hulyClient) {
      return this.hulyClient;
    }

    try {
      this.hulyClient = await connect(HULY_CONFIG.url, {
        email: HULY_CONFIG.email,
        password: HULY_CONFIG.password,
        workspace: HULY_CONFIG.workspace,
        socketFactory: (url) => new WebSocket(url)
      });
      
      return this.hulyClient;
    } catch (error) {
      console.error('Failed to connect to Huly:', error);
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
                  enum: ['title', 'description', 'status', 'priority']
                },
                value: {
                  type: 'string',
                  description: 'New value for the field'
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
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const client = await this.connectToHuly();

        switch (name) {
          case 'huly_list_projects':
            return await this.listProjects(client);
          
          case 'huly_list_issues':
            return await this.listIssues(client, args.project_identifier, args.limit);
          
          case 'huly_create_issue':
            return await this.createIssue(client, args.project_identifier, args.title, args.description, args.priority);
          
          case 'huly_update_issue':
            return await this.updateIssue(client, args.issue_identifier, args.field, args.value);
          
          case 'huly_create_project':
            return await this.createProject(client, args.name, args.description, args.identifier);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async listProjects(client) {
    const projects = await client.findAll(
      tracker.class.Project,
      {},
      { sort: { modifiedOn: -1 } }
    );

    let result = `Found ${projects.length} projects:\n\n`;
    
    for (const project of projects) {
      const issueCount = await client.findAll(
        tracker.class.Issue,
        { space: project._id },
        { total: true }
      );

      result += `📁 **${project.name}** (${project.identifier})\n`;
      result += `   Description: ${project.description || 'No description'}\n`;
      result += `   Issues: ${issueCount.total}\n`;
      result += `   Created: ${new Date(project.createdOn).toLocaleDateString()}\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  async listIssues(client, projectIdentifier, limit = 50) {
    const project = await client.findOne(
      tracker.class.Project,
      { identifier: projectIdentifier }
    );

    if (!project) {
      throw new Error(`Project ${projectIdentifier} not found`);
    }

    const issues = await client.findAll(
      tracker.class.Issue,
      { space: project._id },
      { 
        limit,
        sort: { modifiedOn: -1 }
      }
    );

    let result = `Found ${issues.length} issues in ${project.name}:\n\n`;
    
    for (const issue of issues) {
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;
      result += `   Status: ${issue.status}\n`;
      result += `   Priority: ${issue.priority || 'Not set'}\n`;
      result += `   Created: ${new Date(issue.createdOn).toLocaleDateString()}\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  async createIssue(client, projectIdentifier, title, description = '', priority = 'medium') {
    const project = await client.findOne(
      tracker.class.Project,
      { identifier: projectIdentifier }
    );

    if (!project) {
      throw new Error(`Project ${projectIdentifier} not found`);
    }

    const issueId = generateId();

    // Increment sequence number
    const incResult = await client.updateDoc(
      tracker.class.Project,
      project.space,
      project._id,
      { $inc: { sequence: 1 } },
      true
    );

    const sequence = incResult.object.sequence;

    // Get last issue for ranking
    const lastIssue = await client.findOne(
      tracker.class.Issue,
      { space: project._id },
      { sort: { rank: -1 } }
    );

    // Create issue
    await client.addCollection(
      tracker.class.Issue,
      project._id,
      project._id,
      tracker.class.Project,
      'issues',
      {
        title,
        description,
        identifier: `${project.identifier}-${sequence}`,
        number: sequence,
        status: project.defaultIssueStatus || 'tracker:status:Backlog',
        priority,
        kind: 'tracker:taskTypes:Issue',
        rank: makeRank(lastIssue?.rank, undefined),
        assignee: null,
        component: null,
        estimation: 0,
        remainingTime: 0,
        reportedTime: 0,
        reports: 0,
        subIssues: 0,
        parents: [],
        childInfo: [],
        dueDate: null
      },
      issueId
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created issue ${project.identifier}-${sequence}: ${title}\n\nStatus: ${project.defaultIssueStatus || 'tracker:status:Backlog'}\nPriority: ${priority}`
        }
      ]
    };
  }

  async updateIssue(client, issueIdentifier, field, value) {
    const issue = await client.findOne(
      tracker.class.Issue,
      { identifier: issueIdentifier }
    );

    if (!issue) {
      throw new Error(`Issue ${issueIdentifier} not found`);
    }

    const updateData = {};
    updateData[field] = value;

    await client.updateDoc(
      tracker.class.Issue,
      issue.space,
      issue._id,
      updateData
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Updated issue ${issueIdentifier}\n\n${field}: ${value}`
        }
      ]
    };
  }

  async createProject(client, name, description = '', identifier) {
    const projectId = generateId();
    
    // Generate identifier if not provided
    if (!identifier) {
      identifier = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 5);
    }

    // Check if identifier already exists
    const existingProject = await client.findOne(
      tracker.class.Project,
      { identifier }
    );

    if (existingProject) {
      throw new Error(`Project with identifier '${identifier}' already exists`);
    }

    await client.createDoc(
      tracker.class.Project,
      'core:space:Space',
      {
        name,
        description,
        identifier,
        private: false,
        archived: false,
        autoJoin: true,
        sequence: 0,
        defaultIssueStatus: 'tracker:status:Backlog',
        defaultTimeReportDay: 'PreviousWorkDay',
        defaultAssignee: null,
        members: [],
        owners: []
      },
      projectId
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created project ${name} (${identifier})\n\nDescription: ${description || 'No description'}`
        }
      ]
    };
  }

  async run(transportType = 'stdio') {
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
    const port = process.env.PORT || 3000;
    
    app.use(cors());
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', server: 'huly-mcp-server' });
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
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'huly-mcp-server',
                version: '1.0.0'
              }
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
                        enum: ['title', 'description', 'status', 'priority']
                      },
                      value: {
                        type: 'string',
                        description: 'New value for the field'
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
                result = await this.listIssues(client, args.project_identifier, args.limit);
                break;
              case 'huly_create_issue':
                result = await this.createIssue(client, args.project_identifier, args.title, args.description, args.priority);
                break;
              case 'huly_update_issue':
                result = await this.updateIssue(client, args.issue_identifier, args.field, args.value);
                break;
              case 'huly_create_project':
                result = await this.createProject(client, args.name, args.description, args.identifier);
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
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: error.message },
          id: req.body.id || null
        });
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
                  enum: ['title', 'description', 'status', 'priority']
                },
                value: {
                  type: 'string',
                  description: 'New value for the field'
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
            result = await this.listProjects(client);
            break;
          case 'huly_list_issues':
            result = await this.listIssues(client, args.project_identifier, args.limit);
            break;
          case 'huly_create_issue':
            result = await this.createIssue(client, args.project_identifier, args.title, args.description, args.priority);
            break;
          case 'huly_update_issue':
            result = await this.updateIssue(client, args.issue_identifier, args.field, args.value);
            break;
          case 'huly_create_project':
            result = await this.createProject(client, args.name, args.description, args.identifier);
            break;
          default:
            return res.status(404).json({ error: `Tool ${toolName} not found` });
        }
        
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
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
const transportType = transportArg ? transportArg.split('=')[1] : 'stdio';

// Run the server
const server = new HulyMCPServer();
server.run(transportType).catch(console.error);