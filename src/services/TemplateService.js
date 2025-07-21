/**
 * TemplateService - Handles all issue template-related operations
 *
 * Provides methods for creating, updating, listing, and using issue templates
 * in the Huly project management system.
 */

import { HulyError } from '../core/HulyError.js';
import { PRIORITY_MAP, DEFAULTS } from '../core/constants.js';
import { extractTextFromMarkup } from '../utils/textExtractor.js';
import { validateEnum, getValidPriorities, normalizePriority } from '../utils/validators.js';
import trackerModule from '@hcengineering/tracker';
import coreModule from '@hcengineering/core';

const tracker = trackerModule.default || trackerModule;
const core = coreModule.default || coreModule;
const { generateId } = coreModule;

class TemplateService {
  constructor() {}

  /**
   * Create a new issue template
   */
  async createTemplate(client, projectIdentifier, templateData) {
    // Find the project
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    // Validate priority
    const priority = validateEnum(
      templateData.priority || 'medium',
      'priority',
      getValidPriorities(),
      'medium'
    );

    // Convert priority to tracker format
    const priorityValue = PRIORITY_MAP[priority];
    if (priorityValue === undefined) {
      throw HulyError.invalidValue('priority', priority, 'low, medium, high, urgent, or none');
    }

    // Prepare template data
    const template = {
      title: templateData.title,
      description: templateData.description || '',
      priority: priorityValue,
      assignee: null,
      component: null,
      milestone: null,
      estimation: templateData.estimation || 0,
      dueDate: null,
      labels: [],
      children: [],
      comments: 0,
      attachments: 0,
      relations: [],
    };

    // Handle assignee
    if (templateData.assignee) {
      const person = await client.findOne(core.class.Account, { email: templateData.assignee });
      if (person) {
        template.assignee = person._id;
      }
    }

    // Handle component
    if (templateData.component) {
      const component = await client.findOne(tracker.class.Component, {
        space: project._id,
        label: templateData.component,
      });
      if (component) {
        template.component = component._id;
      }
    }

    // Handle milestone
    if (templateData.milestone) {
      const milestone = await client.findOne(tracker.class.Milestone, {
        space: project._id,
        label: templateData.milestone,
      });
      if (milestone) {
        template.milestone = milestone._id;
      }
    }

    // Handle children templates
    if (templateData.children && Array.isArray(templateData.children)) {
      template.children = await this._prepareChildTemplates(
        client,
        project._id,
        templateData.children
      );
    }

    // Create the template
    await client.createDoc(tracker.class.IssueTemplate, project._id, template);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Created template "${templateData.title}" in project ${project.name}`,
        },
      ],
    };
  }

  /**
   * List templates in a project
   */
  async listTemplates(client, projectIdentifier, limit = DEFAULTS.LIST_LIMIT) {
    const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier });
    if (!project) {
      throw HulyError.notFound('project', projectIdentifier);
    }

    const templates = await client.findAll(
      tracker.class.IssueTemplate,
      { space: project._id },
      {
        sort: { modifiedOn: -1 },
        limit: limit,
      }
    );

    if (templates.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No templates found in project ${project.name}`,
          },
        ],
      };
    }

    let result = `Found ${templates.length} templates in project ${project.name}:\n\n`;

    for (const template of templates) {
      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[template.priority] || 'Not set';

      result += `📄 **${template.title}**\n`;
      result += `   ID: ${template._id}\n`;
      result += `   Priority: ${priorityName}\n`;
      result += `   Estimation: ${template.estimation || 0} hours\n`;

      if (template.children && template.children.length > 0) {
        result += `   Child templates: ${template.children.length}\n`;
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
   * Get detailed information about a template
   */
  async getTemplateDetails(client, templateId) {
    const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId });
    if (!template) {
      throw HulyError.notFound('template', templateId);
    }

    // Get project information
    const project = await client.findOne(tracker.class.Project, { _id: template.space });

    let result = `# Template: ${template.title}\n\n`;
    result += `**Project**: ${project?.name || 'Unknown'}\n`;

    // Priority
    const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
    const priorityName = priorityNames[template.priority] || 'Not set';
    result += `**Priority**: ${priorityName}\n`;

    // Estimation
    result += `**Estimation**: ${template.estimation || 0} hours\n`;

    // Assignee
    if (template.assignee) {
      const assignee = await client.findOne(core.class.Account, { _id: template.assignee });
      result += `**Default Assignee**: ${assignee?.email || 'Unknown'}\n`;
    }

    // Component
    if (template.component) {
      const component = await client.findOne(tracker.class.Component, { _id: template.component });
      result += `**Default Component**: ${component?.label || 'Unknown'}\n`;
    }

    // Milestone
    if (template.milestone) {
      const milestone = await client.findOne(tracker.class.Milestone, { _id: template.milestone });
      result += `**Default Milestone**: ${milestone?.label || 'Unknown'}\n`;
    }

    // Description
    result += '\n## Description\n\n';
    if (template.description) {
      try {
        const descText = await extractTextFromMarkup(template.description);
        result += descText || 'No description provided.';
      } catch {
        result += 'Error loading description.';
      }
    } else {
      result += 'No description provided.';
    }

    // Child templates
    if (template.children && template.children.length > 0) {
      result += '\n\n## Child Templates\n\n';
      for (let i = 0; i < template.children.length; i++) {
        const child = template.children[i];
        const childPriorityName = priorityNames[child.priority] || 'Not set';

        result += `${i + 1}. **${child.title}**\n`;
        result += `   Priority: ${childPriorityName}\n`;
        result += `   Estimation: ${child.estimation || 0} hours\n`;

        if (child.assignee) {
          const childAssignee = await client.findOne(core.class.Account, { _id: child.assignee });
          result += `   Assignee: ${childAssignee?.email || 'Unknown'}\n`;
        }

        if (child.description) {
          try {
            const childDescText = await extractTextFromMarkup(child.description);
            const preview =
              childDescText?.substring(0, 100) + (childDescText?.length > 100 ? '...' : '');
            result += `   Description: ${preview || 'No description'}\n`;
          } catch {
            result += `   Description: Error loading\n`;
          }
        }

        result += '\n';
      }
    }

    // Metadata
    result += '\n## Metadata\n\n';
    result += `**Template ID**: ${template._id}\n`;
    result += `**Created**: ${new Date(template.createdOn).toLocaleString()}\n`;
    result += `**Modified**: ${new Date(template.modifiedOn).toLocaleString()}\n`;

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
   * Update an existing template
   */
  async updateTemplate(client, templateId, field, value) {
    const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId });
    if (!template) {
      throw HulyError.notFound('template', templateId);
    }

    const updateData = {};
    let displayValue = value;

    switch (field) {
      case 'title':
        updateData.title = value;
        break;

      case 'description':
        updateData.description = value;
        break;

      case 'priority': {
        const normalizedPriority = normalizePriority(value);
        if (!normalizedPriority) {
          throw HulyError.invalidValue(
            'priority',
            value,
            'low, medium, high, urgent, or nopriority'
          );
        }
        updateData.priority = PRIORITY_MAP[normalizedPriority];
        displayValue = normalizedPriority === 'none' ? 'No Priority' : normalizedPriority;
        break;
      }

      case 'estimation': {
        const estimation = parseFloat(value);
        if (isNaN(estimation) || estimation < 0) {
          throw HulyError.invalidValue('estimation', value, 'a non-negative number');
        }
        updateData.estimation = estimation;
        displayValue = `${estimation} hours`;
        break;
      }

      case 'assignee': {
        if (!value) {
          updateData.assignee = null;
          displayValue = 'None';
        } else {
          const person = await client.findOne(core.class.Account, { email: value });
          if (!person) {
            throw HulyError.notFound('assignee', value);
          }
          updateData.assignee = person._id;
        }
        break;
      }

      case 'component': {
        if (!value) {
          updateData.component = null;
          displayValue = 'None';
        } else {
          const component = await client.findOne(tracker.class.Component, {
            space: template.space,
            label: value,
          });
          if (!component) {
            throw HulyError.notFound('component', value);
          }
          updateData.component = component._id;
        }
        break;
      }

      case 'milestone': {
        if (!value) {
          updateData.milestone = null;
          displayValue = 'None';
        } else {
          const milestone = await client.findOne(tracker.class.Milestone, {
            space: template.space,
            label: value,
          });
          if (!milestone) {
            throw HulyError.notFound('milestone', value);
          }
          updateData.milestone = milestone._id;
        }
        break;
      }

      default:
        throw HulyError.invalidValue(
          'field',
          field,
          'title, description, priority, estimation, assignee, component, or milestone'
        );
    }

    await client.updateDoc(tracker.class.IssueTemplate, template.space, template._id, updateData);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Updated template "${template.title}"\n\n${field}: ${displayValue}`,
        },
      ],
    };
  }

  /**
   * Delete a template
   */
  async deleteTemplate(client, templateId) {
    const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId });
    if (!template) {
      throw HulyError.notFound('template', templateId);
    }

    await client.removeDoc(tracker.class.IssueTemplate, template.space, template._id);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Deleted template "${template.title}"`,
        },
      ],
    };
  }

  /**
   * Create issues from a template
   */
  async createIssueFromTemplate(client, templateId, overrides = {}) {
    const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId });
    if (!template) {
      throw HulyError.notFound('template', templateId);
    }

    const project = await client.findOne(tracker.class.Project, { _id: template.space });
    if (!project) {
      throw HulyError.notFound('project space', template.space);
    }

    // Get default status for the project
    const defaultStatus =
      project.defaultIssueStatus || (await this._getDefaultStatus(client, project._id));

    // Create main issue from template
    const issueData = {
      title: overrides.title || template.title,
      description: template.description,
      status: defaultStatus,
      priority:
        overrides.priority !== undefined
          ? PRIORITY_MAP[normalizePriority(overrides.priority)]
          : template.priority,
      assignee:
        overrides.assignee !== undefined
          ? await this._resolveAssignee(client, overrides.assignee)
          : template.assignee,
      component:
        overrides.component !== undefined
          ? await this._resolveComponent(client, template.space, overrides.component)
          : template.component,
      milestone:
        overrides.milestone !== undefined
          ? await this._resolveMilestone(client, template.space, overrides.milestone)
          : template.milestone,
      estimation:
        overrides.estimation !== undefined ? parseFloat(overrides.estimation) : template.estimation,
      remainingTime:
        overrides.estimation !== undefined ? parseFloat(overrides.estimation) : template.estimation,
      dueDate: template.dueDate,
      number: await this._getNextIssueNumber(client, project._id),
      rank: '',
      subIssues: 0,
      comments: 0,
      attachments: 0,
      reportedTime: 0,
      relations: [],
    };

    // Generate identifier
    issueData.identifier = `${project.identifier}-${issueData.number}`;

    // Create the main issue
    const issueId = await client.addCollection(
      tracker.class.Issue,
      template.space,
      tracker.ids.NoParent,
      tracker.class.Issue,
      'subIssues',
      issueData
    );

    const createdIssues = [
      {
        id: issueId,
        identifier: issueData.identifier,
        title: issueData.title,
        parent: null,
      },
    ];

    // Create child issues from template children
    if (template.children && template.children.length > 0 && overrides.includeChildren !== false) {
      for (const childTemplate of template.children) {
        const childNumber = await this._getNextIssueNumber(client, project._id);
        const childIdentifier = `${project.identifier}-${childNumber}`;

        const childIssueData = {
          title: childTemplate.title,
          description: childTemplate.description,
          status: defaultStatus,
          priority: childTemplate.priority,
          assignee: childTemplate.assignee,
          component: childTemplate.component,
          milestone: childTemplate.milestone,
          estimation: childTemplate.estimation,
          remainingTime: childTemplate.estimation,
          dueDate: childTemplate.dueDate,
          number: childNumber,
          identifier: childIdentifier,
          rank: '',
          subIssues: 0,
          comments: 0,
          attachments: 0,
          reportedTime: 0,
          relations: [],
        };

        const childIssueId = await client.addCollection(
          tracker.class.Issue,
          template.space,
          issueId, // Parent issue
          tracker.class.Issue,
          'subIssues',
          childIssueData
        );

        createdIssues.push({
          id: childIssueId,
          identifier: childIdentifier,
          title: childTemplate.title,
          parent: issueData.identifier,
        });

        // Update parent's subIssues count
        await client.updateDoc(tracker.class.Issue, template.space, issueId, {
          $inc: { subIssues: 1 },
        });
      }
    }

    // Format result
    let result = `✅ Created ${createdIssues.length} issue(s) from template "${template.title}"\n\n`;

    for (const issue of createdIssues) {
      result += `📋 **${issue.identifier}**: ${issue.title}\n`;
      if (issue.parent) {
        result += `   Parent: ${issue.parent}\n`;
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
   * Add a child template to an existing template
   */
  async addChildTemplate(client, templateId, childData) {
    const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId });
    if (!template) {
      throw HulyError.notFound('template', templateId);
    }

    const childTemplate = await this._prepareChildTemplate(client, template.space, childData);

    await client.updateDoc(tracker.class.IssueTemplate, template.space, template._id, {
      $push: { children: childTemplate },
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Added child template "${childData.title}" to template "${template.title}"`,
        },
      ],
    };
  }

  /**
   * Remove a child template
   */
  async removeChildTemplate(client, templateId, childIndex) {
    const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId });
    if (!template) {
      throw HulyError.notFound('template', templateId);
    }

    const index = parseInt(childIndex);
    if (isNaN(index) || index < 0 || index >= template.children.length) {
      throw HulyError.invalidValue(
        'childIndex',
        childIndex,
        `a number between 0 and ${template.children.length - 1}`
      );
    }

    const removedChild = template.children[index];
    const newChildren = template.children.filter((_, i) => i !== index);

    await client.updateDoc(tracker.class.IssueTemplate, template.space, template._id, {
      children: newChildren,
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Removed child template "${removedChild.title}" from template "${template.title}"`,
        },
      ],
    };
  }

  /**
   * Search templates
   */
  async searchTemplates(client, query, projectIdentifier = null, limit = DEFAULTS.LIST_LIMIT) {
    const searchCriteria = {};

    if (projectIdentifier) {
      const project = await client.findOne(tracker.class.Project, {
        identifier: projectIdentifier,
      });
      if (!project) {
        throw HulyError.notFound('project', projectIdentifier);
      }
      searchCriteria.space = project._id;
    }

    // Add search query
    if (query) {
      searchCriteria.$search = query;
    }

    const templates = await client.findAll(tracker.class.IssueTemplate, searchCriteria, {
      sort: { modifiedOn: -1 },
      limit: limit,
    });

    if (templates.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No templates found matching the search criteria.',
          },
        ],
      };
    }

    // Get project information for all templates
    const projectIds = [...new Set(templates.map((t) => t.space))];
    const projects = await Promise.all(
      projectIds.map((id) => client.findOne(tracker.class.Project, { _id: id }))
    );
    const projectMap = new Map(projects.map((p) => [p._id, p]));

    let result = `Found ${templates.length} templates:\n\n`;

    for (const template of templates) {
      const project = projectMap.get(template.space);
      const priorityNames = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];
      const priorityName = priorityNames[template.priority] || 'Not set';

      result += `📄 **${template.title}**\n`;
      result += `   Project: ${project?.name || 'Unknown'}\n`;
      result += `   Priority: ${priorityName}\n`;
      result += `   Estimation: ${template.estimation || 0} hours\n`;

      if (template.children && template.children.length > 0) {
        result += `   Child templates: ${template.children.length}\n`;
      }

      result += `   ID: ${template._id}\n`;
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

  // Helper methods
  async _prepareChildTemplates(client, projectSpace, children) {
    const preparedChildren = [];

    for (const child of children) {
      const preparedChild = await this._prepareChildTemplate(client, projectSpace, child);
      preparedChildren.push(preparedChild);
    }

    return preparedChildren;
  }

  async _prepareChildTemplate(client, projectSpace, childData) {
    const priority = validateEnum(
      childData.priority || 'medium',
      'priority',
      getValidPriorities(),
      'medium'
    );

    const childTemplate = {
      id: generateId(),
      title: childData.title,
      description: childData.description || '',
      priority: PRIORITY_MAP[priority],
      assignee: null,
      component: null,
      milestone: null,
      estimation: childData.estimation || 0,
      dueDate: null,
    };

    // Handle assignee
    if (childData.assignee) {
      const person = await client.findOne(core.class.Account, { email: childData.assignee });
      if (person) {
        childTemplate.assignee = person._id;
      }
    }

    // Handle component
    if (childData.component) {
      const component = await client.findOne(tracker.class.Component, {
        space: projectSpace,
        label: childData.component,
      });
      if (component) {
        childTemplate.component = component._id;
      }
    }

    // Handle milestone
    if (childData.milestone) {
      const milestone = await client.findOne(tracker.class.Milestone, {
        space: projectSpace,
        label: childData.milestone,
      });
      if (milestone) {
        childTemplate.milestone = milestone._id;
      }
    }

    return childTemplate;
  }

  async _getDefaultStatus(client, projectSpace) {
    const statuses = await client.findAll(tracker.class.IssueStatus, {
      space: projectSpace,
      category: 'backlog',
    });

    if (statuses.length > 0) {
      return statuses[0]._id;
    }

    // Fallback to any status
    const anyStatus = await client.findOne(tracker.class.IssueStatus, {
      space: projectSpace,
    });

    if (anyStatus) {
      return anyStatus._id;
    }

    throw new HulyError('OPERATION_FAILED', 'No issue statuses found in project');
  }

  async _getNextIssueNumber(client, projectSpace) {
    const lastIssue = await client.findOne(
      tracker.class.Issue,
      { space: projectSpace },
      { sort: { number: -1 } }
    );

    return (lastIssue?.number || 0) + 1;
  }

  async _resolveAssignee(client, email) {
    if (!email) return null;
    const person = await client.findOne(core.class.Account, { email });
    return person?._id || null;
  }

  async _resolveComponent(client, projectSpace, label) {
    if (!label) return null;
    const component = await client.findOne(tracker.class.Component, {
      space: projectSpace,
      label,
    });
    return component?._id || null;
  }

  async _resolveMilestone(client, projectSpace, label) {
    if (!label) return null;
    const milestone = await client.findOne(tracker.class.Milestone, {
      space: projectSpace,
      label,
    });
    return milestone?._id || null;
  }
}

export default TemplateService;
