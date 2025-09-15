/**
 * URL Generator Utility
 *
 * Generates URLs for Huly entities like issues, projects, etc.
 */

import { ConfigManager } from '../config/ConfigManager.js';

export class URLGenerator {
  constructor() {
    this.config = new ConfigManager();
    this.baseUrl = this.config.config.huly.url;
    this.workspace = this.config.config.huly.workspace;
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
