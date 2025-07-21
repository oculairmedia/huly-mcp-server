/**
 * Unit tests for bulk operations functionality
 * Tests bulk create, update, and delete operations with proper mocking
 */

import { jest } from '@jest/globals';
import { handler as bulkCreateHandler } from '../../../src/tools/issues/bulkCreateIssues.js';
import { handler as bulkUpdateHandler } from '../../../src/tools/issues/bulkUpdateIssues.js';
import { handler as bulkDeleteHandler } from '../../../src/tools/issues/bulkDeleteIssues.js';
import { IssueService } from '../../../src/services/IssueService.js';
import { DeletionService } from '../../../src/services/DeletionService.js';
import { SequenceService } from '../../../src/services/SequenceService.js';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
};

// Mock _status manager
const mockStatusManager = {
  getDefaultStatus: jest.fn(),
  normalizeStatus: jest.fn(),
  toHumanStatus: jest.fn((status) => status),
  getStatusDescription: jest.fn((_status) => 'Status description'),
};

// Mock Huly modules
jest.mock('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
      IssueStatus: 'tracker:class:IssueStatus',
      Component: 'tracker:class:Component',
      Milestone: 'tracker:class:Milestone',
    },
    ids: {
      NoParent: 'tracker:ids:NoParent',
    },
  },
}));

jest.mock('@hcengineering/core', () => ({
  default: {
    space: {
      Space: 'core:space:Space',
    },
    class: {
      Account: 'core:class:Account',
    },
  },
}));

describe('Bulk Operations Unit Tests', () => {
  let mockClient;
  let issueService;
  let deletionService;
  let sequenceService;
  let context;
  let createdIssues;
  let projectSequence;

  beforeEach(() => {
    jest.clearAllMocks();
    createdIssues = new Map();
    projectSequence = 0;

    // Create services
    sequenceService = new SequenceService(mockLogger);
    issueService = new IssueService(mockStatusManager, sequenceService);
    deletionService = new DeletionService();

    // Mock client
    mockClient = {
      findOne: jest.fn().mockImplementation((className, query) => {
        if (className === 'tracker:class:Project') {
          if (query.identifier === 'TEST' || query._id === 'test-project-id') {
            return Promise.resolve({
              _id: 'test-project-id',
              identifier: 'TEST',
              name: 'Test Project',
              space: 'test-space',
              sequence: projectSequence,
            });
          }
        }
        if (className === 'tracker:class:Issue' && query.identifier) {
          return Promise.resolve(createdIssues.get(query.identifier));
        }
        if (className === 'tracker:class:IssueStatus') {
          return Promise.resolve({
            _id: 'status-backlog',
            name: 'Backlog',
            category: 'Backlog',
          });
        }
        return Promise.resolve(null);
      }),

      findAll: jest.fn().mockImplementation((className, query) => {
        if (className === 'tracker:class:IssueStatus') {
          // Return statuses for any query (project space or model space)
          return Promise.resolve([
            { _id: 'status-backlog', name: 'Backlog', category: 'Backlog' },
            { _id: 'status-todo', name: 'Todo', category: 'Todo' },
            { _id: 'status-in-progress', name: 'In Progress', category: 'InProgress' },
            { _id: 'status-done', name: 'Done', category: 'Done' },
          ]);
        }
        if (className === 'tracker:class:Issue') {
          if (query && query.space) {
            return Promise.resolve(
              Array.from(createdIssues.values()).filter((issue) => issue.space === query.space)
            );
          }
          if (query && query.parentIssue) {
            return Promise.resolve(
              Array.from(createdIssues.values()).filter((i) => i.parentIssue === query.parentIssue)
            );
          }
          return Promise.resolve(Array.from(createdIssues.values()));
        }
        return Promise.resolve([]);
      }),

      updateDoc: jest.fn().mockImplementation((className, space, docId, operations) => {
        if (operations.$inc && operations.$inc.sequence) {
          projectSequence += operations.$inc.sequence;
          return Promise.resolve({
            object: {
              _id: docId,
              sequence: projectSequence,
            },
          });
        }
        // Handle regular updates
        const issue = Array.from(createdIssues.values()).find((i) => i._id === docId);
        if (issue && operations) {
          Object.entries(operations).forEach(([key, value]) => {
            if (key !== '$inc') {
              issue[key] = value;
            }
          });
        }
        return Promise.resolve({});
      }),

      addCollection: jest
        .fn()
        .mockImplementation((className, space, parent, parentClass, collection, data) => {
          const issueId = `issue-${data.identifier}`;
          createdIssues.set(data.identifier, {
            _id: issueId,
            ...data,
            space: space,
          });
          return Promise.resolve(issueId);
        }),

      uploadMarkup: jest.fn().mockResolvedValue('desc-ref'),

      removeDoc: jest.fn().mockImplementation((className, space, id) => {
        // Find and remove the issue
        for (const [identifier, issue] of createdIssues) {
          if (issue._id === id) {
            createdIssues.delete(identifier);
            break;
          }
        }
        return Promise.resolve();
      }),

      removeCollection: jest.fn().mockResolvedValue(),
    };

    mockStatusManager.getDefaultStatus.mockResolvedValue({
      _id: 'status-backlog',
      name: 'Backlog',
    });

    // Create context for tool handlers
    context = {
      client: mockClient,
      services: {
        issueService,
        deletionService,
      },
      logger: mockLogger,
    };
  });

  describe('Bulk Create Issues', () => {
    it('should create multiple issues with defaults', async () => {
      const result = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          defaults: {
            priority: 'medium',
          },
          issues: [
            { title: 'API endpoint /users' },
            { title: 'API endpoint /products' },
            { title: 'API endpoint /orders', priority: 'high' }, // Override default
          ],
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBe(3);
      expect(data.summary.failed).toBe(0);

      // Verify issues were created
      expect(createdIssues.size).toBe(3);

      // Check that defaults were applied
      const users = Array.from(createdIssues.values()).find(
        (i) => i.title === 'API endpoint /users'
      );
      expect(users.priority).toBe(3); // Medium priority

      const orders = Array.from(createdIssues.values()).find(
        (i) => i.title === 'API endpoint /orders'
      );
      expect(orders.priority).toBe(2); // High priority (override)
    });

    it('should create sub-issues in bulk', async () => {
      // Create parent issue first
      const parentId = 'issue-TEST-1';
      createdIssues.set('TEST-1', {
        _id: parentId,
        identifier: 'TEST-1',
        title: 'Epic: Implement user authentication',
        space: 'test-project-id',
      });

      const result = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: [
            {
              title: 'Design authentication flow',
              parent_issue: 'TEST-1',
            },
            {
              title: 'Implement login endpoint',
              parent_issue: 'TEST-1',
            },
            {
              title: 'Implement logout endpoint',
              parent_issue: 'TEST-1',
            },
          ],
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBe(3);

      // Verify parent-child relationships
      const subIssues = data.created_issues.filter((i) => i.parent_issue === 'TEST-1');
      expect(subIssues).toHaveLength(3);
    });

    it('should handle partial failures with continue_on_error', async () => {
      const result = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: [
            { title: 'Valid issue 1' },
            { title: '' }, // Invalid - empty title
            { title: 'Valid issue 2' },
            { parent_issue: 'INVALID-999', title: 'Issue with invalid parent' },
            { title: 'Valid issue 3' },
          ],
          options: {
            continue_on_error: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBeGreaterThanOrEqual(3); // At least the valid issues
      expect(data.summary.failed).toBeGreaterThanOrEqual(1); // At least the empty title
    });

    it('should validate data in dry run mode', async () => {
      const result = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: [
            { title: 'Test issue 1' },
            { title: 'Test issue 2' },
            { title: '' }, // Invalid
          ],
          options: {
            dry_run: true,
            continue_on_error: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.dry_run).toBe(true);
      expect(data.validation.valid_count).toBe(2);
      expect(data.validation.invalid_count).toBe(1);

      // Verify nothing was created
      expect(createdIssues.size).toBe(0);
    });

    it('should respect batch size for large operations', async () => {
      const issues = Array.from({ length: 25 }, (_, i) => ({
        title: `Batch test issue ${i + 1}`,
        description: `Issue number ${i + 1}`,
      }));

      const result = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues,
          options: {
            batch_size: 5, // Process 5 at a time
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBe(25);
      expect(data.summary.batch_count).toBe(5); // 25 issues / 5 per batch
    });
  });

  describe('Bulk Update Issues', () => {
    beforeEach(async () => {
      // Create test issues
      for (let i = 1; i <= 5; i++) {
        const identifier = `TEST-${i}`;
        createdIssues.set(identifier, {
          _id: `issue-${identifier}`,
          identifier,
          title: `Update test ${i}`,
          priority: i % 2 === 0 ? 3 : 4, // Alternate between medium and low
          status: 'status-backlog',
          space: 'test-project-id',
        });
      }
    });

    it('should update multiple issues with different fields', async () => {
      const result = await bulkUpdateHandler(
        {
          updates: [
            {
              issue_identifier: 'TEST-1',
              field: 'status',
              value: 'in-progress',
            },
            {
              issue_identifier: 'TEST-2',
              field: 'priority',
              value: 'urgent',
            },
            {
              issue_identifier: 'TEST-3',
              field: 'title',
              value: 'Updated title for issue 3',
            },
          ],
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(3);
      expect(data.summary.succeeded).toBe(3);
      expect(data.summary.failed).toBe(0);

      // Verify updates
      const issue2 = createdIssues.get('TEST-2');
      expect(issue2.priority).toBe(1); // Urgent priority

      const issue3 = createdIssues.get('TEST-3');
      expect(issue3.title).toBe('Updated title for issue 3');
    });

    it('should handle invalid fields gracefully', async () => {
      const result = await bulkUpdateHandler(
        {
          updates: [
            {
              issue_identifier: 'TEST-1',
              field: 'invalid_field', // Invalid field
              value: 'some value',
            },
            {
              issue_identifier: 'TEST-2',
              field: 'priority',
              value: 'invalid_priority', // Invalid value
            },
            {
              issue_identifier: 'TEST-3',
              field: 'title',
              value: 'Valid update',
            },
          ],
          options: {
            continue_on_error: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.summary.failed).toBeGreaterThanOrEqual(2);
      expect(data.summary.succeeded).toBeGreaterThanOrEqual(1);
    });

    it('should perform dry run for updates', async () => {
      const originalTitle = createdIssues.get('TEST-1').title;

      const result = await bulkUpdateHandler(
        {
          updates: [
            {
              issue_identifier: 'TEST-1',
              field: 'title',
              value: 'Dry run title',
            },
            {
              issue_identifier: 'TEST-2',
              field: 'priority',
              value: 'urgent',
            },
          ],
          options: {
            dry_run: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.dry_run).toBe(true);
      expect(data.validation.total).toBe(2);

      // Verify no actual updates
      expect(createdIssues.get('TEST-1').title).toBe(originalTitle);
    });
  });

  describe('Bulk Delete Issues', () => {
    beforeEach(async () => {
      // Create test issues including parent-child relationships
      for (let i = 1; i <= 4; i++) {
        const identifier = `TEST-${i}`;
        createdIssues.set(identifier, {
          _id: `issue-${identifier}`,
          identifier,
          title: i === 4 ? 'Parent issue' : `Delete test ${i}`,
          space: 'test-project-id',
        });
      }

      // Create sub-issues
      createdIssues.set('TEST-5', {
        _id: 'issue-TEST-5',
        identifier: 'TEST-5',
        title: 'Sub-issue 1',
        parentIssue: 'issue-TEST-4',
        space: 'test-project-id',
      });
      createdIssues.set('TEST-6', {
        _id: 'issue-TEST-6',
        identifier: 'TEST-6',
        title: 'Sub-issue 2',
        parentIssue: 'issue-TEST-4',
        space: 'test-project-id',
      });
    });

    it('should delete multiple issues', async () => {
      const toDelete = ['TEST-1', 'TEST-2', 'TEST-3'];
      const result = await bulkDeleteHandler(
        {
          issue_identifiers: toDelete,
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.succeeded).toBe(3);
      expect(data.summary.failed).toBe(0);

      // Verify issues are deleted
      toDelete.forEach((id) => {
        expect(createdIssues.has(id)).toBe(false);
      });

      // Verify other issues remain
      expect(createdIssues.has('TEST-4')).toBe(true);
    });

    it('should handle cascade deletion', async () => {
      // Mock findAll to return sub-issues when querying by parent
      mockClient.findAll.mockImplementation((className, query) => {
        if (className === 'tracker:class:Issue' && query.parentIssue) {
          return Promise.resolve(
            Array.from(createdIssues.values()).filter((i) => i.parentIssue === query.parentIssue)
          );
        }
        return Promise.resolve([]);
      });

      const result = await bulkDeleteHandler(
        {
          issue_identifiers: ['TEST-4'], // Parent issue
          options: {
            cascade: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.succeeded).toBeGreaterThanOrEqual(1); // At least the parent

      // Verify parent is deleted
      expect(createdIssues.has('TEST-4')).toBe(false);
    });

    it('should perform dry run for deletions', async () => {
      const toDelete = ['TEST-1', 'TEST-2'];
      const result = await bulkDeleteHandler(
        {
          issue_identifiers: toDelete,
          options: {
            dry_run: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.dry_run).toBe(true);

      // Verify no actual deletions
      toDelete.forEach((id) => {
        expect(createdIssues.has(id)).toBe(true);
      });
    });

    it('should continue on error', async () => {
      const toDelete = [
        'TEST-1',
        'INVALID-999', // Non-existent issue
        'TEST-2',
      ];

      const result = await bulkDeleteHandler(
        {
          issue_identifiers: toDelete,
          options: {
            continue_on_error: true,
          },
        },
        context
      );

      const data = JSON.parse(result.content[0].text);
      expect(data.summary.total).toBe(3);
      expect(data.summary.succeeded).toBe(2);
      expect(data.summary.failed).toBe(1);
    });
  });

  describe('Mixed Bulk Operations', () => {
    it('should handle concurrent bulk operations', async () => {
      // Run multiple bulk operations concurrently
      const operations = [
        // Create issues
        bulkCreateHandler(
          {
            project_identifier: 'TEST',
            issues: Array.from({ length: 10 }, (_, i) => ({
              title: `Concurrent test ${i + 1}`,
            })),
          },
          context
        ),
        // Create more issues
        bulkCreateHandler(
          {
            project_identifier: 'TEST',
            issues: Array.from({ length: 10 }, (_, i) => ({
              title: `Another concurrent test ${i + 1}`,
            })),
          },
          context
        ),
      ];

      const results = await Promise.all(operations);

      // Verify both operations succeeded
      results.forEach((result) => {
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.summary.succeeded).toBe(10);
      });

      // Verify total issues created
      expect(createdIssues.size).toBeGreaterThanOrEqual(20);

      // Verify all identifiers are unique
      const identifiers = Array.from(createdIssues.keys());
      const uniqueIdentifiers = new Set(identifiers);
      expect(uniqueIdentifiers.size).toBe(identifiers.length);
    });
  });
});
