/**
 * IssueService - Handles all issue-related operations
 *
 * Provides methods for creating, updating, listing, and searching issues
 * in the Huly project management system.
 */

import { HulyError } from '../core/HulyError.js';
import { PRIORITY_MAP, DEFAULTS } from '../core/constants.js';
import { extractTextFromMarkup, extractTextFromDoc } from '../utils/textExtractor.js';
import {
  validateEnum,
  getValidPriorities,
  normalizePriority,
  isValidUpdateField,
} from '../utils/validators.js';
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
  constructor(statusManager = null) {
    this.statusManager = statusManager;
  }

  /**
   * List issues in a project
   */
  async listIssues(client, projectIdentifier, limit = DEFAULTS.LIST_LIMIT) {
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });

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

    // Fetch all components and milestones for this project to resolve references
    const components = await client.findAll(tracker.class.Component, { space: project._id });
    const milestones = await client.findAll(tracker.class.Milestone, { space: project._id });

    // Create lookup maps for efficient access
    const componentMap = new Map(components.map((c) => [c._id, c]));
    const milestoneMap = new Map(milestones.map((m) => [m._id, m]));

    let result = `Found ${issues.length} issues in ${project.name}:\n\n`;

    for (const issue of issues) {
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;

      // Use StatusManager to display human-readable status
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

      // Resolve assignee
      if (issue.assignee) {
        const assignee = await client.findOne(core.class.Account, { _id: issue.assignee });
        result += `   Assignee: ${assignee?.email || 'Unknown'}\n`;
      }

      // Resolve component
      if (issue.component) {
        const component = componentMap.get(issue.component);
        result += `   Component: ${component?.label || 'Unknown'}\n`;
      }

      // Resolve milestone
      if (issue.milestone) {
        const milestone = milestoneMap.get(issue.milestone);
        result += `   Milestone: ${milestone?.label || 'Unknown'}\n`;
      }

      // Add description preview if available
      if (issue.description) {
        try {
          const descText = await this._extractDescription(client, issue);
          if (descText && descText.trim()) {
            const preview = descText.length > 100 ? `${descText.substring(0, 100)}...` : descText;
            result += `   Description: ${preview}\n`;
          }
        } catch (error) {
          console.error('Error extracting description:', error);
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
  async createIssue(client, projectIdentifier, title, description = '', priority = 'NoPriority') {
    // Validate priority
    priority = validateEnum(priority, 'priority', getValidPriorities(), 'NoPriority');

    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });

    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    // Get the default status for new issues (Backlog)
    let defaultStatus;
    try {
      defaultStatus = await this.statusManager.getDefaultStatus(client, project._id);
    } catch (error) {
      console.error('Error getting default status:', error);
      // Use hardcoded fallback if status manager fails
      defaultStatus = 'tracker:status:Backlog';
    }

    // Generate issue number
    const lastOne = await client.findOne(
      tracker.class.Issue,
      { space: project._id },
      { sort: { number: -1 } }
    );
    const number = (lastOne?.number ?? 0) + 1;
    const identifier = `${project.identifier}-${number}`;

    const issueData = {
      title,
      description: '', // Will be updated after issue creation
      assignee: null,
      component: null,
      milestone: null,
      number,
      identifier,
      priority: PRIORITY_MAP[priority],
      rank: '',
      status: defaultStatus,
      doneState: null,
      dueTo: null,
      attachedTo: tracker.ids.NoParent,
      comments: 0,
      subIssues: 0,
      estimation: 0,
      reportedTime: 0,
      childInfo: [],
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

    // Get status name for display
    let statusName = 'Backlog';
    try {
      statusName = this.statusManager.toHumanStatus(defaultStatus);
    } catch (error) {
      console.error('Error converting status:', error);
    }

    const priorityName =
      Object.keys(PRIORITY_MAP).find((key) => PRIORITY_MAP[key] === issueData.priority) ||
      'NoPriority';

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created issue ${identifier}: "${title}"\n\nPriority: ${priorityName}\nStatus: ${statusName}\nProject: ${project.name}`,
        },
      ],
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
          // Convert human-readable status to internal format
          const internalStatus = this.statusManager.fromHumanStatus(value);
          const validStatuses = await this.statusManager.getValidStatuses(client, issue.space);

          if (!validStatuses.includes(internalStatus)) {
            const humanStatuses = await this.statusManager.getHumanStatuses(client, issue.space);
            throw HulyError.invalidValue('status', value, humanStatuses.join(', '));
          }

          updateData.status = internalStatus;
          displayValue = this.statusManager.toHumanStatus(internalStatus);
        } catch (error) {
          if (error instanceof HulyError) {
            throw error;
          }
          // Try using the value directly if it's already in internal format
          updateData.status = value;
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

        updateData.priority =
          tracker.component.Priority[
            normalizedPriority === 'NoPriority'
              ? 'NoPriority'
              : normalizedPriority.charAt(0).toUpperCase() + normalizedPriority.slice(1)
          ];
        displayValue = normalizedPriority === 'NoPriority' ? 'No Priority' : normalizedPriority;
        break;
      }

      case 'component': {
        // Find component by label
        const component = await client.findOne(tracker.class.Component, {
          space: issue.space,
          label: value,
        });

        if (!component && value) {
          throw HulyError.notFound('component', value);
        }

        updateData.component = component?._id || null;
        break;
      }

      case 'milestone': {
        // Find milestone by label
        const milestone = await client.findOne(tracker.class.Milestone, {
          space: issue.space,
          label: value,
        });

        if (!milestone && value) {
          throw HulyError.notFound('milestone', value);
        }

        updateData.milestone = milestone?._id || null;
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

    return {
      content: [
        {
          type: 'text',
          text: `✅ Updated issue ${issueIdentifier}\n\n${field}: ${displayValue}`,
        },
      ],
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
    priority = 'NoPriority'
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
    try {
      defaultStatus = await this.statusManager.getDefaultStatus(client, project._id);
    } catch (error) {
      console.error('Error getting default status:', error);
      defaultStatus = 'tracker:status:Backlog';
    }

    // Generate issue number
    const lastOne = await client.findOne(
      tracker.class.Issue,
      { space: project._id },
      { sort: { number: -1 } }
    );
    const number = (lastOne?.number ?? 0) + 1;
    const identifier = `${project.identifier}-${number}`;

    const issueData = {
      title,
      description: '', // Will be updated after issue creation
      assignee: null,
      component: parentIssue.component, // Inherit from parent
      milestone: parentIssue.milestone, // Inherit from parent
      number,
      identifier,
      priority: PRIORITY_MAP[priority],
      rank: '',
      status: defaultStatus,
      doneState: null,
      dueTo: null,
      attachedTo: parentIssue._id, // Link to parent
      comments: 0,
      subIssues: 0,
      estimation: 0,
      reportedTime: 0,
      childInfo: [],
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

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created subissue ${identifier}: "${title}"\n\nParent: ${parentIssueIdentifier}\nPriority: ${priorityName}\nProject: ${project.name}`,
        },
      ],
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
      _activity.class.ActivityMessage,
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

    let result = `Found ${comments.length} comments on issue ${issueIdentifier}:\n\n`;

    for (const comment of comments) {
      // Get author information
      const author = await client.findOne(core.class.Account, { _id: comment.createdBy });
      const authorName = author?.email || 'Unknown';

      // Format timestamp
      const timestamp = new Date(comment.createdOn).toLocaleString();

      result += `💬 **${authorName}** - ${timestamp}\n`;

      // Extract comment text
      let commentText = 'No content';
      if (comment.message) {
        // Comments use direct Markup storage, not blob references
        try {
          commentText = await extractTextFromMarkup(comment.message);
        } catch {
          // If extraction fails, use the raw message
          commentText =
            typeof comment.message === 'string' ? comment.message : JSON.stringify(comment.message);
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
  async getIssueDetails(client, issueIdentifier) {
    // Find the issue
    const issue = await client.findOne(tracker.class.Issue, { identifier: issueIdentifier });

    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    // Get project information
    const project = await client.findOne(tracker.class.Project, { _id: issue.space });

    let result = `# ${issue.identifier}: ${issue.title}\n\n`;

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
      const assignee = await client.findOne(core.class.Account, { _id: issue.assignee });
      result += `**Assignee**: ${assignee?.email || 'Unknown'}\n`;
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

    // Full description
    result += '\n## Description\n\n';
    if (issue.description) {
      try {
        const descText = await this._extractDescription(client, issue);
        result += descText || 'No description provided.';
      } catch (error) {
        console.error('Error extracting description:', error);
        result += 'Error loading description.';
      }
    } else {
      result += 'No description provided.';
    }

    // Recent comments
    result += '\n\n## Recent Comments\n\n';
    const comments = await client.findAll(
      _activity.class.ActivityMessage,
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
      for (const comment of comments) {
        const author = await client.findOne(core.class.Account, { _id: comment.createdBy });
        const timestamp = new Date(comment.createdOn).toLocaleString();
        result += `### ${author?.email || 'Unknown'} - ${timestamp}\n`;

        // Extract comment text
        let commentText = '';
        if (comment.message) {
          // Comments use direct Markup storage, not blob references
          try {
            commentText = await extractTextFromMarkup(comment.message);
          } catch {
            commentText =
              typeof comment.message === 'string' ? comment.message : 'Unable to display comment';
          }
        }
        result += `${commentText}\n\n`;
      }
    } else {
      result += 'No comments yet.\n';
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
    };
  }

  /**
   * Search for issues with filters
   */
  async searchIssues(client, args) {
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
    } = args;

    // Build search criteria
    const searchCriteria = {};

    // Project filter
    if (project_identifier) {
      const project = await client.findOne(tracker.class.Project, {
        identifier: project_identifier,
      });
      if (!project) {
        throw HulyError.notFound('project', project_identifier);
      }
      searchCriteria.space = project._id;
    }

    // Status filter
    if (status) {
      try {
        // Try to convert human-readable status
        const internalStatus = this.statusManager.fromHumanStatus(status);
        searchCriteria.status = internalStatus;
      } catch {
        // Use as-is if conversion fails
        searchCriteria.status = status;
      }
    }

    // Priority filter
    if (priority) {
      const priorityMap = {
        low: tracker.component.Priority.Low,
        medium: tracker.component.Priority.Medium,
        high: tracker.component.Priority.High,
        urgent: tracker.component.Priority.Urgent,
        nopriority: tracker.component.Priority.NoPriority,
      };
      const normalizedPriority = priority.toLowerCase();
      if (priorityMap[normalizedPriority] !== undefined) {
        searchCriteria.priority = priorityMap[normalizedPriority];
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
      // Find account by email
      const account = await client.findOne(core.class.Account, { email: assignee });
      if (account) {
        issues = issues.filter((issue) => issue.assignee === account._id);
      } else {
        issues = []; // No matching assignee
      }
    }

    if (component) {
      // Find all matching components across projects
      const components = await client.findAll(tracker.class.Component, { label: component });
      const componentIds = components.map((c) => c._id);
      issues = issues.filter((issue) => componentIds.includes(issue.component));
    }

    if (milestone) {
      // Find all matching milestones across projects
      const milestones = await client.findAll(tracker.class.Milestone, { label: milestone });
      const milestoneIds = milestones.map((m) => m._id);
      issues = issues.filter((issue) => milestoneIds.includes(issue.milestone));
    }

    // Text search in title and description
    if (query) {
      const queryLower = query.toLowerCase();
      const filteredIssues = [];

      for (const issue of issues) {
        // Check title
        if (issue.title.toLowerCase().includes(queryLower)) {
          filteredIssues.push(issue);
          continue;
        }

        // Check description
        if (issue.description) {
          try {
            const descText = await this._extractDescription(client, issue);
            if (descText && descText.toLowerCase().includes(queryLower)) {
              filteredIssues.push(issue);
            }
          } catch {
            // Skip if description extraction fails
          }
        }
      }

      issues = filteredIssues;
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
    const projectMap = new Map(projects.map((p) => [p._id, p]));

    let result = `Found ${issues.length} issues:\n\n`;

    for (const issue of issues) {
      const project = projectMap.get(issue.space);
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;
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
    } catch (parseError) {
      // Ignore parse error
    }

    // Last fallback: return as plain string
    return typeof issue.description === 'string' ? issue.description : '';
  }
}

// Export class and create instance function
export { IssueService };
export function createIssueService(statusManager) {
  return new IssueService(statusManager);
}
