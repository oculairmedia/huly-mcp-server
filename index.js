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
                  enum: ['title', 'description', 'status', 'priority', 'component', 'milestone']
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
          
          case 'huly_create_subissue':
            return await this.createSubissue(client, args.parent_issue_identifier, args.title, args.description, args.priority);
          
          case 'huly_create_component':
            return await this.createComponent(client, args.project_identifier, args.label, args.description);
          
          case 'huly_list_components':
            return await this.listComponents(client, args.project_identifier);
          
          case 'huly_create_milestone':
            return await this.createMilestone(client, args.project_identifier, args.label, args.description, args.target_date, args.status);
          
          case 'huly_list_milestones':
            return await this.listMilestones(client, args.project_identifier);
          
          case 'huly_list_github_repositories':
            return await this.listGithubRepositories(client);
          
          case 'huly_assign_repository_to_project':
            return await this.assignRepositoryToProject(client, args.project_identifier, args.repository_name);
          
          case 'huly_search_issues':
            return await this.searchIssues(client, args);
          
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

    // Fetch all components and milestones for this project to resolve references
    const components = await client.findAll(
      tracker.class.Component,
      { space: project._id }
    );
    const milestones = await client.findAll(
      tracker.class.Milestone,
      { space: project._id }
    );

    // Create lookup maps for efficient access
    const componentMap = new Map(components.map(c => [c._id, c]));
    const milestoneMap = new Map(milestones.map(m => [m._id, m]));

    let result = `Found ${issues.length} issues in ${project.name}:\n\n`;
    
    for (const issue of issues) {
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;
      result += `   Status: ${issue.status}\n`;
      
      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[issue.priority] || 'Not set';
      result += `   Priority: ${priorityName}\n`;
      
      // Add component information
      if (issue.component) {
        const component = componentMap.get(issue.component);
        result += `   Component: ${component ? component.label : 'Unknown'}\n`;
      }
      
      // Add milestone information
      if (issue.milestone) {
        const milestone = milestoneMap.get(issue.milestone);
        result += `   Milestone: ${milestone ? milestone.label : 'Unknown'}\n`;
      }
      
      // Add assignee information
      if (issue.assignee) {
        result += `   Assignee: ${issue.assignee}\n`;
      }
      
      // Add due date if set
      if (issue.dueDate) {
        result += `   Due Date: ${new Date(issue.dueDate).toLocaleDateString()}\n`;
      }
      
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

  async createIssue(client, projectIdentifier, title, description = '', priority = 'NoPriority') {
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

    // Map priority strings to IssuePriority enum values
    const priorityMap = {
      'NoPriority': 0,
      'urgent': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    const priorityValue = priorityMap[priority] ?? 0;

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
        priority: priorityValue,
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
        dueDate: null,
        attachedTo: project._id,
        attachedToClass: tracker.class.Project,
        collection: 'issues'
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
    
    // Handle priority field specially
    if (field === 'priority') {
      const priorityMap = {
        'NoPriority': 0,
        'urgent': 1,
        'high': 2,
        'medium': 3,
        'low': 4
      };
      updateData[field] = priorityMap[value] ?? 0;
    } else if (field === 'milestone') {
      // Handle milestone field by looking up milestone by label
      const milestone = await client.findOne(
        tracker.class.Milestone,
        { label: value, space: issue.space }
      );
      if (!milestone) {
        throw new Error(`Milestone "${value}" not found in project`);
      }
      updateData[field] = milestone._id;
    } else if (field === 'component') {
      // Handle component field by looking up component by label
      const component = await client.findOne(
        tracker.class.Component,
        { label: value, space: issue.space }
      );
      if (!component) {
        throw new Error(`Component "${value}" not found in project`);
      }
      updateData[field] = component._id;
    } else {
      updateData[field] = value;
    }

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

  async createSubissue(client, parentIssueIdentifier, title, description = '', priority = 'NoPriority') {
    const parentIssue = await client.findOne(
      tracker.class.Issue,
      { identifier: parentIssueIdentifier }
    );

    if (!parentIssue) {
      throw new Error(`Parent issue ${parentIssueIdentifier} not found`);
    }

    const project = await client.findOne(
      tracker.class.Project,
      { _id: parentIssue.space }
    );

    if (!project) {
      throw new Error(`Project for parent issue ${parentIssueIdentifier} not found`);
    }

    const subissueId = generateId();

    // Increment sequence number for the subissue
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

    // Map priority strings to IssuePriority enum values
    const priorityMap = {
      'NoPriority': 0,
      'urgent': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    const priorityValue = priorityMap[priority] ?? 0;

    // Create subissue with proper attachedTo reference
    await client.addCollection(
      tracker.class.Issue,
      project._id,
      parentIssue._id,
      tracker.class.Issue,
      'subIssues',
      {
        title,
        description,
        identifier: `${project.identifier}-${sequence}`,
        number: sequence,
        status: project.defaultIssueStatus || 'tracker:status:Backlog',
        priority: priorityValue,
        kind: 'tracker:taskTypes:Issue',
        rank: makeRank(lastIssue?.rank, undefined),
        assignee: null,
        component: null,
        estimation: 0,
        remainingTime: 0,
        reportedTime: 0,
        reports: 0,
        subIssues: 0,
        parents: [{ parentId: parentIssue._id, parentTitle: parentIssue.title, identifier: parentIssue.identifier }],
        childInfo: [],
        dueDate: null,
        attachedTo: parentIssue._id,
        attachedToClass: tracker.class.Issue,
        collection: 'subIssues'
      },
      subissueId
    );

    // Update parent issue to include this subissue
    await client.updateDoc(
      tracker.class.Issue,
      parentIssue.space,
      parentIssue._id,
      { 
        $push: { childInfo: { childId: subissueId, childTitle: title, identifier: `${project.identifier}-${sequence}` } },
        $inc: { subIssues: 1 }
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created subissue ${project.identifier}-${sequence}: ${title}\\n\\nParent: ${parentIssueIdentifier}\\nStatus: ${project.defaultIssueStatus || 'tracker:status:Backlog'}\\nPriority: ${priority}`
        }
      ]
    };
  }

  async createComponent(client, projectIdentifier, label, description = '') {
    const project = await client.findOne(
      tracker.class.Project,
      { identifier: projectIdentifier }
    );

    if (!project) {
      throw new Error(`Project ${projectIdentifier} not found`);
    }

    const componentId = generateId();

    await client.createDoc(
      tracker.class.Component,
      project._id,
      {
        label,
        description,
        lead: null,
        comments: 0,
        attachments: 0
      },
      componentId
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created component "${label}" in project ${project.name}`
        }
      ]
    };
  }

  async listComponents(client, projectIdentifier) {
    const project = await client.findOne(
      tracker.class.Project,
      { identifier: projectIdentifier }
    );

    if (!project) {
      throw new Error(`Project ${projectIdentifier} not found`);
    }

    const components = await client.findAll(
      tracker.class.Component,
      { space: project._id }
    );

    let result = `Found ${components.length} components in ${project.name}:\n\n`;
    
    for (const component of components) {
      result += `🏷️  **${component.label}**\n`;
      if (component.description) {
        result += `   Description: ${component.description}\n`;
      }
      result += `   Lead: ${component.lead || 'Not assigned'}\n\n`;
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

  async createMilestone(client, projectIdentifier, label, description = '', targetDate, status = 'planned') {
    const project = await client.findOne(
      tracker.class.Project,
      { identifier: projectIdentifier }
    );

    if (!project) {
      throw new Error(`Project ${projectIdentifier} not found`);
    }

    // Map status strings to MilestoneStatus enum values
    const statusMap = {
      'planned': 0,
      'in_progress': 1,
      'completed': 2,
      'canceled': 3
    };
    const statusValue = statusMap[status] ?? 0;

    // Parse target date
    const targetTimestamp = new Date(targetDate).getTime();
    if (isNaN(targetTimestamp)) {
      throw new Error('Invalid target date format. Use ISO 8601 format (e.g., 2024-12-31)');
    }

    const milestoneId = generateId();

    await client.createDoc(
      tracker.class.Milestone,
      project._id,
      {
        label,
        description,
        status: statusValue,
        targetDate: targetTimestamp,
        comments: 0,
        attachments: 0
      },
      milestoneId
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created milestone "${label}" in project ${project.name}\n\nTarget Date: ${new Date(targetTimestamp).toLocaleDateString()}\nStatus: ${status}`
        }
      ]
    };
  }

  async listMilestones(client, projectIdentifier) {
    const project = await client.findOne(
      tracker.class.Project,
      { identifier: projectIdentifier }
    );

    if (!project) {
      throw new Error(`Project ${projectIdentifier} not found`);
    }

    const milestones = await client.findAll(
      tracker.class.Milestone,
      { space: project._id }
    );

    const statusNames = ['Planned', 'In Progress', 'Completed', 'Canceled'];
    
    let result = `Found ${milestones.length} milestones in ${project.name}:\n\n`;
    
    for (const milestone of milestones) {
      result += `🎯 **${milestone.label}**\n`;
      if (milestone.description) {
        result += `   Description: ${milestone.description}\n`;
      }
      result += `   Status: ${statusNames[milestone.status] || 'Unknown'}\n`;
      result += `   Target Date: ${new Date(milestone.targetDate).toLocaleDateString()}\n\n`;
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

  async listGithubRepositories(client) {
    try {
      // List all GitHub integration repositories using string class reference
      const repositories = await client.findAll(
        'github:class:GithubIntegrationRepository',
        {}
      );

      let result = `Found ${repositories.length} GitHub repositories available:\n\n`;
      
      for (const repo of repositories) {
        result += `📁 **${repo.name}**\n`;
        if (repo.description) {
          result += `   Description: ${repo.description}\n`;
        }
        result += `   Owner: ${repo.owner?.login || 'Unknown'}\n`;
        result += `   Language: ${repo.language || 'Not specified'}\n`;
        result += `   Stars: ${repo.stargazers || 0} | Forks: ${repo.forks || 0}\n`;
        result += `   Private: ${repo.private ? 'Yes' : 'No'}\n`;
        result += `   Has Issues: ${repo.hasIssues ? 'Yes' : 'No'}\n`;
        if (repo.githubProject) {
          result += `   🔗 Already assigned to project\n`;
        } else {
          result += `   ✅ Available for assignment\n`;
        }
        result += `   URL: ${repo.htmlURL || repo.url || 'N/A'}\n\n`;
      }

      if (repositories.length === 0) {
        result += 'No GitHub repositories found. Make sure GitHub integration is configured and repositories are available.';
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list GitHub repositories: ${error.message}`);
    }
  }

  async assignRepositoryToProject(client, projectIdentifier, repositoryName) {
    try {
      // Find the project
      const project = await client.findOne(
        tracker.class.Project,
        { identifier: projectIdentifier }
      );

      if (!project) {
        throw new Error(`Project ${projectIdentifier} not found`);
      }

      // Find the repository by name
      const repository = await client.findOne(
        'github:class:GithubIntegrationRepository',
        { name: repositoryName }
      );

      if (!repository) {
        throw new Error(`GitHub repository "${repositoryName}" not found. Use huly_list_github_repositories to see available repositories.`);
      }

      if (repository.githubProject) {
        throw new Error(`Repository "${repositoryName}" is already assigned to another project`);
      }

      // Apply the GithubProject mixin to the project if not already applied
      const existingGithubProject = await client.findOne(
        'github:mixin:GithubProject',
        { _id: project._id }
      );

      if (!existingGithubProject) {
        // Apply the mixin with initial data
        await client.createMixin(
          project._id,
          tracker.class.Project,
          project.space,
          'github:mixin:GithubProject',
          {
            integration: repository.attachedTo, // The GithubIntegration ID
            repositories: [repository._id],
            projectNodeId: `project-${project._id}`,
            projectNumber: project.sequence || 1
          }
        );
      } else {
        // Update existing GitHub project to add this repository
        const currentRepos = existingGithubProject.repositories || [];
        if (!currentRepos.includes(repository._id)) {
          await client.updateMixin(
            project._id,
            tracker.class.Project,
            project.space,
            'github:mixin:GithubProject',
            {
              repositories: [...currentRepos, repository._id]
            }
          );
        }
      }

      // Update the repository to link it to this project
      await client.updateDoc(
        'github:class:GithubIntegrationRepository',
        repository.space,
        repository._id,
        {
          githubProject: project._id
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully assigned GitHub repository "${repositoryName}" to project ${project.name} (${projectIdentifier})\n\nThe project now has GitHub integration enabled and can sync issues, pull requests, and other GitHub data.`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to assign repository to project: ${error.message}`);
    }
  }

  async searchIssues(client, args) {
    const {
      query,
      project_identifier,
      status,
      priority,
      assignee,
      component,
      milestone,
      created_after,
      created_before,
      modified_after,
      modified_before,
      limit = 50
    } = args;

    try {
      // Build the query object
      const searchQuery = {};
      
      // Project-specific or cross-project search
      if (project_identifier) {
        const project = await client.findOne(
          tracker.class.Project,
          { identifier: project_identifier }
        );
        if (!project) {
          throw new Error(`Project ${project_identifier} not found`);
        }
        searchQuery.space = project._id;
      }

      // Status filter
      if (status) {
        searchQuery.status = status;
      }

      // Priority filter
      if (priority) {
        const priorityMap = {
          'NoPriority': 0,
          'urgent': 1,
          'high': 2,
          'medium': 3,
          'low': 4
        };
        searchQuery.priority = priorityMap[priority] ?? 0;
      }

      // Assignee filter
      if (assignee) {
        searchQuery.assignee = assignee;
      }

      // Component filter
      if (component) {
        // Find component by name if project is specified
        if (project_identifier) {
          const project = await client.findOne(
            tracker.class.Project,
            { identifier: project_identifier }
          );
          const comp = await client.findOne(
            tracker.class.Component,
            { label: component, space: project._id }
          );
          if (comp) {
            searchQuery.component = comp._id;
          }
        } else {
          // For cross-project search, find all components with this name
          const components = await client.findAll(
            tracker.class.Component,
            { label: component }
          );
          if (components.length > 0) {
            searchQuery.component = { $in: components.map(c => c._id) };
          }
        }
      }

      // Milestone filter
      if (milestone) {
        // Find milestone by name if project is specified
        if (project_identifier) {
          const project = await client.findOne(
            tracker.class.Project,
            { identifier: project_identifier }
          );
          const ms = await client.findOne(
            tracker.class.Milestone,
            { label: milestone, space: project._id }
          );
          if (ms) {
            searchQuery.milestone = ms._id;
          }
        } else {
          // For cross-project search, find all milestones with this name
          const milestones = await client.findAll(
            tracker.class.Milestone,
            { label: milestone }
          );
          if (milestones.length > 0) {
            searchQuery.milestone = { $in: milestones.map(m => m._id) };
          }
        }
      }

      // Date range filters
      if (created_after || created_before) {
        searchQuery.createdOn = {};
        if (created_after) {
          searchQuery.createdOn.$gte = new Date(created_after).getTime();
        }
        if (created_before) {
          searchQuery.createdOn.$lte = new Date(created_before).getTime();
        }
      }

      if (modified_after || modified_before) {
        searchQuery.modifiedOn = {};
        if (modified_after) {
          searchQuery.modifiedOn.$gte = new Date(modified_after).getTime();
        }
        if (modified_before) {
          searchQuery.modifiedOn.$lte = new Date(modified_before).getTime();
        }
      }

      // Get initial results
      let issues = await client.findAll(
        tracker.class.Issue,
        searchQuery,
        { 
          limit: limit * 2, // Get more results for text filtering
          sort: { modifiedOn: -1 }
        }
      );

      // Apply full-text search if query is provided
      if (query) {
        const searchTerms = query.toLowerCase().split(/\s+/);
        issues = issues.filter(issue => {
          const titleText = (issue.title || '').toLowerCase();
          const descriptionText = (issue.description || '').toLowerCase();
          const combinedText = titleText + ' ' + descriptionText;
          
          return searchTerms.every(term => 
            combinedText.includes(term)
          );
        });
      }

      // Limit results after text filtering
      issues = issues.slice(0, limit);

      // Fetch related data for display
      const projectIds = [...new Set(issues.map(i => i.space))];
      const projects = await client.findAll(
        tracker.class.Project,
        { _id: { $in: projectIds } }
      );
      const projectMap = new Map(projects.map(p => [p._id, p]));

      const componentIds = [...new Set(issues.map(i => i.component).filter(Boolean))];
      const components = componentIds.length > 0 ? await client.findAll(
        tracker.class.Component,
        { _id: { $in: componentIds } }
      ) : [];
      const componentMap = new Map(components.map(c => [c._id, c]));

      const milestoneIds = [...new Set(issues.map(i => i.milestone).filter(Boolean))];
      const milestones = milestoneIds.length > 0 ? await client.findAll(
        tracker.class.Milestone,
        { _id: { $in: milestoneIds } }
      ) : [];
      const milestoneMap = new Map(milestones.map(m => [m._id, m]));

      // Format results
      let result = `Found ${issues.length} issues`;
      if (query) {
        result += ` matching "${query}"`;
      }
      result += `:\n\n`;

      for (const issue of issues) {
        const project = projectMap.get(issue.space);
        const projectName = project ? project.name : 'Unknown Project';
        const projectIdentifier = project ? project.identifier : 'UNKNOWN';

        result += `📋 **${issue.identifier}**: ${issue.title}\n`;
        result += `   Project: ${projectName} (${projectIdentifier})\n`;
        result += `   Status: ${issue.status}\n`;
        
        const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
        const priorityName = priorityNames[issue.priority] || 'Not set';
        result += `   Priority: ${priorityName}\n`;
        
        // Add component information
        if (issue.component) {
          const comp = componentMap.get(issue.component);
          result += `   Component: ${comp ? comp.label : 'Unknown'}\n`;
        }
        
        // Add milestone information
        if (issue.milestone) {
          const ms = milestoneMap.get(issue.milestone);
          result += `   Milestone: ${ms ? ms.label : 'Unknown'}\n`;
        }
        
        // Add assignee information
        if (issue.assignee) {
          result += `   Assignee: ${issue.assignee}\n`;
        }
        
        // Add due date if set
        if (issue.dueDate) {
          result += `   Due Date: ${new Date(issue.dueDate).toLocaleDateString()}\n`;
        }
        
        result += `   Created: ${new Date(issue.createdOn).toLocaleDateString()}\n`;
        result += `   Modified: ${new Date(issue.modifiedOn).toLocaleDateString()}\n\n`;
      }

      if (issues.length === 0) {
        result += 'No issues found matching the search criteria.';
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };

    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
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
                        enum: ['title', 'description', 'status', 'priority', 'component', 'milestone']
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
              case 'huly_create_subissue':
                result = await this.createSubissue(client, args.parent_issue_identifier, args.title, args.description, args.priority);
                break;
              case 'huly_create_component':
                result = await this.createComponent(client, args.project_identifier, args.label, args.description);
                break;
              case 'huly_list_components':
                result = await this.listComponents(client, args.project_identifier);
                break;
              case 'huly_create_milestone':
                result = await this.createMilestone(client, args.project_identifier, args.label, args.description, args.target_date, args.status);
                break;
              case 'huly_list_milestones':
                result = await this.listMilestones(client, args.project_identifier);
                break;
              case 'huly_list_github_repositories':
                result = await this.listGithubRepositories(client);
                break;
              case 'huly_assign_repository_to_project':
                result = await this.assignRepositoryToProject(client, args.project_identifier, args.repository_name);
                break;
              case 'huly_search_issues':
                result = await this.searchIssues(client, args);
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
                  enum: ['title', 'description', 'status', 'priority', 'component', 'milestone']
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
          case 'huly_create_subissue':
            result = await this.createSubissue(client, args.parent_issue_identifier, args.title, args.description, args.priority);
            break;
          case 'huly_create_component':
            result = await this.createComponent(client, args.project_identifier, args.label, args.description);
            break;
          case 'huly_list_components':
            result = await this.listComponents(client, args.project_identifier);
            break;
          case 'huly_create_milestone':
            result = await this.createMilestone(client, args.project_identifier, args.label, args.description, args.target_date, args.status);
            break;
          case 'huly_list_milestones':
            result = await this.listMilestones(client, args.project_identifier);
            break;
          case 'huly_list_github_repositories':
            result = await this.listGithubRepositories(client);
            break;
          case 'huly_assign_repository_to_project':
            result = await this.assignRepositoryToProject(client, args.project_identifier, args.repository_name);
            break;
          case 'huly_search_issues':
            result = await this.searchIssues(client, args);
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