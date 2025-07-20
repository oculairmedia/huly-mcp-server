/**
 * DeletionService - Service for managing deletion operations
 *
 * Handles deletion of various entity types in Huly with proper
 * validation, cascade handling, and impact analysis.
 */

import trackerModule from '@hcengineering/tracker';
import coreModule from '@hcengineering/core';
import { HulyError } from '../core/HulyError.js';

const tracker = trackerModule.default || trackerModule;
const core = coreModule.default || coreModule;

/**
 * Service class for deletion operations
 */
export class DeletionService {
  constructor() {
    // Service can be extended with configuration if needed
  }

  /**
   * Delete an issue and optionally its sub-issues
   * @param {Object} client - Huly client instance
   * @param {string} issueIdentifier - Issue identifier (e.g., "PROJ-123")
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteIssue(client, issueIdentifier, options = {}) {
    const {
      cascade = true, // Delete sub-issues
      force = false, // Force deletion even with references
      dryRun = false, // Preview only
    } = options;

    // Find the issue
    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });
    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    // Get impact analysis
    const impact = await this.analyzeIssueDeletionImpact(client, issueIdentifier);

    if (dryRun) {
      return {
        content: [
          {
            type: 'text',
            text: this._formatImpactAnalysis(impact, 'issue', issueIdentifier),
          },
        ],
      };
    }

    // Check for blockers if not forcing
    if (!force && impact.blockers.length > 0) {
      throw new HulyError(
        'DELETION_BLOCKED',
        `Cannot delete issue ${issueIdentifier}: ${impact.blockers.join(', ')}`,
        {
          context: 'Issue has blocking references',
          suggestion: 'Use force option to override or resolve blockers first',
          data: { blockers: impact.blockers },
        }
      );
    }

    // Perform deletion
    const deletedItems = [];

    try {
      // Delete sub-issues first if cascading
      if (cascade && impact.subIssues.length > 0) {
        for (const subIssue of impact.subIssues) {
          await this._deleteIssueRecursive(client, subIssue, deletedItems);
        }
      }

      // Delete the main issue
      // Issues are AttachedDoc types, so we use removeCollection
      await client.removeCollection(
        tracker.class.Issue,
        issue.space,
        issue._id,
        issue.attachedTo,
        issue.attachedToClass,
        issue.collection
      );

      deletedItems.push({
        type: 'issue',
        identifier: issueIdentifier,
        title: issue.title,
      });

      return {
        content: [
          {
            type: 'text',
            text: this._formatDeletionResult(deletedItems),
          },
        ],
      };
    } catch (error) {
      throw HulyError.database('delete issue', error);
    }
  }

  /**
   * Bulk delete multiple issues
   * @param {Object} client - Huly client instance
   * @param {Array<string>} issueIdentifiers - Array of issue identifiers
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Bulk deletion result
   */
  async bulkDeleteIssues(client, issueIdentifiers, options = {}) {
    const {
      cascade = true,
      force = false,
      dryRun = false,
      continueOnError = true,
      batchSize = 10,
    } = options;

    const results = {
      total: issueIdentifiers.length,
      succeeded: [],
      failed: [],
      skipped: [],
    };

    // Process in batches
    for (let i = 0; i < issueIdentifiers.length; i += batchSize) {
      const batch = issueIdentifiers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (identifier) => {
          try {
            const result = await this.deleteIssue(client, identifier, {
              cascade,
              force,
              dryRun,
            });

            if (dryRun) {
              results.skipped.push({ identifier, preview: result });
            } else {
              results.succeeded.push({ identifier });
            }
          } catch (error) {
            results.failed.push({
              identifier,
              error: error.message,
            });

            if (!continueOnError) {
              throw error;
            }
          }
        })
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: this._formatBulkDeletionResult(results),
        },
      ],
    };
  }

  /**
   * Delete a project and all its contents
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProject(client, projectIdentifier, options = {}) {
    const { force = false, dryRun = false } = options;

    // Find the project
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    // Get impact analysis
    const impact = await this.analyzeProjectDeletionImpact(client, projectIdentifier);

    if (dryRun) {
      return {
        content: [
          {
            type: 'text',
            text: this._formatImpactAnalysis(impact, 'project', projectIdentifier),
          },
        ],
      };
    }

    // Check for blockers if not forcing
    if (!force && impact.blockers.length > 0) {
      throw new HulyError(
        'DELETION_BLOCKED',
        `Cannot delete project ${projectIdentifier}: ${impact.blockers.join(', ')}`,
        {
          context: 'Project has blocking references or active data',
          suggestion: 'Archive the project instead or use force option',
          data: { blockers: impact.blockers },
        }
      );
    }

    try {
      // Delete all issues first
      if (impact.issues.length > 0) {
        const issueIdentifiers = impact.issues.map((i) => i.identifier);
        await this.bulkDeleteIssues(client, issueIdentifiers, { force: true });
      }

      // Delete components
      for (const component of impact.components) {
        await client.removeDoc(tracker.class.Component, project._id, component._id);
      }

      // Delete milestones
      for (const milestone of impact.milestones) {
        await client.removeDoc(tracker.class.Milestone, project._id, milestone._id);
      }

      // Delete templates
      for (const template of impact.templates) {
        await client.removeDoc(tracker.class.IssueTemplate, project._id, template._id);
      }

      // Finally delete the project
      await client.removeDoc(tracker.class.Project, core.class.Space, project._id);

      return {
        content: [
          {
            type: 'text',
            text:
              `✅ Deleted project ${projectIdentifier} and all its contents:\n` +
              `- ${impact.issues.length} issues\n` +
              `- ${impact.components.length} components\n` +
              `- ${impact.milestones.length} milestones\n` +
              `- ${impact.templates.length} templates`,
          },
        ],
      };
    } catch (error) {
      throw HulyError.database('delete project', error);
    }
  }

  /**
   * Archive a project (soft delete)
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Archive result
   */
  async archiveProject(client, projectIdentifier) {
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    if (project.archived) {
      throw new HulyError('ALREADY_ARCHIVED', `Project ${projectIdentifier} is already archived`, {
        context: 'Project archive status',
        suggestion: 'Use unarchive operation to restore',
      });
    }

    try {
      await client.updateDoc(tracker.class.Project, project.space, project._id, { archived: true });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Archived project ${projectIdentifier}\n\nThe project and all its data are preserved but hidden from active views.`,
          },
        ],
      };
    } catch (error) {
      throw HulyError.database('archive project', error);
    }
  }

  /**
   * Delete a component
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} componentLabel - Component label
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteComponent(client, projectIdentifier, componentLabel, options = {}) {
    const { force = false, dryRun = false } = options;

    // Find project
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    // Find component
    const component = await client.findOne(tracker.class.Component, {
      space: project._id,
      label: componentLabel,
    });
    if (!component) {
      throw HulyError.notFound('component', componentLabel);
    }

    // Check for issues using this component
    const affectedIssues = await client.findAll(tracker.class.Issue, {
      space: project._id,
      component: component._id,
    });

    if (dryRun) {
      return {
        content: [
          {
            type: 'text',
            text:
              `Component deletion preview: ${componentLabel}\n\n` +
              `Affected issues: ${affectedIssues.length}\n${affectedIssues
                .slice(0, 10)
                .map((i) => `- ${i.identifier}: ${i.title}`)
                .join(
                  '\n'
                )}${affectedIssues.length > 10 ? `\n... and ${affectedIssues.length - 10} more` : ''}`,
          },
        ],
      };
    }

    if (!force && affectedIssues.length > 0) {
      throw new HulyError(
        'DELETION_BLOCKED',
        `Cannot delete component ${componentLabel}: ${affectedIssues.length} issues use this component`,
        {
          context: 'Component is in use',
          suggestion: 'Remove component from issues first or use force option',
          data: { affectedCount: affectedIssues.length },
        }
      );
    }

    try {
      // Remove component from all issues
      for (const issue of affectedIssues) {
        await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { component: null });
      }

      // Delete the component
      await client.removeDoc(tracker.class.Component, project._id, component._id);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Deleted component "${componentLabel}" from project ${projectIdentifier}\n${
              affectedIssues.length > 0 ? `\nRemoved from ${affectedIssues.length} issues` : ''
            }`,
          },
        ],
      };
    } catch (error) {
      throw HulyError.database('delete component', error);
    }
  }

  /**
   * Delete a milestone
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} milestoneLabel - Milestone label
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteMilestone(client, projectIdentifier, milestoneLabel, options = {}) {
    const { force = false, dryRun = false } = options;

    // Find project
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    // Find milestone
    const milestone = await client.findOne(tracker.class.Milestone, {
      space: project._id,
      label: milestoneLabel,
    });
    if (!milestone) {
      throw HulyError.notFound('milestone', milestoneLabel);
    }

    // Check for issues using this milestone
    const affectedIssues = await client.findAll(tracker.class.Issue, {
      space: project._id,
      milestone: milestone._id,
    });

    if (dryRun) {
      return {
        content: [
          {
            type: 'text',
            text:
              `Milestone deletion preview: ${milestoneLabel}\n\n` +
              `Affected issues: ${affectedIssues.length}\n${affectedIssues
                .slice(0, 10)
                .map((i) => `- ${i.identifier}: ${i.title}`)
                .join(
                  '\n'
                )}${affectedIssues.length > 10 ? `\n... and ${affectedIssues.length - 10} more` : ''}`,
          },
        ],
      };
    }

    if (!force && affectedIssues.length > 0) {
      throw new HulyError(
        'DELETION_BLOCKED',
        `Cannot delete milestone ${milestoneLabel}: ${affectedIssues.length} issues use this milestone`,
        {
          context: 'Milestone is in use',
          suggestion: 'Remove milestone from issues first or use force option',
          data: { affectedCount: affectedIssues.length },
        }
      );
    }

    try {
      // Remove milestone from all issues
      for (const issue of affectedIssues) {
        await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { milestone: null });
      }

      // Delete the milestone
      await client.removeDoc(tracker.class.Milestone, project._id, milestone._id);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Deleted milestone "${milestoneLabel}" from project ${projectIdentifier}\n${
              affectedIssues.length > 0 ? `\nRemoved from ${affectedIssues.length} issues` : ''
            }`,
          },
        ],
      };
    } catch (error) {
      throw HulyError.database('delete milestone', error);
    }
  }

  /**
   * Analyze the impact of deleting an issue
   * @param {Object} client - Huly client instance
   * @param {string} issueIdentifier - Issue identifier
   * @returns {Promise<Object>} Impact analysis
   */
  async analyzeIssueDeletionImpact(client, issueIdentifier) {
    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });
    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    const impact = {
      issue: {
        identifier: issueIdentifier,
        title: issue.title,
      },
      subIssues: [],
      comments: 0,
      attachments: issue.attachments || 0,
      relations: [],
      blockers: [],
    };

    // Find sub-issues
    if (issue.subIssues > 0) {
      const subIssues = await client.findAll(tracker.class.Issue, {
        attachedTo: issue._id,
      });
      impact.subIssues = subIssues.map((sub) => ({
        identifier: sub.identifier,
        title: sub.title,
      }));
    }

    // Check for blocking relations
    if (issue.relations && issue.relations.length > 0) {
      for (const relation of issue.relations) {
        if (relation.type === 'blocks') {
          const blockedIssue = await client.findOne(tracker.class.Issue, { _id: relation.target });
          if (blockedIssue) {
            impact.blockers.push(`Blocks ${blockedIssue.identifier}`);
          }
        }
      }
    }

    // Count comments (simplified - would need to query comments collection)
    impact.comments = issue.comments || 0;

    return impact;
  }

  /**
   * Analyze the impact of deleting a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Impact analysis
   */
  async analyzeProjectDeletionImpact(client, projectIdentifier) {
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    const impact = {
      project: {
        identifier: projectIdentifier,
        name: project.name,
      },
      issues: [],
      components: [],
      milestones: [],
      templates: [],
      blockers: [],
    };

    // Find all issues
    const issues = await client.findAll(tracker.class.Issue, { space: project._id });
    impact.issues = issues.map((i) => ({
      identifier: i.identifier,
      title: i.title,
    }));

    // Find components
    const components = await client.findAll(tracker.class.Component, { space: project._id });
    impact.components = components;

    // Find milestones
    const milestones = await client.findAll(tracker.class.Milestone, { space: project._id });
    impact.milestones = milestones;

    // Find templates
    const templates = await client.findAll(tracker.class.IssueTemplate, { space: project._id });
    impact.templates = templates;

    // Check for blockers
    if (issues.some((i) => i.status !== 'done' && i.status !== 'canceled')) {
      impact.blockers.push('Project has active issues');
    }

    if (project.githubIntegration) {
      impact.blockers.push('Project has GitHub integration enabled');
    }

    return impact;
  }

  // Helper methods

  async _deleteIssueRecursive(client, issue, deletedItems) {
    // Find and delete sub-issues first
    const subIssues = await client.findAll(tracker.class.Issue, {
      attachedTo: issue._id,
    });

    for (const subIssue of subIssues) {
      await this._deleteIssueRecursive(client, subIssue, deletedItems);
    }

    // Delete the issue
    await client.removeCollection(
      tracker.class.Issue,
      issue.space,
      issue._id,
      issue.attachedTo,
      issue.attachedToClass,
      issue.collection
    );

    deletedItems.push({
      type: 'issue',
      identifier: issue.identifier,
      title: issue.title,
    });
  }

  _formatImpactAnalysis(impact, entityType, identifier) {
    let result = `# Deletion Impact Analysis\n\n`;
    result += `**${entityType}**: ${identifier}\n\n`;

    if (entityType === 'issue') {
      result += `## Affected Items\n\n`;
      result += `- Sub-issues: ${impact.subIssues.length}\n`;
      result += `- Comments: ${impact.comments}\n`;
      result += `- Attachments: ${impact.attachments}\n`;

      if (impact.subIssues.length > 0) {
        result += `\n### Sub-issues to be deleted:\n`;
        impact.subIssues.forEach((sub) => {
          result += `- ${sub.identifier}: ${sub.title}\n`;
        });
      }

      if (impact.blockers.length > 0) {
        result += `\n### ⚠️ Blockers:\n`;
        impact.blockers.forEach((blocker) => {
          result += `- ${blocker}\n`;
        });
      }
    } else if (entityType === 'project') {
      result += `## Project Contents\n\n`;
      result += `- Issues: ${impact.issues.length}\n`;
      result += `- Components: ${impact.components.length}\n`;
      result += `- Milestones: ${impact.milestones.length}\n`;
      result += `- Templates: ${impact.templates.length}\n`;

      if (impact.blockers.length > 0) {
        result += `\n### ⚠️ Blockers:\n`;
        impact.blockers.forEach((blocker) => {
          result += `- ${blocker}\n`;
        });
      }
    }

    result += `\n*This is a preview. Use force option to proceed with deletion.*`;
    return result;
  }

  _formatDeletionResult(deletedItems) {
    let result = `✅ Successfully deleted ${deletedItems.length} item(s):\n\n`;

    deletedItems.forEach((item) => {
      result += `- ${item.type}: ${item.identifier} - ${item.title}\n`;
    });

    return result;
  }

  _formatBulkDeletionResult(results) {
    let text = `# Bulk Deletion Results\n\n`;
    text += `Total: ${results.total}\n`;
    text += `Succeeded: ${results.succeeded.length}\n`;
    text += `Failed: ${results.failed.length}\n`;
    text += `Skipped (dry run): ${results.skipped.length}\n\n`;

    if (results.failed.length > 0) {
      text += `## Failed Deletions\n\n`;
      results.failed.forEach((item) => {
        text += `- ${item.identifier}: ${item.error}\n`;
      });
    }

    return text;
  }
}

// Export singleton instance
export const deletionService = new DeletionService();
