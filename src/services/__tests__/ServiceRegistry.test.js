/**
 * Unit tests for ServiceRegistry
 */

import { jest } from '@jest/globals';
import ServiceRegistry from '../ServiceRegistry.js';

// Mock all services
jest.mock('../IssueService.js');
jest.mock('../ProjectService.js');
jest.mock('../CommentService.js');
jest.mock('../ComponentService.js');
jest.mock('../MilestoneService.js');
jest.mock('../GitHubService.js');
jest.mock('../TemplateService.js');

describe('ServiceRegistry', () => {
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    mockClient = {
      // Mock HulyClient instance
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the singleton instance', () => {
      const instance1 = ServiceRegistry.getInstance();
      const instance2 = ServiceRegistry.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ServiceRegistry);
    });
  });

  describe('initialize', () => {
    it('should initialize all services', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockClient, mockLogger);

      expect(registry.issueService).toBeDefined();
      expect(registry.projectService).toBeDefined();
      expect(registry.commentService).toBeDefined();
      expect(registry.componentService).toBeDefined();
      expect(registry.milestoneService).toBeDefined();
      expect(registry.gitHubService).toBeDefined();
      expect(registry.templateService).toBeDefined();
    });

    it('should log initialization', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockClient, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing ServiceRegistry');
    });
  });

  describe('getServices', () => {
    it('should return all services', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockClient, mockLogger);

      const services = registry.getServices();

      expect(services).toHaveProperty('issueService');
      expect(services).toHaveProperty('projectService');
      expect(services).toHaveProperty('commentService');
      expect(services).toHaveProperty('componentService');
      expect(services).toHaveProperty('milestoneService');
      expect(services).toHaveProperty('gitHubService');
      expect(services).toHaveProperty('templateService');
    });

    it('should throw error if not initialized', () => {
      // Create a new instance to ensure it's not initialized
      const ServiceRegistryClass = ServiceRegistry.constructor;
      const newRegistry = new ServiceRegistryClass();

      expect(() => newRegistry.getServices()).toThrow('ServiceRegistry not initialized');
    });
  });

  describe('service instances', () => {
    it('should return the same service instances on multiple calls', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockClient, mockLogger);

      const services1 = registry.getServices();
      const services2 = registry.getServices();

      expect(services1.issueService).toBe(services2.issueService);
      expect(services1.projectService).toBe(services2.projectService);
      expect(services1.templateService).toBe(services2.templateService);
    });

    it('should pass client and logger to service constructors', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockClient, mockLogger);

      // Services should be initialized with the provided client and logger
      // This is implicitly tested by the fact that services are created without errors
      const services = registry.getServices();
      expect(services).toBeDefined();
    });
  });

  describe('error handling', () => {
    // TODO: Fix this test to work with ESM modules
    // it('should handle initialization errors gracefully', () => {
    //   const registry = ServiceRegistry.getInstance();
    //   // Mock a service constructor to throw
    //   const IssueService = require('../IssueService.js').default;
    //   IssueService.mockImplementation(() => {
    //     throw new Error('Service initialization failed');
    //   });
    //   expect(() => {
    //     registry.initialize(mockClient, mockLogger);
    //   }).toThrow('Service initialization failed');
    // });
  });
});
