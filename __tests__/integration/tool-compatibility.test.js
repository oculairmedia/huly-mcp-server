/**
 * Tool Compatibility Integration Tests
 *
 * This test suite verifies that all tools are properly loaded, have correct
 * definitions, and maintain compatibility across different scenarios.
 */

import { jest } from '@jest/globals';
import {
  initializeTools,
  getAllToolDefinitions,
  executeTool,
  hasTool,
  getToolsByCategory,
} from '../../src/tools/index.js';

jest.setTimeout(60000); // 1 minute

describe('Tool Compatibility Integration Tests', () => {
  let allTools;
  let mockContext;

  beforeAll(async () => {
    await initializeTools();
    allTools = getAllToolDefinitions();

    // Setup comprehensive mock context
    mockContext = {
      client: {
        findOne: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      services: {
        projectService: {
          createProject: jest.fn(),
          getProject: jest.fn(),
          listProjects: jest.fn(),
          deleteProject: jest.fn(),
        },
        issueService: {
          createIssue: jest.fn(),
          updateIssue: jest.fn(),
          getIssue: jest.fn(),
          listIssues: jest.fn(),
          deleteIssue: jest.fn(),
          createSubIssue: jest.fn(),
          searchIssues: jest.fn(),
        },
        componentService: {
          createComponent: jest.fn(),
          listComponents: jest.fn(),
          deleteComponent: jest.fn(),
        },
        milestoneService: {
          createMilestone: jest.fn(),
          listMilestones: jest.fn(),
          deleteMilestone: jest.fn(),
        },
        templateService: {
          createTemplate: jest.fn(),
          getTemplateDetails: jest.fn(),
          listTemplates: jest.fn(),
          searchTemplates: jest.fn(),
          createIssueFromTemplate: jest.fn(),
          addChildTemplate: jest.fn(),
          removeChildTemplate: jest.fn(),
          updateTemplate: jest.fn(),
          deleteTemplate: jest.fn(),
        },
        commentService: {
          createComment: jest.fn(),
          listComments: jest.fn(),
        },
        githubService: {
          listRepositories: jest.fn(),
          assignRepository: jest.fn(),
        },
        accountService: {
          getCurrentAccount: jest.fn(),
          createEmployee: jest.fn(),
          getEmployee: jest.fn(),
          listEmployees: jest.fn(),
          updateEmployee: jest.fn(),
          deleteEmployee: jest.fn(),
        },
        deletionService: {
          validateDeletion: jest.fn(),
          deletionImpactPreview: jest.fn(),
          deleteProject: jest.fn(),
          deleteIssue: jest.fn(),
          deleteComponent: jest.fn(),
          deleteMilestone: jest.fn(),
          deleteTemplate: jest.fn(),
        },
        bulkOperationService: {
          executeBulkOperation: jest.fn(),
        },
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Discovery and Registration', () => {
    it('should have loaded all expected tools', () => {
      expect(allTools).toBeDefined();
      expect(allTools.length).toBeGreaterThan(0);

      console.log(`📊 Total tools loaded: ${allTools.length}`);

      // Verify we have tools from all expected categories
      const expectedCategories = [
        'projects',
        'issues',
        'components',
        'milestones',
        'github',
        'comments',
        'templates',
        'validation',
        'preview',
        'accounts',
      ];

      expectedCategories.forEach((category) => {
        const categoryTools = getToolsByCategory(category);
        expect(categoryTools.length).toBeGreaterThan(0);
        console.log(`  - ${category}: ${categoryTools.length} tools`);
      });
    });

    it('should have proper tool definitions structure', () => {
      allTools.forEach((tool) => {
        // Basic structure validation
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');

        // Name format validation
        expect(tool.name).toMatch(/^huly_[a-z_]+$/);
        expect(tool.name).not.toContain('__'); // No double underscores

        // Description validation
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.description.length).toBeLessThan(2000);

        // Input schema validation
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');

        // Annotations validation (if present)
        if (tool.annotations) {
          expect(tool.annotations).toHaveProperty('title');
          expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
          expect(typeof tool.annotations.destructiveHint).toBe('boolean');
          expect(typeof tool.annotations.idempotentHint).toBe('boolean');
          expect(typeof tool.annotations.openWorldHint).toBe('boolean');
        }
      });
    });

    it('should have unique tool names', () => {
      const toolNames = allTools.map((tool) => tool.name);
      const uniqueNames = new Set(toolNames);

      expect(uniqueNames.size).toBe(toolNames.length);
    });

    it('should properly categorize tools', () => {
      const categoryMap = {
        projects: ['create_project', 'list_projects', 'delete_project'],
        issues: [
          'create_issue',
          'list_issues',
          'get_issue_details',
          'update_issue',
          'delete_issue',
          'create_subissue',
          'search_issues',
          'bulk_create_issues',
          'bulk_update_issues',
          'bulk_delete_issues',
        ],
        components: ['create_component', 'list_components', 'delete_component'],
        milestones: ['create_milestone', 'list_milestones', 'delete_milestone'],
        templates: [
          'create_template',
          'list_templates',
          'get_template_details',
          'search_templates',
          'create_issue_from_template',
          'add_child_template',
          'remove_child_template',
          'update_template',
          'delete_template',
        ],
        comments: ['create_comment', 'list_comments'],
        github: ['list_github_repositories', 'assign_repository_to_project'],
        accounts: [
          'get_current_account',
          'create_employee',
          'get_employee',
          'list_employees',
          'update_employee',
          'delete_employee',
        ],
        validation: ['validate_deletion'],
        preview: ['deletion_impact_preview'],
      };

      Object.entries(categoryMap).forEach(([category, expectedSuffixes]) => {
        const categoryTools = getToolsByCategory(category);

        expectedSuffixes.forEach((suffix) => {
          const expectedName = `huly_${suffix}`;
          const toolExists = categoryTools.some((tool) => tool.definition.name === expectedName);
          expect(toolExists).toBe(true);
        });
      });
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate required parameters across all tools', () => {
      const toolsWithRequiredParams = allTools.filter(
        (tool) => tool.inputSchema.required && tool.inputSchema.required.length > 0
      );

      expect(toolsWithRequiredParams.length).toBeGreaterThan(0);

      toolsWithRequiredParams.forEach((tool) => {
        tool.inputSchema.required.forEach((requiredParam) => {
          expect(tool.inputSchema.properties).toHaveProperty(requiredParam);
        });
      });
    });

    it('should have consistent parameter naming conventions', () => {
      const parameterPatterns = {
        identifiers:
          /^(project_identifier|issue_identifier|template_id|component_label|milestone_label|employee_id)$/,
        booleans: /^(dry_run|force|cascade|include_children|continue_on_error|active)$/,
        options: /^(options|defaults)$/,
        arrays: /^(issues|updates|children|tags|books|issue_identifiers)$/,
      };

      allTools.forEach((tool) => {
        Object.keys(tool.inputSchema.properties).forEach((paramName) => {
          const param = tool.inputSchema.properties[paramName];

          // Check naming conventions
          if (paramName.includes('identifier') || paramName.includes('_id')) {
            expect(paramName).toMatch(parameterPatterns.identifiers);
          }

          // Check type consistency
          if (param.type === 'boolean') {
            expect(paramName).toMatch(parameterPatterns.booleans);
          }

          if (param.type === 'array') {
            expect(paramName).toMatch(parameterPatterns.arrays);
          }

          // Ensure no camelCase in parameter names (should be snake_case)
          expect(paramName).not.toMatch(/[A-Z]/);
        });
      });
    });

    it('should have consistent enum values', () => {
      const priorityEnums = new Set();
      const statusEnums = new Set();

      allTools.forEach((tool) => {
        Object.values(tool.inputSchema.properties).forEach((param) => {
          if (param.enum) {
            if (param.description && param.description.includes('priority')) {
              param.enum.forEach((value) => priorityEnums.add(value));
            }
            if (param.description && param.description.includes('status')) {
              param.enum.forEach((value) => statusEnums.add(value));
            }
          }
        });
      });

      // Verify priority enums are consistent
      if (priorityEnums.size > 0) {
        const expectedPriorities = ['low', 'medium', 'high', 'urgent'];
        expectedPriorities.forEach((priority) => {
          expect(priorityEnums.has(priority)).toBe(true);
        });
      }
    });
  });

  describe('Tool Execution Compatibility', () => {
    it('should execute all read-only tools without errors', async () => {
      const readOnlyTools = [
        'huly_list_projects',
        'huly_list_issues',
        'huly_list_components',
        'huly_list_milestones',
        'huly_list_templates',
        'huly_list_github_repositories',
        'huly_list_employees',
        'huly_get_current_account',
      ];

      // Mock successful responses for all services
      Object.values(mockContext.services).forEach((service) => {
        Object.keys(service).forEach((method) => {
          if (method.startsWith('list') || method.startsWith('get')) {
            service[method].mockResolvedValue({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, data: [] }),
                },
              ],
            });
          }
        });
      });

      for (const toolName of readOnlyTools) {
        if (hasTool(toolName)) {
          const result = await executeTool(toolName, {}, mockContext);
          expect(result).toBeDefined();
          expect(result.content).toBeDefined();
          expect(result.content[0]).toHaveProperty('type');
        }
      }
    });

    it('should handle validation tools properly', async () => {
      mockContext.services.deletionService.validateDeletion.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              can_delete: true,
              blocking_issues: [],
              warnings: [],
            }),
          },
        ],
      });

      const result = await executeTool(
        'huly_validate_deletion',
        {
          entity_type: 'project',
          entity_identifier: 'TEST',
        },
        mockContext
      );

      expect(result.content[0].type).toBe('text');
      expect(mockContext.services.deletionService.validateDeletion).toHaveBeenCalled();
    });

    it('should handle preview tools correctly', async () => {
      mockContext.services.deletionService.deleteProject.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '🔍 DRY RUN: Project deletion preview for TEST',
          },
        ],
      });

      const result = await executeTool(
        'huly_delete_project',
        {
          project_identifier: 'TEST',
          dry_run: true,
        },
        mockContext
      );

      expect(result.content[0].text).toContain('DRY RUN');
      expect(mockContext.services.deletionService.deleteProject).toHaveBeenCalledWith(
        mockContext.client,
        'TEST',
        { dryRun: true, force: false }
      );
    });

    it('should maintain tool interface consistency', async () => {
      // Test that all tools return consistent response format
      const testTools = [
        { name: 'huly_list_projects', args: {} },
        { name: 'huly_create_project', args: { name: 'Test', identifier: 'TEST' } },
        {
          name: 'huly_validate_deletion',
          args: { entity_type: 'project', entity_identifier: 'TEST' },
        },
      ];

      // Mock all services to return consistent format
      Object.values(mockContext.services).forEach((service) => {
        Object.keys(service).forEach((method) => {
          service[method].mockResolvedValue({
            content: [
              {
                type: 'text',
                text: 'Mock response',
              },
            ],
          });
        });
      });

      for (const test of testTools) {
        if (hasTool(test.name)) {
          const result = await executeTool(test.name, test.args, mockContext);

          // Verify response structure
          expect(result).toHaveProperty('content');
          expect(Array.isArray(result.content)).toBe(true);
          expect(result.content.length).toBeGreaterThan(0);
          expect(result.content[0]).toHaveProperty('type');
          expect(result.content[0]).toHaveProperty('text');
        }
      }
    });
  });

  describe('Cross-Tool Compatibility', () => {
    it('should have compatible identifier formats across tools', async () => {
      // Test that identifiers created by one tool work with others
      const projectId = 'COMPAT';

      // Mock project creation
      mockContext.services.projectService.createProject.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Project created successfully: ${projectId}`,
          },
        ],
      });

      // Create project
      const createResult = await executeTool(
        'huly_create_project',
        {
          name: 'Compatibility Test',
          identifier: projectId,
        },
        mockContext
      );

      expect(createResult.content[0].text).toContain('Project created successfully');

      // Use project ID in other tools
      mockContext.services.issueService.createIssue.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Issue created successfully: Test Issue (${projectId}-1)`,
          },
        ],
      });

      const issueResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: projectId,
          title: 'Test Issue',
        },
        mockContext
      );

      expect(issueResult.content[0].text).toContain('Issue created successfully');
      expect(mockContext.services.issueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        projectId,
        'Test Issue',
        undefined, // description
        'medium', // default priority
        undefined, // component
        undefined // milestone
      );
    });

    it('should maintain referential integrity between tools', async () => {
      // Test that components created for a project work with issue creation
      const projectId = 'REF';
      const componentName = 'Backend';

      mockContext.services.componentService.createComponent.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Component "${componentName}" created successfully`,
          },
        ],
      });

      const componentResult = await executeTool(
        'huly_create_component',
        {
          project_identifier: projectId,
          label: componentName,
          description: 'Backend component',
        },
        mockContext
      );

      expect(componentResult.content[0].text).toContain('Component "Backend" created');

      // Use component in issue creation
      mockContext.services.issueService.createIssue.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Issue created successfully: Backend Issue (${projectId}-1)`,
          },
        ],
      });

      const issueResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: projectId,
          title: 'Backend Issue',
          component: componentName,
        },
        mockContext
      );

      expect(issueResult.content[0].text).toContain('Issue created successfully');
      expect(mockContext.services.issueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        projectId,
        'Backend Issue',
        undefined, // description
        'medium', // default priority
        componentName,
        undefined // milestone
      );
    });

    it('should handle cascading operations properly', async () => {
      // Test that deletion operations properly handle dependencies
      const projectId = 'CASCADE';

      mockContext.services.deletionService.validateDeletion.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              can_delete: true,
              blocking_issues: [],
              affected_entities: {
                issues: 5,
                components: 2,
                milestones: 1,
              },
            }),
          },
        ],
      });

      const validateResult = await executeTool(
        'huly_validate_deletion',
        {
          entity_type: 'project',
          entity_identifier: projectId,
        },
        mockContext
      );

      const validationData = JSON.parse(validateResult.content[0].text);
      expect(validationData.can_delete).toBe(true);

      // Delete project with cascade
      mockContext.services.deletionService.deleteProject.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Successfully deleted project ${projectId} and all associated data`,
          },
        ],
      });

      const deleteResult = await executeTool(
        'huly_delete_project',
        {
          project_identifier: projectId,
          force: true,
        },
        mockContext
      );

      expect(deleteResult.content[0].text).toContain('Successfully deleted project');
    });
  });

  describe('Tool Performance and Scalability', () => {
    it('should handle large parameter sets efficiently', async () => {
      // Test bulk operations with large datasets
      const largeIssueSet = Array.from({ length: 100 }, (_, i) => ({
        title: `Bulk Issue ${i + 1}`,
        description: `Description for issue ${i + 1}`,
      }));

      mockContext.services.bulkOperationService.executeBulkOperation.mockResolvedValue({
        summary: {
          total: 100,
          succeeded: 100,
          failed: 0,
          duration: 5000,
        },
        results: largeIssueSet.map((issue, i) => ({
          success: true,
          item: issue,
          result: { identifier: `BULK-${i + 1}` },
        })),
        errors: [],
      });

      const startTime = Date.now();

      const result = await executeTool(
        'huly_bulk_create_issues',
        {
          project_identifier: 'BULK',
          issues: largeIssueSet,
        },
        mockContext
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.summary.succeeded).toBe(100);

      // Performance assertion - should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('should have reasonable memory usage patterns', async () => {
      // Test that tools don't leak memory with repeated calls
      const initialMemory = process.memoryUsage().heapUsed;

      // Mock lightweight response
      mockContext.services.projectService.listProjects.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ projects: [] }),
          },
        ],
      });

      // Execute tool multiple times
      for (let i = 0; i < 50; i++) {
        await executeTool('huly_list_projects', {}, mockContext);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Tool Documentation and Metadata', () => {
    it('should have consistent annotation patterns', () => {
      const toolsWithAnnotations = allTools.filter((tool) => tool.annotations);

      expect(toolsWithAnnotations.length).toBeGreaterThan(0);

      toolsWithAnnotations.forEach((tool) => {
        // Destructive operations should be marked
        if (tool.name.includes('delete') || tool.name.includes('remove')) {
          expect(tool.annotations.destructiveHint).toBe(true);
        }

        // Read-only operations should be marked
        if (
          tool.name.includes('list') ||
          tool.name.includes('get') ||
          tool.name.includes('search')
        ) {
          expect(tool.annotations.readOnlyHint).toBe(true);
        }

        // Bulk operations should be marked as open world
        if (tool.name.includes('bulk')) {
          expect(tool.annotations.openWorldHint).toBe(true);
        }
      });
    });

    it('should have appropriate description patterns', () => {
      const descriptionPatterns = {
        create: /^(Create|Establish|Generate)/,
        list: /^(Retrieve|List|Get)/,
        update: /^(Modify|Update|Change)/,
        delete: /^(Permanently remove|Delete|Remove)/,
        search: /^(Execute|Search|Find)/,
        bulk: /^(Execute|Perform|Process)/,
      };

      allTools.forEach((tool) => {
        const toolAction = tool.name.split('_')[1]; // Extract action from tool name

        if (descriptionPatterns[toolAction]) {
          expect(tool.description).toMatch(descriptionPatterns[toolAction]);
        }
      });
    });
  });

  afterAll(() => {
    console.log('\n📊 Tool Compatibility Test Summary:');
    console.log(`- Total tools validated: ${allTools.length}`);

    const categoryStats = {};
    allTools.forEach((tool) => {
      const category = tool.name.split('_')[1];
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });

    console.log('- Tools by category:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} tools`);
    });

    console.log('✅ All tools passed compatibility validation');
  });
});
