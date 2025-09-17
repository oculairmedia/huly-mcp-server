/**
 * Tests for the comprehensive Huly Client Mock
 *
 * This test file validates that the new mock system provides
 * all required methods and realistic behavior patterns.
 */

import { jest } from '@jest/globals';
import { createMockHulyClient, createBasicMockClient, mockClients } from '../hulyClient.mock.js';

describe('HulyClient Mock System', () => {
  describe('createMockHulyClient', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockHulyClient();
    });

    afterEach(() => {
      mockClient._clearMockStats();
    });

    describe('Core query methods', () => {
      it('should provide findOne with realistic responses', async () => {
        const project = await mockClient.findOne('tracker:class:Project', { identifier: 'TEST' });

        expect(project).toHaveProperty('_id');
        expect(project).toHaveProperty('identifier', 'TEST');
        expect(project).toHaveProperty('name', 'Mock Project TEST');
        expect(project).toHaveProperty('createdOn');
        expect(project).toHaveProperty('modifiedOn');
      });

      it('should provide findAll with arrays of mock objects', async () => {
        const issues = await mockClient.findAll('tracker:class:Issue', { space: 'project-123' });

        expect(Array.isArray(issues)).toBe(true);
        expect(issues).toHaveLength(5); // Default mock count
        issues.forEach((issue) => {
          expect(issue).toHaveProperty('_id');
          expect(issue).toHaveProperty('identifier');
          expect(issue).toHaveProperty('title');
        });
      });

      it('should return null for not found queries', async () => {
        const notFound = await mockClient.findOne('tracker:class:Issue', { _id: 'notfound-123' });
        expect(notFound).toBeNull();
      });
    });

    describe('Document lifecycle methods', () => {
      it('should provide createDoc method', async () => {
        const docId = await mockClient.createDoc('tracker:class:Project', 'core:space:Space', {
          name: 'Test Project',
        });

        expect(typeof docId).toBe('string');
        expect(docId).toMatch(/^doc-/);
      });

      it('should provide updateDoc method', async () => {
        const result = await mockClient.updateDoc(
          'tracker:class:Project',
          'core:space:Space',
          'project-123',
          { name: 'Updated Project' }
        );

        expect(result).toHaveProperty('success', true);
      });

      it('should provide removeDoc method', async () => {
        const result = await mockClient.removeDoc(
          'tracker:class:Project',
          'core:space:Space',
          'project-123'
        );

        expect(result).toHaveProperty('success', true);
      });
    });

    describe('Collection methods (NEW)', () => {
      it('should provide addCollection method for AttachedDoc creation', async () => {
        const issueId = await mockClient.addCollection(
          'tracker:class:Issue',
          'project-space',
          'parent-id',
          'tracker:class:Issue',
          'subIssues',
          {
            title: 'Test Issue',
            description: 'Test description',
            priority: 2,
          }
        );

        expect(typeof issueId).toBe('string');
        expect(issueId).toMatch(/^collection-/);

        // Verify it was stored in mock store
        const stored = mockClient._getMockStore('issues').get(issueId);
        expect(stored).toHaveProperty('title', 'Test Issue');
        expect(stored).toHaveProperty('attachedTo', 'parent-id');
      });

      it('should provide removeCollection method', async () => {
        const result = await mockClient.removeCollection(
          'tracker:class:Issue',
          'project-space',
          'issue-123',
          'tracker:class:Issue',
          'subIssues'
        );

        expect(result).toHaveProperty('success', true);
      });
    });

    describe('Markup methods (NEW)', () => {
      it('should provide uploadMarkup for content storage', async () => {
        const markupRef = await mockClient.uploadMarkup(
          'tracker:class:Issue',
          'issue-123',
          'description',
          'This is a test description with **markdown**',
          'markdown'
        );

        expect(typeof markupRef).toBe('string');
        expect(markupRef).toMatch(/^markup-/);

        // Verify content was stored
        const stored = mockClient._getMockStore('markupBlobs').get(markupRef);
        expect(stored).toHaveProperty('content', 'This is a test description with **markdown**');
        expect(stored).toHaveProperty('format', 'markdown');
      });

      it('should provide fetchMarkup for content retrieval', async () => {
        // First upload some content
        const markupRef = await mockClient.uploadMarkup(
          'tracker:class:Issue',
          'issue-123',
          'description',
          'Original content'
        );

        // Then fetch it back
        const content = await mockClient.fetchMarkup(
          'tracker:class:Issue',
          'issue-123',
          'description',
          markupRef,
          'markdown'
        );

        expect(content).toBe('Original content');
      });

      it('should throw error for non-existent markup', async () => {
        await expect(
          mockClient.fetchMarkup(
            'tracker:class:Issue',
            'issue-123',
            'description',
            'nonexistent-markup-ref'
          )
        ).rejects.toThrow('Mock error: Markup not found');
      });
    });

    describe('Mixin methods (NEW)', () => {
      it('should provide createMixin method', async () => {
        const result = await mockClient.createMixin('contact:mixin:Employee', 'person-123', {
          active: true,
          position: 'Developer',
        });

        expect(result).toHaveProperty('success', true);
      });

      it('should provide updateMixin method', async () => {
        const result = await mockClient.updateMixin('contact:mixin:Employee', 'person-123', {
          active: false,
        });

        expect(result).toHaveProperty('success', true);
      });
    });

    describe('Account methods (NEW)', () => {
      it('should provide getCurrentAccountId method', async () => {
        const accountId = await mockClient.getCurrentAccountId();

        expect(typeof accountId).toBe('string');
        expect(accountId).toMatch(/^account-/);
      });
    });

    describe('Mock statistics and debugging', () => {
      it('should track method call statistics', async () => {
        await mockClient.findOne('tracker:class:Project', {});
        await mockClient.findAll('tracker:class:Issue', {});
        await mockClient.addCollection(
          'tracker:class:Issue',
          'space',
          'parent',
          'class',
          'collection',
          {}
        );

        const stats = mockClient._getMockStats();
        expect(stats.findOne).toBe(1);
        expect(stats.findAll).toBe(1);
        expect(stats.addCollection).toBe(1);
      });

      it('should allow statistics to be cleared', async () => {
        await mockClient.findOne('tracker:class:Project', {});
        expect(mockClient._getMockStats().findOne).toBe(1);

        mockClient._clearMockStats();
        expect(mockClient._getMockStats().findOne).toBe(0);
      });

      it('should allow mock data manipulation', () => {
        mockClient._setMockData('projects', 'test-project', { name: 'Test Project' });
        const stored = mockClient._getMockStore('projects').get('test-project');
        expect(stored).toHaveProperty('name', 'Test Project');
      });
    });

    describe('Parameter validation', () => {
      it('should validate required parameters by default', async () => {
        await expect(
          mockClient.addCollection('class', 'space', 'attached') // Missing required params
        ).rejects.toThrow('Mock validation error');
      });

      it('should allow validation to be disabled', async () => {
        const noValidationClient = createMockHulyClient({ validateCalls: false });

        // This should not throw even with missing params
        const result = await noValidationClient.addCollection('class', 'space', 'attached');
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Pre-configured mock clients', () => {
    it('should provide error simulation client', async () => {
      // Error client should occasionally throw errors
      let errorThrown = false;
      for (let i = 0; i < 20; i++) {
        try {
          await mockClients.errorClient.findOne('tracker:class:Project', {});
        } catch (error) {
          errorThrown = true;
          expect(error.message).toContain('Mock error');
          break;
        }
      }
      // Should have thrown at least one error in 20 attempts
      expect(errorThrown).toBe(true);
    });

    it('should provide basic client for simple testing', () => {
      const basicClient = mockClients.basicClient;
      expect(basicClient.findOne).toBeDefined();
      expect(basicClient.addCollection).toBeDefined();
      expect(basicClient.uploadMarkup).toBeDefined();
    });
  });

  describe('Backwards compatibility', () => {
    it('should provide basic mock client for legacy tests', () => {
      const basicClient = createBasicMockClient();

      expect(basicClient.findOne).toBeDefined();
      expect(basicClient.findAll).toBeDefined();
      expect(basicClient.createDoc).toBeDefined();
      expect(basicClient.addCollection).toBeDefined();
      expect(basicClient.uploadMarkup).toBeDefined();

      // Should be Jest mocks
      expect(jest.isMockFunction(basicClient.findOne)).toBe(true);
      expect(jest.isMockFunction(basicClient.addCollection)).toBe(true);
    });
  });

  describe('API completeness check', () => {
    it('should provide all methods used by current implementation', () => {
      const client = createMockHulyClient();

      // All methods identified from the codebase analysis
      const requiredMethods = [
        'findOne',
        'findAll',
        'createDoc',
        'updateDoc',
        'removeDoc',
        'addCollection',
        'removeCollection',
        'uploadMarkup',
        'fetchMarkup',
        'createMixin',
        'updateMixin',
        'getCurrentAccountId',
      ];

      requiredMethods.forEach((method) => {
        expect(client[method]).toBeDefined();
        expect(typeof client[method]).toBe('function');
      });
    });
  });
});
