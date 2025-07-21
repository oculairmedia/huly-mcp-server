/**
 * Integration tests for concurrent bulk operations
 * Verifies that the SequenceService prevents duplicate issue IDs
 * when multiple bulk operations run concurrently
 */

import { jest } from '@jest/globals';
import { IssueService } from '../../src/services/IssueService.js';
import { SequenceService } from '../../src/services/SequenceService.js';
import TemplateService from '../../src/services/TemplateService.js';
import { handler as bulkCreateHandler } from '../../src/tools/issues/bulkCreateIssues.js';
import { handler as bulkDeleteHandler } from '../../src/tools/issues/bulkDeleteIssues.js';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
};

// Mock status manager
const mockStatusManager = {
  getDefaultStatus: jest.fn(),
  normalizeStatus: jest.fn(),
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
      IssueTemplate: 'tracker:class:IssueTemplate',
    },
    ids: {
      NoParent: 'tracker:ids:NoParent',
    },
    taskTypes: {
      Issue: 'tracker:taskTypes:Issue',
    },
  },
}));

jest.mock('@hcengineering/core', () => ({
  default: {
    space: {
      Space: 'core:space:Space',
    },
  },
}));

jest.mock('@hcengineering/chunter', () => ({
  default: {
    class: {
      Comment: 'chunter:class:Comment',
    },
  },
}));

jest.mock('@hcengineering/activity', () => ({
  default: {
    class: {
      DocUpdateMessage: 'activity:class:DocUpdateMessage',
    },
  },
}));

// Mock deletion service - leave empty for now

describe('Concurrent Bulk Operations Integration Tests', () => {
  let sequenceService;
  let issueService;
  let templateService;
  let mockClient;
  let createdIssues;
  let projectSequence;

  beforeEach(() => {
    jest.clearAllMocks();
    createdIssues = new Map();
    projectSequence = 0;

    // Create real services with sequence service
    sequenceService = new SequenceService(mockLogger);
    issueService = new IssueService(mockStatusManager, sequenceService);
    templateService = new TemplateService(mockLogger);
    templateService.sequenceService = sequenceService;

    // Mock client with atomic sequence simulation
    mockClient = {
      findOne: jest.fn().mockImplementation((className, query) => {
        if (className === 'tracker:class:Project') {
          if (query._id === 'test-project-id' || query.identifier === 'TEST') {
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
        if (className === 'tracker:class:IssueTemplate' && query._id === 'template-id') {
          return Promise.resolve({
            _id: 'template-id',
            space: 'test-project-id',
            title: 'Test Template',
            description: 'Template description',
            priority: 2,
            children: [
              { title: 'Child 1', priority: 1 },
              { title: 'Child 2', priority: 2 },
            ],
          });
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
          return Promise.resolve([
            {
              _id: 'status-backlog',
              name: 'Backlog',
              category: 'Backlog',
            },
            {
              _id: 'status-todo',
              name: 'Todo',
              category: 'Todo',
            },
            {
              _id: 'status-in-progress',
              name: 'In Progress',
              category: 'InProgress',
            },
            {
              _id: 'status-done',
              name: 'Done',
              category: 'Done',
            },
          ]);
        }
        if (className === 'tracker:class:Issue') {
          if (query && query.space) {
            return Promise.resolve(
              Array.from(createdIssues.values()).filter((issue) => issue.space === query.space)
            );
          }
          return Promise.resolve(Array.from(createdIssues.values()));
        }
        return Promise.resolve([]);
      }),

      updateDoc: jest.fn().mockImplementation((className, space, docId, operations) => {
        // Simulate atomic increment
        if (operations.$inc && operations.$inc.sequence) {
          projectSequence += operations.$inc.sequence;
          return Promise.resolve({
            object: {
              _id: docId,
              sequence: projectSequence,
            },
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

      createDoc: jest.fn().mockImplementation((className, data) => {
        // For creating issues from templates
        if (className === 'tracker:class:Issue') {
          // Use the sequence service to get a unique number
          projectSequence += 1;
          const identifier = `TEST-${projectSequence}`;
          const issueId = `issue-${identifier}`;
          createdIssues.set(identifier, {
            _id: issueId,
            identifier,
            ...data,
          });
          return Promise.resolve(issueId);
        }
        return Promise.resolve(`doc-${Date.now()}`);
      }),

      uploadMarkup: jest.fn().mockResolvedValue('desc-ref'),

      deleteDoc: jest.fn().mockImplementation((className, space, id) => {
        // Find and remove the issue
        for (const [identifier, issue] of createdIssues) {
          if (issue._id === id) {
            createdIssues.delete(identifier);
            break;
          }
        }
        return Promise.resolve();
      }),
    };

    mockStatusManager.getDefaultStatus.mockResolvedValue({
      _id: 'status-backlog',
      name: 'Backlog',
    });
  });

  describe('Concurrent Bulk Create Operations', () => {
    it('should create unique issue numbers when multiple bulk creates run concurrently', async () => {
      const context = {
        client: mockClient,
        services: { issueService },
        logger: mockLogger,
      };

      // Create 3 concurrent bulk operations, each creating 10 issues
      const bulkOp1 = bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: Array(10)
            .fill(null)
            .map((_, i) => ({
              title: `Bulk 1 Issue ${i + 1}`,
              description: 'Test issue from bulk 1',
            })),
        },
        context
      );

      const bulkOp2 = bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: Array(10)
            .fill(null)
            .map((_, i) => ({
              title: `Bulk 2 Issue ${i + 1}`,
              description: 'Test issue from bulk 2',
            })),
        },
        context
      );

      const bulkOp3 = bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: Array(10)
            .fill(null)
            .map((_, i) => ({
              title: `Bulk 3 Issue ${i + 1}`,
              description: 'Test issue from bulk 3',
            })),
        },
        context
      );

      // Wait for all operations to complete
      const results = await Promise.all([bulkOp1, bulkOp2, bulkOp3]);

      // Verify all operations succeeded
      results.forEach((result, index) => {
        // Check if result is an error
        if (result.content[0].text.startsWith('Error:')) {
          console.error(`Operation ${index} failed:`, result.content[0].text);
          throw new Error(`Operation ${index} failed: ${result.content[0].text}`);
        }
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.summary.succeeded).toBe(10);
        expect(data.summary.failed).toBe(0);
      });

      // Collect all created issue identifiers
      const allIdentifiers = [];
      results.forEach((result) => {
        const data = JSON.parse(result.content[0].text);
        if (data.created_issues && Array.isArray(data.created_issues)) {
          data.created_issues.forEach((issue) => {
            allIdentifiers.push(issue.identifier);
          });
        }
      });

      // Verify we have 30 issues total
      expect(allIdentifiers).toHaveLength(30);

      // Verify all identifiers are unique
      const uniqueIdentifiers = new Set(allIdentifiers);
      expect(uniqueIdentifiers.size).toBe(30);

      // Verify sequential numbering
      const numbers = allIdentifiers.map((id) => parseInt(id.split('-')[1])).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    });

    it('should handle mixed regular issues and subissues concurrently', async () => {
      const context = {
        client: mockClient,
        services: { issueService },
        logger: mockLogger,
      };

      // Create parent issues first
      const parentResult = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: [
            { title: 'Parent 1', description: 'Parent issue 1' },
            { title: 'Parent 2', description: 'Parent issue 2' },
          ],
        },
        context
      );

      const parentData = JSON.parse(parentResult.content[0].text);
      const parent1Id = parentData.created_issues[0].identifier;
      const parent2Id = parentData.created_issues[1].identifier;

      // Create concurrent bulk operations with subissues
      const bulkOp1 = bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: [
            { title: 'Regular Issue 1', description: 'Regular' },
            { parent_issue: parent1Id, title: 'Sub 1-1', description: 'Subissue' },
            { parent_issue: parent1Id, title: 'Sub 1-2', description: 'Subissue' },
          ],
        },
        context
      );

      const bulkOp2 = bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: [
            { parent_issue: parent2Id, title: 'Sub 2-1', description: 'Subissue' },
            { title: 'Regular Issue 2', description: 'Regular' },
            { parent_issue: parent2Id, title: 'Sub 2-2', description: 'Subissue' },
          ],
        },
        context
      );

      const results = await Promise.all([bulkOp1, bulkOp2]);

      // Collect all identifiers from both operations
      const allIdentifiers = [];
      results.forEach((result) => {
        const data = JSON.parse(result.content[0].text);
        if (data.created_issues && Array.isArray(data.created_issues)) {
          data.created_issues.forEach((issue) => {
            allIdentifiers.push(issue.identifier);
          });
        }
      });

      // Verify no duplicates
      const uniqueIdentifiers = new Set(allIdentifiers);
      expect(uniqueIdentifiers.size).toBe(allIdentifiers.length);
    });
  });

  describe('Concurrent Template Operations', () => {
    it('should create unique issue numbers when multiple templates are instantiated concurrently', async () => {
      // Create multiple template instantiations concurrently
      const templateOps = Array(5)
        .fill(null)
        .map((_, i) =>
          templateService.createIssueFromTemplate(mockClient, 'template-id', {
            title: `Template Instance ${i + 1}`,
          })
        );

      await Promise.all(templateOps);

      // Each template creates 3 issues (1 parent + 2 children)
      expect(createdIssues.size).toBe(15);

      // Verify all identifiers are unique
      const identifiers = Array.from(createdIssues.keys());
      const uniqueIdentifiers = new Set(identifiers);
      expect(uniqueIdentifiers.size).toBe(15);

      // Verify sequential numbering
      const numbers = identifiers.map((id) => parseInt(id.split('-')[1])).sort((a, b) => a - b);
      const expectedNumbers = Array.from({ length: 15 }, (_, i) => i + 1);
      expect(numbers).toEqual(expectedNumbers);
    });
  });

  describe('Concurrent Mixed Operations', () => {
    it('should handle concurrent bulk creates, template instantiations, and single creates', async () => {
      const context = {
        client: mockClient,
        services: { issueService },
        logger: mockLogger,
      };

      // Mix of different operations
      const operations = [
        // Bulk create
        bulkCreateHandler(
          {
            project_identifier: 'TEST',
            issues: Array(5)
              .fill(null)
              .map((_, i) => ({
                title: `Bulk Issue ${i + 1}`,
                description: 'From bulk',
              })),
          },
          context
        ),

        // Template instantiation
        templateService.createIssueFromTemplate(mockClient, 'template-id', {
          title: 'From Template 1',
        }),

        // Single issue creates
        issueService.createIssue(mockClient, 'TEST', {
          title: 'Single Issue 1',
          description: 'Description',
        }),
        issueService.createIssue(mockClient, 'TEST', {
          title: 'Single Issue 2',
          description: 'Description',
        }),

        // Another bulk create
        bulkCreateHandler(
          {
            project_identifier: 'TEST',
            issues: Array(3)
              .fill(null)
              .map((_, i) => ({
                title: `Second Bulk Issue ${i + 1}`,
                description: 'From second bulk',
              })),
          },
          context
        ),

        // Another template
        templateService.createIssueFromTemplate(mockClient, 'template-id', {
          title: 'From Template 2',
        }),
      ];

      await Promise.all(operations);

      // Total issues: 5 (bulk) + 3 (template) + 2 (single) + 3 (bulk) + 3 (template) = 16
      expect(createdIssues.size).toBe(16);

      // Verify all identifiers are unique
      const identifiers = Array.from(createdIssues.keys());
      const uniqueIdentifiers = new Set(identifiers);
      expect(uniqueIdentifiers.size).toBe(16);

      // Verify no gaps in numbering
      const numbers = identifiers.map((id) => parseInt(id.split('-')[1])).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    });
  });

  describe('Error Recovery in Concurrent Operations', () => {
    it('should maintain sequence integrity even when some operations fail', async () => {
      const context = {
        client: mockClient,
        services: { issueService },
        logger: mockLogger,
      };

      let callCount = 0;
      // Make some operations fail
      const originalAddCollection = mockClient.addCollection;
      mockClient.addCollection = jest.fn().mockImplementation((...args) => {
        callCount++;
        // Fail every 3rd operation
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Simulated failure'));
        }
        return originalAddCollection(...args);
      });

      // Run concurrent bulk operations
      const operations = Array(3)
        .fill(null)
        .map((_, i) =>
          bulkCreateHandler(
            {
              project_identifier: 'TEST',
              issues: Array(5)
                .fill(null)
                .map((_, j) => ({
                  title: `Batch ${i + 1} Issue ${j + 1}`,
                  description: 'Test',
                })),
              _options: { continue_on_error: true },
            },
            context
          )
        );

      const results = await Promise.all(operations);

      // Collect successful issues
      const successfulIdentifiers = [];
      results.forEach((result) => {
        const data = JSON.parse(result.content[0].text);
        if (data.created_issues && Array.isArray(data.created_issues)) {
          data.created_issues.forEach((issue) => {
            successfulIdentifiers.push(issue.identifier);
          });
        }
      });

      // Verify all successful identifiers are unique
      const uniqueIdentifiers = new Set(successfulIdentifiers);
      expect(uniqueIdentifiers.size).toBe(successfulIdentifiers.length);

      // Verify no duplicate numbers were used
      const numbers = successfulIdentifiers.map((id) => parseInt(id.split('-')[1]));
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(numbers.length);
    });
  });

  describe('High Concurrency Stress Test', () => {
    it('should maintain uniqueness under high concurrency load', async () => {
      const context = {
        client: mockClient,
        services: { issueService },
        logger: mockLogger,
      };

      // Create 10 concurrent bulk operations, each with 20 issues
      const operations = Array(10)
        .fill(null)
        .map((_, i) =>
          bulkCreateHandler(
            {
              project_identifier: 'TEST',
              issues: Array(20)
                .fill(null)
                .map((_, j) => ({
                  title: `Load Test ${i}-${j}`,
                  description: 'High concurrency test',
                })),
              _options: {
                batch_size: 5, // Smaller batches to increase concurrency
              },
            },
            context
          )
        );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      console.log(`Created 200 issues in ${duration}ms`);

      // Check if any operations failed
      results.forEach((result, index) => {
        const data = JSON.parse(result.content[0].text);
        if (!data.success) {
          console.error(`Operation ${index} failed:`, data);
        }
      });

      // Verify all 200 issues were created
      expect(createdIssues.size).toBe(200);

      // Verify all identifiers are unique
      const identifiers = Array.from(createdIssues.keys());
      const uniqueIdentifiers = new Set(identifiers);
      expect(uniqueIdentifiers.size).toBe(200);

      // Verify sequential numbering with no gaps
      const numbers = identifiers.map((id) => parseInt(id.split('-')[1])).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: 200 }, (_, i) => i + 1));

      // Verify no number was used twice
      const numberSet = new Set(numbers);
      expect(numberSet.size).toBe(200);
    });
  });

  describe('Concurrent Delete and Create Operations', () => {
    it('should handle concurrent deletes and creates without conflicts', async () => {
      // Create a mock deletion service
      const mockDeletionService = {
        bulkDeleteIssues: jest.fn().mockImplementation(async (client, identifiers, _options) => {
          // Remove issues from our mock storage
          let deletedCount = 0;
          identifiers.forEach((id) => {
            if (createdIssues.has(id)) {
              createdIssues.delete(id);
              deletedCount++;
            }
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  summary: {
                    total: identifiers.length,
                    succeeded: deletedCount,
                    failed: identifiers.length - deletedCount,
                  },
                }),
              },
            ],
          };
        }),
      };

      const context = {
        client: mockClient,
        services: {
          issueService,
          deletionService: mockDeletionService,
        },
        logger: mockLogger,
      };

      // First create some issues
      const initialResult = await bulkCreateHandler(
        {
          project_identifier: 'TEST',
          issues: Array(10)
            .fill(null)
            .map((_, i) => ({
              title: `Initial Issue ${i + 1}`,
              description: 'To be deleted',
            })),
        },
        context
      );

      const initialData = JSON.parse(initialResult.content[0].text);
      const toDelete = initialData.created_issues.slice(0, 5).map((i) => i.identifier);

      // Run concurrent delete and create operations
      const operations = [
        // Delete some issues
        bulkDeleteHandler(
          {
            issue_identifiers: toDelete,
          },
          context
        ),

        // Create new issues at the same time
        bulkCreateHandler(
          {
            project_identifier: 'TEST',
            issues: Array(10)
              .fill(null)
              .map((_, i) => ({
                title: `New Issue ${i + 1}`,
                description: 'Created during delete',
              })),
          },
          context
        ),
      ];

      const results = await Promise.all(operations);

      // Verify delete succeeded
      const deleteResult = JSON.parse(results[0].content[0].text);
      expect(deleteResult.summary.succeeded).toBe(5);

      // Verify create succeeded with new unique numbers
      const createResult = JSON.parse(results[1].content[0].text);
      expect(createResult.summary.succeeded).toBe(10);

      // Check that new issues have unique numbers starting after the initial batch
      const newNumbers = createResult.created_issues
        .map((i) => parseInt(i.identifier.split('-')[1]))
        .sort((a, b) => a - b);

      expect(newNumbers[0]).toBeGreaterThan(10); // Should continue after initial 10
      expect(new Set(newNumbers).size).toBe(10); // All unique
    });
  });
});
