/**
 * WizardState - Session-based state management for multi-step wizards
 *
 * Manages wizard sessions, step transitions, and state persistence
 * for interactive multi-step workflows.
 */

import { randomUUID } from 'crypto';
import { createLoggerWithConfig } from '../../utils/index.js';
import { getConfigManager } from '../../config/index.js';

/**
 * Represents a single wizard session
 */
export class WizardSession {
  constructor(wizardName, initialData = {}) {
    this._sessionId = randomUUID();
    this.wizardName = wizardName;
    this.currentStep = 0;
    this.steps = [];
    this.state = { ...initialData };
    this.metadata = {
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completedSteps: [],
      totalSteps: 0,
    };
    this.isCompleted = false;
    this.isAborted = false;
  }

  /**
   * Initialize wizard with step definitions
   */
  setSteps(steps) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Steps must be a non-empty array');
    }

    this.steps = steps.map((step, index) => ({
      id: step.id || `step-${index}`,
      name: step.name || `Step ${index + 1}`,
      description: step.description || '',
      required: step.required === true,
      validation: step.validation || null,
      handler: step.handler || null,
      ...step,
    }));

    this.metadata.totalSteps = this.steps.length;
    this.updateLastModified();
    return this;
  }

  /**
   * Get current step information
   */
  getCurrentStep() {
    if (this.currentStep >= this.steps.length) {
      return null;
    }
    return this.steps[this.currentStep];
  }

  /**
   * Get step by ID
   */
  getStep(stepId) {
    return this.steps.find((step) => step.id === stepId);
  }

  /**
   * Update state data
   */
  updateState(data) {
    this.state = { ...this.state, ...data };
    this.updateLastModified();
    return this;
  }

  /**
   * Get specific state value
   */
  getState(key) {
    return key ? this.state[key] : this.state;
  }

  /**
   * Validate current step data
   */
  async validateCurrentStep(data = {}) {
    const step = this.getCurrentStep();
    if (!step) {
      throw new Error('No current step to validate');
    }

    // Check required fields
    if (step.required && (!data || Object.keys(data).length === 0)) {
      throw new Error(`Step '${step.name}' requires data but none provided`);
    }

    // Run custom validation if provided
    if (step.validation && typeof step.validation === 'function') {
      const validationResult = await step.validation(data, this.state);
      if (validationResult !== true) {
        throw new Error(validationResult || `Validation failed for step '${step.name}'`);
      }
    }

    return true;
  }

  /**
   * Advance to next step
   */
  async nextStep(stepData = {}) {
    if (this.isCompleted || this.isAborted) {
      throw new Error('Cannot advance completed or aborted wizard');
    }

    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error('No current step available');
    }

    // Validate step data
    await this.validateCurrentStep(stepData);

    // Update state with step data
    this.updateState(stepData);

    // Mark current step as completed
    this.metadata.completedSteps.push(currentStep.id);

    // Execute step handler if provided
    if (currentStep.handler && typeof currentStep.handler === 'function') {
      await currentStep.handler(stepData, this.state, this);
    }

    // Advance to next step
    this.currentStep++;

    // Check if wizard is complete
    if (this.currentStep >= this.steps.length) {
      this.isCompleted = true;
      this.metadata.completedAt = new Date().toISOString();
    }

    this.updateLastModified();
    return this;
  }

  /**
   * Go back to previous step
   */
  previousStep() {
    if (this.isCompleted || this.isAborted) {
      throw new Error('Cannot navigate in completed or aborted wizard');
    }

    if (this.currentStep <= 0) {
      throw new Error('Already at first step');
    }

    this.currentStep--;

    // Remove from completed steps
    const currentStep = this.getCurrentStep();
    if (currentStep) {
      this.metadata.completedSteps = this.metadata.completedSteps.filter(
        (stepId) => stepId !== currentStep.id
      );
    }

    this.updateLastModified();
    return this;
  }

  /**
   * Jump to specific step
   */
  goToStep(stepId) {
    const stepIndex = this.steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step '${stepId}' not found`);
    }

    if (this.isCompleted || this.isAborted) {
      throw new Error('Cannot navigate in completed or aborted wizard');
    }

    this.currentStep = stepIndex;
    this.updateLastModified();
    return this;
  }

  /**
   * Abort the wizard
   */
  abort(reason = 'User cancelled') {
    this.isAborted = true;
    this.metadata.abortedAt = new Date().toISOString();
    this.metadata.abortReason = reason;
    this.updateLastModified();
    return this;
  }

  /**
   * Get wizard progress
   */
  getProgress() {
    return {
      sessionId: this.sessionId,
      wizardName: this.wizardName,
      currentStep: this.currentStep,
      totalSteps: this.metadata.totalSteps,
      completedSteps: this.metadata.completedSteps.length,
      percentage:
        this.metadata.totalSteps > 0
          ? Math.round((this.metadata.completedSteps.length / this.metadata.totalSteps) * 100)
          : 0,
      isCompleted: this.isCompleted,
      isAborted: this.isAborted,
      currentStepInfo: this.getCurrentStep(),
      metadata: this.metadata,
    };
  }

  /**
   * Serialize session to JSON
   */
  toJSON() {
    return {
      sessionId: this.sessionId,
      wizardName: this.wizardName,
      currentStep: this.currentStep,
      steps: this.steps,
      state: this.state,
      metadata: this.metadata,
      isCompleted: this.isCompleted,
      isAborted: this.isAborted,
    };
  }

  /**
   * Restore session from JSON
   */
  static fromJSON(data) {
    const session = new WizardSession(data.wizardName, data.state);
    session._sessionId = data.sessionId;
    session.currentStep = data.currentStep;
    session.steps = data.steps || [];
    session.metadata = data.metadata || {};
    session.isCompleted = data.isCompleted || false;
    session.isAborted = data.isAborted || false;
    return session;
  }

  /**
   * Update last modified timestamp
   */
  updateLastModified() {
    this.metadata.lastUpdated = new Date().toISOString();
  }
}

/**
 * Manages multiple wizard sessions with cleanup and persistence
 */
export class WizardStateManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.maxSessions = options.maxSessions || 100;
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour default
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes default

    // Initialize logger
    try {
      this.logger = createLoggerWithConfig(getConfigManager()).child('wizard-state');
    } catch (_error) {
      // Fallback logger for testing
      this.logger = {
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
      };
    }

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Create a new wizard session
   */
  createSession(wizardName, initialData = {}) {
    if (!wizardName || typeof wizardName !== 'string') {
      throw new Error('Wizard name is required and must be a string');
    }

    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      this.cleanup();
      if (this.sessions.size >= this.maxSessions) {
        throw new Error('Maximum number of wizard sessions reached');
      }
    }

    const session = new WizardSession(wizardName, initialData);
    this.sessions.set(session.sessionId, session);

    this.logger.info(`Created wizard session ${session.sessionId} for ${wizardName}`);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      this.removeSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Remove session
   */
  removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.info(`Removed wizard session ${sessionId}`);
    }
    return !!session;
  }

  /**
   * List all active sessions
   */
  listSessions() {
    const activeSessions = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!this.isSessionExpired(session)) {
        activeSessions.push({
          sessionId,
          wizardName: session.wizardName,
          progress: session.getProgress(),
          createdAt: session.metadata.createdAt,
          lastUpdated: session.metadata.lastUpdated,
        });
      }
    }
    return activeSessions;
  }

  /**
   * Get sessions by wizard name
   */
  getSessionsByWizard(wizardName) {
    const sessions = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.wizardName === wizardName && !this.isSessionExpired(session)) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session) {
    if (session.isCompleted || session.isAborted) {
      return false; // Keep completed/aborted sessions for a while
    }

    const now = Date.now();
    const lastUpdated = new Date(session.metadata.lastUpdated).getTime();
    return now - lastUpdated > this.sessionTimeout;
  }

  /**
   * Cleanup expired sessions
   */
  cleanup() {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      // Remove expired sessions
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        continue;
      }

      // Remove old completed/aborted sessions (24 hours)
      if (session.isCompleted || session.isAborted) {
        const completedAt = session.metadata.completedAt || session.metadata.abortedAt;
        if (completedAt) {
          const age = now - new Date(completedAt).getTime();
          if (age > 86400000) {
            // 24 hours
            this.sessions.delete(sessionId);
            cleanedCount++;
          }
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} expired wizard sessions`);
    }

    return cleanedCount;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    let activeCount = 0;
    let completedCount = 0;
    let abortedCount = 0;
    const wizardTypes = new Map();

    for (const session of this.sessions.values()) {
      if (session.isCompleted) {
        completedCount++;
      } else if (session.isAborted) {
        abortedCount++;
      } else {
        activeCount++;
      }

      // Count by wizard type
      const count = wizardTypes.get(session.wizardName) || 0;
      wizardTypes.set(session.wizardName, count + 1);
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeCount,
      completedSessions: completedCount,
      abortedSessions: abortedCount,
      wizardTypes: Object.fromEntries(wizardTypes),
      maxSessions: this.maxSessions,
      sessionTimeout: this.sessionTimeout,
    };
  }

  /**
   * Shutdown the manager
   */
  shutdown() {
    this.stopCleanupTimer();
    this.sessions.clear();
    this.logger.info('Wizard state manager shut down');
  }
}

// Singleton instance
let wizardStateManager = null;

/**
 * Get the singleton wizard state manager
 */
export function getWizardStateManager(options = {}) {
  if (!wizardStateManager) {
    wizardStateManager = new WizardStateManager(options);
  }
  return wizardStateManager;
}

/**
 * Reset the singleton (mainly for testing)
 */
export function resetWizardStateManager() {
  if (wizardStateManager) {
    wizardStateManager.shutdown();
    wizardStateManager = null;
  }
}
