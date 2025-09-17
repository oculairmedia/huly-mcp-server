/**
 * Comprehensive Huly Client Mock for Unit Tests
 *
 * This mock provides all the methods used by the current Huly MCP Server implementation.
 * It includes validation and realistic behavior patterns to catch API mismatches.
 */

import { jest } from '@jest/globals';

/**
 * Create a comprehensive mock Huly client with all required methods
 * @param {Object} options - Configuration options for the mock
 * @returns {Object} Mock client with all Huly API methods
 */
export function createMockHulyClient(options = {}) {
  const { validateCalls = true, trackStatistics = true, simulateErrors = false } = options;

  // Statistics tracking for debugging
  const callStats = {
    findOne: 0,
    findAll: 0,
    createDoc: 0,
    updateDoc: 0,
    removeDoc: 0,
    addCollection: 0,
    removeCollection: 0,
    uploadMarkup: 0,
    fetchMarkup: 0,
    createMixin: 0,
    updateMixin: 0,
    getCurrentAccountId: 0,
  };

  // Mock data stores for realistic behavior
  const mockStores = {
    projects: new Map(),
    issues: new Map(),
    components: new Map(),
    milestones: new Map(),
    statuses: new Map(),
    accounts: new Map(),
    persons: new Map(),
    markupBlobs: new Map(),
    sequences: new Map(),
  };

  // Helper function to generate realistic IDs
  const generateId = (prefix = 'mock') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Helper function to validate parameters
  const validateParams = (method, params, expectedKeys) => {
    if (!validateCalls) return;

    expectedKeys.forEach((key) => {
      if (!(key in params)) {
        throw new Error(`Mock validation error: ${method} missing required parameter: ${key}`);
      }
    });
  };

  const mockClient = {
    // Query methods
    findOne: jest.fn().mockImplementation(async (classRef, query = {}, _options = {}) => {
      if (trackStatistics) callStats.findOne++;

      // Simulate error scenarios
      if (simulateErrors && Math.random() < 0.1) {
        throw new Error(`Mock error: findOne failed for ${classRef}`);
      }

      // Return null for not found (realistic behavior)
      if (query._id && query._id.includes('notfound')) {
        return null;
      }

      // Mock realistic responses for common queries
      if (classRef.includes('Project')) {
        return {
          _id: generateId('project'),
          identifier: query.identifier || 'MOCK',
          name: `Mock Project ${query.identifier || 'Test'}`,
          description: 'Mock project description',
          private: false,
          archived: false,
          createdOn: Date.now(),
          modifiedOn: Date.now(),
        };
      }

      if (classRef.includes('Issue')) {
        return {
          _id: generateId('issue'),
          identifier: query.identifier || 'MOCK-1',
          title: 'Mock Issue Title',
          description: generateId('markup'),
          status: generateId('status'),
          priority: 2, // Medium
          number: 1,
          space: generateId('project'),
          createdOn: Date.now(),
          modifiedOn: Date.now(),
          assignee: null,
          component: null,
          milestone: null,
          comments: 0,
          subIssues: 0,
          attachedTo: 'tracker:ids:NoParent',
        };
      }

      if (classRef.includes('IssueStatus')) {
        return {
          _id: generateId('status'),
          name: 'Backlog',
          category: 0,
          space: query.space || generateId('project'),
        };
      }

      if (classRef.includes('Account')) {
        return {
          _id: generateId('account'),
          email: query.email || 'test@example.com',
          name: 'Mock User',
          confirmed: true,
        };
      }

      // Default mock object
      return {
        _id: generateId(),
        name: 'Mock Object',
        createdOn: Date.now(),
        modifiedOn: Date.now(),
      };
    }),

    findAll: jest.fn().mockImplementation(async (classRef, query = {}, options = {}) => {
      if (trackStatistics) callStats.findAll++;

      const limit = options.limit || 50;
      const mockItems = [];

      // Generate realistic mock arrays
      if (classRef.includes('Issue')) {
        for (let i = 0; i < Math.min(limit, 5); i++) {
          mockItems.push({
            _id: generateId('issue'),
            identifier: `MOCK-${i + 1}`,
            title: `Mock Issue ${i + 1}`,
            status: generateId('status'),
            priority: i % 4, // Rotate priorities
            space: query.space || generateId('project'),
            createdOn: Date.now() - i * 86400000, // Different dates
            modifiedOn: Date.now() - i * 3600000,
          });
        }
      }

      if (classRef.includes('IssueStatus')) {
        mockItems.push(
          { _id: generateId('status'), name: 'Backlog', category: 0 },
          { _id: generateId('status'), name: 'Todo', category: 1 },
          { _id: generateId('status'), name: 'In Progress', category: 2 },
          { _id: generateId('status'), name: 'Done', category: 3 }
        );
      }

      return mockItems;
    }),

    // Document creation methods
    createDoc: jest.fn().mockImplementation(async (classRef, space, data) => {
      if (trackStatistics) callStats.createDoc++;
      validateParams('createDoc', { classRef, space, data }, ['classRef', 'space', 'data']);

      const id = generateId('doc');
      return id;
    }),

    updateDoc: jest.fn().mockImplementation(async (classRef, space, id, data) => {
      if (trackStatistics) callStats.updateDoc++;
      validateParams('updateDoc', { classRef, space, id, data }, [
        'classRef',
        'space',
        'id',
        'data',
      ]);

      return { success: true };
    }),

    removeDoc: jest.fn().mockImplementation(async (classRef, space, id) => {
      if (trackStatistics) callStats.removeDoc++;
      validateParams('removeDoc', { classRef, space, id }, ['classRef', 'space', 'id']);

      return { success: true };
    }),

    // Collection methods (NEW - critical for current implementation)
    addCollection: jest
      .fn()
      .mockImplementation(
        async function (classRef, space, attachedTo, attachedToClass, collection, data) {
          if (trackStatistics) callStats.addCollection++;

          // Validate that all 6 parameters are provided
          if (validateCalls && arguments.length < 6) {
            throw new Error(
              `Mock validation error: addCollection requires 6 parameters, got ${arguments.length}`
            );
          }

          validateParams(
            'addCollection',
            { classRef, space, attachedTo, attachedToClass, collection, data },
            ['classRef', 'space', 'attachedTo', 'attachedToClass', 'collection', 'data']
          );

          const id = generateId('collection');

          // Store in mock collection for realistic queries
          if (classRef.includes('Issue')) {
            mockStores.issues.set(id, {
              _id: id,
              space,
              attachedTo,
              ...data,
              createdOn: Date.now(),
              modifiedOn: Date.now(),
            });
          }

          return id;
        }
      ),

    removeCollection: jest
      .fn()
      .mockImplementation(async (classRef, space, id, attachedToClass, collection) => {
        if (trackStatistics) callStats.removeCollection++;
        validateParams('removeCollection', { classRef, space, id, attachedToClass, collection }, [
          'classRef',
          'space',
          'id',
          'attachedToClass',
          'collection',
        ]);

        return { success: true };
      }),

    // Markup methods (NEW - critical for descriptions)
    uploadMarkup: jest
      .fn()
      .mockImplementation(async (classRef, objectId, field, content, format = 'markdown') => {
        if (trackStatistics) callStats.uploadMarkup++;
        validateParams('uploadMarkup', { classRef, objectId, field, content }, [
          'classRef',
          'objectId',
          'field',
          'content',
        ]);

        const markupRef = generateId('markup');

        // Store content for fetchMarkup
        mockStores.markupBlobs.set(markupRef, {
          content,
          format,
          classRef,
          objectId,
          field,
          createdOn: Date.now(),
        });

        return markupRef;
      }),

    fetchMarkup: jest
      .fn()
      .mockImplementation(async (classRef, objectId, field, markupRef, _format = 'markdown') => {
        if (trackStatistics) callStats.fetchMarkup++;
        validateParams('fetchMarkup', { classRef, objectId, field, markupRef }, [
          'classRef',
          'objectId',
          'field',
          'markupRef',
        ]);

        const stored = mockStores.markupBlobs.get(markupRef);
        if (!stored) {
          throw new Error(`Mock error: Markup not found: ${markupRef}`);
        }

        return stored.content;
      }),

    // Mixin methods (NEW - for role management)
    createMixin: jest.fn().mockImplementation(async (mixinClass, targetId, data) => {
      if (trackStatistics) callStats.createMixin++;
      validateParams('createMixin', { mixinClass, targetId, data }, [
        'mixinClass',
        'targetId',
        'data',
      ]);

      return { success: true };
    }),

    updateMixin: jest.fn().mockImplementation(async (mixinClass, targetId, data) => {
      if (trackStatistics) callStats.updateMixin++;
      validateParams('updateMixin', { mixinClass, targetId, data }, [
        'mixinClass',
        'targetId',
        'data',
      ]);

      return { success: true };
    }),

    // Account methods (NEW - for current user context)
    getCurrentAccountId: jest.fn().mockImplementation(async () => {
      if (trackStatistics) callStats.getCurrentAccountId++;
      return generateId('account');
    }),

    // Mock-specific helper methods for testing
    _getMockStats: () => ({ ...callStats }),
    _clearMockStats: () => {
      Object.keys(callStats).forEach((key) => (callStats[key] = 0));
    },
    _getMockStore: (storeName) => mockStores[storeName],
    _setMockData: (storeName, key, value) => {
      if (mockStores[storeName]) {
        mockStores[storeName].set(key, value);
      }
    },
    _simulateError: (methodName, shouldError = true) => {
      if (mockClient[methodName] && mockClient[methodName].mockImplementation) {
        const originalImpl = mockClient[methodName].getMockImplementation();
        if (shouldError) {
          mockClient[methodName].mockRejectedValue(new Error(`Mock error: ${methodName} failed`));
        } else {
          mockClient[methodName].mockImplementation(originalImpl);
        }
      }
    },
  };

  return mockClient;
}

/**
 * Create a simple mock client for basic testing (backward compatibility)
 */
export function createBasicMockClient() {
  return {
    findOne: jest.fn(),
    findAll: jest.fn(),
    createDoc: jest.fn(),
    updateDoc: jest.fn(),
    removeDoc: jest.fn(),
    addCollection: jest.fn(),
    uploadMarkup: jest.fn(),
    fetchMarkup: jest.fn(),
  };
}

/**
 * Pre-configured mock clients for common scenarios
 */
export const mockClients = {
  // For testing error conditions
  errorClient: createMockHulyClient({ simulateErrors: true }),

  // For testing with validation disabled (faster)
  basicClient: createMockHulyClient({ validateCalls: false, trackStatistics: false }),

  // Default comprehensive client
  default: createMockHulyClient(),
};

export default createMockHulyClient;
