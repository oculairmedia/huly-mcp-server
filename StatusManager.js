/**
 * StatusManager - Centralized status handling for Huly MCP Server
 *
 * Provides unified status management across all MCP tools:
 * - Converts between human-readable and full Huly format
 * - Validates status values
 * - Ensures consistency across all tools
 *
 * Supports both input formats:
 * - Human-readable: 'backlog', 'todo', 'in-progress', 'done', 'canceled'
 * - Full Huly format: 'tracker:status:Backlog', 'tracker:status:InProgress', etc.
 */

export class StatusManager {
  constructor() {
    // Core status mappings - bidirectional lookup
    this.statusMap = new Map([
      // Standard workflow statuses
      ['backlog', 'tracker:status:Backlog'],
      ['todo', 'tracker:status:Todo'],
      ['in-progress', 'tracker:status:InProgress'],
      ['done', 'tracker:status:Done'],
      ['canceled', 'tracker:status:Canceled'],

      // Alternative friendly names (aliases)
      ['active', 'tracker:status:InProgress'],
      ['progress', 'tracker:status:InProgress'],
      ['in-review', 'tracker:status:InProgress'],
      ['review', 'tracker:status:InProgress'],
      ['completed', 'tracker:status:Done'],
      ['finished', 'tracker:status:Done'],
      ['cancelled', 'tracker:status:Canceled'],

      // Priority mapping for issue creation
      ['low', 'tracker:status:Backlog'],
      ['medium', 'tracker:status:Todo'],
      ['high', 'tracker:status:InProgress'],
      ['urgent', 'tracker:status:InProgress']
    ]);

    // Reverse map for converting full format back to human-readable
    this.reverseStatusMap = new Map([
      ['tracker:status:Backlog', 'backlog'],
      ['tracker:status:Todo', 'todo'],
      ['tracker:status:InProgress', 'in-progress'],
      ['tracker:status:Done', 'done'],
      ['tracker:status:Canceled', 'canceled']
    ]);

    // Valid status values for validation
    this.validStatuses = Array.from(this.statusMap.keys());
    this.validFullStatuses = Array.from(this.reverseStatusMap.keys());

    // Default status for new issues
    this.defaultStatus = 'tracker:status:Backlog';
    this.defaultHumanStatus = 'backlog';
  }

  /**
   * Convert human-readable status to full Huly format
   * @param {string} status - Human-readable status (e.g., 'in-progress')
   * @returns {string} Full Huly status (e.g., 'tracker:status:InProgress')
   * @throws {Error} If status is invalid
   */
  toFullStatus(status) {
    if (!status) {
      return this.defaultStatus;
    }

    // If already in full format, validate and return
    if (status.startsWith('tracker:status:')) {
      if (this.validFullStatuses.includes(status)) {
        return status;
      }
      throw new Error(`Invalid full status format: ${status}`);
    }

    // Convert from human-readable to full format
    const normalizedStatus = status.toLowerCase().trim();
    const fullStatus = this.statusMap.get(normalizedStatus);

    if (!fullStatus) {
      throw new Error(`Invalid status: ${status}. Valid statuses: ${this.validStatuses.join(', ')}`);
    }

    return fullStatus;
  }

  /**
   * Convert full Huly status to human-readable format
   * @param {string} status - Full Huly status (e.g., 'tracker:status:InProgress')
   * @returns {string} Human-readable status (e.g., 'in-progress')
   */
  toHumanStatus(status) {
    if (!status) {
      return this.defaultHumanStatus;
    }

    // If already in human format, validate and return
    if (!status.startsWith('tracker:status:')) {
      const normalizedStatus = status.toLowerCase().trim();
      if (this.validStatuses.includes(normalizedStatus)) {
        return normalizedStatus;
      }
      throw new Error(`Invalid human status: ${status}`);
    }

    // Convert from full format to human-readable
    const humanStatus = this.reverseStatusMap.get(status);
    if (!humanStatus) {
      throw new Error(`Unknown full status: ${status}`);
    }

    return humanStatus;
  }

  /**
   * Validate if a status is valid (in any format)
   * @param {string} status - Status to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidStatus(status) {
    if (!status) return false;

    try {
      this.toFullStatus(status);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all valid human-readable statuses
   * @returns {string[]} Array of valid human-readable statuses
   */
  getValidStatuses() {
    return [...this.validStatuses];
  }

  /**
   * Get all valid full format statuses
   * @returns {string[]} Array of valid full format statuses
   */
  getValidFullStatuses() {
    return [...this.validFullStatuses];
  }

  /**
   * Get status information for documentation/schemas
   * @returns {Object} Status information object
   */
  getStatusInfo() {
    return {
      validStatuses: this.getValidStatuses(),
      validFullStatuses: this.getValidFullStatuses(),
      defaultStatus: this.defaultStatus,
      defaultHumanStatus: this.defaultHumanStatus,
      examples: {
        humanReadable: ['backlog', 'todo', 'in-progress', 'done', 'canceled'],
        fullFormat: ['tracker:status:Backlog', 'tracker:status:Todo', 'tracker:status:InProgress', 'tracker:status:Done', 'tracker:status:Canceled']
      }
    };
  }

  /**
   * Get the default status for new issues
   * @param {string} format - 'human' or 'full' format
   * @returns {string} Default status in requested format
   */
  getDefaultStatus(format = 'full') {
    return format === 'human' ? this.defaultHumanStatus : this.defaultStatus;
  }

  /**
   * Create a user-friendly status description
   * @param {string} status - Status to describe
   * @returns {string} Friendly description
   */
  getStatusDescription(status) {
    const humanStatus = this.toHumanStatus(status);
    const descriptions = {
      'backlog': 'Backlog - Not yet started',
      'todo': 'To Do - Ready to start',
      'in-progress': 'In Progress - Currently being worked on',
      'done': 'Done - Completed successfully',
      'canceled': 'Canceled - Work abandoned'
    };

    return descriptions[humanStatus] || humanStatus;
  }
}

// Export singleton instance
export default new StatusManager();