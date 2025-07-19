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
const tracker = trackerModule.default || trackerModule;
const chunter = chunterModule.default || chunterModule;
const activity = activityModule.default || activityModule;
const { generateId, makeCollabJsonId, makeCollabId } = coreModule;
const { makeRank } = rankModule;
const { getClient: getCollaboratorClient } = collaboratorClientModule;

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

    this.hulyClientWrapper = createHulyClient({
      url: HULY_CONFIG.url,
      email: HULY_CONFIG.email,
      password: HULY_CONFIG.password,
      workspace: HULY_CONFIG.workspace
    });
    
    this.setupHandlers();
  }

  // Helper function to create a MarkupBlobRef for issue descriptions
  async createDescriptionMarkup(client, issueId, text) {
    if (!text || text.trim() === '') {
      return ''; // Return empty string for empty descriptions
    }
    
    try {
      // Use the client's uploadMarkup method to properly store the content
      const markupRef = await client.uploadMarkup(
        tracker.class.Issue,
        issueId,
        'description',
        text.trim(),
        'markdown'  // Specify markdown format for plain text descriptions
      );
      
      console.log('Created MarkupBlobRef:', markupRef);
      return markupRef;
    } catch (error) {
      console.error('Failed to create markup:', error);
      // Fallback to empty string if markup creation fails
      return '';
    }
  }


  async getDescriptionContent(descriptionRef, issueId) {
    if (!descriptionRef || descriptionRef === '') {
      return '';
    }
    
    try {
      // fetchMarkup needs the object details to retrieve content
      // If we don't have issueId, try to extract it from the reference
      if (!issueId && typeof descriptionRef === 'string') {
        // Try to extract issueId from reference format
        if (descriptionRef.includes(':')) {
          const parts = descriptionRef.split(':');
          if (parts.length >= 3) {
            issueId = parts[2].split('-')[0];
          }
        } else if (descriptionRef.includes('-')) {
          issueId = descriptionRef.split('-')[0];
        }
      }
      
      if (!issueId) {
        console.error('Cannot extract issueId from description reference');
        return `[MarkupBlobRef: ${descriptionRef}]`;
      }
      
      // Get client and use fetchMarkup method to retrieve the content
      const client = await this.connectToHuly();
      const markup = await client.fetchMarkup(
        tracker.class.Issue,
        issueId,
        'description',
        descriptionRef,
        'markdown'  // Fetch as markdown since we stored as markdown
      );
      
      return markup || '';
    } catch (error) {
      console.error('Failed to get description content:', error);
      return `[MarkupBlobRef: ${descriptionRef}]`; // Fallback to showing the reference
    }
  }

  async connectToHuly() {
    return await this.hulyClientWrapper.getClient();
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
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Use withClient for automatic reconnection on connection errors
        return await this.hulyClientWrapper.withClient(async (client) => {
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
          
          case 'huly_list_comments':
            return await this.listComments(client, args.issue_identifier, args.limit);
          
          case 'huly_create_comment':
            return await this.createComment(client, args.issue_identifier, args.message);
          
          case 'huly_get_issue_details':
            return await this.getIssueDetails(client, args.issue_identifier);
          
            default:
              throw HulyError.invalidValue('tool', name, 'a valid tool name');
          }
        });
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
      throw HulyError.notFound('project', projectIdentifier);
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
      
      // Use StatusManager to display human-readable status
      try {
        const humanStatus = statusManager.toHumanStatus(issue.status);
        const statusDescription = statusManager.getStatusDescription(issue.status);
        result += `   Status: ${humanStatus} (${statusDescription})\n`;
      } catch (error) {
        result += `   Status: ${issue.status}\n`;
      }
      
      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[issue.priority] || 'Not set';
      result += `   Priority: ${priorityName}\n`;
      
      // Add description if present
      if (issue.description) {
        const descContent = await this.getDescriptionContent(issue.description, issue._id);
        if (descContent) {
          // Truncate long descriptions to keep output readable
          const maxLength = 200;
          const truncated = descContent.length > maxLength 
            ? descContent.substring(0, maxLength) + '...' 
            : descContent;
          result += `   Description: ${truncated}\n`;
        }
      }
      
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
      throw HulyError.notFound('project', projectIdentifier);
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

    // For now, create issue without description and update it after
    // This is because the collaborator client needs the issue to exist first
    
    // Create issue
    await client.addCollection(
      tracker.class.Issue,
      project._id,
      project._id,
      tracker.class.Project,
      'issues',
      {
        title,
        description: '', // Start with empty description
        identifier: `${project.identifier}-${sequence}`,
        number: sequence,
        status: project.defaultIssueStatus || statusManager.getDefaultStatus('full'),
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

    // Now update the issue with the description if provided
    if (description && description.trim() !== '') {
      try {
        const descriptionRef = await this.createDescriptionMarkup(client, issueId, description);
        if (descriptionRef) {
          await client.updateDoc(
            tracker.class.Issue,
            project._id,
            issueId,
            { description: descriptionRef }
          );
        }
      } catch (error) {
        console.error('Failed to update issue description:', error);
        // Continue even if description update fails
      }
    }

    const issueStatus = project.defaultIssueStatus || statusManager.getDefaultStatus('full');
    const humanStatus = statusManager.toHumanStatus(issueStatus);
    const statusDescription = statusManager.getStatusDescription(issueStatus);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Created issue ${project.identifier}-${sequence}: ${title}\n\nStatus: ${humanStatus} (${statusDescription})\nPriority: ${priority}`
        }
      ]
    };
  }

  async updateIssue(client, issueIdentifier, field, value) {
    try {
      // Input validation
      if (!issueIdentifier || typeof issueIdentifier !== 'string') {
        throw HulyError.validation('issueIdentifier', issueIdentifier, 'Use the format "PROJECT-NUMBER" where PROJECT is the project identifier');
      }

      if (!field || typeof field !== 'string') {
        throw HulyError.validation('field', field, 'Use one of: title, description, status, priority, component, milestone');
      }

      if (value === null || value === undefined) {
        throw HulyError.validation('value', value, 'Provide a valid value for the field being updated');
      }

      // Validate field names
      const validFields = ['title', 'description', 'status', 'priority', 'component', 'milestone'];
      if (!validFields.includes(field)) {
        throw HulyError.invalidField(field, validFields);
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
          throw HulyError.database('search for issue', new Error('Database connection lost'));
        }
        // Handle other database errors
        throw HulyError.database('search for issue', error);
      }

      // Check if issue exists
      if (!issue) {
        throw HulyError.notFound('issue', issueIdentifier);
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
          throw HulyError.invalidValue('priority', value, `one of: ${Object.keys(priorityMap).join(', ')}`);
        }
        updateData[field] = priorityMap[value];
        
      } else if (field === 'milestone') {
        // Handle milestone field by looking up milestone by label
        if (typeof value !== 'string' || value.trim() === '') {
          throw HulyError.validation('milestone', value, 'Provide a valid milestone name');
        }

        let milestone;
        try {
          milestone = await client.findOne(
            tracker.class.Milestone,
            { label: value, space: issue.space }
          );
        } catch (error) {
          throw HulyError.database('search for milestone', error);
        }

        if (!milestone) {
          throw HulyError.notFound('milestone', value);
        }
        updateData[field] = milestone._id;
        
      } else if (field === 'component') {
        // Handle component field by looking up component by label
        if (typeof value !== 'string' || value.trim() === '') {
          throw HulyError.validation('component', value, 'Provide a valid component name');
        }

        let component;
        try {
          component = await client.findOne(
            tracker.class.Component,
            { label: value, space: issue.space }
          );
        } catch (error) {
          throw HulyError.database('search for component', error);
        }

        if (!component) {
          throw HulyError.notFound('component', value);
        }
        updateData[field] = component._id;
        
      } else if (field === 'title' || field === 'description') {
        // Validate text fields
        if (typeof value !== 'string') {
          throw HulyError.invalidValue(field, value, 'a string value');
        }
        
        if (field === 'title' && value.trim() === '') {
          throw HulyError.validation('title', value, 'Provide a meaningful title for the issue');
        }
        
        if (field === 'description') {
          // Handle description as a collaborative document
          const descriptionRef = await this.createDescriptionMarkup(client, issue._id, value);
          updateData[field] = descriptionRef;
        } else {
          updateData[field] = value;
        }
        
      } else if (field === 'status') {
        // Handle status field with StatusManager
        if (typeof value !== 'string') {
          throw HulyError.invalidValue('status', value, `one of: ${statusManager.getValidStatuses().join(', ')} or full format like tracker:status:Backlog`);
        }
        
        try {
          // Use StatusManager to convert and validate status
          updateData[field] = statusManager.toFullStatus(value);
        } catch (error) {
          throw HulyError.invalidValue('status', value, `one of: ${statusManager.getValidStatuses().join(', ')}`);
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
          throw HulyError.permission('update', `issue ${issueIdentifier}`);
        }
        
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          throw HulyError.database('update issue', new Error('Connection failed'));
        }

        // Generic database error
        throw HulyError.database('update issue', error);
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
      throw new HulyError(
        ERROR_CODES.VALIDATION_ERROR,
        `Project with identifier '${identifier}' already exists`,
        {
          context: 'Project identifier must be unique',
          suggestion: 'Use a different identifier',
          data: { identifier }
        }
      );
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
      throw HulyError.notFound('issue', parentIssueIdentifier);
    }

    const project = await client.findOne(
      tracker.class.Project,
      { _id: parentIssue.space }
    );

    if (!project) {
      throw HulyError.notFound('project', `for parent issue ${parentIssueIdentifier}`);
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

    // Create the description markup reference
    const descriptionRef = await this.createDescriptionMarkup(client, subissueId, description);
    
    // Create subissue with proper attachedTo reference
    await client.addCollection(
      tracker.class.Issue,
      project._id,
      parentIssue._id,
      tracker.class.Issue,
      'subIssues',
      {
        title,
        description: descriptionRef,
        identifier: `${project.identifier}-${sequence}`,
        number: sequence,
        status: project.defaultIssueStatus || statusManager.getDefaultStatus('full'),
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
      throw HulyError.notFound('project', projectIdentifier);
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
      throw HulyError.notFound('project', projectIdentifier);
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
      throw HulyError.notFound('project', projectIdentifier);
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
      throw HulyError.invalidValue('target_date', target_date, 'ISO 8601 format (e.g., 2024-12-31)');
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
      throw HulyError.notFound('project', projectIdentifier);
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
      throw HulyError.database('list GitHub repositories', error);
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
        throw HulyError.notFound('project', projectIdentifier);
      }

      // Find the repository by name - support both "owner/repo" and "repo" formats
      let repository = await client.findOne(
        'github:class:GithubIntegrationRepository',
        { name: repositoryName }
      );

      // If not found by exact match and input contains "/", try without owner prefix
      if (!repository && repositoryName.includes('/')) {
        const repoNameOnly = repositoryName.split('/').pop();
        repository = await client.findOne(
          'github:class:GithubIntegrationRepository',
          { name: repoNameOnly }
        );
      }

      if (!repository) {
        // Provide helpful error message with available repositories
        const availableRepos = await client.findAll(
          'github:class:GithubIntegrationRepository',
          {},
          { limit: 5 }
        );
        
        let errorMsg = `GitHub repository "${repositoryName}" not found.`;
        if (availableRepos.length > 0) {
          errorMsg += '\n\nAvailable repositories (first 5):\n';
          errorMsg += availableRepos.map(r => `- ${r.name}`).join('\n');
          errorMsg += '\n\nUse huly_list_github_repositories to see all available repositories.';
        } else {
          errorMsg += ' No GitHub repositories are available. Please check your GitHub integration.';
        }
        
        throw new HulyError(
          ERROR_CODES.REPOSITORY_NOT_FOUND,
          errorMsg,
          { 
            context: `Repository '${repositoryName}' not found`,
            suggestion: availableRepos.length > 0 ? `Available repositories: ${availableRepos.slice(0, 5).map(r => r.name).join(', ')}` : 'No GitHub repositories are available. Please check your GitHub integration.',
            data: {
              repositoryName, 
              availableCount: availableRepos.length,
              searchedFormats: repositoryName.includes('/') ? ['exact', 'name-only'] : ['exact']
            }
          }
        );
      }

      if (repository.githubProject) {
        throw new HulyError(
          ERROR_CODES.VALIDATION_ERROR,
          `Repository "${repositoryName}" is already assigned to another project`,
          {
            context: 'Repository can only be assigned to one project',
            suggestion: 'Unassign from current project first',
            data: { repositoryName, currentProject: repository.githubProject }
          }
        );
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
      throw HulyError.database('assign repository to project', error);
    }
  }

  async listComments(client, issueIdentifier, limit = 50) {
    try {
      // Find the issue
      const issue = await client.findOne(
        tracker.class.Issue,
        { identifier: issueIdentifier }
      );

      if (!issue) {
        throw HulyError.notFound('issue', issueIdentifier);
      }

      // Get the total comment count from the issue's collection counter
      const totalCommentCount = issue.comments || 0;

      // Find all activity messages (includes ChatMessage, ThreadMessage, etc.)
      const activityMessages = await client.findAll(
        activity.class.ActivityMessage,
        { 
          attachedTo: issue._id,
          attachedToClass: tracker.class.Issue
        },
        { 
          limit,
          sort: { createdOn: 1 } // Sort by creation date, oldest first
        }
      );

      // Also find thread messages which use a different attachment pattern
      const threadMessages = await client.findAll(
        chunter.class.ThreadMessage,
        {
          objectId: issue._id,
          objectClass: tracker.class.Issue
        },
        {
          limit: Math.max(0, limit - activityMessages.length),
          sort: { createdOn: 1 }
        }
      );

      // Combine all messages
      const allMessages = [...activityMessages, ...threadMessages].sort((a, b) => a.createdOn - b.createdOn);

      let result = `Found ${totalCommentCount} total comments on issue ${issueIdentifier} (showing ${allMessages.length}):\n\n`;
      
      if (allMessages.length === 0) {
        result += 'No comments retrieved. Comments may exist but are not accessible via current query.';
      } else {
        for (const comment of allMessages) {
          const createdDate = new Date(comment.createdOn).toLocaleString();
          const modifiedDate = comment.modifiedOn !== comment.createdOn 
            ? ` (edited: ${new Date(comment.modifiedOn).toLocaleString()})` 
            : '';
          
          // Determine comment type
          let commentType = '💬';
          if (comment._class === chunter.class.ThreadMessage) {
            commentType = '🔗';
          } else if (comment._class === activity.class.DocUpdateMessage) {
            commentType = '📝';
          }
          
          result += `${commentType} **Comment by ${comment.createdBy || 'Unknown'}**\n`;
          result += `   Date: ${createdDate}${modifiedDate}\n`;
          
          // Parse message content if it's JSON
          let messageContent = comment.message;
          try {
            const parsed = JSON.parse(comment.message);
            if (parsed.type === 'doc' && parsed.content) {
              // Extract text from ProseMirror document structure
              messageContent = extractTextFromDoc(parsed);
            }
          } catch (e) {
            // Not JSON, use as-is
          }
          
          result += `   Message: ${messageContent}\n`;
          
          // Check for attachments
          if (comment.attachments && comment.attachments > 0) {
            result += `   📎 Attachments: ${comment.attachments}\n`;
          }
          
          result += '\n';
        }
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
      if (error instanceof HulyError) {
        throw error;
      }
      throw HulyError.database('list comments', error);
    }
  }

  async createComment(client, issueIdentifier, message) {
    try {
      // Validate inputs
      if (!message || message.trim() === '') {
        throw HulyError.validation('message', message, 'Provide a meaningful comment message');
      }

      // Find the issue
      const issue = await client.findOne(
        tracker.class.Issue,
        { identifier: issueIdentifier }
      );

      if (!issue) {
        throw HulyError.notFound('issue', issueIdentifier);
      }

      // Create the comment as a ChatMessage
      const commentId = generateId();
      
      await client.addCollection(
        chunter.class.ChatMessage,
        issue.space,
        issue._id,
        tracker.class.Issue,
        'comments',
        {
          message: message.trim(),
          attachments: 0
        },
        commentId
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully added comment to issue ${issueIdentifier}\n\nComment: ${message}`
          }
        ]
      };
    } catch (error) {
      if (error instanceof HulyError) {
        throw error;
      }
      throw HulyError.database('create comment', error);
    }
  }

  async getIssueDetails(client, issueIdentifier) {
    try {
      // Find the issue
      const issue = await client.findOne(
        tracker.class.Issue,
        { identifier: issueIdentifier }
      );

      if (!issue) {
        throw HulyError.notFound('issue', issueIdentifier);
      }

      // Get project information
      const project = await client.findOne(
        tracker.class.Project,
        { _id: issue.space }
      );

      // Get component information
      let component = null;
      if (issue.component) {
        component = await client.findOne(
          tracker.class.Component,
          { _id: issue.component }
        );
      }

      // Get milestone information
      let milestone = null;
      if (issue.milestone) {
        milestone = await client.findOne(
          tracker.class.Milestone,
          { _id: issue.milestone }
        );
      }

      // Get parent issue information if it's a subissue
      let parentIssues = [];
      if (issue.parents && issue.parents.length > 0) {
        for (const parent of issue.parents) {
          const parentIssue = await client.findOne(
            tracker.class.Issue,
            { _id: parent.parentId }
          );
          if (parentIssue) {
            parentIssues.push({
              identifier: parentIssue.identifier,
              title: parentIssue.title
            });
          }
        }
      }

      // Get child issues if any
      let childIssues = [];
      if (issue.childInfo && issue.childInfo.length > 0) {
        for (const child of issue.childInfo) {
          childIssues.push({
            identifier: child.identifier,
            title: child.childTitle
          });
        }
      }

      // Get all comments
      const comments = await client.findAll(
        chunter.class.ChatMessage,
        { 
          attachedTo: issue._id,
          attachedToClass: tracker.class.Issue
        },
        { 
          sort: { createdOn: 1 } // Sort by creation date, oldest first
        }
      );

      // Get full description content
      let fullDescription = '';
      if (issue.description) {
        fullDescription = await this.getDescriptionContent(issue.description, issue._id);
      }

      // Build comprehensive result
      let result = `# Issue Details: ${issue.identifier}\n\n`;
      
      // Basic Information
      result += `## Basic Information\n`;
      result += `**Title:** ${issue.title}\n`;
      result += `**Project:** ${project ? `${project.name} (${project.identifier})` : 'Unknown'}\n`;
      result += `**Issue Number:** ${issue.number}\n`;
      result += `**Kind:** ${issue.kind || 'tracker:taskTypes:Issue'}\n\n`;

      // Status and Priority
      result += `## Status & Priority\n`;
      try {
        const humanStatus = statusManager.toHumanStatus(issue.status);
        const statusDescription = statusManager.getStatusDescription(issue.status);
        result += `**Status:** ${humanStatus} (${statusDescription})\n`;
      } catch (error) {
        result += `**Status:** ${issue.status}\n`;
      }
      
      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[issue.priority] || 'Not set';
      result += `**Priority:** ${priorityName}\n`;
      
      if (issue.assignee) {
        result += `**Assignee:** ${issue.assignee}\n`;
      } else {
        result += `**Assignee:** Not assigned\n`;
      }
      result += `\n`;

      // Full Description
      if (fullDescription) {
        result += `## Description\n${fullDescription}\n\n`;
      } else {
        result += `## Description\n*No description provided*\n\n`;
      }

      // Organization
      result += `## Organization\n`;
      if (component) {
        result += `**Component:** ${component.label}`;
        if (component.description) {
          result += ` - ${component.description}`;
        }
        result += `\n`;
      }
      
      if (milestone) {
        result += `**Milestone:** ${milestone.label}`;
        const statusNames = ['Planned', 'In Progress', 'Completed', 'Canceled'];
        const milestoneStatus = statusNames[milestone.status] || 'Unknown';
        result += ` (${milestoneStatus})`;
        if (milestone.targetDate) {
          result += ` - Target: ${new Date(milestone.targetDate).toLocaleDateString()}`;
        }
        result += `\n`;
      }
      result += `\n`;

      // Time Tracking
      result += `## Time Tracking\n`;
      result += `**Estimation:** ${issue.estimation || 0} hours\n`;
      result += `**Remaining Time:** ${issue.remainingTime || 0} hours\n`;
      result += `**Reported Time:** ${issue.reportedTime || 0} hours\n`;
      result += `**Reports Count:** ${issue.reports || 0}\n`;
      
      if (issue.dueDate) {
        result += `**Due Date:** ${new Date(issue.dueDate).toLocaleDateString()}\n`;
      }
      result += `\n`;

      // Relationships
      result += `## Relationships\n`;
      
      if (parentIssues.length > 0) {
        result += `**Parent Issues:**\n`;
        for (const parent of parentIssues) {
          result += `- ${parent.identifier}: ${parent.title}\n`;
        }
      }
      
      if (childIssues.length > 0) {
        result += `**Sub-Issues:** (${issue.subIssues || childIssues.length} total)\n`;
        for (const child of childIssues) {
          result += `- ${child.identifier}: ${child.title}\n`;
        }
      }
      
      if (parentIssues.length === 0 && childIssues.length === 0) {
        result += `*No parent or sub-issues*\n`;
      }
      result += `\n`;

      // Comments History
      result += `## Comments (${comments.length} total)\n`;
      if (comments.length > 0) {
        for (const comment of comments) {
          const createdDate = new Date(comment.createdOn).toLocaleString();
          const isEdited = comment.modifiedOn !== comment.createdOn;
          
          result += `\n### ${comment.createdBy || 'Unknown'} - ${createdDate}`;
          if (isEdited) {
            result += ` (edited ${new Date(comment.modifiedOn).toLocaleString()})`;
          }
          result += `\n${comment.message}\n`;
          
          if (comment.attachments && comment.attachments > 0) {
            result += `*📎 ${comment.attachments} attachment(s)*\n`;
          }
        }
      } else {
        result += `*No comments yet*\n`;
      }
      result += `\n`;

      // Metadata
      result += `## Metadata\n`;
      result += `**Created:** ${new Date(issue.createdOn).toLocaleString()}\n`;
      result += `**Last Modified:** ${new Date(issue.modifiedOn).toLocaleString()}\n`;
      result += `**Created By:** ${issue.createdBy || 'Unknown'}\n`;
      result += `**Modified By:** ${issue.modifiedBy || 'Unknown'}\n`;
      result += `**Rank:** ${issue.rank || 'N/A'}\n`;
      result += `**Attachments:** ${issue.attachments || 0}\n`;
      result += `**Comments Count:** ${issue.comments || comments.length}\n`;

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      if (error instanceof HulyError) {
        throw error;
      }
      throw HulyError.database('get issue details', error);
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
          throw HulyError.notFound('project', project_identifier);
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
        
        // Add description if present (truncated for search results)
        if (issue.description) {
          const descContent = await this.getDescriptionContent(issue.description, issue._id);
          if (descContent) {
            const maxLength = 200;
            const truncated = descContent.length > maxLength 
              ? descContent.substring(0, maxLength) + '...' 
              : descContent;
            result += `   Description: ${truncated}\n`;
          }
        }
        
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
      throw HulyError.database('search issues', error);
    }
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
              case 'huly_list_comments':
                result = await this.listComments(client, args.issue_identifier, args.limit);
                break;
              case 'huly_create_comment':
                result = await this.createComment(client, args.issue_identifier, args.message);
                break;
              case 'huly_get_issue_details':
                result = await this.getIssueDetails(client, args.issue_identifier);
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
          case 'huly_list_comments':
            result = await this.listComments(client, args.issue_identifier, args.limit);
            break;
          case 'huly_create_comment':
            result = await this.createComment(client, args.issue_identifier, args.message);
            break;
          case 'huly_get_issue_details':
            result = await this.getIssueDetails(client, args.issue_identifier);
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