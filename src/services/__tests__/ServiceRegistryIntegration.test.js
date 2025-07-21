/**
 * Integration tests for ServiceRegistry
 */

import { jest } from '@jest/globals';
import ServiceRegistry from '../ServiceRegistry.js';
import { SequenceService } from '../SequenceService.js';
import { IssueService } from '../IssueService.js';
import TemplateService from '../TemplateService.js';
import { DeletionService } from '../DeletionService.js';

describe('ServiceRegistry Integration', () => {
  let mockHulyClientWrapper;
  let mockLogger;

  beforeEach(() => {
    // Reset the singleton instance
    ServiceRegistry._instance = null;

    mockHulyClientWrapper = {
      // Mock HulyClient wrapper
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => mockLogger),
    };
  });

  afterEach(() => {
    // Clean up singleton
    const instance = ServiceRegistry.getInstance();
    instance.reset();
    ServiceRegistry._instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should always return the same instance', () => {
      const instance1 = ServiceRegistry.getInstance();
      const instance2 = ServiceRegistry.getInstance();
      const instance3 = ServiceRegistry.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('Initialization', () => {
    it('should initialize all services correctly', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      const services = registry.getServices();

      // Verify all services are present
      expect(services.projectService).toBeDefined();
      expect(services.issueService).toBeDefined();
      expect(services.templateService).toBeDefined();
      expect(services.deletionService).toBeDefined();
      expect(services.sequenceService).toBeDefined();
      expect(services.statusManager).toBeDefined();
    });

    it('should create services with correct types', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      const services = registry.getServices();

      // Verify service types
      expect(services.sequenceService).toBeInstanceOf(SequenceService);
      expect(services.issueService).toBeInstanceOf(IssueService);
      expect(services.templateService).toBeInstanceOf(TemplateService);
      expect(services.deletionService).toBeInstanceOf(DeletionService);
    });

    it('should inject dependencies correctly', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      const services = registry.getServices();

      // Verify IssueService has sequenceService
      expect(services.issueService.sequenceService).toBe(services.sequenceService);

      // Verify TemplateService has sequenceService
      expect(services.templateService.sequenceService).toBe(services.sequenceService);
    });

    it('should throw error if initialized twice', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      expect(() => {
        registry.initialize(mockHulyClientWrapper, mockLogger);
      }).toThrow('ServiceRegistry already initialized');
    });

    it('should use provided logger', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing ServiceRegistry');
      expect(mockLogger.info).toHaveBeenCalledWith('ServiceRegistry initialized successfully');
    });
  });

  describe('Service Retrieval', () => {
    it('should retrieve individual services by name', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      const issueService = registry.getService('issueService');
      const templateService = registry.getService('templateService');

      expect(issueService).toBeInstanceOf(IssueService);
      expect(templateService).toBeInstanceOf(TemplateService);
    });

    it('should throw error for unknown service', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      expect(() => {
        registry.getService('unknownService');
      }).toThrow("Service 'unknownService' not found in registry");
    });

    it('should throw error if not initialized', () => {
      const registry = ServiceRegistry.getInstance();

      expect(() => {
        registry.getServices();
      }).toThrow('ServiceRegistry not initialized');

      expect(() => {
        registry.getService('issueService');
      }).toThrow('ServiceRegistry not initialized');
    });
  });

  describe('Service Consistency', () => {
    it('should return the same service instances on multiple calls', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      const services1 = registry.getServices();
      const services2 = registry.getServices();

      // Verify same instances
      expect(services1.issueService).toBe(services2.issueService);
      expect(services1.sequenceService).toBe(services2.sequenceService);
      expect(services1.templateService).toBe(services2.templateService);
    });

    it('should maintain service relationships', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      const services = registry.getServices();

      // Both IssueService and TemplateService should share the same SequenceService
      expect(services.issueService.sequenceService).toBe(services.templateService.sequenceService);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state', () => {
      const registry = ServiceRegistry.getInstance();
      registry.initialize(mockHulyClientWrapper, mockLogger);

      // Verify initialized
      expect(() => registry.getServices()).not.toThrow();

      // Reset
      registry.reset();

      // Should throw after reset
      expect(() => registry.getServices()).toThrow('ServiceRegistry not initialized');
    });
  });
});
