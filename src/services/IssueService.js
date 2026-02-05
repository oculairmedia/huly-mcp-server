/**
 * IssueService - Handles all issue-related operations
 *
 * Provides methods for creating, updating, listing, and searching issues
 * in the Huly project management system.
 */

import { HulyError } from '../core/HulyError.js';
import { PRIORITY_MAP, DEFAULTS } from '../core/constants.js';
import { extractTextFromMarkup, extractTextFromDoc } from '../utils/textExtractor.js';
import { urlGenerator } from '../utils/urlGenerator.js';
import {
  validateEnum,
  getValidPriorities,
  normalizePriority,
  isValidUpdateField,
} from '../utils/validators.js';
import {
  normalizeStatus as fuzzyNormalizeStatus,
  normalizePriority as fuzzyNormalizePriority,
  fuzzyMatch,
  normalizeProjectIdentifier,
  normalizeLabel,
  normalizeDate,
  normalizeSearchQuery,
} from '../utils/fuzzyNormalizer.js';
import { deletionService } from './DeletionService.js';
import trackerModule from '@hcengineering/tracker';
import coreModule from '@hcengineering/core';
import chunterModule from '@hcengineering/chunter';
import activityModule from '@hcengineering/activity';
import taskModule from '@hcengineering/task';

const tracker = trackerModule.default || trackerModule;
const core = coreModule.default || coreModule;
const chunter = chunterModule.default || chunterModule;
const _activity = activityModule.default || activityModule;
const _task = taskModule.default || taskModule;

class IssueService {
  constructor(statusManager = null, sequenceService = null) {
    this.statusManager = statusManager;
    this.sequenceService = sequenceService;

    // HULLY-235: Metadata cache with 5-minute TTL
    this._metadataCache = new Map();
    this._cacheTTLMs = 5 * 60 * 1000;
  }

  _getCacheKey(type, identifier) {
    return `${type}:${identifier}`;
  }

  _isCacheValid(cached) {
    return cached && Date.now() - cached.timestamp < this._cacheTTLMs;
  }

  async _getCachedProject(client, identifier) {
    const cacheKey = this._getCacheKey('project', identifier);
    const cached = this._metadataCache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const project = await client.findOne(tracker.class.Project, { identifier });
    if (project) {
      this._metadataCache.set(cacheKey, { data: project, timestamp: Date.now() });
    }
    return project;
  }

  async _getCachedComponents(client, projectId) {
    const cacheKey = this._getCacheKey('components', projectId);
    const cached = this._metadataCache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const components = await client.findAll(tracker.class.Component, { space: projectId });
    this._metadataCache.set(cacheKey, { data: components, timestamp: Date.now() });
    return components;
  }

  async _getCachedMilestones(client, projectId) {
    const cacheKey = this._getCacheKey('milestones', projectId);
    const cached = this._metadataCache.get(cacheKey);

    if (this._isCacheValid(cached)) {
      return cached.data;
    }

    const milestones = await client.findAll(tracker.class.Milestone, { space: projectId });
    this._metadataCache.set(cacheKey, { data: milestones, timestamp: Date.now() });
    return milestones;
  }

  invalidateCache(type = null, identifier = null) {
    if (type && identifier) {
      this._metadataCache.delete(this._getCacheKey(type, identifier));
    } else {
      this._metadataCache.clear();
    }
  }

  async listIssues(
    client,
    projectIdentifier,
    limit = DEFAULTS.LIST_LIMIT,
    includeDescriptions = true
  ) {
    const project = await this._getCachedProject(client, projectIdentifier);

    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    const issues = await client.findAll(
      tracker.class.Issue,
      { space: project._id },
      {
        limit,
        sort: { modifiedOn: -1 },
      }
    );

    const components = await this._getCachedComponents(client, project._id);
    const milestones = await this._getCachedMilestones(client, project._id);

    const componentMap = new Map(components.map((c) => [c._id, c]));
    const milestoneMap = new Map(milestones.map((m) => [m._id, m]));

    // Batch fetch all assignees upfront to avoid N+1 queries
    const assigneeIds = [...new Set(issues.map((i) => i.assignee).filter(Boolean))];
    const assignees =
      assigneeIds.length > 0 && core?.class?.Account
        ? await client.findAll(core.class.Account, { _id: { $in: assigneeIds } })
        : [];
    const assigneeMap = new Map(assignees.map((a) => [a._id, a]));

    const descriptionMap = await this._fetchDescriptionsBatch(client, issues, includeDescriptions);

    let result = `Found ${issues.length} issues in ${project.name}:\n\n`;

    for (const issue of issues) {
      const issueUrl = urlGenerator.getIssueUrl(projectIdentifier, issue.identifier);
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;
      if (issueUrl) {
        result += `   🔗 ${issueUrl}\n`;
      }

      try {
        const humanStatus = this.statusManager.toHumanStatus(issue.status);
        const statusDescription = this.statusManager.getStatusDescription(issue.status);
        result += `   Status: ${humanStatus} (${statusDescription})\n`;
      } catch {
        result += `   Status: ${issue.status}\n`;
      }

      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[issue.priority] || 'Not set';
      result += `   Priority: ${priorityName}\n`;

      if (issue.assignee) {
        const assignee = assigneeMap.get(issue.assignee);
        result += `   Assignee: ${assignee?.email || 'Unknown'}\n`;
      }

      if (issue.component) {
        const component = componentMap.get(issue.component);
        result += `   Component: ${component?.label || 'Unknown'}\n`;
      }

      if (issue.milestone) {
        const milestone = milestoneMap.get(issue.milestone);
        result += `   Milestone: ${milestone?.label || 'Unknown'}\n`;
      }

      if (includeDescriptions && issue.description) {
        const descText = descriptionMap.get(issue._id) || '';
        if (descText.trim()) {
          const preview = descText.length > 100 ? `${descText.substring(0, 100)}...` : descText;
          result += `   Description: ${preview}\n`;
        }
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
   * Create a new issue
   */
  async createIssue(
    client,
    projectIdentifier,
    title,
    description = '',
    priority = 'NoPriority',
    component = null,
    milestone = null
  ) {
    // Validate priority
    priority = validateEnum(priority, 'priority', getValidPriorities(), 'NoPriority');

    const project = await this._getCachedProject(client, projectIdentifier);

    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    // Get the default status for new issues (Backlog)
    let defaultStatus;
    let defaultStatusName = 'Backlog';
    try {
      // Find all statuses in the project
      let statuses = await client.findAll(tracker.class.IssueStatus, {
        space: project._id,
      });

      // If no project-specific statuses, use global/model statuses
      if (statuses.length === 0) {
        statuses = await client.findAll(tracker.class.IssueStatus, {
          space: 'core:space:Model',
        });
      }

      // Look for "Backlog" status or use the first available status
      const backlogStatus = statuses.find((s) => s.name === 'Backlog');
      const selectedStatus = backlogStatus || statuses[0];

      if (!selectedStatus) {
        throw new Error('No statuses found in project or model space');
      }

      defaultStatus = selectedStatus._id;
      defaultStatusName = selectedStatus.name;
    } catch (error) {
      console.error('Error getting default status:', error);
      throw new HulyError('OPERATION_FAILED', 'Failed to get default status for project', {
        context: error.message,
        data: { project: project.identifier },
      });
    }

    // Generate issue number atomically
    let number;
    if (this.sequenceService) {
      number = await this.sequenceService.getNextIssueNumber(client, project._id);
    } else {
      // Fallback to old method if SequenceService not available
      const lastOne = await client.findOne(
        tracker.class.Issue,
        { space: project._id },
        { sort: { number: -1 } }
      );
      number = (lastOne?.number ?? 0) + 1;
    }
    const identifier = `${project.identifier}-${number}`;

    let componentId = null;
    if (component) {
      const components = await this._getCachedComponents(client, project._id);
      const normalizedComponent = normalizeLabel(component, components);
      const foundComponent = components.find((c) => c.label === normalizedComponent);
      if (foundComponent) {
        componentId = foundComponent._id;
      }
    }

    let milestoneId = null;
    if (milestone) {
      const milestones = await this._getCachedMilestones(client, project._id);

      const normalizedMilestone = normalizeLabel(milestone, milestones);
      const foundMilestone = milestones.find((m) => m.label === normalizedMilestone);
      if (foundMilestone) {
        milestoneId = foundMilestone._id;
      }
    }

    const issueData = {
      title,
      description: description || '', // Use provided description or empty string
      assignee: null,
      component: componentId,
      milestone: milestoneId,
      number,
      identifier,
      priority: PRIORITY_MAP[priority],
      rank: '',
      status: defaultStatus,
      doneState: null,
      dueTo: null,
      attachedTo: tracker.ids.NoParent,
      parents: [], // Empty array for top-level issues (required for OnIssueUpdate trigger)
      comments: 0,
      subIssues: 0,
      estimation: 0,
      remainingTime: 0, // Should match estimation initially
      reportedTime: 0,
      childInfo: [],
      relations: [],
      kind: tracker.taskTypes.Issue,
    };

    const issueId = await client.addCollection(
      tracker.class.Issue,
      project._id,
      issueData.attachedTo,
      tracker.class.Issue,
      'subIssues',
      issueData
    );

    // Now upload description using the actual issue ID
    if (description && description.trim()) {
      try {
        const descriptionRef = await client.uploadMarkup(
          tracker.class.Issue,
          issueId,
          'description',
          description.trim(),
          'markdown' // Use markdown format for plain text
        );

        // Update the issue with the description reference
        await client.updateDoc(tracker.class.Issue, project._id, issueId, {
          description: descriptionRef,
        });
      } catch (error) {
        console.error('Error creating description:', error);
        // Continue without description rather than failing
      }
    }

    // Status name is already set from defaultStatusName

    const priorityName =
      Object.keys(PRIORITY_MAP).find((key) => PRIORITY_MAP[key] === issueData.priority) ||
      'NoPriority';

    // Generate issue URL
    const issueUrl = urlGenerator.getIssueUrl(project.identifier, identifier);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created issue ${identifier}: "${title}"\n\nPriority: ${priorityName}\nStatus: ${defaultStatusName}\nProject: ${project.name}${issueUrl ? `\n🔗 ${issueUrl}` : ''}`,
        },
      ],
      data: {
        identifier,
        project: project.identifier,
        status: defaultStatusName,
        priority: priorityName,
        url: issueUrl,
      },
    };
  }

  /**
   * Update an issue
   */
  async updateIssue(client, issueIdentifier, field, value) {
    // Validate field name
    if (!isValidUpdateField(field)) {
      throw HulyError.invalidValue(
        'field',
        field,
        'title, description, status, priority, component, or milestone'
      );
    }

    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });

    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    const updateData = {};
    let displayValue = value;

    switch (field) {
      case 'title':
        updateData.title = value;
        break;

      case 'description': {
        // Create new description markup
        let descriptionRef = '';
        if (value && value.trim()) {
          try {
            descriptionRef = await this._createDescriptionMarkup(client, issue._id, value);
          } catch (error) {
            console.error('Error creating description:', error);
            throw HulyError.operationFailed('Failed to update description', {
              error: error.message,
            });
          }
        }
        updateData.description = descriptionRef;
        break;
      }

      case 'status':
        try {
          // Find all statuses in the project first
          let statuses = await client.findAll(tracker.class.IssueStatus, {
            space: issue.space,
          });

          // If no project-specific statuses, look for global/model statuses
          if (statuses.length === 0) {
            console.log('No project-specific statuses found, looking for global statuses...');
            statuses = await client.findAll(tracker.class.IssueStatus, {
              space: 'core:space:Model',
            });
          }

          console.log(
            'Available statuses:',
            statuses.map((s) => ({
              id: s._id,
              name: s.name,
              category: s.category,
            }))
          );

          // First try fuzzy normalization with our standard mappings
          const normalizedValue = fuzzyNormalizeStatus(value);

          // Find matching status by normalized name (case-insensitive)
          let targetStatus = statuses.find(
            (s) => s.name.toLowerCase() === normalizedValue.toLowerCase()
          );

          // If no exact match with normalized value, try original value
          if (!targetStatus) {
            targetStatus = statuses.find((s) => s.name.toLowerCase() === value.toLowerCase());
          }

          // If still no match, try _normalizeStatusValue method for backward compatibility
          if (!targetStatus) {
            const legacyNormalized = this._normalizeStatusValue(value);
            targetStatus = statuses.find((s) => {
              const normalizedStatusName = this._normalizeStatusValue(s.name);
              return normalizedStatusName === legacyNormalized;
            });
          }

          // If still no match, try legacy fuzzy matching for backward compatibility
          if (!targetStatus) {
            const legacyFuzzyMatch = this._fuzzyMatchStatus(value, statuses);
            if (legacyFuzzyMatch) {
              targetStatus = legacyFuzzyMatch;
            }
          }

          // If still no match, try fuzzy matching against all status names
          if (!targetStatus && statuses.length > 0) {
            const statusNames = statuses.map((s) => s.name);
            const fuzzyMatchedName = fuzzyMatch(value, statusNames, 0.7);
            if (fuzzyMatchedName) {
              targetStatus = statuses.find((s) => s.name === fuzzyMatchedName);
            }
          }

          if (!targetStatus) {
            // Provide helpful error with available status names
            const availableStatuses = statuses.map((s) => s.name);
            console.log('Status not found. Available:', availableStatuses);
            console.log('Attempted to match:', value, 'normalized as:', normalizedValue);
            throw HulyError.invalidValue(
              'status',
              value,
              `Available statuses: ${availableStatuses.join(', ')}. Try one of these exact values.`
            );
          }

          updateData.status = targetStatus._id; // Use the actual UUID
          displayValue = targetStatus.name;
        } catch (error) {
          if (error instanceof HulyError) {
            throw error;
          }
          throw new HulyError('OPERATION_FAILED', 'Failed to update status', {
            context: error.message,
          });
        }
        break;

      case 'priority': {
        // Normalize and validate priority
        const normalizedPriority = normalizePriority(value);
        if (!normalizedPriority) {
          throw HulyError.invalidValue(
            'priority',
            value,
            'low, medium, high, urgent, or nopriority'
          );
        }

        updateData.priority = PRIORITY_MAP[normalizedPriority];
        displayValue = normalizedPriority === 'NoPriority' ? 'No Priority' : normalizedPriority;
        break;
      }

      case 'component': {
        if (!value) {
          // Clear component if value is empty
          updateData.component = null;
          break;
        }

        // Find all components in the project
        const allComponents = await client.findAll(tracker.class.Component, {
          space: issue.space,
        });

        // Use fuzzy matching to find the best match
        const normalizedComponent = normalizeLabel(value, allComponents);

        // Find component by normalized label
        let component = await client.findOne(tracker.class.Component, {
          space: issue.space,
          label: normalizedComponent,
        });

        // If no exact match, try fuzzy match
        if (!component && allComponents.length > 0) {
          component = allComponents.find(
            (c) => c.label && fuzzyMatch(value, [c.label], 0.7) === c.label
          );
        }

        if (!component) {
          throw HulyError.notFound('component', value);
        }

        updateData.component = component._id;
        displayValue = component.label;
        break;
      }

      case 'milestone': {
        if (!value) {
          // Clear milestone if value is empty
          updateData.milestone = null;
          break;
        }

        // Find all milestones in the project
        const allMilestones = await client.findAll(tracker.class.Milestone, {
          space: issue.space,
        });

        // Use fuzzy matching to find the best match
        const normalizedMilestone = normalizeLabel(value, allMilestones);

        // Find milestone by normalized label
        let milestone = await client.findOne(tracker.class.Milestone, {
          space: issue.space,
          label: normalizedMilestone,
        });

        // If no exact match, try fuzzy match
        if (!milestone && allMilestones.length > 0) {
          milestone = allMilestones.find(
            (m) => m.label && fuzzyMatch(value, [m.label], 0.7) === m.label
          );
        }

        if (!milestone) {
          throw HulyError.notFound('milestone', value);
        }

        updateData.milestone = milestone._id;
        displayValue = milestone.label;
        break;
      }

      default:
        throw HulyError.invalidValue(
          'field',
          field,
          'title, description, status, priority, component, or milestone'
        );
    }

    await client.updateDoc(tracker.class.Issue, issue.space, issue._id, updateData);

    // Get project identifier for URL generation
    const project = await client.findOne(tracker.class.Project, { _id: issue.space });
    const issueUrl = urlGenerator.getIssueUrl(project?.identifier, issueIdentifier);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Updated issue ${issueIdentifier}\n\n${field}: ${displayValue}${issueUrl ? `\n🔗 ${issueUrl}` : ''}`,
        },
      ],
      data: {
        identifier: issueIdentifier,
        project: project?.identifier,
        field,
        value: displayValue,
        url: issueUrl,
      },
    };
  }

  /**
   * Create a subissue
   */
  async createSubissue(
    client,
    parentIssueIdentifier,
    title,
    description = '',
    priority = 'NoPriority',
    component = null,
    milestone = null
  ) {
    // Validate priority
    priority = validateEnum(priority, 'priority', getValidPriorities(), 'NoPriority');

    const parentIssue = await client.findOne(tracker.class.Issue, {
      identifier: parentIssueIdentifier,
    });

    if (!parentIssue) {
      throw HulyError.notFound('parent issue', parentIssueIdentifier);
    }

    // Get project from parent issue's space
    const project = await client.findOne(tracker.class.Project, { _id: parentIssue.space });

    if (!project) {
      throw HulyError.notFound('project', 'for parent issue');
    }

    // Get the default status for new issues
    let defaultStatus;
    let defaultStatusName = 'Backlog';
    try {
      // Find all statuses in the project
      let statuses = await client.findAll(tracker.class.IssueStatus, {
        space: project._id,
      });

      // If no project-specific statuses, use global/model statuses
      if (statuses.length === 0) {
        statuses = await client.findAll(tracker.class.IssueStatus, {
          space: 'core:space:Model',
        });
      }

      // Look for "Backlog" status or use the first available status
      const backlogStatus = statuses.find((s) => s.name === 'Backlog');
      const selectedStatus = backlogStatus || statuses[0];

      if (!selectedStatus) {
        throw new Error('No statuses found in project or model space');
      }

      defaultStatus = selectedStatus._id;
      defaultStatusName = selectedStatus.name;
    } catch (error) {
      console.error('Error getting default status:', error);
      throw new HulyError('OPERATION_FAILED', 'Failed to get default status for project', {
        context: error.message,
        data: { project: project.identifier },
      });
    }

    // Generate issue number atomically
    let number;
    if (this.sequenceService) {
      number = await this.sequenceService.getNextIssueNumber(client, project._id);
    } else {
      // Fallback to old method if SequenceService not available
      const lastOne = await client.findOne(
        tracker.class.Issue,
        { space: project._id },
        { sort: { number: -1 } }
      );
      number = (lastOne?.number ?? 0) + 1;
    }
    const identifier = `${project.identifier}-${number}`;

    // Resolve component if provided, otherwise inherit from parent
    let componentId = parentIssue.component; // Default to parent's component
    if (component) {
      const components = await client.findAll(tracker.class.Component, {
        space: project._id,
      });

      // Use fuzzy matching to find the best match
      const normalizedComponent = normalizeLabel(component, components);

      // Find component by normalized label
      const foundComponent = await client.findOne(tracker.class.Component, {
        space: project._id,
        label: normalizedComponent,
      });

      if (foundComponent) {
        componentId = foundComponent._id;
      }
    }

    // Resolve milestone if provided, otherwise inherit from parent
    let milestoneId = parentIssue.milestone; // Default to parent's milestone
    if (milestone) {
      const milestones = await client.findAll(tracker.class.Milestone, {
        space: project._id,
      });

      // Use fuzzy matching to find the best match
      const normalizedMilestone = normalizeLabel(milestone, milestones);

      // Find milestone by normalized label
      const foundMilestone = await client.findOne(tracker.class.Milestone, {
        space: project._id,
        label: normalizedMilestone,
      });

      if (foundMilestone) {
        milestoneId = foundMilestone._id;
      }
    }

    // Build the parents array - this is required for Huly's OnIssueUpdate trigger
    // to work correctly (updateIssueParentEstimations iterates over parents)
    const parentInfo = {
      parentId: parentIssue._id,
      parentTitle: parentIssue.title,
      space: parentIssue.space,
      identifier: parentIssue.identifier,
    };

    // If parent has its own parents, include them in the hierarchy
    const parentsArray =
      parentIssue.parents && Array.isArray(parentIssue.parents)
        ? [...parentIssue.parents, parentInfo]
        : [parentInfo];

    const issueData = {
      title,
      description: description || '', // Use provided description or empty string
      assignee: null,
      component: componentId,
      milestone: milestoneId,
      number,
      identifier,
      priority: PRIORITY_MAP[priority],
      rank: '',
      status: defaultStatus,
      doneState: null,
      dueTo: null,
      attachedTo: parentIssue._id, // Link to parent
      parents: parentsArray, // Parent hierarchy for OnIssueUpdate trigger
      comments: 0,
      subIssues: 0,
      estimation: 0,
      remainingTime: 0, // Should match estimation initially
      reportedTime: 0,
      childInfo: [],
      relations: [],
      kind: tracker.taskTypes.Issue,
    };

    const issueId = await client.addCollection(
      tracker.class.Issue,
      project._id,
      parentIssue._id,
      tracker.class.Issue,
      'subIssues',
      issueData
    );

    // Now upload description using the actual issue ID
    if (description && description.trim()) {
      try {
        const descriptionRef = await client.uploadMarkup(
          tracker.class.Issue,
          issueId,
          'description',
          description.trim(),
          'markdown' // Use markdown format for plain text
        );

        // Update the issue with the description reference
        await client.updateDoc(tracker.class.Issue, project._id, issueId, {
          description: descriptionRef,
        });
      } catch (error) {
        console.error('Error creating description:', error);
        // Continue without description rather than failing
      }
    }

    // Update parent's subIssues count
    await client.updateDoc(tracker.class.Issue, parentIssue.space, parentIssue._id, {
      subIssues: (parentIssue.subIssues || 0) + 1,
    });

    const priorityName =
      Object.keys(PRIORITY_MAP).find((key) => PRIORITY_MAP[key] === issueData.priority) ||
      'NoPriority';

    // Generate issue URL
    const issueUrl = urlGenerator.getIssueUrl(project.identifier, identifier);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created subissue ${identifier}: "${title}"\n\nParent: ${parentIssueIdentifier}\nPriority: ${priorityName}\nProject: ${project.name}${issueUrl ? `\n🔗 ${issueUrl}` : ''}`,
        },
      ],
      data: {
        identifier,
        project: project.identifier,
        status: defaultStatusName,
        priority: priorityName,
        url: issueUrl,
      },
    };
  }

  /**
   * List comments on an issue
   */
  async listComments(client, issueIdentifier, limit = DEFAULTS.LIST_LIMIT) {
    // Find the issue
    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });

    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    // Find all comments attached to this issue
    const comments = await client.findAll(
      chunter.class.ChatMessage,
      {
        attachedTo: issue._id,
        attachedToClass: tracker.class.Issue,
      },
      {
        sort: { createdOn: -1 },
        limit,
      }
    );

    if (comments.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No comments found on issue ${issueIdentifier}`,
          },
        ],
      };
    }

    const authorIds = [...new Set(comments.map((c) => c.createdBy).filter(Boolean))];
    const authors =
      authorIds.length > 0 && core?.class?.Account
        ? await client.findAll(core.class.Account, { _id: { $in: authorIds } })
        : [];
    const authorMap = new Map(authors.map((a) => [a._id, a]));

    let result = `Found ${comments.length} comments on issue ${issueIdentifier}:\n\n`;

    for (const comment of comments) {
      const author = authorMap.get(comment.createdBy);
      const authorName = author?.email || 'Unknown';

      // Format timestamp
      const timestamp = new Date(comment.createdOn).toLocaleString();

      result += `💬 **${authorName}** - ${timestamp}\n`;

      // Extract comment text
      let commentText = 'No content';
      if (comment.message) {
        // Comments can be plain strings or markup objects
        if (typeof comment.message === 'string') {
          commentText = comment.message;
        } else {
          try {
            commentText = await extractTextFromMarkup(comment.message);
          } catch {
            // If extraction fails, use JSON representation
            commentText = JSON.stringify(comment.message);
          }
        }
      }

      // Truncate long comments
      if (commentText.length > 500) {
        commentText = `${commentText.substring(0, 497)}...`;
      }

      result += `${commentText}\n\n`;
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
   * Create a comment on an issue
   */
  async createComment(client, issueIdentifier, message) {
    // Find the issue
    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });

    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    // Create comment with message
    const commentData = {
      message: message && message.trim() ? message.trim() : '',
      attachedTo: issue._id,
      attachedToClass: tracker.class.Issue,
      collection: 'comments',
    };

    // Use ChatMessage for comments on issues
    await client.addCollection(
      chunter.class.ChatMessage,
      issue.space,
      issue._id,
      tracker.class.Issue,
      'comments',
      commentData
    );

    // Update the issue's comment count
    await client.updateDoc(tracker.class.Issue, issue.space, issue._id, {
      comments: (issue.comments || 0) + 1,
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Added comment to issue ${issueIdentifier}`,
        },
      ],
    };
  }

  /**
   * Get detailed information about an issue
   */
  async getIssueDetails(client, issueIdentifier, includeDescriptions = true) {
    // Find the issue
    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });

    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    // Get project information
    const project = await client.findOne(tracker.class.Project, { _id: issue.space });

    let result = `# ${issue.identifier}: ${issue.title}\n\n`;

    // Issue URL
    const issueUrl = urlGenerator.getIssueUrl(project?.identifier, issue.identifier);
    if (issueUrl) {
      result += `**🔗 Issue URL**: ${issueUrl}\n\n`;
    }

    // Basic information
    result += `**Project**: ${project?.name || 'Unknown'}\n`;

    // Status
    try {
      const humanStatus = this.statusManager.toHumanStatus(issue.status);
      const statusDescription = this.statusManager.getStatusDescription(issue.status);
      result += `**Status**: ${humanStatus} - ${statusDescription}\n`;
    } catch {
      result += `**Status**: ${issue.status}\n`;
    }

    // Priority
    const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
    const priorityName = priorityNames[issue.priority] || 'Not set';
    result += `**Priority**: ${priorityName}\n`;

    // Dates
    result += `**Created**: ${new Date(issue.createdOn).toLocaleString()}\n`;
    result += `**Modified**: ${new Date(issue.modifiedOn).toLocaleString()}\n`;

    if (issue.dueTo) {
      result += `**Due Date**: ${new Date(issue.dueTo).toLocaleDateString()}\n`;
    }

    // Assignee
    if (issue.assignee) {
      if (core?.class?.Account) {
        const assignee = await client.findOne(core.class.Account, { _id: issue.assignee });
        result += `**Assignee**: ${assignee?.email || 'Unknown'}\n`;
      } else {
        result += '**Assignee**: Unknown\n';
      }
    }

    // Component
    if (issue.component) {
      const component = await client.findOne(tracker.class.Component, { _id: issue.component });
      result += `**Component**: ${component?.label || 'Unknown'}\n`;
    }

    // Milestone
    if (issue.milestone) {
      const milestone = await client.findOne(tracker.class.Milestone, { _id: issue.milestone });
      result += `**Milestone**: ${milestone?.label || 'Unknown'}\n`;
    }

    // Time tracking
    if (issue.estimation > 0) {
      result += `**Estimated Time**: ${issue.estimation} hours\n`;
    }
    if (issue.reportedTime > 0) {
      result += `**Reported Time**: ${issue.reportedTime} hours\n`;
    }

    // Related issues
    if (issue.attachedTo && issue.attachedTo !== 'tracker:ids:NoParent') {
      const parentIssue = await client.findOne(tracker.class.Issue, { _id: issue.attachedTo });
      if (parentIssue) {
        result += `**Parent Issue**: ${parentIssue.identifier} - ${parentIssue.title}\n`;
      }
    }

    result += `**Comments**: ${issue.comments || 0}\n`;
    result += `**Sub-issues**: ${issue.subIssues || 0}\n`;

    // Full description (only if includeDescriptions=true)
    result += '\n## Description\n\n';
    if (includeDescriptions && issue.description) {
      try {
        const descText = await this._extractDescription(client, issue);
        result += descText || 'No description provided.';
      } catch (error) {
        console.error('Error extracting description:', error);
        result += 'Error loading description.';
      }
    } else if (!includeDescriptions) {
      result += '(Description omitted - use includeDescriptions=true to fetch full description)';
    } else {
      result += 'No description provided.';
    }

    result += '\n\n## Recent Comments\n\n';
    const canLoadComments = Boolean(chunter?.class?.ChatMessage);
    if (canLoadComments) {
      const comments = await client.findAll(
        chunter.class.ChatMessage,
        {
          attachedTo: issue._id,
          attachedToClass: tracker.class.Issue,
        },
        {
          sort: { createdOn: -1 },
          limit: 5,
        }
      );

      if (comments.length > 0) {
        const commentAuthorIds = [...new Set(comments.map((c) => c.createdBy).filter(Boolean))];
        const commentAuthors =
          commentAuthorIds.length > 0 && core?.class?.Account
            ? await client.findAll(core.class.Account, { _id: { $in: commentAuthorIds } })
            : [];
        const commentAuthorMap = new Map(commentAuthors.map((a) => [a._id, a]));

        for (const comment of comments) {
          const author = commentAuthorMap.get(comment.createdBy);
          const timestamp = new Date(comment.createdOn).toLocaleString();
          result += `### ${author?.email || 'Unknown'} - ${timestamp}\n`;

          let commentText = '';
          if (comment.message) {
            if (typeof comment.message === 'string') {
              commentText = comment.message;
            } else {
              try {
                commentText = await extractTextFromMarkup(comment.message);
              } catch {
                commentText = 'Unable to display comment';
              }
            }
          }
          result += `${commentText}\n\n`;
        }
      } else {
        result += 'No comments yet.\n';
      }
    } else {
      result += 'Comments unavailable in this environment.\n';
    }

    // Sub-issues
    if (issue.subIssues > 0) {
      result += '\n## Sub-issues\n\n';
      const subIssues = await client.findAll(
        tracker.class.Issue,
        { attachedTo: issue._id },
        { limit: 10 }
      );

      for (const subIssue of subIssues) {
        const statusName = this.statusManager.toHumanStatus(subIssue.status);
        result += `- ${subIssue.identifier}: ${subIssue.title} (${statusName})\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
      data: {
        identifier: issue.identifier,
        project: project?.identifier,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        url: issueUrl,
      },
    };
  }

  /**
   * Search for issues with filters
   */
  async searchIssues(client, args, includeDescriptions = true) {
    // Normalize date inputs
    const normalizedArgs = {
      ...args,
      created_after: normalizeDate(args.created_after) || args.created_after,
      created_before: normalizeDate(args.created_before) || args.created_before,
      modified_after: normalizeDate(args.modified_after) || args.modified_after,
      modified_before: normalizeDate(args.modified_before) || args.modified_before,
      query: args.query ? normalizeSearchQuery(args.query) : args.query,
    };

    const {
      project_identifier,
      query,
      status,
      priority,
      assignee,
      component,
      milestone,
      created_after,
      created_before,
      modified_after,
      modified_before,
      limit = DEFAULTS.LIST_LIMIT,
    } = normalizedArgs;

    // Build search criteria
    const searchCriteria = {};

    // Project filter with fuzzy matching
    if (project_identifier) {
      // First try exact match
      let project = await client.findOne(tracker.class.Project, {
        identifier: project_identifier,
      });

      // If no exact match, try fuzzy matching
      if (!project) {
        const allProjects = await client.findAll(tracker.class.Project, {});
        const normalizedIdentifier = normalizeProjectIdentifier(project_identifier, allProjects);

        if (normalizedIdentifier !== project_identifier) {
          project = await client.findOne(tracker.class.Project, {
            identifier: normalizedIdentifier,
          });
        }
      }

      if (!project) {
        throw HulyError.notFound('project', project_identifier);
      }
      searchCriteria.space = project._id;
    }

    // Status filter with fuzzy normalization
    if (status) {
      // First try fuzzy normalization
      const normalizedStatus = fuzzyNormalizeStatus(status);

      // Find all statuses in the project (if project specified) or workspace
      let statuses = [];
      if (project_identifier && searchCriteria.space) {
        // First try project-specific statuses
        statuses = await client.findAll(tracker.class.IssueStatus, { space: searchCriteria.space });

        // If no project-specific statuses, look for global/model statuses
        if (statuses.length === 0) {
          statuses = await client.findAll(tracker.class.IssueStatus, {
            space: 'core:space:Model',
          });
        }
      } else {
        // If no project specified, search all statuses
        statuses = await client.findAll(tracker.class.IssueStatus, {});

        // If still empty, try global/model statuses
        if (statuses.length === 0) {
          statuses = await client.findAll(tracker.class.IssueStatus, {
            space: 'core:space:Model',
          });
        }
      }

      // Find matching status by normalized name (case-insensitive)
      let targetStatus = statuses.find(
        (s) => s.name.toLowerCase() === normalizedStatus.toLowerCase()
      );

      // If no match with normalized value, try original value
      if (!targetStatus) {
        targetStatus = statuses.find((s) => s.name.toLowerCase() === status.toLowerCase());
      }

      // If still no match, try fuzzy matching against all status names
      if (!targetStatus && statuses.length > 0) {
        const statusNames = statuses.map((s) => s.name);
        const fuzzyMatchedName = fuzzyMatch(status, statusNames, 0.7);
        if (fuzzyMatchedName) {
          targetStatus = statuses.find((s) => s.name === fuzzyMatchedName);
        }
      }

      if (targetStatus) {
        searchCriteria.status = targetStatus._id;
      } else {
        // If no match found, use the value as-is (might be a status ID)
        searchCriteria.status = status;
      }
    }

    // Priority filter with fuzzy normalization
    if (priority) {
      // Use fuzzy priority normalization
      const normalizedPriority = fuzzyNormalizePriority(priority);

      if (PRIORITY_MAP[normalizedPriority] !== undefined) {
        searchCriteria.priority = PRIORITY_MAP[normalizedPriority];
      } else {
        // Try lowercase version as fallback
        const lowerPriority = normalizedPriority.toLowerCase();
        if (PRIORITY_MAP[lowerPriority] !== undefined) {
          searchCriteria.priority = PRIORITY_MAP[lowerPriority];
        }
      }
    }

    // Date filters
    const dateFilters = {};
    if (created_after || created_before) {
      dateFilters.createdOn = {};
      if (created_after) {
        dateFilters.createdOn.$gte = new Date(created_after).getTime();
      }
      if (created_before) {
        dateFilters.createdOn.$lte = new Date(created_before).getTime();
      }
      Object.assign(searchCriteria, dateFilters);
    }

    if (modified_after || modified_before) {
      dateFilters.modifiedOn = {};
      if (modified_after) {
        dateFilters.modifiedOn.$gte = new Date(modified_after).getTime();
      }
      if (modified_before) {
        dateFilters.modifiedOn.$lte = new Date(modified_before).getTime();
      }
      Object.assign(searchCriteria, dateFilters);
    }

    // Search for issues
    let issues = await client.findAll(tracker.class.Issue, searchCriteria, {
      sort: { modifiedOn: -1 },
      limit: limit * 2, // Get extra to filter client-side if needed
    });

    // Client-side filtering for complex criteria
    if (assignee) {
      if (!core?.class?.Account) {
        issues = [];
      } else {
        const account = await client.findOne(core.class.Account, { email: assignee });
        if (account) {
          issues = issues.filter((issue) => issue.assignee === account._id);
        } else {
          issues = [];
        }
      }
    }

    if (component) {
      // Find all components (in project scope if available)
      const componentQuery = searchCriteria.space ? { space: searchCriteria.space } : {};
      const allComponents = await client.findAll(tracker.class.Component, componentQuery);

      // Use fuzzy matching to find the best match
      const normalizedComponent = normalizeLabel(component, allComponents);

      // Find all matching components with normalized label
      const components = await client.findAll(tracker.class.Component, {
        ...componentQuery,
        label: normalizedComponent,
      });

      // If no exact match found with normalized value, try fuzzy match
      if (components.length === 0 && allComponents.length > 0) {
        const fuzzyMatchedComponent = allComponents.find(
          (c) => c.label && fuzzyMatch(component, [c.label], 0.7) === c.label
        );
        if (fuzzyMatchedComponent) {
          components.push(fuzzyMatchedComponent);
        }
      }

      const componentIds = components.map((c) => c._id);
      issues = issues.filter((issue) => componentIds.includes(issue.component));
    }

    if (milestone) {
      // Find all milestones (in project scope if available)
      const milestoneQuery = searchCriteria.space ? { space: searchCriteria.space } : {};
      const allMilestones = await client.findAll(tracker.class.Milestone, milestoneQuery);

      // Use fuzzy matching to find the best match
      const normalizedMilestone = normalizeLabel(milestone, allMilestones);

      // Find all matching milestones with normalized label
      const milestones = await client.findAll(tracker.class.Milestone, {
        ...milestoneQuery,
        label: normalizedMilestone,
      });

      // If no exact match found with normalized value, try fuzzy match
      if (milestones.length === 0 && allMilestones.length > 0) {
        const fuzzyMatchedMilestone = allMilestones.find(
          (m) => m.label && fuzzyMatch(milestone, [m.label], 0.7) === m.label
        );
        if (fuzzyMatchedMilestone) {
          milestones.push(fuzzyMatchedMilestone);
        }
      }

      const milestoneIds = milestones.map((m) => m._id);
      issues = issues.filter((issue) => milestoneIds.includes(issue.milestone));
    }

    // Text search (in-memory filtering on title and description)
    if (query) {
      const queryLower = query.toLowerCase();

      // First filter by title matches
      const titleMatches = issues.filter((issue) => issue.title.toLowerCase().includes(queryLower));

      // For issues that didn't match by title, check descriptions
      const titleMatchIds = new Set(titleMatches.map((i) => i._id));
      const descriptionCandidates = issues.filter(
        (issue) => !titleMatchIds.has(issue._id) && issue.description
      );

      // Fetch descriptions for candidates and filter
      const descriptionMap = await this._fetchDescriptionsBatch(
        client,
        descriptionCandidates,
        true
      );

      const descriptionMatches = descriptionCandidates.filter((issue) => {
        const descText = descriptionMap.get(issue._id) || '';
        return descText.toLowerCase().includes(queryLower);
      });

      issues = [...titleMatches, ...descriptionMatches];
    }

    // Limit results
    issues = issues.slice(0, limit);

    // Format results
    if (issues.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No issues found matching the search criteria.',
          },
        ],
      };
    }

    // Get project information for all issues
    const projectIds = [...new Set(issues.map((i) => i.space))];
    const projects = await Promise.all(
      projectIds.map((id) => client.findOne(tracker.class.Project, { _id: id }))
    );
    const projectMap = new Map(projects.filter((p) => p !== null).map((p) => [p._id, p]));

    let result = `Found ${issues.length} issues:\n\n`;

    for (const issue of issues) {
      const project = projectMap.get(issue.space);
      const issueUrl = urlGenerator.getIssueUrl(project?.identifier, issue.identifier);
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;
      if (issueUrl) {
        result += `   🔗 ${issueUrl}\n`;
      }
      result += `   Project: ${project?.name || 'Unknown'}\n`;

      // Status
      try {
        const humanStatus = this.statusManager.toHumanStatus(issue.status);
        result += `   Status: ${humanStatus}\n`;
      } catch {
        result += `   Status: ${issue.status}\n`;
      }

      // Priority
      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[issue.priority] || 'Not set';
      result += `   Priority: ${priorityName}\n`;

      // Modified date
      result += `   Modified: ${new Date(issue.modifiedOn).toLocaleDateString()}\n`;

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
   * Helper method to create description markup
   * @private
   */
  async _createDescriptionMarkup(client, issueId, text) {
    if (!text || text.trim() === '') {
      return ''; // Return empty string for empty descriptions
    }

    try {
      // Use the client's uploadMarkup method to properly store the content
      const markupRef = await client.uploadMarkup(
        tracker.class.Issue,
        issueId,
        'description',
        text.trim(),
        'markdown' // Use markdown format for plain text
      );

      return markupRef;
    } catch (error) {
      console.error('Failed to create markup:', error);
      // Fallback to empty string if markup creation fails
      return '';
    }
  }

  /**
   * Helper method to extract description text
   * @private
   */
  async _extractDescription(client, issue) {
    if (!issue.description) return '';

    // Check if description looks like a MarkupRef (blob reference)
    // MarkupRef can be either:
    // - A 24-character hex string (e.g., "5f9a1b2c3d4e5f6a7b8c9d0e")
    // - A compound format: <24-hex>-description-<timestamp>
    const isMarkupRef =
      typeof issue.description === 'string' &&
      (issue.description.match(/^[a-z0-9]{24}$/) ||
        issue.description.match(/^[a-z0-9]{24}-description-\d+$/));

    if (isMarkupRef) {
      try {
        // Use fetchMarkup to retrieve the actual content from the blob reference
        const descriptionContent = await client.fetchMarkup(
          tracker.class.Issue,
          issue._id,
          'description',
          issue.description,
          'markdown'
        );

        // The content should be returned as markdown text
        return descriptionContent || '';
      } catch (error) {
        console.error('Error fetching markup:', error);
        // If fetchMarkup fails, return empty string
        return '';
      }
    }

    // Fallback: try to parse as JSON if it's the old format
    try {
      if (typeof issue.description === 'string' && issue.description.startsWith('{')) {
        const parsed = JSON.parse(issue.description);
        return extractTextFromDoc(parsed);
      }
    } catch {
      // Ignore parse error
    }

    // Last fallback: return as plain string
    return typeof issue.description === 'string' ? issue.description : '';
  }

  // HULLY-236: Batch fetch descriptions in parallel for performance
  async _fetchDescriptionsBatch(client, issues, includeDescriptions = true) {
    if (!includeDescriptions) {
      return new Map();
    }

    const issuesWithDescriptions = issues.filter((issue) => issue.description);

    if (issuesWithDescriptions.length === 0) {
      return new Map();
    }

    const descriptionPromises = issuesWithDescriptions.map(async (issue) => {
      try {
        const descText = await this._extractDescription(client, issue);
        return { id: issue._id, desc: descText };
      } catch (error) {
        console.error(`Error fetching description for ${issue.identifier}:`, error.message);
        return { id: issue._id, desc: '' };
      }
    });

    const results = await Promise.all(descriptionPromises);
    return new Map(results.map((r) => [r.id, r.desc]));
  }

  _normalizeStatusValue(value) {
    if (!value) return '';

    // Convert to lowercase and replace common separators with single space
    return value.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Fuzzy match status with common variations
   * @private
   */
  _fuzzyMatchStatus(value, statuses) {
    if (!value || !statuses.length) return null;

    const normalized = value.toLowerCase().replace(/[-_\s]/g, '');

    // Common status mappings
    const statusMappings = {
      // Backlog variations
      backlog: ['backlog', 'back log', 'new', 'open', 'created'],
      todo: ['todo', 'to do', 'todos', 'planned', 'ready'],
      inprogress: ['inprogress', 'in progress', 'active', 'doing', 'wip', 'working', 'started'],
      done: ['done', 'complete', 'completed', 'finished', 'closed', 'resolved'],
      canceled: ['canceled', 'cancelled', 'cancel', 'abandoned', 'stopped', 'rejected'],
    };

    // Find which category the input belongs to
    for (const [key, variations] of Object.entries(statusMappings)) {
      if (variations.some((v) => v.replace(/[-_\s]/g, '') === normalized)) {
        // Find the status that matches this category
        const matchedStatus = statuses.find((s) => {
          const statusNorm = s.name.toLowerCase().replace(/[-_\s]/g, '');
          return statusNorm === key || variations.includes(s.name.toLowerCase());
        });

        if (matchedStatus) {
          console.log(`Fuzzy matched "${value}" to "${matchedStatus.name}"`);
          return matchedStatus;
        }
      }
    }

    return null;
  }

  /**
   * Validate multiple issue identifiers exist
   * @param {Object} client - Huly client
   * @param {Array<string>} identifiers - Array of issue identifiers
   * @returns {Promise<Object>} Validation result with valid and invalid identifiers
   */
  async validateIssueIdentifiers(client, identifiers) {
    const validIssues = [];
    const invalidIdentifiers = [];

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < identifiers.length; i += batchSize) {
      const batch = identifiers.slice(i, i + batchSize);

      // Query all issues in this batch
      const issues = await client.findAll(tracker.class.Issue, {
        identifier: { $in: batch },
      });

      // Create a map for quick lookup
      const issueMap = new Map(issues.map((issue) => [issue.identifier, issue]));

      // Check which identifiers were found
      for (const identifier of batch) {
        if (issueMap.has(identifier)) {
          validIssues.push({
            identifier,
            issue: issueMap.get(identifier),
          });
        } else {
          invalidIdentifiers.push(identifier);
        }
      }
    }

    return {
      valid: validIssues,
      invalid: invalidIdentifiers,
      summary: {
        total: identifiers.length,
        valid: validIssues.length,
        invalid: invalidIdentifiers.length,
      },
    };
  }

  /**
   * Get issues by filter criteria
   * @param {Object} client - Huly client
   * @param {Object} filter - Filter criteria
   * @returns {Promise<Array>} Array of matching issues
   */
  async getIssuesByFilter(client, filter) {
    const query = {};

    // Handle project filter
    if (filter.project) {
      const project = await client.findOne(tracker.class.Project, {
        identifier: filter.project,
      });
      if (project) {
        query.space = project._id;
      } else {
        return []; // No project found
      }
    }

    // Handle status filter with fuzzy matching
    if (filter.status) {
      // First try fuzzy normalization
      const normalizedStatusName = fuzzyNormalizeStatus(filter.status);

      // Find statuses in the project (if specified) or workspace
      const statusQuery = filter.project && query.space ? { space: query.space } : {};
      const statuses = await client.findAll(tracker.class.IssueStatus, statusQuery);

      // Find matching status
      let targetStatus = statuses.find(
        (s) => s.name.toLowerCase() === normalizedStatusName.toLowerCase()
      );

      // If no match, try original value
      if (!targetStatus) {
        targetStatus = statuses.find((s) => s.name.toLowerCase() === filter.status.toLowerCase());
      }

      // If still no match, try fuzzy matching
      if (!targetStatus && statuses.length > 0) {
        const statusNames = statuses.map((s) => s.name);
        const fuzzyMatchedName = fuzzyMatch(filter.status, statusNames, 0.7);
        if (fuzzyMatchedName) {
          targetStatus = statuses.find((s) => s.name === fuzzyMatchedName);
        }
      }

      if (targetStatus) {
        query.status = targetStatus._id;
      }
    }

    // Handle priority filter
    if (filter.priority) {
      // Use fuzzy priority normalization
      const normalizedPriority = fuzzyNormalizePriority(filter.priority);

      const priorityMap = {
        low: tracker.component.Priority.Low,
        medium: tracker.component.Priority.Medium,
        high: tracker.component.Priority.High,
        urgent: tracker.component.Priority.Urgent,
        NoPriority: tracker.component.Priority.NoPriority,
      };

      if (priorityMap[normalizedPriority] !== undefined) {
        query.priority = priorityMap[normalizedPriority];
      } else {
        // Try lowercase version as fallback
        const lowerPriority = normalizedPriority.toLowerCase();
        if (priorityMap[lowerPriority] !== undefined) {
          query.priority = priorityMap[lowerPriority];
        }
      }
    }

    // Handle component filter
    if (filter.component) {
      // Find all components (in project scope if available)
      const componentQuery = query.space ? { space: query.space } : {};
      const allComponents = await client.findAll(tracker.class.Component, componentQuery);

      // Use fuzzy matching to find the best match
      const normalizedComponent = normalizeLabel(filter.component, allComponents);

      // Find component by normalized label
      let component = await client.findOne(tracker.class.Component, {
        ...componentQuery,
        label: normalizedComponent,
      });

      // If no exact match, try fuzzy match
      if (!component && allComponents.length > 0) {
        component = allComponents.find(
          (c) => c.label && fuzzyMatch(filter.component, [c.label], 0.7) === c.label
        );
      }

      if (component) {
        query.component = component._id;
      }
    }

    // Handle milestone filter
    if (filter.milestone) {
      // Find all milestones (in project scope if available)
      const milestoneQuery = query.space ? { space: query.space } : {};
      const allMilestones = await client.findAll(tracker.class.Milestone, milestoneQuery);

      // Use fuzzy matching to find the best match
      const normalizedMilestone = normalizeLabel(filter.milestone, allMilestones);

      // Find milestone by normalized label
      let milestone = await client.findOne(tracker.class.Milestone, {
        ...milestoneQuery,
        label: normalizedMilestone,
      });

      // If no exact match, try fuzzy match
      if (!milestone && allMilestones.length > 0) {
        milestone = allMilestones.find(
          (m) => m.label && fuzzyMatch(filter.milestone, [m.label], 0.7) === m.label
        );
      }

      if (milestone) {
        query.milestone = milestone._id;
      }
    }

    // Handle date filters
    if (filter.createdAfter || filter.createdBefore) {
      query.createdOn = {};
      if (filter.createdAfter) {
        query.createdOn.$gte = new Date(filter.createdAfter).getTime();
      }
      if (filter.createdBefore) {
        query.createdOn.$lte = new Date(filter.createdBefore).getTime();
      }
    }

    if (filter.modifiedAfter || filter.modifiedBefore) {
      query.modifiedOn = {};
      if (filter.modifiedAfter) {
        query.modifiedOn.$gte = new Date(filter.modifiedAfter).getTime();
      }
      if (filter.modifiedBefore) {
        query.modifiedOn.$lte = new Date(filter.modifiedBefore).getTime();
      }
    }

    // Handle text search
    if (filter.query) {
      query.$search = filter.query;
    }

    const options = {
      limit: filter.limit || 100,
      sort: { modifiedOn: -1 },
    };

    return client.findAll(tracker.class.Issue, query, options);
  }

  /**
   * Get multiple issues by their identifiers
   * @param {Object} client - Huly client
   * @param {Array<string>} identifiers - Array of issue identifiers
   * @returns {Promise<Array>} Array of issues
   */
  async getMultipleIssues(client, identifiers) {
    if (!identifiers || identifiers.length === 0) {
      return [];
    }

    // Query in batches to avoid overwhelming the database
    const allIssues = [];
    const batchSize = 50;

    for (let i = 0; i < identifiers.length; i += batchSize) {
      const batch = identifiers.slice(i, i + batchSize);
      const issues = await client.findAll(tracker.class.Issue, {
        identifier: { $in: batch },
      });
      allIssues.push(...issues);
    }

    return allIssues;
  }

  /**
   * Create multiple issues in batch
   * @param {Object} client - Huly client
   * @param {Array<Object>} issueDataArray - Array of issue data objects
   * @returns {Promise<Array>} Array of creation results
   */
  async createMultipleIssues(client, issueDataArray) {
    const results = [];

    for (const issueData of issueDataArray) {
      try {
        const result = await this.createIssue(
          client,
          issueData.project_identifier,
          issueData.title,
          issueData.description,
          issueData.priority
        );
        results.push({
          success: true,
          data: result.data,
          input: issueData,
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          input: issueData,
        });
      }
    }

    return results;
  }

  /**
   * Delete an issue and optionally its sub-issues
   * @param {Object} client - Huly client instance
   * @param {string} issueIdentifier - Issue identifier (e.g., "PROJ-123")
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteIssue(client, issueIdentifier, options = {}) {
    return deletionService.deleteIssue(client, issueIdentifier, options);
  }

  /**
   * Bulk delete multiple issues
   * @param {Object} client - Huly client instance
   * @param {Array<string>} issueIdentifiers - Array of issue identifiers
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Bulk deletion result
   */
  async bulkDeleteIssues(client, issueIdentifiers, options = {}) {
    return deletionService.bulkDeleteIssues(client, issueIdentifiers, options);
  }

  /**
   * Analyze the impact of deleting an issue
   * @param {Object} client - Huly client instance
   * @param {string} issueIdentifier - Issue identifier
   * @returns {Promise<Object>} Impact analysis
   */
  async analyzeIssueDeletionImpact(client, issueIdentifier) {
    return deletionService.analyzeIssueDeletionImpact(client, issueIdentifier);
  }
}

// Export class and create instance function
export { IssueService };
export function createIssueService(statusManager, sequenceService) {
  return new IssueService(statusManager, sequenceService);
}
