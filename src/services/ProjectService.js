/**
 * ProjectService - Service for managing Huly projects
 *
 * Handles all project-related operations including projects,
 * components, milestones, and GitHub repository integrations
 */

import trackerModule from '@hcengineering/tracker';
import coreModule from '@hcengineering/core';
import { HulyError } from '../core/HulyError.js';
import { MILESTONE_STATUS_MAP, MILESTONE_STATUS_NAMES } from '../core/constants.js';
import { isValidProjectIdentifier, isValidISODate } from '../utils/validators.js';
import { deletionService } from './DeletionService.js';

const tracker = trackerModule.default || trackerModule;
const core = coreModule.default || coreModule;
const { generateId } = coreModule;

/**
 * Service class for project operations
 */
export class ProjectService {
  /**
   * Create a ProjectService instance
   */
  constructor() {
    // Service can be extended with configuration if needed
  }

  /**
   * List all projects in the workspace
   * @param {Object} client - Huly client instance
   * @returns {Promise<Object>} Formatted project list response
   */
  async listProjects(client) {
    const projects = await client.findAll(tracker.class.Project, {}, { sort: { modifiedOn: -1 } });

    let result = `Found ${projects.length} projects:\n\n`;

    for (const project of projects) {
      const issueCount = await client.findAll(tracker.class.Issue, { space: project._id });

      result += `📁 ${project.name} (${project.identifier})\n`;
      if (project.description) {
        result += `   Description: ${project.description}\n`;
      }
      result += `   Issues: ${issueCount.length}\n`;
      result += `   Private: ${project.private || false}\n`;
      result += `   Archived: ${project.archived || false}\n`;

      // List project owners if any
      if (project.owners && project.owners.length > 0) {
        result += `   Owners: ${project.owners.length}\n`;
      }

      result += '\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  /**
   * Create a new project
   * @param {Object} client - Huly client instance
   * @param {string} name - Project name
   * @param {string} description - Project description
   * @param {string} identifier - Project identifier (auto-generated if not provided)
   * @returns {Promise<Object>} Created project response
   */
  async createProject(client, name, description = '', identifier) {
    const projectId = generateId();

    // Generate identifier if not provided
    if (!identifier) {
      identifier = name
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .substring(0, 5);
    }

    // Validate identifier format
    if (!isValidProjectIdentifier(identifier)) {
      throw HulyError.invalidValue('identifier', identifier, '1-5 uppercase letters/numbers');
    }

    // Check if identifier already exists
    const existingProject = await client.findOne(tracker.class.Project, { identifier });

    if (existingProject) {
      throw new HulyError(
        'VALIDATION_ERROR',
        `Project with identifier '${identifier}' already exists`,
        {
          context: 'Project identifier must be unique',
          suggestion: 'Use a different identifier',
          data: { identifier },
        }
      );
    }

    // Create the project
    await client.createDoc(
      tracker.class.Project,
      core.class.Space,
      {
        name,
        description,
        identifier,
        private: false,
        archived: false,
        members: [],
        sequence: 0,
        owners: [],
      },
      projectId
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created project: ${name} (${identifier})\n\nProject ID: ${projectId}${description ? `\nDescription: ${description}` : ''}`,
        },
      ],
    };
  }

  /**
   * Find a project by identifier
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Project object
   * @throws {HulyError} If project not found
   */
  async findProject(client, projectIdentifier) {
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });

    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    return project;
  }

  /**
   * Create a component in a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} label - Component label
   * @param {string} description - Component description
   * @returns {Promise<Object>} Created component response
   */
  async createComponent(client, projectIdentifier, label, description = '') {
    const project = await this.findProject(client, projectIdentifier);
    const componentId = generateId();

    await client.createDoc(
      tracker.class.Component,
      project._id,
      {
        label,
        description,
        lead: null,
        attachments: 0,
        comments: 0,
      },
      componentId
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created component "${label}" in project ${projectIdentifier}\n\nComponent ID: ${componentId}${description ? `\nDescription: ${description}` : ''}`,
        },
      ],
    };
  }

  /**
   * List components in a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Component list response
   */
  async listComponents(client, projectIdentifier) {
    const project = await this.findProject(client, projectIdentifier);

    const components = await client.findAll(tracker.class.Component, { space: project._id });

    let result = `Found ${components.length} components in project ${projectIdentifier}:\n\n`;

    for (const component of components) {
      result += `🏷️  ${component.label}\n`;
      if (component.description) {
        result += `   Description: ${component.description}\n`;
      }
      if (component.lead) {
        result += `   Lead: ${component.lead}\n`;
      }
      result += '\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  /**
   * Create a milestone in a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} label - Milestone label
   * @param {string} description - Milestone description
   * @param {string} targetDate - Target date in ISO format
   * @param {string} status - Milestone status
   * @returns {Promise<Object>} Created milestone response
   */
  async createMilestone(
    client,
    projectIdentifier,
    label,
    description = '',
    targetDate,
    status = 'planned'
  ) {
    const project = await this.findProject(client, projectIdentifier);

    // Map status strings to MilestoneStatus enum values
    const statusValue = MILESTONE_STATUS_MAP[status] ?? 0;

    // Validate target date
    if (!isValidISODate(targetDate)) {
      throw HulyError.invalidValue('target_date', targetDate, 'ISO 8601 format (e.g., 2024-12-31)');
    }
    const targetTimestamp = Date.parse(targetDate);

    const milestoneId = generateId();

    await client.createDoc(
      tracker.class.Milestone,
      project._id,
      {
        label,
        description,
        status: statusValue,
        targetDate: targetTimestamp,
        attachments: 0,
        comments: 0,
      },
      milestoneId
    );

    const statusName = MILESTONE_STATUS_NAMES[statusValue] || 'Unknown';

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created milestone "${label}" in project ${projectIdentifier}\n\nMilestone ID: ${milestoneId}\nStatus: ${statusName}\nTarget Date: ${new Date(targetTimestamp).toISOString().split('T')[0]}${description ? `\nDescription: ${description}` : ''}`,
        },
      ],
    };
  }

  /**
   * List milestones in a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Milestone list response
   */
  async listMilestones(client, projectIdentifier) {
    const project = await this.findProject(client, projectIdentifier);

    const milestones = await client.findAll(tracker.class.Milestone, { space: project._id });

    let result = `Found ${milestones.length} milestones in project ${projectIdentifier}:\n\n`;

    for (const milestone of milestones) {
      const statusName = MILESTONE_STATUS_NAMES[milestone.status] || 'Unknown';
      result += `🎯 ${milestone.label}\n`;
      result += `   Status: ${statusName}\n`;
      if (milestone.targetDate) {
        result += `   Target Date: ${new Date(milestone.targetDate).toISOString().split('T')[0]}\n`;
      }
      if (milestone.description) {
        result += `   Description: ${milestone.description}\n`;
      }
      result += '\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  /**
   * List available GitHub repositories
   * @param {Object} client - Huly client instance
   * @returns {Promise<Object>} Repository list response
   */
  async listGithubRepositories(client) {
    try {
      // List all GitHub integration repositories using string class reference
      const repositories = await client.findAll('github:class:GithubIntegrationRepository', {});

      let result = `Found ${repositories.length} GitHub repositories available:\n\n`;

      for (const repo of repositories) {
        result += `📦 ${repo.name}`;
        if (repo.githubProject) {
          // Find the associated project
          const project = await client.findOne(tracker.class.Project, { _id: repo.githubProject });
          if (project) {
            result += ` → Assigned to project: ${project.identifier}`;
          }
        } else {
          result += ' (unassigned)';
        }
        result += '\n';

        if (repo.url) {
          result += `   URL: ${repo.url}\n`;
        }
        if (repo.enabled !== undefined) {
          result += `   Enabled: ${repo.enabled ? 'Yes' : 'No'}\n`;
        }

        result += '\n';
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      throw HulyError.database('list GitHub repositories', error);
    }
  }

  /**
   * Assign a GitHub repository to a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} repositoryName - Repository name
   * @returns {Promise<Object>} Assignment result response
   */
  async assignRepositoryToProject(client, projectIdentifier, repositoryName) {
    try {
      // Find the project
      const project = await this.findProject(client, projectIdentifier);

      // Find the repository by name
      const availableRepos = await client.findAll('github:class:GithubIntegrationRepository', {});

      let repository = null;

      // First try exact match
      repository = availableRepos.find((r) => r.name === repositoryName);

      // If not found, try without organization prefix
      if (!repository && repositoryName.includes('/')) {
        const repoNameOnly = repositoryName.split('/').pop();
        repository = availableRepos.find((r) => {
          const nameOnly = r.name.split('/').pop();
          return nameOnly === repoNameOnly;
        });
      }

      if (!repository) {
        // Create informative error message
        let errorMsg = `Repository "${repositoryName}" not found.`;

        if (availableRepos.length > 0) {
          errorMsg += '\n\nAvailable repositories:\n';
          availableRepos.forEach((r) => {
            errorMsg += `- ${r.name}${r.githubProject ? ' (already assigned)' : ''}\n`;
          });
        } else {
          errorMsg +=
            ' No GitHub repositories are available. Please check your GitHub integration.';
        }

        throw new HulyError('REPOSITORY_NOT_FOUND', errorMsg, {
          context: `Repository '${repositoryName}' not found`,
          suggestion:
            availableRepos.length > 0
              ? `Available repositories: ${availableRepos
                  .slice(0, 5)
                  .map((r) => r.name)
                  .join(', ')}`
              : 'No GitHub repositories are available. Please check your GitHub integration.',
          data: {
            repositoryName,
            availableCount: availableRepos.length,
            searchedFormats: repositoryName.includes('/') ? ['exact', 'name-only'] : ['exact'],
          },
        });
      }

      // Check if already assigned
      if (repository.githubProject) {
        throw new HulyError(
          'VALIDATION_ERROR',
          `Repository "${repositoryName}" is already assigned to another project`,
          {
            context: 'Repository can only be assigned to one project',
            suggestion: 'Unassign from current project first',
            data: { repositoryName, currentProject: repository.githubProject },
          }
        );
      }

      // Update the repository with the project assignment
      await client.updateDoc(
        'github:class:GithubIntegrationRepository',
        repository.space,
        repository._id,
        {
          githubProject: project._id,
        }
      );

      // Also ensure the project has the integration enabled
      if (!project.githubIntegration) {
        await client.updateDoc(tracker.class.Project, project.space, project._id, {
          githubIntegration: true,
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully assigned repository "${repositoryName}" to project ${projectIdentifier}\n\nThe GitHub integration is now active for this project. Issues and pull requests from this repository will be synchronized.`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof HulyError) {
        throw error;
      }
      throw HulyError.database('assign repository to project', error);
    }
  }

  /**
   * Delete a project and all its contents
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProject(client, projectIdentifier, options = {}) {
    return deletionService.deleteProject(client, projectIdentifier, options);
  }

  /**
   * Archive a project (soft delete)
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Archive result
   */
  async archiveProject(client, projectIdentifier) {
    return deletionService.archiveProject(client, projectIdentifier);
  }

  /**
   * Delete a component from a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} componentLabel - Component label
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteComponent(client, projectIdentifier, componentLabel, options = {}) {
    return deletionService.deleteComponent(client, projectIdentifier, componentLabel, options);
  }

  /**
   * Delete a milestone from a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @param {string} milestoneLabel - Milestone label
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteMilestone(client, projectIdentifier, milestoneLabel, options = {}) {
    return deletionService.deleteMilestone(client, projectIdentifier, milestoneLabel, options);
  }

  /**
   * Analyze the impact of deleting a project
   * @param {Object} client - Huly client instance
   * @param {string} projectIdentifier - Project identifier
   * @returns {Promise<Object>} Impact analysis
   */
  async analyzeProjectDeletionImpact(client, projectIdentifier) {
    return deletionService.analyzeProjectDeletionImpact(client, projectIdentifier);
  }
}

// Export a singleton instance
export const projectService = new ProjectService();
