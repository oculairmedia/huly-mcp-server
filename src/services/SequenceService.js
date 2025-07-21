/**
 * SequenceService - Atomic sequence generation for issue numbers
 *
 * This service provides thread-safe issue number generation using MongoDB's
 * atomic $inc operator to prevent duplicate issue IDs in concurrent operations.
 *
 * Fixes HULLY-121: Duplicate issue IDs in bulk creation
 */

import coreModule from '@hcengineering/core';
import trackerModule from '@hcengineering/tracker';
import { HulyError } from '../core/HulyError.js';

const core = coreModule.default || coreModule;
const tracker = trackerModule.default || trackerModule;

/**
 * SequenceService class
 * Manages atomic sequence generation for projects
 */
export class SequenceService {
  /**
   * @param {import('../utils/Logger').Logger} logger - Logger instance
   */
  constructor(logger) {
    this.logger = logger;
    this._sequenceCache = new Map(); // Cache for performance optimization
    this._cacheTTL = 60000; // 1 minute cache TTL
  }

  /**
   * Get the next issue number for a project atomically
   * @param {Object} client - Huly client instance
   * @param {string} projectId - Project ID
   * @returns {Promise<number>} Next issue number
   */
  async getNextIssueNumber(client, projectId) {
    try {
      this.logger.debug(`Getting next issue number for project ${projectId}`);

      // First, ensure the project has a sequence field initialized
      const project = await client.findOne(tracker.class.Project, { _id: projectId });

      if (!project) {
        throw HulyError.notFound('project', projectId);
      }

      // Always check for initialization to handle edge cases
      await this._ensureSequenceInitialized(client, project);

      // Atomic increment using $inc operator
      const result = await client.updateDoc(
        tracker.class.Project,
        project.space,
        projectId,
        { $inc: { sequence: 1 } },
        true // Return updated document
      );

      // Extract the new sequence number from the result
      // The result format is { object: { ...projectData, sequence: newNumber } }
      const newSequence = result?.object?.sequence;

      if (newSequence === undefined || newSequence === null) {
        throw new HulyError('SEQUENCE_ERROR', 'Failed to get sequence number from atomic update', {
          projectId,
          result,
        });
      }

      this.logger.debug(`Generated issue number ${newSequence} for project ${project.identifier}`);

      // Update cache
      this._updateCache(projectId, newSequence);

      return newSequence;
    } catch (error) {
      this.logger.error('Failed to get next issue number:', error);
      throw error;
    }
  }

  /**
   * Ensure project sequence is properly initialized
   * @private
   * @param {Object} client - Huly client instance
   * @param {Object} project - Project object
   */
  async _ensureSequenceInitialized(client, project) {
    // If sequence exists and is greater than 0, check if it's still valid
    if (project.sequence !== undefined && project.sequence !== null && project.sequence > 0) {
      // Double-check: find the highest issue number to ensure sequence is correct
      const lastIssue = await client.findOne(
        tracker.class.Issue,
        { space: project._id },
        { sort: { number: -1 } }
      );

      const highestNumber = lastIssue?.number || 0;

      // If the project sequence is less than the highest issue number, update it
      if (project.sequence < highestNumber) {
        this.logger.warn(
          `Project ${project.identifier} sequence (${project.sequence}) is less than highest issue number (${highestNumber}). Updating...`
        );
        await this._initializeProjectSequence(client, project._id, highestNumber);
      }
    } else {
      // No sequence field or it's 0/null, initialize it
      await this._initializeProjectSequence(client, project._id);
    }
  }

  /**
   * Initialize project sequence by finding the highest existing issue number
   * @private
   * @param {Object} client - Huly client instance
   * @param {string} projectId - Project ID
   * @param {number} [knownHighest] - Known highest issue number (optional)
   */
  async _initializeProjectSequence(client, projectId, knownHighest) {
    this.logger.info(`Initializing sequence for project ${projectId}`);

    let initialSequence = knownHighest;

    // If we don't know the highest, find it
    if (initialSequence === undefined) {
      const lastIssue = await client.findOne(
        tracker.class.Issue,
        { space: projectId },
        { sort: { number: -1 } }
      );
      initialSequence = lastIssue?.number || 0;
    }

    this.logger.info(`Setting initial sequence to ${initialSequence} for project ${projectId}`);

    // Set the sequence field on the project
    await client.updateDoc(tracker.class.Project, core.space.Space, projectId, {
      sequence: initialSequence,
    });
  }

  /**
   * Get multiple sequence numbers atomically (for bulk operations)
   * @param {Object} client - Huly client instance
   * @param {string} projectId - Project ID
   * @param {number} count - Number of sequences to reserve
   * @returns {Promise<number[]>} Array of reserved sequence numbers
   */
  async getNextIssueNumbers(client, projectId, count) {
    if (count <= 0) {
      throw new HulyError('INVALID_ARGUMENT', 'Count must be greater than 0', { count });
    }

    try {
      this.logger.debug(`Reserving ${count} issue numbers for project ${projectId}`);

      const project = await client.findOne(tracker.class.Project, { _id: projectId });

      if (!project) {
        throw HulyError.notFound('project', projectId);
      }

      // Always ensure sequence is properly initialized
      await this._ensureSequenceInitialized(client, project);

      // Atomic increment by count
      const result = await client.updateDoc(
        tracker.class.Project,
        project.space,
        projectId,
        { $inc: { sequence: count } },
        true // Return updated document
      );

      const newSequence = result?.object?.sequence;

      if (newSequence === undefined || newSequence === null) {
        throw new HulyError(
          'SEQUENCE_ERROR',
          'Failed to get sequence number from atomic bulk update',
          { projectId, count, result }
        );
      }

      // Generate array of reserved numbers
      const numbers = [];
      for (let i = count - 1; i >= 0; i--) {
        numbers.push(newSequence - i);
      }

      this.logger.debug(
        `Reserved issue numbers ${numbers[0]}-${numbers[numbers.length - 1]} for project ${project.identifier}`
      );

      // Update cache with the highest number
      this._updateCache(projectId, newSequence);

      return numbers;
    } catch (error) {
      this.logger.error('Failed to reserve issue numbers:', error);
      throw error;
    }
  }

  /**
   * Clear the sequence cache (useful for testing)
   */
  clearCache() {
    this._sequenceCache.clear();
    this.logger.debug('Sequence cache cleared');
  }

  /**
   * Update cache with new sequence value
   * @private
   * @param {string} projectId - Project ID
   * @param {number} sequence - Latest sequence number
   */
  _updateCache(projectId, sequence) {
    this._sequenceCache.set(projectId, {
      sequence,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached sequence value if still valid
   * @private
   * @param {string} projectId - Project ID
   * @returns {number|null} Cached sequence or null if expired/missing
   */
  _getCachedSequence(projectId) {
    const cached = this._sequenceCache.get(projectId);
    if (cached && Date.now() - cached.timestamp < this._cacheTTL) {
      return cached.sequence;
    }
    return null;
  }
}

// Export for factory function
export function createSequenceService(logger) {
  return new SequenceService(logger);
}
