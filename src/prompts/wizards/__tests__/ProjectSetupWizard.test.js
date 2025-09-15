/**
 * ProjectSetupWizard Tests
 *
 * Tests the complete project setup wizard workflow including:
 * - Step navigation and validation
 * - State management and persistence
 * - Form validation and error handling
 * - Project creation integration
 */

import { jest } from '@jest/globals';
import { getWizardStateManager, resetWizardStateManager } from '../../base/WizardState.js';

// Mock Huly dependencies with correct module names
jest.mock('@hcengineering/tracker', () => ({
  tracker: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
      IssueStatus: 'tracker:class:IssueStatus',
      IssuePriority: 'tracker:class:IssuePriority'
    },
    ids: {
      NoProject: 'tracker:ids:NoProject'
    }
  }
}));

jest.mock('@hcengineering/core', () => ({
  core: {
    class: {
      Account: 'core:class:Account'
    }
  }
}));

// Mock Huly client and services
jest.mock('../../../core/hulyClient.js', () => ({
  createHulyClient: jest.fn(() => ({
    isConnected: jest.fn(() => true),
    findAll: jest.fn(() => []),
    createObject: jest.fn(() => ({ id: 'mock-project-id' })),
    close: jest.fn()
  }))
}));

jest.mock('../../../services/ProjectService.js', () => ({
  ProjectService: class MockProjectService {
    constructor(client) {
      this.client = client;
    }

    async createProject(data) {
      return {
        id: 'mock-project-id',
        identifier: data.identifier,
        name: data.name,
        description: data.description,
        private: data.private || false,
        archived: false,
        owners: data.owners || [],
        members: data.members || []
      };
    }

    async listProjects() {
      return [];
    }
  }
}));

// Import after mocks are set up
const { ProjectSetupWizard } = await import('../ProjectSetupWizard.js');

describe('ProjectSetupWizard', () => {
  let wizard;
  let stateManager;

  beforeEach(() => {
    // Reset wizard state manager
    resetWizardStateManager();
    stateManager = getWizardStateManager();

    // Create fresh wizard instance
    wizard = new ProjectSetupWizard();
  });

  afterEach(() => {
    resetWizardStateManager();
  });

  describe('Wizard Definition', () => {
    test('should have correct basic properties', () => {
      expect(wizard.name).toBe('project-setup-wizard');
      expect(wizard.description).toContain('Interactive wizard');
      expect(wizard.category).toBe('project-management');
    });

    test('should have 5 defined steps', () => {
      expect(wizard.steps).toHaveLength(5);
      expect(wizard.steps[0].id).toBe('project-basic-info');
      expect(wizard.steps[1].id).toBe('project-settings');
      expect(wizard.steps[2].id).toBe('team-setup');
      expect(wizard.steps[3].id).toBe('initial-structure');
      expect(wizard.steps[4].id).toBe('finalization');
    });

    test('should have wizard annotation', () => {
      expect(wizard.annotations.wizard).toBe(true);
    });
  });

  describe('Wizard Execution', () => {
    test('should create new session and start at first step', async () => {
      const context = { sessionId: null };
      const result = await wizard.execute({}, context);

      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBeDefined();
      expect(result.data.currentStep.id).toBe('project-basic-info');
      expect(result.data.currentStep.name).toBe('Project Basic Information');
    });

    test('should resume existing session', async () => {
      // Create initial session
      const context1 = { sessionId: null };
      const result1 = await wizard.execute({}, context1);
      const sessionId = result1.data.sessionId;

      // Resume session
      const context2 = { sessionId };
      const result2 = await wizard.execute({}, context2);

      expect(result2.success).toBe(true);
      expect(result2.data.sessionId).toBe(sessionId);
      expect(result2.data.currentStep.id).toBe('project-basic-info');
    });

    test('should handle session not found gracefully', async () => {
      const context = { sessionId: 'non-existent-session' };
      const result = await wizard.execute({}, context);

      expect(result.success).toBe(true);
      expect(result.data.sessionId).not.toBe('non-existent-session');
      expect(result.data.currentStep.id).toBe('project-basic-info');
    });
  });

  describe('Step 1 - Project Basic Info', () => {
    test('should validate required fields', async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      const sessionId = context.sessionId;

      // Try to advance without required data
      const result = await wizard.execute({
        action: 'next',
        stepData: {}
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    test('should validate project name format', async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      const sessionId = context.sessionId;

      // Try with invalid name
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          name: '', // Empty name
          identifier: 'TEST',
          description: 'Test project'
        }
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    test('should validate project identifier format', async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      const sessionId = context.sessionId;

      // Try with invalid identifier
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'invalid-identifier!', // Invalid characters
          description: 'Test project'
        }
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('uppercase letters, numbers, and underscores');
    });

    test('should advance to step 2 with valid data', async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      const sessionId = context.sessionId;

      const result = await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'TEST_PROJECT',
          description: 'A test project for validation'
        }
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('project-settings');
    });
  });

  describe('Step 2 - Project Settings', () => {
    let sessionId;

    beforeEach(async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      sessionId = context.sessionId;

      // Complete step 1
      await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'TEST_PROJECT',
          description: 'A test project'
        }
      }, { sessionId });
    });

    test('should have default settings values', async () => {
      const result = await wizard.execute({}, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('project-settings');
      expect(result.data.currentStep.form.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'private', defaultValue: false }),
          expect.objectContaining({ name: 'defaultAssignee' }),
          expect.objectContaining({ name: 'autoClose', defaultValue: false })
        ])
      );
    });

    test('should advance with default values', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {} // Use defaults
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('team-setup');
    });

    test('should advance with custom values', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          private: true,
          defaultAssignee: 'john.doe@example.com',
          autoClose: true,
          autoCloseTimeoutDays: 30
        }
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('team-setup');
    });
  });

  describe('Step 3 - Team Setup', () => {
    let sessionId;

    beforeEach(async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      sessionId = context.sessionId;

      // Complete steps 1 and 2
      await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'TEST_PROJECT',
          description: 'A test project'
        }
      }, { sessionId });

      await wizard.execute({
        action: 'next',
        stepData: {}
      }, { sessionId });
    });

    test('should validate email format for owners', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          owners: ['invalid-email']
        }
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('valid email');
    });

    test('should validate email format for members', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          owners: ['owner@example.com'],
          members: ['valid@example.com', 'invalid-email']
        }
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('valid email');
    });

    test('should advance with valid team data', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          owners: ['owner@example.com'],
          members: ['member1@example.com', 'member2@example.com']
        }
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('initial-structure');
    });

    test('should allow empty team lists', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          owners: [],
          members: []
        }
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('initial-structure');
    });
  });

  describe('Step 4 - Initial Structure', () => {
    let sessionId;

    beforeEach(async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      sessionId = context.sessionId;

      // Complete steps 1, 2, and 3
      await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'TEST_PROJECT',
          description: 'A test project'
        }
      }, { sessionId });

      await wizard.execute({
        action: 'next',
        stepData: {}
      }, { sessionId });

      await wizard.execute({
        action: 'next',
        stepData: {
          owners: ['owner@example.com']
        }
      }, { sessionId });
    });

    test('should advance with structure selections', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          createDefaultStates: true,
          createDefaultPriorities: true,
          createSampleIssues: false,
          initialComponents: ['Frontend', 'Backend', 'Database']
        }
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('finalization');
    });

    test('should advance with minimal structure', async () => {
      const result = await wizard.execute({
        action: 'next',
        stepData: {
          createDefaultStates: false,
          createDefaultPriorities: false,
          createSampleIssues: false,
          initialComponents: []
        }
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('finalization');
    });
  });

  describe('Step 5 - Finalization', () => {
    let sessionId;

    beforeEach(async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      sessionId = context.sessionId;

      // Complete all previous steps
      await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'TEST_PROJECT',
          description: 'A test project'
        }
      }, { sessionId });

      await wizard.execute({
        action: 'next',
        stepData: { private: false }
      }, { sessionId });

      await wizard.execute({
        action: 'next',
        stepData: {
          owners: ['owner@example.com'],
          members: ['member@example.com']
        }
      }, { sessionId });

      await wizard.execute({
        action: 'next',
        stepData: {
          createDefaultStates: true,
          createDefaultPriorities: true,
          createSampleIssues: false,
          initialComponents: ['Frontend']
        }
      }, { sessionId });
    });

    test('should complete wizard and create project', async () => {
      const result = await wizard.execute({
        action: 'finish'
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.completed).toBe(true);
      expect(result.data.project).toBeDefined();
      expect(result.data.project.id).toBe('mock-project-id');
      expect(result.data.project.identifier).toBe('TEST_PROJECT');
    });

    test('should show review data before completion', async () => {
      const result = await wizard.execute({}, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('finalization');
      expect(result.data.currentStep.review).toBeDefined();
      expect(result.data.currentStep.review.name).toBe('Test Project');
      expect(result.data.currentStep.review.identifier).toBe('TEST_PROJECT');
      expect(result.data.currentStep.review.owners).toContain('owner@example.com');
    });
  });

  describe('Navigation Controls', () => {
    let sessionId;

    beforeEach(async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      sessionId = context.sessionId;

      // Complete step 1
      await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Test Project',
          identifier: 'TEST_PROJECT',
          description: 'A test project'
        }
      }, { sessionId });
    });

    test('should go back to previous step', async () => {
      const result = await wizard.execute({
        action: 'previous'
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.currentStep.id).toBe('project-basic-info');
    });

    test('should not go back from first step', async () => {
      // Go back to first step
      await wizard.execute({
        action: 'previous'
      }, { sessionId });

      // Try to go back again
      const result = await wizard.execute({
        action: 'previous'
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('first step');
    });

    test('should cancel wizard', async () => {
      const result = await wizard.execute({
        action: 'cancel'
      }, { sessionId });

      expect(result.success).toBe(true);
      expect(result.data.cancelled).toBe(true);

      // Session should be aborted
      const session = stateManager.getSession(sessionId);
      expect(session?.isAborted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid action', async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);

      const result = await wizard.execute({
        action: 'invalid-action'
      }, { sessionId: context.sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    test('should handle project creation failure', async () => {
      // Mock project creation failure
      const ProjectService = (await import('../../../services/ProjectService.js')).ProjectService;
      const mockProjectService = ProjectService.prototype;
      const originalCreate = mockProjectService.createProject;

      mockProjectService.createProject = jest.fn().mockRejectedValue(
        new Error('Project creation failed')
      );

      const context = { sessionId: null };
      await wizard.execute({}, context);
      const sessionId = context.sessionId;

      // Complete all steps
      await wizard.execute({
        action: 'next',
        stepData: { name: 'Test', identifier: 'TEST', description: 'Test' }
      }, { sessionId });

      await wizard.execute({ action: 'next', stepData: {} }, { sessionId });
      await wizard.execute({ action: 'next', stepData: { owners: [] } }, { sessionId });
      await wizard.execute({ action: 'next', stepData: { createDefaultStates: false } }, { sessionId });

      // Try to finish
      const result = await wizard.execute({
        action: 'finish'
      }, { sessionId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Project creation failed');

      // Restore original method
      mockProjectService.createProject = originalCreate;
    });
  });

  describe('State Persistence', () => {
    test('should maintain state across navigation', async () => {
      const context = { sessionId: null };
      await wizard.execute({}, context);
      const sessionId = context.sessionId;

      // Complete step 1
      await wizard.execute({
        action: 'next',
        stepData: {
          name: 'Persistent Project',
          identifier: 'PERSIST',
          description: 'Test persistence'
        }
      }, { sessionId });

      // Go to step 3
      await wizard.execute({ action: 'next', stepData: {} }, { sessionId });

      // Go back to step 1
      await wizard.execute({ action: 'previous' }, { sessionId });
      await wizard.execute({ action: 'previous' }, { sessionId });

      // Check that data is still there
      const session = stateManager.getSession(sessionId);
      expect(session.getState('name')).toBe('Persistent Project');
      expect(session.getState('identifier')).toBe('PERSIST');
      expect(session.getState('description')).toBe('Test persistence');
    });
  });
});