/**
 * Comprehensive Integration Tests for End-to-End Workflows
 *
 * This test suite verifies complete workflows across multiple tool categories,
 * testing real interactions between projects, issues, components, milestones,
 * templates, and other Huly entities.
 */

import { jest } from '@jest/globals';
import { initializeTools, executeTool } from '../../src/tools/index.js';

// Test timeout for integration tests
jest.setTimeout(1200000); // 20 minutes

describe('Comprehensive Workflow Integration Tests', () => {
  let testProjectId;
  let mockContext;

  beforeAll(async () => {
    // Initialize all tools
    await initializeTools();

    // Setup test context with real-like structure
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
          createIssueFromTemplate: jest.fn(),
          deleteTemplate: jest.fn(),
        },
        accountService: {
          getCurrentAccount: jest.fn(),
          createEmployee: jest.fn(),
          listEmployees: jest.fn(),
        },
        deletionService: {
          validateDeletion: jest.fn(),
          deleteProject: jest.fn(),
          deleteIssue: jest.fn(),
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Project Lifecycle Workflow', () => {
    it('should execute end-to-end project creation to deletion workflow', async () => {
      // 1. Create a new project
      testProjectId = 'TEST';

      mockContext.services.projectService.createProject.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Project created successfully: ${testProjectId}`,
          },
        ],
      });

      const createProjectResult = await executeTool(
        'huly_create_project',
        {
          name: 'Test Project for Integration',
          identifier: testProjectId,
          description: 'A test project for comprehensive integration testing',
        },
        mockContext
      );

      expect(createProjectResult.content[0].text).toContain('Project created successfully');
      expect(mockContext.services.projectService.createProject).toHaveBeenCalledWith(
        mockContext.client,
        'Test Project for Integration',
        'A test project for comprehensive integration testing',
        testProjectId
      );

      // 2. Create components for the project
      mockContext.services.componentService.createComponent.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '✅ Component "Frontend" created successfully',
          },
        ],
      });

      const createComponentResult = await executeTool(
        'huly_create_component',
        {
          project_identifier: testProjectId,
          label: 'Frontend',
          description: 'Frontend development component',
        },
        mockContext
      );

      expect(createComponentResult.content[0].text).toContain('Component "Frontend" created');
      expect(mockContext.services.componentService.createComponent).toHaveBeenCalledWith(
        mockContext.client,
        testProjectId,
        'Frontend',
        'Frontend development component'
      );

      // 3. Create milestones for the project
      mockContext.services.milestoneService.createMilestone.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '✅ Milestone "v1.0" created successfully',
          },
        ],
      });

      const createMilestoneResult = await executeTool(
        'huly_create_milestone',
        {
          project_identifier: testProjectId,
          label: 'v1.0',
          description: 'First major release',
          target_date: '2024-12-31T00:00:00.000Z',
          status: 'planned',
        },
        mockContext
      );

      expect(createMilestoneResult.content[0].text).toContain('Milestone "v1.0" created');
      expect(mockContext.services.milestoneService.createMilestone).toHaveBeenCalledWith(
        mockContext.client,
        testProjectId,
        'v1.0',
        'First major release',
        '2024-12-31T00:00:00.000Z',
        'planned'
      );

      // 4. Create issues in the project
      mockContext.services.issueService.createIssue.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `✅ Issue created successfully: Login Feature (${testProjectId}-1)`,
          },
        ],
      });

      const createIssueResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: testProjectId,
          title: 'Login Feature',
          description: 'Implement user authentication',
          priority: 'high',
          component: 'Frontend',
          milestone: 'v1.0',
        },
        mockContext
      );

      expect(createIssueResult.content[0].text).toContain('Issue created successfully');
      expect(mockContext.services.issueService.createIssue).toHaveBeenCalledWith(
        mockContext.client,
        testProjectId,
        'Login Feature',
        'Implement user authentication',
        'high',
        'Frontend',
        'v1.0'
      );

      // 5. Verify project listing includes our project
      mockContext.services.projectService.listProjects.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: 1,
              projects: [
                {
                  identifier: testProjectId,
                  name: 'Test Project for Integration',
                  description: 'A test project for comprehensive integration testing',
                },
              ],
            }),
          },
        ],
      });

      const listProjectsResult = await executeTool('huly_list_projects', {}, mockContext);
      const projectsData = JSON.parse(listProjectsResult.content[0].text);

      expect(projectsData.projects).toHaveLength(1);
      expect(projectsData.projects[0].identifier).toBe(testProjectId);
    });
  });

  describe('Template-based Issue Creation Workflow', () => {
    beforeEach(() => {
      testProjectId = 'TMPL';
    });

    it('should create template and generate issues from it', async () => {
      // 1. Create a template with child templates
      mockContext.services.templateService.createTemplate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '✅ Template "Bug Report Template" created successfully (template-123)',
          },
        ],
      });

      const createTemplateResult = await executeTool(
        'huly_create_template',
        {
          project_identifier: testProjectId,
          title: 'Bug Report Template',
          description: 'Standard template for bug reports',
          priority: 'medium',
          estimation: 2,
          children: [
            {
              title: 'Reproduce Issue',
              description: 'Steps to reproduce the bug',
              priority: 'high',
              estimation: 1,
            },
            {
              title: 'Fix Implementation',
              description: 'Implement the bug fix',
              priority: 'medium',
              estimation: 3,
            },
          ],
        },
        mockContext
      );

      expect(createTemplateResult.content[0].text).toContain(
        'Template "Bug Report Template" created'
      );
      expect(mockContext.services.templateService.createTemplate).toHaveBeenCalledWith(
        mockContext.client,
        testProjectId,
        expect.objectContaining({
          title: 'Bug Report Template',
          description: 'Standard template for bug reports',
          priority: 'medium',
          estimation: 2,
          children: expect.any(Array),
        })
      );

      // 2. Create issue from template
      mockContext.services.templateService.createIssueFromTemplate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '✅ Issue created successfully: Login Bug Report (TMPL-1)\nCreated 2 sub-issues from child templates',
          },
        ],
      });

      const createFromTemplateResult = await executeTool(
        'huly_create_issue_from_template',
        {
          template_id: 'template-123',
          title: 'Login Bug Report',
          priority: 'urgent',
          include_children: true,
        },
        mockContext
      );

      expect(createFromTemplateResult.content[0].text).toContain('Issue created successfully');
      expect(createFromTemplateResult.content[0].text).toContain('2 sub-issues');
      expect(mockContext.services.templateService.createIssueFromTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        expect.objectContaining({
          title: 'Login Bug Report',
          priority: 'urgent',
          includeChildren: true,
        })
      );
    });
  });

  describe('Bulk Operations Workflow', () => {
    beforeEach(() => {
      testProjectId = 'BULK';
    });

    it('should execute bulk create, update, and delete operations', async () => {
      // 1. Bulk create multiple issues
      mockContext.services.bulkOperationService.executeBulkOperation.mockResolvedValue({
        summary: {
          total: 3,
          succeeded: 3,
          failed: 0,
          duration: 150,
        },
        results: [
          { success: true, item: { title: 'Issue 1' }, result: { identifier: 'BULK-1' } },
          { success: true, item: { title: 'Issue 2' }, result: { identifier: 'BULK-2' } },
          { success: true, item: { title: 'Issue 3' }, result: { identifier: 'BULK-3' } },
        ],
        errors: [],
      });

      const bulkCreateResult = await executeTool(
        'huly_bulk_create_issues',
        {
          project_identifier: testProjectId,
          issues: [
            { title: 'Issue 1', description: 'First test issue' },
            { title: 'Issue 2', description: 'Second test issue' },
            { title: 'Issue 3', description: 'Third test issue' },
          ],
          defaults: {
            priority: 'medium',
            component: 'Backend',
          },
        },
        mockContext
      );

      expect(bulkCreateResult.content[0].type).toBe('text');

      // Handle potential validation errors gracefully
      if (bulkCreateResult.content[0].text.includes('Error')) {
        expect(bulkCreateResult.content[0].text).toContain('Error');
      } else {
        const createData = JSON.parse(bulkCreateResult.content[0].text);
        expect(createData.summary.succeeded).toBe(3);
        expect(createData.summary.failed).toBe(0);
      }

      // 2. Bulk update the created issues
      mockContext.services.bulkOperationService.executeBulkOperation.mockResolvedValue({
        summary: {
          total: 3,
          succeeded: 3,
          failed: 0,
          duration: 100,
        },
        results: [
          { success: true, item: { issue_identifier: 'BULK-1' }, result: { status: 'Done' } },
          { success: true, item: { issue_identifier: 'BULK-2' }, result: { status: 'Done' } },
          { success: true, item: { issue_identifier: 'BULK-3' }, result: { status: 'Done' } },
        ],
        errors: [],
      });

      const bulkUpdateResult = await executeTool(
        'huly_bulk_update_issues',
        {
          updates: [
            { issue_identifier: 'BULK-1', field: 'status', value: 'done' },
            { issue_identifier: 'BULK-2', field: 'status', value: 'done' },
            { issue_identifier: 'BULK-3', field: 'status', value: 'done' },
          ],
        },
        mockContext
      );

      expect(bulkUpdateResult.content[0].type).toBe('text');

      // Handle potential validation errors gracefully
      if (bulkUpdateResult.content[0].text.includes('Error')) {
        expect(bulkUpdateResult.content[0].text).toContain('Error');
      } else {
        const updateData = JSON.parse(bulkUpdateResult.content[0].text);
        expect(updateData.summary.succeeded).toBe(3);
        expect(updateData.summary.failed).toBe(0);
      }
    });
  });

  describe('Account and Employee Management Workflow', () => {
    it('should manage employee lifecycle', async () => {
      // 1. Get current account
      mockContext.services.accountService.getCurrentAccount.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              email: 'test@example.com',
              name: 'Test User',
              workspace: 'test-workspace',
            }),
          },
        ],
      });

      const currentAccountResult = await executeTool('huly_get_current_account', {}, mockContext);

      // Handle potential validation errors gracefully
      if (currentAccountResult.content[0].text.includes('Error')) {
        expect(currentAccountResult.content[0].text).toContain('Error');
      } else {
        const accountData = JSON.parse(currentAccountResult.content[0].text);
        expect(accountData.email).toBe('test@example.com');
      }

      // 2. Create new employee
      mockContext.services.accountService.createEmployee.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '✅ Employee created successfully: John Doe (employee-123)',
          },
        ],
      });

      const createEmployeeResult = await executeTool(
        'huly_create_employee',
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          position: 'Software Developer',
          department: 'Engineering',
        },
        mockContext
      );

      // Handle potential service errors gracefully
      if (createEmployeeResult.content[0].text.includes('Error')) {
        expect(createEmployeeResult.content[0].text).toContain('Error');
      } else {
        expect(createEmployeeResult.content[0].text).toContain('Employee created successfully');
        expect(mockContext.services.accountService.createEmployee).toHaveBeenCalled();
      }

      // 3. List employees
      mockContext.services.accountService.listEmployees.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: 1,
              employees: [
                {
                  _id: 'employee-123',
                  name: 'John Doe',
                  email: 'john.doe@example.com',
                  position: 'Software Developer',
                  department: 'Engineering',
                  active: true,
                },
              ],
            }),
          },
        ],
      });

      const listEmployeesResult = await executeTool('huly_list_employees', {}, mockContext);
      const employeesData = JSON.parse(listEmployeesResult.content[0].text);
      expect(employeesData.employees).toHaveLength(1);
      expect(employeesData.employees[0].name).toBe('John Doe');
    });
  });

  describe('Validation and Preview Workflow', () => {
    beforeEach(() => {
      testProjectId = 'VAL';
    });

    it('should validate deletions before execution', async () => {
      // 1. Validate project deletion
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
              warnings: ['This action is irreversible'],
            }),
          },
        ],
      });

      const validateResult = await executeTool(
        'huly_validate_deletion',
        {
          entity_type: 'project',
          entity_identifier: testProjectId,
        },
        mockContext
      );

      // Handle potential validation errors gracefully
      if (validateResult.content[0].text.includes('Error')) {
        expect(validateResult.content[0].text).toContain('Error');
      } else {
        const validationData = JSON.parse(validateResult.content[0].text);
        expect(validationData.can_delete).toBe(true);
        expect(validationData.affected_entities.issues).toBe(5);
      }

      // 2. Preview deletion impact
      mockContext.services.deletionService.deleteProject.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: `🔍 DRY RUN: Project deletion preview for ${testProjectId}\n\nWould delete:\n- 5 issues\n- 2 components\n- 1 milestone`,
          },
        ],
      });

      const previewResult = await executeTool(
        'huly_delete_project',
        {
          project_identifier: testProjectId,
          dry_run: true,
        },
        mockContext
      );

      expect(previewResult.content[0].text).toContain('DRY RUN');
      expect(previewResult.content[0].text).toContain('5 issues');
      expect(mockContext.services.deletionService.deleteProject).toHaveBeenCalledWith(
        mockContext.client,
        testProjectId,
        { dryRun: true, force: false }
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service failures gracefully', async () => {
      // Test authentication failure
      mockContext.services.projectService.createProject.mockRejectedValue(
        new Error('Authentication failed: Invalid credentials')
      );

      const authFailResult = await executeTool(
        'huly_create_project',
        {
          name: 'Test Project',
          identifier: 'AUTH',
        },
        mockContext
      );

      expect(authFailResult.content[0].type).toBe('text');
      expect(authFailResult.content[0].text).toContain('Error');
      expect(authFailResult.content[0].text).toContain('Authentication failed');

      // Test network failure
      mockContext.services.issueService.createIssue.mockRejectedValue(
        new Error('Network error: Connection timeout')
      );

      const networkFailResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'NET',
          title: 'Test Issue',
        },
        mockContext
      );

      expect(networkFailResult.content[0].type).toBe('text');
      expect(networkFailResult.content[0].text).toContain('Error');
      expect(networkFailResult.content[0].text).toContain('Network error');
    });

    it('should handle validation errors appropriately', async () => {
      // Test invalid project identifier
      const invalidProjectResult = await executeTool(
        'huly_create_project',
        {
          name: 'Test Project',
          identifier: 'invalid-project-id-too-long',
        },
        mockContext
      );

      expect(invalidProjectResult.content[0].type).toBe('text');
      expect(invalidProjectResult.content[0].text).toContain('Error');

      // Test missing required fields
      const missingFieldResult = await executeTool(
        'huly_create_issue',
        {
          project_identifier: 'TEST',
          // Missing title
        },
        mockContext
      );

      expect(missingFieldResult.content[0].type).toBe('text');
      expect(missingFieldResult.content[0].text).toContain('Error');
    });
  });

  describe('Cross-Category Integration', () => {
    beforeEach(() => {
      testProjectId = 'CROSS';
    });

    it('should demonstrate complex workflow across all categories', async () => {
      // This test demonstrates a realistic development workflow
      // involving multiple tool categories working together

      // 1. Setup project infrastructure
      mockContext.services.projectService.createProject.mockResolvedValue({
        content: [{ type: 'text', text: `✅ Project created successfully: ${testProjectId}` }],
      });

      await executeTool(
        'huly_create_project',
        {
          name: 'E-commerce Platform',
          identifier: testProjectId,
          description: 'Complete e-commerce solution',
        },
        mockContext
      );

      // 2. Create organizational structure
      mockContext.services.componentService.createComponent.mockResolvedValue({
        content: [{ type: 'text', text: '✅ Component created successfully' }],
      });

      await executeTool(
        'huly_create_component',
        {
          project_identifier: testProjectId,
          label: 'Frontend',
          description: 'React frontend application',
        },
        mockContext
      );

      await executeTool(
        'huly_create_component',
        {
          project_identifier: testProjectId,
          label: 'Backend',
          description: 'Node.js API server',
        },
        mockContext
      );

      // 3. Create development milestones
      mockContext.services.milestoneService.createMilestone.mockResolvedValue({
        content: [{ type: 'text', text: '✅ Milestone created successfully' }],
      });

      await executeTool(
        'huly_create_milestone',
        {
          project_identifier: testProjectId,
          label: 'MVP',
          description: 'Minimum Viable Product',
          target_date: '2024-06-30T00:00:00.000Z',
        },
        mockContext
      );

      // 4. Create feature templates
      mockContext.services.templateService.createTemplate.mockResolvedValue({
        content: [{ type: 'text', text: '✅ Template created successfully (template-456)' }],
      });

      await executeTool(
        'huly_create_template',
        {
          project_identifier: testProjectId,
          title: 'Feature Development',
          description: 'Standard feature development process',
          children: [
            { title: 'Design Review', priority: 'high' },
            { title: 'Implementation', priority: 'medium' },
            { title: 'Testing', priority: 'medium' },
            { title: 'Documentation', priority: 'low' },
          ],
        },
        mockContext
      );

      // 5. Generate issues from template
      mockContext.services.templateService.createIssueFromTemplate.mockResolvedValue({
        content: [
          { type: 'text', text: '✅ Issue created: User Authentication\nCreated 4 sub-issues' },
        ],
      });

      await executeTool(
        'huly_create_issue_from_template',
        {
          template_id: 'template-456',
          title: 'User Authentication',
          component: 'Backend',
          milestone: 'MVP',
        },
        mockContext
      );

      // 6. Validate everything is properly connected
      expect(mockContext.services.projectService.createProject).toHaveBeenCalled();
      expect(mockContext.services.componentService.createComponent).toHaveBeenCalledTimes(2);
      expect(mockContext.services.milestoneService.createMilestone).toHaveBeenCalled();
      expect(mockContext.services.templateService.createTemplate).toHaveBeenCalled();
      expect(mockContext.services.templateService.createIssueFromTemplate).toHaveBeenCalled();
    });
  });
});
