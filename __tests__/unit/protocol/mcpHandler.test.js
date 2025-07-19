/**
 * MCPHandler Tests
 *
 * Tests for the MCP protocol handler
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { MCPHandler } from '../../../src/protocol/MCPHandler.js';
import { HulyError } from '../../../src/core/HulyError.js';

// Helper to create mock functions
function createMockFn() {
  const calls = [];
  const mockImplementations = [];

  const fn = async (...args) => {
    calls.push(args);
    if (mockImplementations.length > 0) {
      const impl = mockImplementations.shift();
      if (impl.type === 'value') {
        return impl.value;
      } else if (impl.type === 'error') {
        throw impl.error;
      }
    }
    return undefined;
  };

  fn.mockResolvedValue = (value) => {
    mockImplementations.push({ type: 'value', value });
    return fn;
  };

  fn.mockResolvedValueOnce = (value) => {
    mockImplementations.push({ type: 'value', value });
    return fn;
  };

  fn.mockRejectedValue = (error) => {
    mockImplementations.push({ type: 'error', error });
    return fn;
  };

  fn.getCalls = () => calls;
  fn.toHaveBeenCalled = () => calls.length > 0;
  fn.toHaveBeenCalledWith = (...args) => {
    return calls.some(call =>
      call.length === args.length &&
      call.every((arg, i) => arg === args[i])
    );
  };

  return fn;
}

describe('MCPHandler Tests', () => {
  let _handler;
  let mockServer;
  let mockServices;
  let mockClient;

  beforeEach(() => {
    // Create mock server
    mockServer = {
      setRequestHandler: createMockFn()
    };

    // Create mock client
    mockClient = {};

    // Create mock services
    mockServices = {
      projectService: {
        listProjects: createMockFn(),
        createProject: createMockFn(),
        createComponent: createMockFn(),
        listComponents: createMockFn(),
        createMilestone: createMockFn(),
        listMilestones: createMockFn(),
        listGithubRepositories: createMockFn(),
        assignRepositoryToProject: createMockFn()
      },
      issueService: {
        listIssues: createMockFn(),
        createIssue: createMockFn(),
        updateIssue: createMockFn(),
        createSubissue: createMockFn(),
        searchIssues: createMockFn(),
        listComments: createMockFn(),
        createComment: createMockFn(),
        getIssueDetails: createMockFn()
      },
      hulyClientWrapper: {
        withClient: createMockFn()
      }
    };

    // Mock withClient to execute the callback with mockClient
    mockServices.hulyClientWrapper.withClient = async (callback) => {
      return callback(mockClient);
    };

    _handler = new MCPHandler(mockServer, mockServices);
  });

  describe('Constructor', () => {
    test('should set up request handlers', () => {
      expect(mockServer.setRequestHandler.toHaveBeenCalled()).toBe(true);
      expect(mockServer.setRequestHandler.getCalls().length).toBe(2);
    });
  });

  describe('Tool Listing', () => {
    test('should handle ListToolsRequestSchema', async () => {
      const listToolsHandler = mockServer.setRequestHandler.getCalls()[0][1];
      const result = await listToolsHandler();

      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0]).toHaveProperty('name');
      expect(result.tools[0]).toHaveProperty('description');
      expect(result.tools[0]).toHaveProperty('inputSchema');
    });
  });

  describe('Tool Execution', () => {
    let toolHandler;

    beforeEach(() => {
      // Get the CallToolRequestSchema handler
      toolHandler = mockServer.setRequestHandler.getCalls()[1][1];

      // Update mock to actually call the callback
      mockServices.hulyClientWrapper.withClient = async (callback) => {
        return callback(mockClient);
      };
    });

    test('should execute project listing tool', async () => {
      mockServices.projectService.listProjects.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Projects listed' }]
      });

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {}
        }
      };

      const result = await toolHandler(request);

      expect(mockServices.projectService.listProjects.toHaveBeenCalled()).toBe(true);
      expect(result.content[0].text).toBe('Projects listed');
    });

    test('should execute issue creation tool', async () => {
      mockServices.issueService.createIssue.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Issue created' }]
      });

      const request = {
        params: {
          name: 'huly_create_issue',
          arguments: {
            project_identifier: 'TEST',
            title: 'Test Issue',
            description: 'Test description',
            priority: 'high'
          }
        }
      };

      const result = await toolHandler(request);

      expect(mockServices.issueService.createIssue.toHaveBeenCalled()).toBe(true);
      expect(result.content[0].text).toBe('Issue created');
    });

    test('should handle HulyError appropriately', async () => {
      const hulyError = new HulyError('NOT_FOUND', 'Project not found');
      mockServices.hulyClientWrapper.withClient = async () => {
        throw hulyError;
      };

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {}
        }
      };

      const result = await toolHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Project not found');
    });

    test('should handle generic errors', async () => {
      mockServices.hulyClientWrapper.withClient = async () => {
        throw new Error('Connection failed');
      };

      const request = {
        params: {
          name: 'huly_list_projects',
          arguments: {}
        }
      };

      const result = await toolHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('❌ Error: Connection failed');
    });

    test('should handle invalid tool name', async () => {
      const request = {
        params: {
          name: 'invalid_tool',
          arguments: {}
        }
      };

      const result = await toolHandler(request);

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('Invalid value for field');
    });
  });

  describe('Tool Execution - All Tools', () => {
    let toolHandler;

    beforeEach(() => {
      toolHandler = mockServer.setRequestHandler.getCalls()[1][1];
      mockServices.hulyClientWrapper.withClient = async (callback) => {
        return callback(mockClient);
      };
    });

    const toolTests = [
      // Project tools
      { name: 'huly_list_projects', service: 'projectService', method: 'listProjects', args: {} },
      { name: 'huly_create_project', service: 'projectService', method: 'createProject', args: { name: 'Test' } },
      { name: 'huly_list_components', service: 'projectService', method: 'listComponents', args: { project_identifier: 'TEST' } },
      { name: 'huly_create_component', service: 'projectService', method: 'createComponent', args: { project_identifier: 'TEST', label: 'UI' } },
      { name: 'huly_list_milestones', service: 'projectService', method: 'listMilestones', args: { project_identifier: 'TEST' } },
      { name: 'huly_create_milestone', service: 'projectService', method: 'createMilestone', args: { project_identifier: 'TEST', label: 'v1.0' } },
      { name: 'huly_list_github_repositories', service: 'projectService', method: 'listGithubRepositories', args: {} },
      { name: 'huly_assign_repository_to_project', service: 'projectService', method: 'assignRepositoryToProject', args: { project_identifier: 'TEST', repository_name: 'org/repo' } },

      // Issue tools
      { name: 'huly_list_issues', service: 'issueService', method: 'listIssues', args: { project_identifier: 'TEST' } },
      { name: 'huly_create_issue', service: 'issueService', method: 'createIssue', args: { project_identifier: 'TEST', title: 'Issue' } },
      { name: 'huly_update_issue', service: 'issueService', method: 'updateIssue', args: { issue_identifier: 'TEST-1', field: 'title', value: 'New' } },
      { name: 'huly_create_subissue', service: 'issueService', method: 'createSubissue', args: { parent_issue_identifier: 'TEST-1', title: 'Sub' } },
      { name: 'huly_search_issues', service: 'issueService', method: 'searchIssues', args: { query: 'test' } },
      { name: 'huly_list_comments', service: 'issueService', method: 'listComments', args: { issue_identifier: 'TEST-1' } },
      { name: 'huly_create_comment', service: 'issueService', method: 'createComment', args: { issue_identifier: 'TEST-1', message: 'Comment' } },
      { name: 'huly_get_issue_details', service: 'issueService', method: 'getIssueDetails', args: { issue_identifier: 'TEST-1' } }
    ];

    test.each(toolTests)('should execute $name tool', async ({ name, service, method, args }) => {
      mockServices[service][method].mockResolvedValueOnce({
        content: [{ type: 'text', text: `${name} executed` }]
      });

      const request = {
        params: {
          name,
          arguments: args
        }
      };

      const result = await toolHandler(request);

      expect(mockServices[service][method].toHaveBeenCalled()).toBe(true);
      expect(result.content[0].text).toBe(`${name} executed`);
    });
  });
});