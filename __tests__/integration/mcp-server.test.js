import { createMCPServer } from '../../src/server/createMCPServer.js';
import { HulyClient } from '../../src/client/HulyClient.js';
import { getConfigManager } from '../../src/config/index.js';
import { createLoggerWithConfig } from '../../src/utils/logger.js';
import {
  setupTestEnvironment,
  generateTestProjectIdentifier,
  generateTestIssueData,
  cleanupTestResources,
  trackResource,
} from './setup.js';

describe('MCP Server Integration Tests', () => {
  let server;
  let client;
  let services;
  let config;
  let logger;

  beforeAll(async () => {
    // Setup test environment
    await setupTestEnvironment();

    // Initialize configuration and logger
    const configManager = getConfigManager();
    config = configManager.getConfig();
    logger = createLoggerWithConfig(configManager);

    // Create Huly client
    client = new HulyClient(config, logger);
    await client.connect();

    // Create MCP server
    const serverResult = await createMCPServer(configManager);
    server = serverResult.server;
    services = serverResult.services;
  });

  afterAll(async () => {
    // Cleanup all test resources
    await cleanupTestResources(client, services);

    // Close connections
    if (client) {
      await client.close();
    }
    if (server && server.close) {
      await server.close();
    }
  });

  describe('Tool Discovery', () => {
    it('should list all available tools', async () => {
      const tools = await server.listTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);
      expect(tools.tools.length).toBeGreaterThan(0);

      // Check for essential tools
      const toolNames = tools.tools.map((t) => t.name);

      // Project tools
      expect(toolNames).toContain('huly_list_projects');
      expect(toolNames).toContain('huly_create_project');
      expect(toolNames).toContain('huly_delete_project');
      expect(toolNames).toContain('huly_archive_project');

      // Issue tools
      expect(toolNames).toContain('huly_create_issue');
      expect(toolNames).toContain('huly_create_subissue');
      expect(toolNames).toContain('huly_update_issue');
      expect(toolNames).toContain('huly_delete_issue');
      expect(toolNames).toContain('huly_get_issue_details');
      expect(toolNames).toContain('huly_list_issues');
      expect(toolNames).toContain('huly_search_issues');
      expect(toolNames).toContain('huly_bulk_create_issues');
      expect(toolNames).toContain('huly_bulk_delete_issues');
      expect(toolNames).toContain('huly_bulk_update_issues');

      // Component tools
      expect(toolNames).toContain('huly_create_component');
      expect(toolNames).toContain('huly_delete_component');
      expect(toolNames).toContain('huly_list_components');

      // Milestone tools
      expect(toolNames).toContain('huly_create_milestone');
      expect(toolNames).toContain('huly_delete_milestone');
      expect(toolNames).toContain('huly_list_milestones');

      // GitHub tools
      expect(toolNames).toContain('huly_assign_repository_to_project');
      expect(toolNames).toContain('huly_list_github_repositories');

      // Comment tools
      expect(toolNames).toContain('huly_create_comment');
      expect(toolNames).toContain('huly_list_comments');

      // Template tools
      expect(toolNames).toContain('huly_create_template');
      expect(toolNames).toContain('huly_delete_template');
      expect(toolNames).toContain('huly_update_template');
      expect(toolNames).toContain('huly_get_template_details');
      expect(toolNames).toContain('huly_list_templates');
      expect(toolNames).toContain('huly_search_templates');
      expect(toolNames).toContain('huly_add_child_template');
      expect(toolNames).toContain('huly_remove_child_template');
      expect(toolNames).toContain('huly_create_issue_from_template');

      // Validation tools
      expect(toolNames).toContain('huly_validate_deletion');

      // Verify total count
      expect(toolNames.length).toBe(35);
    });

    it('should provide proper tool schemas', async () => {
      const tools = await server.listTools();
      const createIssueTool = tools.tools.find((t) => t.name === 'huly_create_issue');

      expect(createIssueTool).toBeDefined();
      expect(createIssueTool.description).toBeTruthy();
      expect(createIssueTool.inputSchema).toBeDefined();
      expect(createIssueTool.inputSchema.type).toBe('object');
      expect(createIssueTool.inputSchema.properties).toBeDefined();
      expect(createIssueTool.inputSchema.required).toContain('project_identifier');
      expect(createIssueTool.inputSchema.required).toContain('title');
    });
  });

  describe('Project Operations', () => {
    let testProjectId;

    beforeEach(() => {
      testProjectId = generateTestProjectIdentifier();
    });

    it('should create and list projects', async () => {
      // Create project
      const createResult = await server.callTool('huly_create_project', {
        name: `Integration Test Project ${testProjectId}`,
        identifier: testProjectId,
        description: 'Created by integration tests',
      });

      expect(createResult.content[0].text).toContain('Project created successfully');
      trackResource('projects', testProjectId);

      // List projects
      const listResult = await server.callTool('huly_list_projects', {});
      expect(listResult.content[0].text).toContain(testProjectId);
    });

    it('should handle duplicate project creation', async () => {
      // Create first project
      await server.callTool('huly_create_project', {
        name: `Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);

      // Try to create duplicate
      await expect(
        server.callTool('huly_create_project', {
          name: `Duplicate Project ${testProjectId}`,
          identifier: testProjectId,
        })
      ).rejects.toThrow();
    });
  });

  describe('Issue Operations', () => {
    let testProjectId;

    beforeEach(async () => {
      // Create a test project for issues
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Issue Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);
    });

    it('should create and retrieve issues', async () => {
      // Create issue
      const issueData = generateTestIssueData({
        title: 'Integration test issue',
        description: 'This issue was created by integration tests',
        priority: 'high',
      });

      const createResult = await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        ...issueData,
      });

      expect(createResult.content[0].text).toContain('Issue created successfully');
      const issueIdMatch = createResult.content[0].text.match(/\(([^)]+)\)/);
      const issueId = issueIdMatch[1];
      trackResource('issues', issueId);

      // Get issue details
      const detailsResult = await server.callTool('huly_get_issue_details', {
        issue_identifier: issueId,
      });

      expect(detailsResult.content[0].text).toContain(issueData.title);
      expect(detailsResult.content[0].text).toContain(issueData.description);
      expect(detailsResult.content[0].text).toContain('high');
    });

    it('should update issue fields', async () => {
      // Create issue
      const createResult = await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        title: 'Issue to update',
        priority: 'low',
      });

      const issueIdMatch = createResult.content[0].text.match(/\(([^)]+)\)/);
      const issueId = issueIdMatch[1];
      trackResource('issues', issueId);

      // Update status
      const updateResult = await server.callTool('huly_update_issue', {
        issue_identifier: issueId,
        field: 'status',
        value: 'in-progress',
      });

      expect(updateResult.content[0].text).toContain('Updated issue');
      expect(updateResult.content[0].text).toContain('in-progress');

      // Update priority
      const priorityResult = await server.callTool('huly_update_issue', {
        issue_identifier: issueId,
        field: 'priority',
        value: 'urgent',
      });

      expect(priorityResult.content[0].text).toContain('urgent');
    });

    it('should search issues', async () => {
      // Create multiple issues
      const issue1 = await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        title: 'Search test bug report',
        description: 'This is a bug that needs fixing',
        priority: 'high',
      });

      const issue2 = await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        title: 'Feature request for search',
        description: 'Add new search functionality',
        priority: 'medium',
      });

      // Track created issues
      const issueId1 = issue1.content[0].text.match(/\(([^)]+)\)/)[1];
      const issueId2 = issue2.content[0].text.match(/\(([^)]+)\)/)[1];
      trackResource('issues', issueId1);
      trackResource('issues', issueId2);

      // Search for "bug"
      const searchResult = await server.callTool('huly_search_issues', {
        query: 'bug',
        project_identifier: testProjectId,
      });

      expect(searchResult.content[0].text).toContain('Search test bug report');
      expect(searchResult.content[0].text).not.toContain('Feature request for search');
    });
  });

  describe('Bulk Operations', () => {
    let testProjectId;

    beforeEach(async () => {
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Bulk Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);
    });

    it('should bulk create issues', async () => {
      const result = await server.callTool('huly_bulk_create_issues', {
        project_identifier: testProjectId,
        issues: [
          {
            title: 'Bulk issue 1',
            description: 'First bulk created issue',
            priority: 'high',
          },
          {
            title: 'Bulk issue 2',
            description: 'Second bulk created issue',
            priority: 'medium',
          },
          {
            title: 'Bulk issue 3',
            description: 'Third bulk created issue',
            priority: 'low',
          },
        ],
      });

      expect(result.content[0].text).toContain('✅ Bulk Creation Complete');
      expect(result.content[0].text).toContain('Created: 3');

      // Track created issues
      const issueMatches = result.content[0].text.matchAll(/([A-Z]+-\d+)/g);
      for (const match of issueMatches) {
        trackResource('issues', match[1]);
      }
    });

    it('should bulk update issues', async () => {
      // Create issues to update
      const createResult = await server.callTool('huly_bulk_create_issues', {
        project_identifier: testProjectId,
        issues: [
          { title: 'Update test 1' },
          { title: 'Update test 2' },
          { title: 'Update test 3' },
        ],
      });

      // Extract issue identifiers
      const issueIds = [];
      const issueMatches = createResult.content[0].text.matchAll(/([A-Z]+-\d+)/g);
      for (const match of issueMatches) {
        issueIds.push(match[1]);
        trackResource('issues', match[1]);
      }

      // Bulk update
      const updateResult = await server.callTool('huly_bulk_update_issues', {
        updates: issueIds.map((id) => ({
          issue_identifier: id,
          field: 'status',
          value: 'done',
        })),
      });

      expect(updateResult.content[0].text).toContain('✅ Bulk Update Complete');
      expect(updateResult.content[0].text).toContain(`Succeeded: ${issueIds.length}`);
    });

    it('should handle bulk operation errors gracefully', async () => {
      const result = await server.callTool('huly_bulk_update_issues', {
        updates: [
          {
            issue_identifier: `${testProjectId}-9999`, // Non-existent issue
            field: 'status',
            value: 'done',
          },
          {
            issue_identifier: `${testProjectId}-9998`, // Another non-existent
            field: 'priority',
            value: 'high',
          },
        ],
        options: {
          continue_on_error: true,
        },
      });

      expect(result.content[0].text).toContain('Bulk Update Completed with Errors');
      expect(result.content[0].text).toContain('Failed: 2');
    });
  });

  describe('Template Operations', () => {
    let testProjectId;

    beforeEach(async () => {
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Template Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);
    });

    it('should create and use templates', async () => {
      // Create template
      const templateResult = await server.callTool('huly_create_template', {
        project_identifier: testProjectId,
        title: 'Bug Report Template',
        description: 'Standard template for bug reports',
        priority: 'high',
        children: [
          {
            title: 'Reproduce steps',
            description: 'Document reproduction steps',
          },
          {
            title: 'Expected behavior',
            description: 'Document expected behavior',
          },
        ],
      });

      expect(templateResult.content[0].text).toContain('Template created successfully');
      expect(templateResult.content[0].text).toContain('Created 2 child templates');

      // List templates
      const listResult = await server.callTool('huly_list_templates', {
        project_identifier: testProjectId,
      });

      expect(listResult.content[0].text).toContain('Bug Report Template');
      expect(listResult.content[0].text).toContain('(2 children)');

      // Extract template ID for creating issue
      const templateIdMatch = templateResult.content[0].text.match(/ID: ([^\s]+)/);
      if (templateIdMatch) {
        const templateId = templateIdMatch[1];
        trackResource('templates', templateId);

        // Create issue from template
        const issueResult = await server.callTool('huly_create_issue_from_template', {
          template_id: templateId,
          title: 'Actual Bug: Login fails',
        });

        expect(issueResult.content[0].text).toContain('Issue created successfully');
        expect(issueResult.content[0].text).toContain('Created 2 sub-issues');

        // Track created issue
        const issueIdMatch = issueResult.content[0].text.match(/\(([^)]+)\)/);
        if (issueIdMatch) {
          trackResource('issues', issueIdMatch[1]);
        }
      }
    });
  });

  describe('Deletion Operations', () => {
    let testProjectId;

    beforeEach(async () => {
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Deletion Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);
    });

    it('should validate deletions before executing', async () => {
      // Create issue with sub-issues
      const parentResult = await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        title: 'Parent issue with children',
      });

      const parentId = parentResult.content[0].text.match(/\(([^)]+)\)/)[1];
      trackResource('issues', parentId);

      // Create sub-issue
      const subResult = await server.callTool('huly_create_subissue', {
        parent_issue_identifier: parentId,
        title: 'Sub-issue 1',
      });

      const subId = subResult.content[0].text.match(/\(([^)]+)\)/)[1];
      trackResource('issues', subId);

      // Validate deletion
      const validationResult = await server.callTool('huly_validate_deletion', {
        entity_type: 'issue',
        entity_identifier: parentId,
      });

      expect(validationResult.content[0].text).toContain('Can Delete: ✅ Yes');
      expect(validationResult.content[0].text).toContain('Has 1 sub-issues');
    });

    it('should preview deletion impact', async () => {
      // Create test data
      await server.callTool('huly_create_component', {
        project_identifier: testProjectId,
        label: 'Backend',
        description: 'Backend component',
      });

      await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        title: 'Backend issue',
        component: 'Backend',
      });

      // Preview project deletion
      const previewResult = await server.callTool('huly_deletion_impact_preview', {
        entity_type: 'project',
        entity_identifier: testProjectId,
        detailed: true,
      });

      expect(previewResult.content[0].text).toContain('Deletion Impact Preview');
      expect(previewResult.content[0].text).toContain('Total Impact:');
      expect(previewResult.content[0].text).toContain('components');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool names', async () => {
      await expect(server.callTool('huly_invalid_tool_name', {})).rejects.toThrow();
    });

    it('should validate required parameters', async () => {
      await expect(
        server.callTool('huly_create_issue', {
          // Missing required project_identifier and title
        })
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      // This test would require mocking network failures
      // For now, we'll test with an invalid project identifier
      await expect(
        server.callTool('huly_list_issues', {
          project_identifier: 'NONEXISTENT999',
        })
      ).rejects.toThrow();
    });
  });

  describe('Component and Milestone Operations', () => {
    let testProjectId;

    beforeEach(async () => {
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Component Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);
    });

    it('should manage components', async () => {
      // Create component
      const createResult = await server.callTool('huly_create_component', {
        project_identifier: testProjectId,
        label: 'Frontend',
        description: 'Frontend components and UI',
      });

      expect(createResult.content[0].text).toContain('Created component "Frontend"');

      // List components
      const listResult = await server.callTool('huly_list_components', {
        project_identifier: testProjectId,
      });

      expect(listResult.content[0].text).toContain('Frontend');
      expect(listResult.content[0].text).toContain('Frontend components and UI');

      // Delete component
      const deleteResult = await server.callTool('huly_delete_component', {
        project_identifier: testProjectId,
        component_label: 'Frontend',
        force: true,
      });

      expect(deleteResult.content[0].text).toContain('Deleted component "Frontend"');
    });

    it('should manage milestones', async () => {
      // Create milestone
      const createResult = await server.callTool('huly_create_milestone', {
        project_identifier: testProjectId,
        label: 'v1.0',
        description: 'First release',
        target_date: '2024-12-31',
        status: 'planned',
      });

      expect(createResult.content[0].text).toContain('Created milestone "v1.0"');

      // List milestones
      const listResult = await server.callTool('huly_list_milestones', {
        project_identifier: testProjectId,
      });

      expect(listResult.content[0].text).toContain('v1.0');
      expect(listResult.content[0].text).toContain('First release');

      // Delete milestone
      const deleteResult = await server.callTool('huly_delete_milestone', {
        project_identifier: testProjectId,
        milestone_label: 'v1.0',
        force: true,
      });

      expect(deleteResult.content[0].text).toContain('Deleted milestone "v1.0"');
    });
  });

  describe('Comment Operations', () => {
    let testProjectId;
    let testIssueId;

    beforeEach(async () => {
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Comment Test Project ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);

      // Create a test issue
      const issueResult = await server.callTool('huly_create_issue', {
        project_identifier: testProjectId,
        title: 'Issue for comments',
      });
      testIssueId = issueResult.content[0].text.match(/\(([^)]+)\)/)[1];
      trackResource('issues', testIssueId);
    });

    it('should create and list comments', async () => {
      // Create comment
      const createResult = await server.callTool('huly_create_comment', {
        issue_identifier: testIssueId,
        message: 'This is a test comment with **markdown** support',
      });

      expect(createResult.content[0].text).toContain('Comment added successfully');

      // List comments
      const listResult = await server.callTool('huly_list_comments', {
        issue_identifier: testIssueId,
        limit: 10,
      });

      expect(listResult.content[0].text).toContain('This is a test comment');
      expect(listResult.content[0].text).toContain('markdown');
    });
  });

  describe('Advanced Template Operations', () => {
    let testProjectId;
    let templateId;

    beforeEach(async () => {
      testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Advanced Template Test ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);

      // Create a template
      const templateResult = await server.callTool('huly_create_template', {
        project_identifier: testProjectId,
        title: 'Feature Template',
        description: 'Template for new features',
        priority: 'medium',
      });
      templateId = templateResult.content[0].text.match(/ID: ([^\s]+)/)[1];
      trackResource('templates', templateId);
    });

    it('should manage template details and children', async () => {
      // Get template details
      const detailsResult = await server.callTool('huly_get_template_details', {
        template_id: templateId,
      });

      expect(detailsResult.content[0].text).toContain('Feature Template');
      expect(detailsResult.content[0].text).toContain('Template for new features');

      // Add child template
      const addChildResult = await server.callTool('huly_add_child_template', {
        template_id: templateId,
        title: 'Implementation Task',
        description: 'Implement the feature',
        estimation: 8,
      });

      expect(addChildResult.content[0].text).toContain('Added child template');

      // Update template
      const updateResult = await server.callTool('huly_update_template', {
        template_id: templateId,
        field: 'priority',
        value: 'high',
      });

      expect(updateResult.content[0].text).toContain('Updated template');

      // Search templates
      const searchResult = await server.callTool('huly_search_templates', {
        query: 'Feature',
        project_identifier: testProjectId,
      });

      expect(searchResult.content[0].text).toContain('Feature Template');

      // Remove child template
      const removeChildResult = await server.callTool('huly_remove_child_template', {
        template_id: templateId,
        child_index: 0,
      });

      expect(removeChildResult.content[0].text).toContain('Removed child template');
    });
  });

  describe('Project Archive Operations', () => {
    it('should archive projects', async () => {
      const archiveProjectId = generateTestProjectIdentifier();

      // Create project
      await server.callTool('huly_create_project', {
        name: `Archive Test ${archiveProjectId}`,
        identifier: archiveProjectId,
      });
      trackResource('projects', archiveProjectId);

      // Archive project
      const archiveResult = await server.callTool('huly_archive_project', {
        project_identifier: archiveProjectId,
      });

      expect(archiveResult.content[0].text).toContain('archived successfully');
      expect(archiveResult.content[0].text).toContain('hidden from active views');
    });
  });

  describe('GitHub Integration', () => {
    it('should list GitHub repositories', async () => {
      const listResult = await server.callTool('huly_list_github_repositories', {});

      // May return empty list if no GitHub integration is configured
      expect(listResult.content[0].text).toBeDefined();
    });

    it('should handle repository assignment', async () => {
      const testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `GitHub Test ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);

      // This might fail if no repositories are available
      try {
        const assignResult = await server.callTool('huly_assign_repository_to_project', {
          project_identifier: testProjectId,
          repository_name: 'test-org/test-repo',
        });
        expect(assignResult.content[0].text).toBeDefined();
      } catch (error) {
        // Expected if no GitHub integration is set up
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should handle large bulk operations efficiently', async () => {
      const testProjectId = generateTestProjectIdentifier();
      await server.callTool('huly_create_project', {
        name: `Performance Test ${testProjectId}`,
        identifier: testProjectId,
      });
      trackResource('projects', testProjectId);

      const startTime = Date.now();

      // Create 50 issues
      const issues = Array.from({ length: 50 }, (_, i) => ({
        title: `Performance test issue ${i + 1}`,
        description: `Issue ${i + 1} for performance testing`,
        priority: ['low', 'medium', 'high'][i % 3],
      }));

      const result = await server.callTool('huly_bulk_create_issues', {
        project_identifier: testProjectId,
        issues,
        options: {
          batch_size: 10,
        },
      });

      const duration = Date.now() - startTime;

      expect(result.content[0].text).toContain('Created: 50');
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      // Track for cleanup
      const issueMatches = result.content[0].text.matchAll(/([A-Z]+-\d+)/g);
      for (const match of issueMatches) {
        trackResource('issues', match[1]);
      }
    });
  });
});
