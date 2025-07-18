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

// Error codes for structured error responses
const ERROR_CODES = {
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error utility class for consistent error handling
class HulyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'HulyError';
  }

  toMCPResponse() {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error [${this.code}]: ${this.message}${this.details.context ? `\n\nContext: ${this.details.context}` : ''}${this.details.suggestion ? `\n\nSuggestion: ${this.details.suggestion}` : ''}`
        }
      ]
    };
  }
}

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
                  description: 'New value for the field. For status field, valid values are: Backlog, Todo, InProgress, Done, Canceled'
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
          
          default:
            throw new Error(`Unknown tool: ${name}`);
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
              text: `❌ Error: ${error.message}`
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
    try {
      // Input validation
      if (!issueIdentifier || typeof issueIdentifier !== 'string') {
        throw new HulyError(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid issue identifier provided',
          {
            context: 'Issue identifier must be a non-empty string (e.g., "LMP-1")',
            suggestion: 'Use the format "PROJECT-NUMBER" where PROJECT is the project identifier'
          }
        );
      }

      if (!field || typeof field !== 'string') {
        throw new HulyError(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid field name provided',
          {
            context: 'Field name must be a non-empty string',
            suggestion: 'Use one of: title, description, status, priority, component, milestone'
          }
        );
      }

      if (value === null || value === undefined) {
        throw new HulyError(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid value provided',
          {
            context: 'Value cannot be null or undefined',
            suggestion: 'Provide a valid value for the field being updated'
          }
        );
      }

      // Validate field names
      const validFields = ['title', 'description', 'status', 'priority', 'component', 'milestone'];
      if (!validFields.includes(field)) {
        throw new HulyError(
          ERROR_CODES.INVALID_FIELD,
          `Invalid field name: ${field}`,
          {
            context: `Field '${field}' is not a valid updateable field`,
            suggestion: `Use one of: ${validFields.join(', ')}`
          }
        );
      }

      // Find the issue with connection error handling
      let issue;
      try {
        issue = await client.findOne(
          tracker.class.Issue,
          { identifier: issueIdentifier }
        );
      } catch (error) {
        // Handle database connection errors
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          throw new HulyError(
            ERROR_CODES.DATABASE_ERROR,
            'Database connection failed while searching for issue',
            {
              context: `Could not connect to database to find issue ${issueIdentifier}`,
              suggestion: 'Check database connection and try again'
            }
          );
        }
        // Handle other database errors
        throw new HulyError(
          ERROR_CODES.DATABASE_ERROR,
          'Database error while searching for issue',
          {
            context: `Database operation failed: ${error.message}`,
            suggestion: 'Check database status and try again'
          }
        );
      }

      // Check if issue exists
      if (!issue) {
        throw new HulyError(
          ERROR_CODES.ISSUE_NOT_FOUND,
          `Issue ${issueIdentifier} not found`,
          {
            context: `No issue found with identifier ${issueIdentifier}`,
            suggestion: 'Check the issue identifier and ensure it exists in the system'
          }
        );
      }

      const updateData = {};
      
      // Handle different field types with validation
      if (field === 'priority') {
        const priorityMap = {
          'NoPriority': 0,
          'urgent': 1,
          'high': 2,
          'medium': 3,
          'low': 4
        };
        
        if (!(value in priorityMap)) {
          throw new HulyError(
            ERROR_CODES.INVALID_VALUE,
            `Invalid priority value: ${value}`,
            {
              context: `Priority '${value}' is not a valid priority level`,
              suggestion: `Use one of: ${Object.keys(priorityMap).join(', ')}`
            }
          );
        }
        updateData[field] = priorityMap[value];
        
      } else if (field === 'milestone') {
        // Handle milestone field by looking up milestone by label
        if (typeof value !== 'string' || value.trim() === '') {
          throw new HulyError(
            ERROR_CODES.INVALID_VALUE,
            'Invalid milestone name provided',
            {
              context: 'Milestone name must be a non-empty string',
              suggestion: 'Provide a valid milestone name'
            }
          );
        }

        let milestone;
        try {
          milestone = await client.findOne(
            tracker.class.Milestone,
            { label: value, space: issue.space }
          );
        } catch (error) {
          throw new HulyError(
            ERROR_CODES.DATABASE_ERROR,
            'Database error while searching for milestone',
            {
              context: `Could not search for milestone: ${error.message}`,
              suggestion: 'Check database connection and try again'
            }
          );
        }

        if (!milestone) {
          throw new HulyError(
            ERROR_CODES.MILESTONE_NOT_FOUND,
            `Milestone "${value}" not found in project`,
            {
              context: `No milestone with name "${value}" exists in the project`,
              suggestion: 'Check available milestones or create the milestone first'
            }
          );
        }
        updateData[field] = milestone._id;
        
      } else if (field === 'component') {
        // Handle component field by looking up component by label
        if (typeof value !== 'string' || value.trim() === '') {
          throw new HulyError(
            ERROR_CODES.INVALID_VALUE,
            'Invalid component name provided',
            {
              context: 'Component name must be a non-empty string',
              suggestion: 'Provide a valid component name'
            }
          );
        }

        let component;
        try {
          component = await client.findOne(
            tracker.class.Component,
            { label: value, space: issue.space }
          );
        } catch (error) {
          throw new HulyError(
            ERROR_CODES.DATABASE_ERROR,
            'Database error while searching for component',
            {
              context: `Could not search for component: ${error.message}`,
              suggestion: 'Check database connection and try again'
            }
          );
        }

        if (!component) {
          throw new HulyError(
            ERROR_CODES.COMPONENT_NOT_FOUND,
            `Component "${value}" not found in project`,
            {
              context: `No component with name "${value}" exists in the project`,
              suggestion: 'Check available components or create the component first'
            }
          );
        }
        updateData[field] = component._id;
        
      } else if (field === 'title' || field === 'description') {
        // Validate text fields
        if (typeof value !== 'string') {
          throw new HulyError(
            ERROR_CODES.INVALID_VALUE,
            `Invalid ${field} value provided`,
            {
              context: `${field} must be a string`,
              suggestion: 'Provide a valid text value'
            }
          );
        }
        
        if (field === 'title' && value.trim() === '') {
          throw new HulyError(
            ERROR_CODES.INVALID_VALUE,
            'Title cannot be empty',
            {
              context: 'Issue title must contain at least one non-whitespace character',
              suggestion: 'Provide a meaningful title for the issue'
            }
          );
        }
        
        updateData[field] = value;
        
      } else if (field === 'status') {
        // Handle status field with comprehensive validation
        const validStatuses = {
          'Backlog': 'tracker:status:Backlog',
          'Todo': 'tracker:status:Todo',
          'InProgress': 'tracker:status:InProgress',
          'Done': 'tracker:status:Done',
          'Canceled': 'tracker:status:Canceled'
        };
        
        if (typeof value !== 'string') {
          throw new HulyError(
            ERROR_CODES.INVALID_VALUE,
            'Invalid status value provided',
            {
              context: 'Status must be a string',
              suggestion: `Use one of: ${Object.keys(validStatuses).join(', ')}`
            }
          );
        }
        
        // Check if value is already in full format (tracker:status:*)
        if (value.startsWith('tracker:status:')) {
          const statusName = value.replace('tracker:status:', '');
          if (!Object.keys(validStatuses).includes(statusName)) {
            throw new HulyError(
              ERROR_CODES.INVALID_VALUE,
              `Invalid status "${value}"`,
              {
                context: `Status '${statusName}' is not a valid status`,
                suggestion: `Valid statuses are: ${Object.keys(validStatuses).join(', ')}`
              }
            );
          }
          updateData[field] = value;
        } else {
          // Handle human-readable status names
          const statusValue = validStatuses[value];
          if (!statusValue) {
            throw new HulyError(
              ERROR_CODES.INVALID_VALUE,
              `Invalid status "${value}"`,
              {
                context: `Status '${value}' is not a valid status`,
                suggestion: `Valid statuses are: ${Object.keys(validStatuses).join(', ')}`
              }
            );
          }
          updateData[field] = statusValue;
        }
        
      } else {
        // Fallback for other fields
        updateData[field] = value;
      }

      // Perform the update with error handling
      try {
        await client.updateDoc(
          tracker.class.Issue,
          issue.space,
          issue._id,
          updateData
        );
      } catch (error) {
        // Handle specific update errors
        if (error.message.includes('permission') || error.message.includes('access')) {
          throw new HulyError(
            ERROR_CODES.PERMISSION_ERROR,
            'Insufficient permissions to update issue',
            {
              context: `User does not have permission to update issue ${issueIdentifier}`,
              suggestion: 'Check user permissions for this project'
            }
          );
        }
        
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          throw new HulyError(
            ERROR_CODES.DATABASE_ERROR,
            'Database connection failed during update',
            {
              context: `Could not update issue ${issueIdentifier}: connection error`,
              suggestion: 'Check database connection and try again'
            }
          );
        }

        // Generic database error
        throw new HulyError(
          ERROR_CODES.DATABASE_ERROR,
          'Failed to update issue in database',
          {
            context: `Database update failed: ${error.message}`,
            suggestion: 'Check database status and try again'
          }
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Updated issue ${issueIdentifier}\n\n${field}: ${value}`
          }
        ]
      };
      
    } catch (error) {
      // If it's already a HulyError, re-throw it
      if (error instanceof HulyError) {
        throw error;
      }
      
      // Handle unexpected errors
      throw new HulyError(
        ERROR_CODES.UNKNOWN_ERROR,
        'An unexpected error occurred while updating the issue',
        {
          context: `Unexpected error: ${error.message}`,
          suggestion: 'Please try again or contact support if the problem persists'
        }
      );
    }
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
                  description: 'New value for the field. For status field, valid values are: Backlog, Todo, InProgress, Done, Canceled'
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
const transportType = transportArg ? transportArg.split('=')[1] : 'stdio';

// Run the server
const server = new HulyMCPServer();
server.run(transportType).catch(console.error);