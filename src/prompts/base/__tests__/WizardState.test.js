/**
 * Tests for WizardState system
 */

import { jest } from '@jest/globals';
import {
  WizardSession,
  WizardStateManager,
  getWizardStateManager,
  resetWizardStateManager,
} from '../WizardState.js';

// Mock the config and utils modules
jest.mock('../../../config/index.js');
jest.mock('../../../utils/index.js');

describe('WizardSession', () => {
  let session;

  beforeEach(() => {
    session = new WizardSession('test-wizard', { initialValue: 'test' });
  });

  describe('Construction and Initialization', () => {
    it('should create a new wizard session with default values', () => {
      const newSession = new WizardSession('my-wizard');

      expect(newSession.sessionId).toBeDefined();
      expect(newSession.wizardName).toBe('my-wizard');
      expect(newSession.currentStep).toBe(0);
      expect(newSession.steps).toEqual([]);
      expect(newSession.state).toEqual({});
      expect(newSession.isCompleted).toBe(false);
      expect(newSession.isAborted).toBe(false);
      expect(newSession.metadata.createdAt).toBeDefined();
      expect(newSession.metadata.totalSteps).toBe(0);
    });

    it('should create session with initial data', () => {
      expect(session.state).toEqual({ initialValue: 'test' });
      expect(session.wizardName).toBe('test-wizard');
    });

    it('should set steps correctly', () => {
      const steps = [
        { id: 'step1', name: 'First Step', required: true },
        { id: 'step2', name: 'Second Step', required: false },
      ];

      session.setSteps(steps);

      expect(session.steps).toHaveLength(2);
      expect(session.steps[0].id).toBe('step1');
      expect(session.steps[0].required).toBe(true);
      expect(session.steps[1].required).toBe(false);
      expect(session.metadata.totalSteps).toBe(2);
    });

    it('should auto-generate step IDs if not provided', () => {
      const steps = [{ name: 'First Step' }, { name: 'Second Step' }];

      session.setSteps(steps);

      expect(session.steps[0].id).toBe('step-0');
      expect(session.steps[1].id).toBe('step-1');
    });

    it('should throw error for invalid steps', () => {
      expect(() => session.setSteps([])).toThrow('Steps must be a non-empty array');
      expect(() => session.setSteps(null)).toThrow('Steps must be a non-empty array');
    });
  });

  describe('Step Navigation', () => {
    beforeEach(() => {
      session.setSteps([
        { id: 'step1', name: 'Step 1' },
        { id: 'step2', name: 'Step 2' },
        { id: 'step3', name: 'Step 3' },
      ]);
    });

    it('should get current step correctly', () => {
      const currentStep = session.getCurrentStep();
      expect(currentStep.id).toBe('step1');
      expect(currentStep.name).toBe('Step 1');
    });

    it('should return null when past last step', () => {
      session.currentStep = 10;
      expect(session.getCurrentStep()).toBeNull();
    });

    it('should get step by ID', () => {
      const step = session.getStep('step2');
      expect(step.id).toBe('step2');
      expect(step.name).toBe('Step 2');
    });

    it('should advance to next step', async () => {
      await session.nextStep({ stepData: 'value1' });

      expect(session.currentStep).toBe(1);
      expect(session.state.stepData).toBe('value1');
      expect(session.metadata.completedSteps).toContain('step1');
      expect(session.isCompleted).toBe(false);
    });

    it('should complete wizard on last step', async () => {
      // Advance through all steps
      await session.nextStep({});
      await session.nextStep({});
      await session.nextStep({});

      expect(session.isCompleted).toBe(true);
      expect(session.metadata.completedAt).toBeDefined();
      expect(session.metadata.completedSteps).toHaveLength(3);
    });

    it('should go back to previous step', async () => {
      await session.nextStep({});
      expect(session.currentStep).toBe(1);

      session.previousStep();
      expect(session.currentStep).toBe(0);
      expect(session.metadata.completedSteps).not.toContain('step1');
    });

    it('should not go back from first step', () => {
      expect(() => session.previousStep()).toThrow('Already at first step');
    });

    it('should jump to specific step', () => {
      session.goToStep('step3');
      expect(session.currentStep).toBe(2);
    });

    it('should throw error for invalid step jump', () => {
      expect(() => session.goToStep('invalid')).toThrow("Step 'invalid' not found");
    });

    it('should not navigate in completed wizard', async () => {
      // Complete the wizard
      await session.nextStep({});
      await session.nextStep({});
      await session.nextStep({});

      await expect(session.nextStep({})).rejects.toThrow(
        'Cannot advance completed or aborted wizard'
      );
      expect(() => session.previousStep()).toThrow(
        'Cannot navigate in completed or aborted wizard'
      );
      expect(() => session.goToStep('step1')).toThrow(
        'Cannot navigate in completed or aborted wizard'
      );
    });
  });

  describe('State Management', () => {
    it('should update state data', () => {
      session.updateState({ newKey: 'newValue', anotherKey: 123 });

      expect(session.state.initialValue).toBe('test');
      expect(session.state.newKey).toBe('newValue');
      expect(session.state.anotherKey).toBe(123);
    });

    it('should get specific state value', () => {
      session.updateState({ specificKey: 'specificValue' });

      expect(session.getState('specificKey')).toBe('specificValue');
      expect(session.getState('nonexistent')).toBeUndefined();
    });

    it('should get entire state when no key provided', () => {
      const fullState = session.getState();
      expect(fullState).toEqual(session.state);
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      session.setSteps([
        {
          id: 'required-step',
          name: 'Required Step',
          required: true,
        },
        {
          id: 'validation-step',
          name: 'Validation Step',
          validation: (data, _state) => {
            if (!data.email || !data.email.includes('@')) {
              return 'Invalid email address';
            }
            return true;
          },
        },
      ]);
    });

    it('should validate required step data', async () => {
      await expect(session.validateCurrentStep()).rejects.toThrow(
        "Step 'Required Step' requires data but none provided"
      );

      await expect(session.validateCurrentStep({})).rejects.toThrow(
        "Step 'Required Step' requires data but none provided"
      );

      await expect(session.validateCurrentStep({ someData: 'value' })).resolves.toBe(true);
    });

    it('should run custom validation', async () => {
      session.goToStep('validation-step');

      await expect(session.validateCurrentStep({ email: 'invalid' })).rejects.toThrow(
        'Invalid email address'
      );

      await expect(session.validateCurrentStep({ email: 'test@example.com' })).resolves.toBe(true);
    });

    it('should handle async validation', async () => {
      const asyncValidationStep = {
        id: 'async-step',
        validation: async (data) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(data.value === 'correct' ? true : 'Incorrect value');
            }, 10);
          });
        },
      };

      session.setSteps([asyncValidationStep]);

      await expect(session.validateCurrentStep({ value: 'wrong' })).rejects.toThrow(
        'Incorrect value'
      );

      await expect(session.validateCurrentStep({ value: 'correct' })).resolves.toBe(true);
    });
  });

  describe('Step Handlers', () => {
    it('should execute step handlers during navigation', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      session.setSteps([
        { id: 'step1', handler: handler1 },
        { id: 'step2', handler: handler2 },
      ]);

      await session.nextStep({ step1Data: 'value1' });

      expect(handler1).toHaveBeenCalledWith(
        { step1Data: 'value1' },
        expect.objectContaining({ step1Data: 'value1' }),
        session
      );
      expect(handler2).not.toHaveBeenCalled();

      await session.nextStep({ step2Data: 'value2' });

      expect(handler2).toHaveBeenCalledWith(
        { step2Data: 'value2' },
        expect.objectContaining({
          step1Data: 'value1',
          step2Data: 'value2',
        }),
        session
      );
    });

    it('should handle async step handlers', async () => {
      const asyncHandler = jest.fn(async (_data) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, 10);
        });
      });

      session.setSteps([{ id: 'async-step', handler: asyncHandler }]);

      await session.nextStep({ asyncData: 'test' });

      expect(asyncHandler).toHaveBeenCalled();
    });
  });

  describe('Wizard Abortion', () => {
    beforeEach(() => {
      session.setSteps([
        { id: 'step1', name: 'Step 1' },
        { id: 'step2', name: 'Step 2' },
      ]);
    });

    it('should abort wizard with reason', () => {
      session.abort('User cancelled');

      expect(session.isAborted).toBe(true);
      expect(session.metadata.abortedAt).toBeDefined();
      expect(session.metadata.abortReason).toBe('User cancelled');
    });

    it('should abort with default reason', () => {
      session.abort();
      expect(session.metadata.abortReason).toBe('User cancelled');
    });

    it('should prevent navigation after abortion', async () => {
      session.abort();

      await expect(session.nextStep({})).rejects.toThrow(
        'Cannot advance completed or aborted wizard'
      );
      expect(() => session.previousStep()).toThrow(
        'Cannot navigate in completed or aborted wizard'
      );
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      session.setSteps([
        { id: 'step1', name: 'Step 1' },
        { id: 'step2', name: 'Step 2' },
        { id: 'step3', name: 'Step 3' },
      ]);
    });

    it('should calculate progress correctly', async () => {
      let progress = session.getProgress();
      expect(progress.percentage).toBe(0);
      expect(progress.completedSteps).toBe(0);

      await session.nextStep({});
      progress = session.getProgress();
      expect(progress.percentage).toBe(33); // 1/3 rounded

      await session.nextStep({});
      progress = session.getProgress();
      expect(progress.percentage).toBe(67); // 2/3 rounded

      await session.nextStep({});
      progress = session.getProgress();
      expect(progress.percentage).toBe(100);
      expect(progress.isCompleted).toBe(true);
    });

    it('should include current step info in progress', () => {
      const progress = session.getProgress();
      expect(progress.currentStepInfo.id).toBe('step1');
      expect(progress.currentStepInfo.name).toBe('Step 1');
    });
  });

  describe('Serialization', () => {
    beforeEach(() => {
      session.setSteps([
        { id: 'step1', name: 'Step 1' },
        { id: 'step2', name: 'Step 2' },
      ]);
    });

    it('should serialize to JSON', async () => {
      await session.nextStep({ testData: 'value' });

      const json = session.toJSON();

      expect(json.sessionId).toBe(session.sessionId);
      expect(json.wizardName).toBe('test-wizard');
      expect(json.currentStep).toBe(1);
      expect(json.state.testData).toBe('value');
      expect(json.steps).toHaveLength(2);
      expect(json.isCompleted).toBe(false);
    });

    it('should restore from JSON', async () => {
      await session.nextStep({ testData: 'value' });
      const json = session.toJSON();

      const restored = WizardSession.fromJSON(json);

      expect(restored.sessionId).toBe(session.sessionId);
      expect(restored.wizardName).toBe(session.wizardName);
      expect(restored.currentStep).toBe(session.currentStep);
      expect(restored.state).toEqual(session.state);
      expect(restored.steps).toEqual(session.steps);
    });

    it('should handle incomplete JSON data', () => {
      const minimalJson = {
        wizardName: 'minimal-wizard',
        state: { test: 'data' },
      };

      const restored = WizardSession.fromJSON(minimalJson);

      expect(restored.wizardName).toBe('minimal-wizard');
      expect(restored.state).toEqual({ test: 'data' });
      expect(restored.steps).toEqual([]);
      expect(restored.isCompleted).toBe(false);
    });
  });
});

describe('WizardStateManager', () => {
  let manager;

  beforeEach(() => {
    resetWizardStateManager(); // Clear singleton
    manager = new WizardStateManager({
      maxSessions: 5,
      sessionTimeout: 1000, // 1 second for testing
      cleanupInterval: 100, // 100ms for testing
    });
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('Session Management', () => {
    it('should create new sessions', () => {
      const session = manager.createSession('test-wizard', { initial: 'data' });

      expect(session.wizardName).toBe('test-wizard');
      expect(session.state.initial).toBe('data');
      expect(manager.sessions.size).toBe(1);
    });

    it('should throw error for invalid wizard name', () => {
      expect(() => manager.createSession()).toThrow('Wizard name is required');
      expect(() => manager.createSession(123)).toThrow('Wizard name is required');
    });

    it('should enforce session limit', () => {
      // Create maximum sessions
      for (let i = 0; i < 5; i++) {
        manager.createSession(`wizard-${i}`);
      }

      expect(() => manager.createSession('wizard-overflow')).toThrow(
        'Maximum number of wizard sessions reached'
      );
    });

    it('should retrieve sessions by ID', () => {
      const session = manager.createSession('test-wizard');
      const retrieved = manager.getSession(session.sessionId);

      expect(retrieved).toBe(session);
    });

    it('should return null for non-existent session', () => {
      expect(manager.getSession('non-existent')).toBeNull();
    });

    it('should remove sessions', () => {
      const session = manager.createSession('test-wizard');
      expect(manager.sessions.size).toBe(1);

      const removed = manager.removeSession(session.sessionId);
      expect(removed).toBe(true);
      expect(manager.sessions.size).toBe(0);

      const removedAgain = manager.removeSession(session.sessionId);
      expect(removedAgain).toBe(false);
    });

    it('should list all active sessions', () => {
      const session1 = manager.createSession('wizard-1');
      const session2 = manager.createSession('wizard-2');

      const sessions = manager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain(session1.sessionId);
      expect(sessions.map((s) => s.sessionId)).toContain(session2.sessionId);
    });

    it('should get sessions by wizard name', () => {
      manager.createSession('wizard-a');
      manager.createSession('wizard-b');
      manager.createSession('wizard-a'); // Another instance

      const wizardASessions = manager.getSessionsByWizard('wizard-a');
      expect(wizardASessions).toHaveLength(2);

      const wizardBSessions = manager.getSessionsByWizard('wizard-b');
      expect(wizardBSessions).toHaveLength(1);
    });
  });

  describe('Session Expiration', () => {
    it('should identify expired sessions', (done) => {
      const session = manager.createSession('test-wizard');

      // Session should not be expired initially
      expect(manager.isSessionExpired(session)).toBe(false);

      // Wait for session to expire
      setTimeout(() => {
        expect(manager.isSessionExpired(session)).toBe(true);
        done();
      }, 1100); // Wait longer than sessionTimeout
    });

    it('should not expire completed sessions', (done) => {
      const session = manager.createSession('test-wizard');
      session.isCompleted = true;

      setTimeout(() => {
        expect(manager.isSessionExpired(session)).toBe(false);
        done();
      }, 1100);
    });

    it('should return null for expired session retrieval', (done) => {
      const session = manager.createSession('test-wizard');
      const sessionId = session.sessionId;

      setTimeout(() => {
        const retrieved = manager.getSession(sessionId);
        expect(retrieved).toBeNull();
        expect(manager.sessions.has(sessionId)).toBe(false);
        done();
      }, 1100);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired sessions manually', (done) => {
      // Stop automatic cleanup for this test
      manager.stopCleanupTimer();

      manager.createSession('test-wizard-1');
      manager.createSession('test-wizard-2');

      expect(manager.sessions.size).toBe(2);

      setTimeout(() => {
        const cleanedCount = manager.cleanup();
        expect(cleanedCount).toBe(2);
        expect(manager.sessions.size).toBe(0);

        // Restart automatic cleanup
        manager.startCleanupTimer();
        done();
      }, 1100);
    }, 10000);

    it('should automatically clean up sessions', (done) => {
      manager.createSession('test-wizard');
      expect(manager.sessions.size).toBe(1);

      // Wait for automatic cleanup
      setTimeout(() => {
        expect(manager.sessions.size).toBe(0);
        done();
      }, 1200); // Wait longer than cleanup interval + session timeout
    }, 10000);

    it('should clean up old completed sessions', () => {
      const session = manager.createSession('test-wizard');
      session.isCompleted = true;
      session.metadata.completedAt = new Date(Date.now() - 90000000).toISOString(); // Very old

      const cleanedCount = manager.cleanup();
      expect(cleanedCount).toBe(1);
      expect(manager.sessions.size).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      const session1 = manager.createSession('wizard-a');
      const session2 = manager.createSession('wizard-b');
      const _session3 = manager.createSession('wizard-a');

      // Complete one session
      session1.setSteps([{ id: 'step1' }]);
      await session1.nextStep({});

      // Abort another
      session2.abort();

      const stats = manager.getStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(1);
      expect(stats.completedSessions).toBe(1);
      expect(stats.abortedSessions).toBe(1);
      expect(stats.wizardTypes['wizard-a']).toBe(2);
      expect(stats.wizardTypes['wizard-b']).toBe(1);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getWizardStateManager', () => {
      const instance1 = getWizardStateManager();
      const instance2 = getWizardStateManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getWizardStateManager();
      resetWizardStateManager();
      const instance2 = getWizardStateManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Shutdown', () => {
    it('should properly shutdown manager', () => {
      manager.createSession('test-wizard');
      expect(manager.sessions.size).toBe(1);
      expect(manager.cleanupTimer).toBeDefined();

      manager.shutdown();

      expect(manager.sessions.size).toBe(0);
      expect(manager.cleanupTimer).toBeNull();
    });
  });
});
