/**
 * ServiceFactory - Factory for creating services with dependency injection
 *
 * Provides factory methods for creating service instances with proper
 * dependency resolution and configuration.
 */

import { createIssueService } from './IssueService.js';
import TemplateService from './TemplateService.js';
import { DeletionService } from './DeletionService.js';
import { SequenceService } from './SequenceService.js';
import { projectService } from './ProjectService.js';

/**
 * Factory class for creating service instances
 */
export class ServiceFactory {
  /**
   * Create a SequenceService instance
   * @param {Object} logger - Logger instance
   * @returns {SequenceService} New SequenceService instance
   */
  static createSequenceService(logger) {
    return new SequenceService(logger);
  }

  /**
   * Create an IssueService instance with dependencies
   * @param {Object} statusManager - Status manager instance
   * @param {SequenceService} sequenceService - Sequence service instance
   * @returns {IssueService} New IssueService instance
   */
  static createIssueService(statusManager, sequenceService) {
    return createIssueService(statusManager, sequenceService);
  }

  /**
   * Create a TemplateService instance with dependencies
   * @param {SequenceService} sequenceService - Sequence service instance
   * @returns {TemplateService} New TemplateService instance
   */
  static createTemplateService(sequenceService) {
    return new TemplateService(sequenceService);
  }

  /**
   * Create a DeletionService instance
   * @returns {DeletionService} New DeletionService instance
   */
  static createDeletionService() {
    return new DeletionService();
  }

  /**
   * Get the ProjectService singleton
   * @returns {ProjectService} ProjectService instance
   */
  static getProjectService() {
    return projectService;
  }

  /**
   * Create all services with proper dependency injection
   * @param {Object} dependencies - Required dependencies
   * @param {Object} dependencies.statusManager - Status manager instance
   * @param {Object} dependencies.logger - Logger instance
   * @returns {Object} Object containing all service instances
   */
  static createAllServices({ statusManager, logger }) {
    // Create services in dependency order
    const sequenceService = this.createSequenceService(logger.child('SequenceService'));
    const issueService = this.createIssueService(statusManager, sequenceService);
    const templateService = this.createTemplateService(sequenceService);
    const deletionService = this.createDeletionService();
    const projectServiceInstance = this.getProjectService();

    return {
      sequenceService,
      issueService,
      templateService,
      deletionService,
      projectService: projectServiceInstance,
      statusManager,
    };
  }

  /**
   * Validate service dependencies
   * @param {Object} services - Object containing service instances
   * @returns {boolean} True if all dependencies are properly wired
   */
  static validateDependencies(services) {
    // Check that IssueService has SequenceService
    if (!services.issueService.sequenceService) {
      throw new Error('IssueService missing SequenceService dependency');
    }

    // Check that TemplateService has SequenceService
    if (!services.templateService.sequenceService) {
      throw new Error('TemplateService missing SequenceService dependency');
    }

    // Check that both services share the same SequenceService instance
    if (services.issueService.sequenceService !== services.templateService.sequenceService) {
      throw new Error('IssueService and TemplateService have different SequenceService instances');
    }

    return true;
  }
}
