/**
 * MCP Server Integration Tests
 * 
 * Tests the full MCP server functionality with mocked dependencies
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockHulyClient, mockConnect } from '../mocks/hulyClient.mock.js';

// Mock dependencies
jest.mock('@hcengineering/api-client', () => ({
  connect: mockConnect
}));

// Mock tracker module
const mockTrackerClasses = {
  class: {
    Project: { _class: 'tracker:class:Project' },
    Issue: { _class: 'tracker:class:Issue' },
    IssueStatus: { _class: 'tracker:class:IssueStatus' },
    IssuePriority: { _class: 'tracker:class:IssuePriority' },
    Component: { _class: 'tracker:class:Component' },
    Milestone: { _class: 'tracker:class:Milestone' }
  },
  status: {
    Backlog: 'tracker:status:Backlog',
    Todo: 'tracker:status:Todo',
    InProgress: 'tracker:status:InProgress',
    Done: 'tracker:status:Done',
    Canceled: 'tracker:status:Canceled'
  },
  priority: {
    NoPriority: 'tracker:priority:NoPriority',
    Low: 'tracker:priority:Low',
    Medium: 'tracker:priority:Medium',
    High: 'tracker:priority:High',
    Urgent: 'tracker:priority:Urgent'
  }
};

jest.mock('@hcengineering/tracker', () => ({
  default: mockTrackerClasses
}));

jest.mock('@hcengineering/chunter', () => ({
  default: {
    class: {
      Comment: { _class: 'chunter:class:Comment' }
    }
  }
}));

jest.mock('@hcengineering/activity', () => ({
  default: {}
}));

// Mock core module
jest.mock('@hcengineering/core', () => ({
  generateId: jest.fn(() => `generated-${Date.now()}`),
  makeCollabJsonId: jest.fn(),
  makeCollabId: jest.fn()
}));

// Mock rank module
jest.mock('@hcengineering/rank', () => ({
  makeRank: jest.fn(() => '0|hzzzzz:')
}));

// Mock collaborator client
jest.mock('@hcengineering/collaborator-client', () => ({
  getClient: jest.fn()
}));

describe('MCP Server Integration Tests', () => {
  let server;
  let mockClient;
  let handler;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockClient = new MockHulyClient();
    mockConnect.mockResolvedValue(mockClient);
    
    const module = await import('../../index.js');
    const HulyMCPServer = module.HulyMCPServer;
    server = new HulyMCPServer();
    
    await server.connectToHuly();
    
    // Get the tools/call handler
    handler = server.server._requestHandlers.get('tools/call');
  });
  
  afterEach(() => {
    mockClient.reset();
  });
  
  describe('Tool Registration', () => {
    test('should register all expected tools', async () => {
      const listHandler = server.server._requestHandlers.get('tools/list');
      const response = await listHandler({
        method: 'tools/list',
        params: {}
      });
      
      const toolNames = response.tools.map(t => t.name);
      
      expect(toolNames).toContain('huly_list_projects');
      expect(toolNames).toContain('huly_create_project');
      expect(toolNames).toContain('huly_list_issues');
      expect(toolNames).toContain('huly_create_issue');
      expect(toolNames).toContain('huly_update_issue');
      expect(toolNames).toContain('huly_search_issues');
      expect(toolNames).toContain('huly_get_issue_details');
      expect(toolNames).toContain('huly_create_comment');
      expect(toolNames).toContain('huly_list_comments');
      expect(toolNames).toContain('huly_create_component');
      expect(toolNames).toContain('huly_list_components');
      expect(toolNames).toContain('huly_create_milestone');
      expect(toolNames).toContain('huly_list_milestones');
      expect(toolNames).toContain('huly_create_subissue');
    });
  });
  
  describe('End-to-End Workflows', () => {
    test('should complete project creation and issue workflow', async () => {
      // 1. Create a project
      const createProjectResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_create_project',
          arguments: {
            name: 'Test Project',
            identifier: 'TEST',
            description: 'A test project'
          }
        }
      });
      
      expect(createProjectResponse.content[0].text).toContain('✅ Created project');
      expect(createProjectResponse.content[0].text).toContain('Test Project (TEST)');
      
      // 2. List projects to verify creation
      const listProjectsResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_list_projects',
          arguments: {}
        }
      });
      
      expect(listProjectsResponse.content[0].text).toContain('Test Project (TEST)');
      expect(listProjectsResponse.content[0].text).toContain('A test project');
      
      // 3. Create an issue in the project
      const createIssueResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_create_issue',
          arguments: {
            project_identifier: 'TEST',
            title: 'First Issue',
            description: 'This is the first issue',
            priority: 'high'
          }
        }
      });
      
      expect(createIssueResponse.content[0].text).toContain('Successfully created issue');
      expect(createIssueResponse.content[0].text).toContain('TEST-1');
      expect(createIssueResponse.content[0].text).toContain('First Issue');
      
      // 4. List issues to verify creation
      const listIssuesResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_list_issues',
          arguments: {
            project_identifier: 'TEST'
          }
        }
      });
      
      expect(listIssuesResponse.content[0].text).toContain('Found 1 issues');
      expect(listIssuesResponse.content[0].text).toContain('TEST-1: First Issue');
      expect(listIssuesResponse.content[0].text).toContain('Priority: High');
      
      // 5. Update the issue
      const updateIssueResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_update_issue',
          arguments: {
            issue_identifier: 'TEST-1',
            field: 'status',
            value: 'in-progress'
          }
        }
      });
      
      expect(updateIssueResponse.content[0].text).toContain('Successfully updated');
      expect(updateIssueResponse.content[0].text).toContain('TEST-1');
      
      // 6. Get issue details
      const issueDetailsResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_get_issue_details',
          arguments: {
            issue_identifier: 'TEST-1'
          }
        }
      });
      
      expect(issueDetailsResponse.content[0].text).toContain('First Issue');
      expect(issueDetailsResponse.content[0].text).toContain('This is the first issue');
      expect(issueDetailsResponse.content[0].text).toContain('InProgress');
      
      // 7. Add a comment
      const createCommentResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_create_comment',
          arguments: {
            issue_identifier: 'TEST-1',
            message: 'This is a test comment'
          }
        }
      });
      
      expect(createCommentResponse.content[0].text).toContain('Successfully added comment');
      
      // 8. List comments
      const listCommentsResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_list_comments',
          arguments: {
            issue_identifier: 'TEST-1'
          }
        }
      });
      
      expect(listCommentsResponse.content[0].text).toContain('This is a test comment');
    });
    
    test('should handle component and milestone creation', async () => {
      // Setup: Create a project
      mockClient.addMockProject({
        _id: 'test-project-id',
        name: 'Test Project',
        identifier: 'TEST'
      });
      
      // Create a component
      const createComponentResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_create_component',
          arguments: {
            project_identifier: 'TEST',
            label: 'Frontend',
            description: 'Frontend components'
          }
        }
      });
      
      expect(createComponentResponse.content[0].text).toContain('✅ Created component');
      expect(createComponentResponse.content[0].text).toContain('Frontend');
      
      // List components
      const listComponentsResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_list_components',
          arguments: {
            project_identifier: 'TEST'
          }
        }
      });
      
      expect(listComponentsResponse.content[0].text).toContain('Frontend');
      expect(listComponentsResponse.content[0].text).toContain('Frontend components');
      
      // Create a milestone
      const createMilestoneResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_create_milestone',
          arguments: {
            project_identifier: 'TEST',
            label: 'v1.0',
            target_date: '2024-12-31',
            description: 'First release'
          }
        }
      });
      
      expect(createMilestoneResponse.content[0].text).toContain('Successfully created milestone');
      expect(createMilestoneResponse.content[0].text).toContain('v1.0');
      
      // List milestones
      const listMilestonesResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_list_milestones',
          arguments: {
            project_identifier: 'TEST'
          }
        }
      });
      
      expect(listMilestonesResponse.content[0].text).toContain('v1.0');
      expect(listMilestonesResponse.content[0].text).toContain('First release');
    });
    
    test('should handle search functionality', async () => {
      // Setup: Create project and issues
      const projectId = 'test-project-id';
      mockClient.addMockProject({
        _id: projectId,
        name: 'Test Project',
        identifier: 'TEST'
      });
      
      // Add various issues for search
      mockClient.addMockIssue({
        space: projectId,
        identifier: 'TEST-1',
        number: 1,
        title: 'Bug in login system',
        priority: 'tracker:priority:High',
        status: 'tracker:status:InProgress'
      });
      
      mockClient.addMockIssue({
        space: projectId,
        identifier: 'TEST-2',
        number: 2,
        title: 'Feature: Add dashboard',
        priority: 'tracker:priority:Medium',
        status: 'tracker:status:Backlog'
      });
      
      mockClient.addMockIssue({
        space: projectId,
        identifier: 'TEST-3',
        number: 3,
        title: 'Fix navigation bug',
        priority: 'tracker:priority:High',
        status: 'tracker:status:Done'
      });
      
      // Search by query
      const searchByQueryResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_search_issues',
          arguments: {
            query: 'bug'
          }
        }
      });
      
      expect(searchByQueryResponse.content[0].text).toContain('Found 2 issues');
      expect(searchByQueryResponse.content[0].text).toContain('TEST-1');
      expect(searchByQueryResponse.content[0].text).toContain('TEST-3');
      
      // Search by priority
      const searchByPriorityResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_search_issues',
          arguments: {
            priority: 'high'
          }
        }
      });
      
      expect(searchByPriorityResponse.content[0].text).toContain('Found 2 issues');
      
      // Search by status
      const searchByStatusResponse = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_search_issues',
          arguments: {
            status: 'Done'
          }
        }
      });
      
      expect(searchByStatusResponse.content[0].text).toContain('TEST-3');
      expect(searchByStatusResponse.content[0].text).not.toContain('TEST-1');
      expect(searchByStatusResponse.content[0].text).not.toContain('TEST-2');
    });
  });
  
  describe('Error Scenarios', () => {
    test('should handle project not found errors', async () => {
      const response = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_list_issues',
          arguments: {
            project_identifier: 'NONEXISTENT'
          }
        }
      });
      
      expect(response.content[0].text).toContain('Error');
      expect(response.content[0].text).toContain('Project NONEXISTENT not found');
    });
    
    test('should handle invalid tool name', async () => {
      const response = await handler({
        method: 'tools/call',
        params: {
          name: 'invalid_tool_name',
          arguments: {}
        }
      });
      
      expect(response.content[0].text).toContain('Error');
      expect(response.content[0].text).toContain('Unknown tool');
      expect(response.content[0].text).toContain('invalid_tool_name');
    });
    
    test('should handle missing required arguments', async () => {
      const response = await handler({
        method: 'tools/call',
        params: {
          name: 'huly_create_issue',
          arguments: {
            // Missing project_identifier and title
          }
        }
      });
      
      expect(response.content[0].text).toContain('Error');
    });
  });
});