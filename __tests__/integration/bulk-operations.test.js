import { HulyClient } from '../../src/client/HulyClient.js';
import { getConfigManager } from '../../src/config/index.js';
import { createLoggerWithConfig } from '../../src/utils/logger.js';
import { createServices } from '../../src/services/index.js';
import {
  setupTestEnvironment,
  generateTestProjectIdentifier,
  generateTestIssueData,
  cleanupTestResources,
  trackResource,
  waitForCondition,
  expectToBeIssue,
} from './setup.js';

describe('Bulk Operations Integration Tests', () => {
  let client;
  let services;
  let config;
  let logger;
  let testProjectId;

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

    // Create services
    services = createServices(logger);
  });

  beforeEach(async () => {
    // Create a fresh test project for each test
    testProjectId = generateTestProjectIdentifier();
    const projectData = {
      name: `Bulk Test ${testProjectId}`,
      identifier: testProjectId,
      description: 'Project for bulk operations testing',
    };

    await services.projectService.createProject(client, projectData);
    trackResource('projects', testProjectId);
  });

  afterAll(async () => {
    // Cleanup all test resources
    await cleanupTestResources(client, services);

    // Close connections
    if (client) {
      await client.close();
    }
  });

  describe('Bulk Create Issues', () => {
    it('should create multiple issues with defaults', async () => {
      // Create component and milestone first
      await services.componentService.createComponent(client, testProjectId, {
        label: 'Backend',
        description: 'Backend components',
      });

      await services.milestoneService.createMilestone(client, testProjectId, {
        label: 'v1.0',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          defaults: {
            component: 'Backend',
            milestone: 'v1.0',
            priority: 'medium',
          },
          issues: [
            { title: 'API endpoint /users' },
            { title: 'API endpoint /products' },
            { title: 'API endpoint /orders', priority: 'high' }, // Override default
          ],
        }
      );

      expect(result.success).toBe(true);
      expect(result.created).toBe(3);
      expect(result.failed).toBe(0);

      // Verify issues were created with defaults
      const issues = await services.issueService.listIssues(client, testProjectId);
      const createdIssues = issues.filter((issue) =>
        issue.title.startsWith('API endpoint')
      );

      expect(createdIssues).toHaveLength(3);
      createdIssues.forEach((issue) => {
        expectToBeIssue(issue);
        expect(issue.component?.label).toBe('Backend');
        expect(issue.milestone?.label).toBe('v1.0');
        trackResource('issues', issue.identifier);
      });

      // Check priority override
      const ordersIssue = createdIssues.find((i) => i.title.includes('/orders'));
      expect(ordersIssue.priority).toBe('high');
    });

    it('should create sub-issues in bulk', async () => {
      // Create parent issue
      const parentResult = await services.issueService.createIssue(client, testProjectId, {
        title: 'Epic: Implement user authentication',
        priority: 'high',
      });
      trackResource('issues', parentResult.identifier);

      // Bulk create sub-issues
      const result = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: [
            {
              title: 'Design authentication flow',
              parent_issue: parentResult.identifier,
            },
            {
              title: 'Implement login endpoint',
              parent_issue: parentResult.identifier,
            },
            {
              title: 'Implement logout endpoint',
              parent_issue: parentResult.identifier,
            },
            {
              title: 'Add session management',
              parent_issue: parentResult.identifier,
            },
          ],
        }
      );

      expect(result.success).toBe(true);
      expect(result.created).toBe(4);

      // Verify parent-child relationships
      const parentDetails = await services.issueService.getIssueDetails(
        client,
        parentResult.identifier
      );
      expect(parentDetails.subIssues).toHaveLength(4);

      // Track sub-issues
      result.results.forEach((r) => {
        if (r.success) {
          trackResource('issues', r.identifier);
        }
      });
    });

    it('should handle partial failures with continue_on_error', async () => {
      const result = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: [
            { title: 'Valid issue 1' },
            { title: '' }, // Invalid - empty title
            { title: 'Valid issue 2' },
            { parent_issue: 'INVALID-999' }, // Invalid - missing title
            { title: 'Valid issue 3' },
          ],
          options: {
            continue_on_error: true,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.created).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.results.filter((r) => r.success)).toHaveLength(3);
      expect(result.results.filter((r) => !r.success)).toHaveLength(2);

      // Track successful issues
      result.results.forEach((r) => {
        if (r.success) {
          trackResource('issues', r.identifier);
        }
      });
    });

    it('should validate data in dry run mode', async () => {
      const result = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: [
            { title: 'Test issue 1' },
            { title: 'Test issue 2' },
            { title: '' }, // Invalid
          ],
          options: {
            dry_run: true,
            continue_on_error: true,
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.created).toBe(0); // Nothing actually created
      expect(result.validated).toBe(2);
      expect(result.failed).toBe(1);

      // Verify nothing was created
      const issues = await services.issueService.listIssues(client, testProjectId);
      expect(issues.filter((i) => i.title.startsWith('Test issue'))).toHaveLength(0);
    });

    it('should respect batch size for large operations', async () => {
      const issues = Array.from({ length: 25 }, (_, i) => ({
        title: `Batch test issue ${i + 1}`,
        description: `Issue number ${i + 1}`,
      }));

      const startTime = Date.now();
      const result = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues,
          options: {
            batch_size: 5, // Process 5 at a time
          },
        }
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.created).toBe(25);
      expect(result.batches).toBe(5); // 25 issues / 5 per batch
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeLessThanOrEqual(duration);

      // Track all created issues
      result.results.forEach((r) => {
        if (r.success) {
          trackResource('issues', r.identifier);
        }
      });
    });
  });

  describe('Bulk Update Issues', () => {
    let issueIds;

    beforeEach(async () => {
      // Create test issues
      const createResult = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: [
            { title: 'Update test 1', priority: 'low' },
            { title: 'Update test 2', priority: 'medium' },
            { title: 'Update test 3', priority: 'high' },
            { title: 'Update test 4', priority: 'low' },
            { title: 'Update test 5', priority: 'medium' },
          ],
        }
      );

      issueIds = createResult.results.map((r) => r.identifier);
      issueIds.forEach((id) => trackResource('issues', id));
    });

    it('should update multiple issues with different fields', async () => {
      const result = await services.issueService.bulkUpdateIssues(client, {
        updates: [
          {
            issue_identifier: issueIds[0],
            field: 'status',
            value: 'in-progress',
          },
          {
            issue_identifier: issueIds[1],
            field: 'priority',
            value: 'urgent',
          },
          {
            issue_identifier: issueIds[2],
            field: 'title',
            value: 'Updated title for issue 3',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);

      // Verify updates
      const issue1 = await services.issueService.getIssueDetails(client, issueIds[0]);
      expect(issue1.status).toBe('In Progress');

      const issue2 = await services.issueService.getIssueDetails(client, issueIds[1]);
      expect(issue2.priority).toBe('urgent');

      const issue3 = await services.issueService.getIssueDetails(client, issueIds[2]);
      expect(issue3.title).toBe('Updated title for issue 3');
    });

    it('should batch update same field across multiple issues', async () => {
      // Create milestone
      await services.milestoneService.createMilestone(client, testProjectId, {
        label: 'Sprint 1',
        targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = await services.issueService.bulkUpdateIssues(client, {
        updates: issueIds.map((id) => ({
          issue_identifier: id,
          field: 'milestone',
          value: 'Sprint 1',
        })),
      });

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(issueIds.length);

      // Verify all issues have the milestone
      for (const id of issueIds) {
        const issue = await services.issueService.getIssueDetails(client, id);
        expect(issue.milestone?.label).toBe('Sprint 1');
      }
    });

    it('should handle validation in dry run mode', async () => {
      const result = await services.issueService.bulkUpdateIssues(client, {
        updates: [
          {
            issue_identifier: issueIds[0],
            field: 'status',
            value: 'done',
          },
          {
            issue_identifier: 'INVALID-999',
            field: 'status',
            value: 'done',
          },
        ],
        options: {
          dry_run: true,
          continue_on_error: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);

      // Verify nothing was actually updated
      const issue = await services.issueService.getIssueDetails(client, issueIds[0]);
      expect(issue.status).not.toBe('Done');
    });

    it('should normalize field values', async () => {
      const result = await services.issueService.bulkUpdateIssues(client, {
        updates: [
          {
            issue_identifier: issueIds[0],
            field: 'status',
            value: 'IN-PROGRESS', // Should normalize to 'in-progress'
          },
          {
            issue_identifier: issueIds[1],
            field: 'priority',
            value: 'URGENT', // Should normalize to 'urgent'
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(2);

      const issue1 = await services.issueService.getIssueDetails(client, issueIds[0]);
      expect(issue1.status).toBe('In Progress');

      const issue2 = await services.issueService.getIssueDetails(client, issueIds[1]);
      expect(issue2.priority).toBe('urgent');
    });
  });

  describe('Bulk Delete Issues', () => {
    let issueIds;
    let parentId;

    beforeEach(async () => {
      // Create parent with sub-issues
      const parent = await services.issueService.createIssue(client, testProjectId, {
        title: 'Parent issue for deletion test',
      });
      parentId = parent.identifier;
      trackResource('issues', parentId);

      // Create sub-issues
      const subResults = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: [
            { title: 'Sub-issue 1', parent_issue: parentId },
            { title: 'Sub-issue 2', parent_issue: parentId },
          ],
        }
      );

      // Create standalone issues
      const standaloneResults = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: [
            { title: 'Standalone 1' },
            { title: 'Standalone 2' },
            { title: 'Standalone 3' },
          ],
        }
      );

      issueIds = [
        parentId,
        ...subResults.results.map((r) => r.identifier),
        ...standaloneResults.results.map((r) => r.identifier),
      ];

      // Track all but parent (we'll test cascade deletion)
      subResults.results.forEach((r) => trackResource('issues', r.identifier));
      standaloneResults.results.forEach((r) => trackResource('issues', r.identifier));
    });

    it('should delete multiple issues with cascade', async () => {
      const result = await services.deletionService.bulkDeleteIssues(
        client,
        [parentId, issueIds[5]], // Parent and one standalone
        {
          cascade: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.totalRequested).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.deletedCount).toBe(4); // Parent + 2 sub-issues + 1 standalone

      // Verify deletion
      await expect(
        services.issueService.getIssueDetails(client, parentId)
      ).rejects.toThrow();

      // Verify sub-issues were deleted
      await expect(
        services.issueService.getIssueDetails(client, issueIds[1])
      ).rejects.toThrow();
    });

    it('should preview deletion in dry run mode', async () => {
      const result = await services.deletionService.bulkDeleteIssues(
        client,
        [parentId],
        {
          cascade: true,
          dryRun: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.totalRequested).toBe(1);
      expect(result.wouldDelete).toBeGreaterThanOrEqual(3); // Parent + sub-issues

      // Verify nothing was deleted
      const issue = await services.issueService.getIssueDetails(client, parentId);
      expect(issue).toBeDefined();
    });

    it('should handle mixed success/failure scenarios', async () => {
      const result = await services.deletionService.bulkDeleteIssues(
        client,
        [
          issueIds[3], // Valid standalone
          'INVALID-999', // Non-existent
          issueIds[4], // Valid standalone
        ],
        {
          continueOnError: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.totalRequested).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);

      // Check failed issues
      const failedResult = result.results.find((r) => !r.success);
      expect(failedResult.issueIdentifier).toBe('INVALID-999');
      expect(failedResult.error).toContain('not found');
    });

    it('should respect batch size for large deletions', async () => {
      // Create more issues
      const moreIssues = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: Array.from({ length: 20 }, (_, i) => ({
            title: `Bulk delete test ${i}`,
          })),
        }
      );

      const allIds = [
        ...issueIds,
        ...moreIssues.results.map((r) => r.identifier),
      ];

      // Track new issues
      moreIssues.results.forEach((r) => trackResource('issues', r.identifier));

      const result = await services.deletionService.bulkDeleteIssues(
        client,
        allIds,
        {
          batchSize: 5,
          cascade: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.batches).toBeGreaterThan(1);
      expect(result.deletedCount).toBeGreaterThanOrEqual(allIds.length);
    });
  });

  describe('Complex Bulk Scenarios', () => {
    it('should handle bulk operations on large datasets', async () => {
      // Create 100 issues
      const createResult = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: Array.from({ length: 100 }, (_, i) => ({
            title: `Large dataset issue ${i + 1}`,
            priority: ['low', 'medium', 'high', 'urgent'][i % 4],
          })),
          options: {
            batch_size: 20,
          },
        }
      );

      expect(createResult.success).toBe(true);
      expect(createResult.created).toBe(100);

      const issueIds = createResult.results.map((r) => r.identifier);
      issueIds.forEach((id) => trackResource('issues', id));

      // Update all to in-progress
      const updateResult = await services.issueService.bulkUpdateIssues(client, {
        updates: issueIds.map((id) => ({
          issue_identifier: id,
          field: 'status',
          value: 'in-progress',
        })),
        options: {
          batch_size: 25,
        },
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.succeeded).toBe(100);

      // Search to verify
      const inProgressIssues = await services.issueService.searchIssues(client, {
        project_identifier: testProjectId,
        status: 'In Progress',
        limit: 150,
      });

      expect(inProgressIssues.length).toBeGreaterThanOrEqual(100);
    });

    it('should maintain data integrity during concurrent bulk operations', async () => {
      // Create initial issues
      const createResult = await services.issueService.bulkCreateIssues(
        client,
        testProjectId,
        {
          issues: Array.from({ length: 10 }, (_, i) => ({
            title: `Concurrent test ${i}`,
            priority: 'medium',
          })),
        }
      );

      const issueIds = createResult.results.map((r) => r.identifier);
      issueIds.forEach((id) => trackResource('issues', id));

      // Run concurrent updates
      const updatePromises = [
        // Update half to high priority
        services.issueService.bulkUpdateIssues(client, {
          updates: issueIds.slice(0, 5).map((id) => ({
            issue_identifier: id,
            field: 'priority',
            value: 'high',
          })),
        }),
        // Update other half to done status
        services.issueService.bulkUpdateIssues(client, {
          updates: issueIds.slice(5).map((id) => ({
            issue_identifier: id,
            field: 'status',
            value: 'done',
          })),
        }),
      ];

      const results = await Promise.all(updatePromises);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Verify final state
      for (let i = 0; i < 5; i++) {
        const issue = await services.issueService.getIssueDetails(client, issueIds[i]);
        expect(issue.priority).toBe('high');
      }

      for (let i = 5; i < 10; i++) {
        const issue = await services.issueService.getIssueDetails(client, issueIds[i]);
        expect(issue.status).toBe('Done');
      }
    });
  });
});