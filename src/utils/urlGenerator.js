/**
 * URL Generator Utility
 *
 * Generates URLs for Huly entities like issues, projects, etc.
 */

import { getConfigManager } from '../config/ConfigManager.js';

export class URLGenerator {
  constructor() {
    // Use the singleton ConfigManager to avoid creating multiple instances
    this.configManager = null; // Lazy load to avoid startup issues
  }

  /**
   * Get config lazily to avoid startup timing issues
   */
  _getConfig() {
    if (!this.configManager) {
      this.configManager = getConfigManager();
    }
    return this.configManager.config;
  }

  /**
   * Get the base URL for generating user-facing links
   */
  get baseUrl() {
    return this._getConfig().huly.publicUrl;
  }

  /**
   * Get the workspace name
   */
  get workspace() {
    return this._getConfig().huly.workspace;
  }

  /**
   * Generate issue URL
   * @param {string} projectId - Project identifier (e.g., "HULLY") - not used in actual URL
   * @param {string} issueId - Issue identifier (e.g., "HULLY-309")
   * @returns {string} Complete issue URL
   */
  getIssueUrl(projectId, issueId) {
    if (!this.baseUrl || !this.workspace) {
      return null;
    }

    // Actual Huly URL pattern: /workbench/<workspace>/tracker/<issue_identifier>
    return `${this.baseUrl}/workbench/${this.workspace}/tracker/${issueId}`;
  }

  /**
   * Generate project URL
   * @param {string} projectId - Project identifier (e.g., "HULLY")
   * @returns {string} Complete project URL
   */
  getProjectUrl(projectId) {
    if (!this.baseUrl || !this.workspace) {
      return null;
    }

    return `${this.baseUrl}/workbench/${this.workspace}/${projectId}`;
  }

  /**
   * Generate component URL
   * @param {string} projectId - Project identifier
   * @param {string} componentId - Component identifier
   * @returns {string} Complete component URL
   */
  getComponentUrl(projectId, componentId) {
    if (!this.baseUrl || !this.workspace) {
      return null;
    }

    return `${this.baseUrl}/workbench/${this.workspace}/${projectId}/components/${componentId}`;
  }

  /**
   * Generate milestone URL
   * @param {string} projectId - Project identifier
   * @param {string} milestoneId - Milestone identifier
   * @returns {string} Complete milestone URL
   */
  getMilestoneUrl(projectId, milestoneId) {
    if (!this.baseUrl || !this.workspace) {
      return null;
    }

    return `${this.baseUrl}/workbench/${this.workspace}/${projectId}/milestones/${milestoneId}`;
  }
}

// Export singleton instance
export const urlGenerator = new URLGenerator();
