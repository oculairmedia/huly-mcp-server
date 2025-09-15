/**
 * IssueWorkflowWizard.js
 *
 * Interactive wizard for guided issue creation and management.
 * Supports bulk operations, templates, and workflow automation.
 */

import { WizardPrompt } from '../base/PromptInterface.js';
import { getLogger } from '../../utils/index.js';
// Remove unused imports - these services are not needed for prompt definitions
// The actual services will be provided through the execution context

export class IssueWorkflowWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'issue-workflow-wizard',
      description: 'Interactive wizard for guided issue creation, bulk operations, and template management',
      category: 'issue-management',
      annotations: {
        wizard: true,
        maxSteps: 5,
        estimatedTime: '5-10 minutes',
        tags: ['issue', 'workflow', 'template', 'bulk']
      },
      arguments: [
        {
          name: 'mode',
          description: 'Wizard mode: create, bulk, template, or workflow',
          required: false,
          defaultValue: 'create'
        },
        {
          name: 'projectId',
          description: 'Project ID for issue creation',
          required: false
        }
      ],
      // Use arrow function to delegate to execute method
      handler: async (...args) => this.execute(...args)
    });

    // Store steps on the instance directly
    this.steps = [
        {
          id: 'workflow-type',
          name: 'Select Workflow Type',
          description: 'Choose the type of issue operation',
          form: {
            fields: [
              {
                name: 'workflowType',
                type: 'select',
                required: true,
                description: 'Type of issue workflow',
                options: [
                  { value: 'single', label: 'Create single issue' },
                  { value: 'bulk', label: 'Bulk create issues' },
                  { value: 'template', label: 'Create from template' },
                  { value: 'import', label: 'Import from CSV/JSON' },
                  { value: 'clone', label: 'Clone existing issues' }
                ],
                defaultValue: 'single'
              },
              {
                name: 'projectId',
                type: 'select',
                required: true,
                description: 'Target project',
                dynamic: true,
                placeholder: 'Select project'
              }
            ]
          }
        },
        {
          id: 'issue-details',
          name: 'Issue Details',
          description: 'Define issue properties',
          conditional: true, // This step changes based on workflow type
          form: {
            fields: [] // Will be populated dynamically
          }
        },
        {
          id: 'advanced-options',
          name: 'Advanced Options',
          description: 'Configure advanced issue settings',
          form: {
            fields: [
              {
                name: 'addToSprint',
                type: 'checkbox',
                required: false,
                description: 'Add to current sprint',
                defaultValue: false
              },
              {
                name: 'autoAssign',
                type: 'checkbox',
                required: false,
                description: 'Auto-assign to team members',
                defaultValue: false
              },
              {
                name: 'createSubtasks',
                type: 'checkbox',
                required: false,
                description: 'Generate standard subtasks',
                defaultValue: false
              },
              {
                name: 'applyLabels',
                type: 'multiselect',
                required: false,
                description: 'Apply labels',
                dynamic: true,
                placeholder: 'Select labels'
              },
              {
                name: 'linkToIssues',
                type: 'multiselect',
                required: false,
                description: 'Link to existing issues',
                dynamic: true,
                placeholder: 'Select related issues'
              }
            ]
          }
        },
        {
          id: 'automation-rules',
          name: 'Automation Rules',
          description: 'Set up workflow automation',
          form: {
            fields: [
              {
                name: 'enableAutomation',
                type: 'checkbox',
                required: false,
                description: 'Enable workflow automation',
                defaultValue: false
              },
              {
                name: 'autoTransition',
                type: 'select',
                required: false,
                description: 'Auto-transition when',
                options: [
                  { value: 'none', label: 'No automation' },
                  { value: 'pr-opened', label: 'PR opened' },
                  { value: 'pr-merged', label: 'PR merged' },
                  { value: 'all-subtasks-done', label: 'All subtasks complete' },
                  { value: 'time-based', label: 'After time period' }
                ],
                defaultValue: 'none'
              },
              {
                name: 'notificationRules',
                type: 'multiselect',
                required: false,
                description: 'Send notifications on',
                options: [
                  { value: 'created', label: 'Issue created' },
                  { value: 'assigned', label: 'Issue assigned' },
                  { value: 'status-change', label: 'Status changed' },
                  { value: 'comment', label: 'Comment added' },
                  { value: 'due-soon', label: 'Due date approaching' }
                ]
              }
            ]
          }
        },
        {
          id: 'review-create',
          name: 'Review & Create',
          description: 'Review and create issues',
          review: true
        }
    ];

    this.logger = null;
  }

  getLogger() {
    if (!this.logger) {
      this.logger = getLogger('issue-workflow-wizard');
    }
    return this.logger;
  }

  async execute(args = {}, context = {}) {
    try {
      const { sessionId } = context;
      const stateManager = (await import('../base/WizardState.js')).getWizardStateManager();

      let session = sessionId ? stateManager.getSession(sessionId) : null;
      if (!session) {
        session = stateManager.createSession(this.name, {
          mode: args.mode || 'create',
          projectId: args.projectId
        });
        session.setSteps(this.steps);
        context.sessionId = session.id;
      }

      const action = args.action || 'start';

      switch (action) {
        case 'start':
          return this.handleStart(session);
        case 'next':
          return this.handleNext(session, args.stepData || {});
        case 'previous':
          return this.handlePrevious(session);
        case 'cancel':
          return this.handleCancel(session);
        case 'finish':
          return this.handleFinish(session);
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      this.getLogger().error('Issue workflow wizard failed', { error });
      return { success: false, error: error.message };
    }
  }

  async handleStart(session) {
    const currentStep = session.getCurrentStep();

    if (currentStep.id === 'workflow-type') {
      await this.loadProjects(currentStep, session);
    }

    return {
      success: true,
      data: {
        sessionId: session.id,
        currentStep,
        progress: session.getProgress(),
        canGoBack: session.canGoBack(),
        canGoForward: false
      }
    };
  }

  async handleNext(session, stepData) {
    try {
      const currentStep = session.getCurrentStep();
      await this.validateStepData(currentStep.id, stepData, session);

      await session.nextStep(stepData);
      const newStep = session.getCurrentStep();

      // Dynamically configure steps based on workflow type
      if (newStep.id === 'issue-details') {
        await this.configureIssueDetailsStep(newStep, session);
      } else if (newStep.id === 'advanced-options') {
        await this.loadAdvancedOptions(newStep, session);
      } else if (newStep.id === 'review-create') {
        newStep.review = this.generateReview(session);
      }

      return {
        success: true,
        data: {
          sessionId: session.id,
          currentStep: newStep,
          progress: session.getProgress(),
          canGoBack: session.canGoBack(),
          canGoForward: session.hasCompletedStep(newStep.id)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handlePrevious(session) {
    try {
      await session.previousStep();
      return {
        success: true,
        data: {
          sessionId: session.id,
          currentStep: session.getCurrentStep(),
          progress: session.getProgress(),
          canGoBack: session.canGoBack(),
          canGoForward: true
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleCancel(session) {
    session.abort();
    return {
      success: true,
      data: { cancelled: true, sessionId: session.id }
    };
  }

  async handleFinish(session) {
    try {
      const issues = await this.createIssues(session);
      session.complete();

      return {
        success: true,
        data: {
          completed: true,
          issues,
          sessionId: session.id,
          summary: {
            created: issues.length,
            type: session.getState('workflowType'),
            project: session.getState('projectId')
          }
        }
      };
    } catch (error) {
      this.getLogger().error('Failed to create issues', { error });
      return { success: false, error: `Failed to create issues: ${error.message}` };
    }
  }

  async validateStepData(stepId, data, session) {
    switch (stepId) {
      case 'workflow-type':
        if (!data.workflowType) {
          throw new Error('Workflow type is required');
        }
        if (!data.projectId) {
          throw new Error('Project selection is required');
        }
        break;

      case 'issue-details': {
        const workflowType = session.getState('workflowType');
        if (workflowType === 'single' || workflowType === 'template') {
          if (!data.title?.trim()) {
            throw new Error('Issue title is required');
          }
        } else if (workflowType === 'bulk') {
          if (!data.issues || data.issues.length === 0) {
            throw new Error('At least one issue is required');
          }
        } else if (workflowType === 'import') {
          if (!data.importData) {
            throw new Error('Import data is required');
          }
        }
        break;
      }
    }
  }

  async loadProjects(step, session) {
    try {
      const context = session.executionContext;
      if (!context) {
        step.form.fields[1].options = [];
        return;
      }

      const { services, client, logger } = context;
      const projects = await services.projectService.listProjects(client);

      step.form.fields[1].options = projects.map(p => ({
        value: p.identifier,
        label: `${p.identifier} - ${p.name || 'Unnamed Project'}`
      }));

      if (session.getState('projectId')) {
        step.form.fields[1].defaultValue = session.getState('projectId');
      }

      logger.debug('Loaded projects for issue workflow', { projectCount: projects.length });
    } catch (error) {
      this.getLogger().error('Failed to load projects', { error });
      step.form.fields[1].options = [];
    }
  }

  async configureIssueDetailsStep(step, session) {
    const workflowType = session.getState('workflowType');

    switch (workflowType) {
      case 'single':
        step.form.fields = [
          {
            name: 'title',
            type: 'string',
            required: true,
            description: 'Issue title',
            placeholder: 'Enter issue title'
          },
          {
            name: 'description',
            type: 'text',
            required: false,
            description: 'Issue description',
            placeholder: 'Describe the issue...'
          },
          {
            name: 'priority',
            type: 'select',
            required: true,
            description: 'Priority',
            options: [
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' },
              { value: 'Urgent', label: 'Urgent' }
            ],
            defaultValue: 'Medium'
          },
          {
            name: 'assignee',
            type: 'select',
            required: false,
            description: 'Assignee',
            dynamic: true,
            placeholder: 'Select assignee'
          },
          {
            name: 'dueDate',
            type: 'date',
            required: false,
            description: 'Due date'
          }
        ];
        break;

      case 'bulk':
        step.form.fields = [
          {
            name: 'bulkMethod',
            type: 'select',
            required: true,
            description: 'How to enter issues',
            options: [
              { value: 'list', label: 'Enter as list' },
              { value: 'paste', label: 'Paste from spreadsheet' },
              { value: 'generate', label: 'Generate from pattern' }
            ],
            defaultValue: 'list'
          },
          {
            name: 'issues',
            type: 'array',
            required: true,
            description: 'Issue list (one per line)',
            placeholder: 'Issue 1\nIssue 2\nIssue 3'
          },
          {
            name: 'commonPriority',
            type: 'select',
            required: true,
            description: 'Common priority for all',
            options: [
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' }
            ],
            defaultValue: 'Medium'
          }
        ];
        break;

      case 'template':
        step.form.fields = await this.loadTemplateFields(session);
        break;

      case 'import':
        step.form.fields = [
          {
            name: 'importFormat',
            type: 'select',
            required: true,
            description: 'Import format',
            options: [
              { value: 'csv', label: 'CSV' },
              { value: 'json', label: 'JSON' },
              { value: 'markdown', label: 'Markdown' }
            ],
            defaultValue: 'csv'
          },
          {
            name: 'importData',
            type: 'text',
            required: true,
            description: 'Paste import data',
            placeholder: 'Paste CSV/JSON data here...'
          },
          {
            name: 'mappingRules',
            type: 'object',
            required: false,
            description: 'Field mapping rules'
          }
        ];
        break;

      case 'clone':
        step.form.fields = [
          {
            name: 'sourceIssues',
            type: 'multiselect',
            required: true,
            description: 'Issues to clone',
            dynamic: true,
            placeholder: 'Select issues'
          },
          {
            name: 'cloneOptions',
            type: 'multiselect',
            required: false,
            description: 'What to clone',
            options: [
              { value: 'description', label: 'Description' },
              { value: 'attachments', label: 'Attachments' },
              { value: 'subtasks', label: 'Subtasks' },
              { value: 'comments', label: 'Comments' },
              { value: 'labels', label: 'Labels' }
            ],
            defaultValue: ['description', 'labels']
          }
        ];
        await this.loadIssuesForCloning(step, session);
        break;
    }
  }

  async loadTemplateFields(session) {
    try {
      const context = session.executionContext;
      if (!context) {
        return [];
      }

      const { services, client, logger } = context;
      const projectId = session.getState('projectId');

      if (!projectId) {
        return [];
      }

      const templates = await services.templateService.listTemplates(client, projectId, 20);

      const fields = [
        {
          name: 'templateId',
          type: 'select',
          required: true,
          description: 'Select template',
          options: templates.map(t => ({
            value: t.id,
            label: t.title || t.name || 'Unnamed Template'
          })),
          placeholder: 'Choose a template'
        },
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'Issue title',
          placeholder: 'Enter issue title'
        },
        {
          name: 'templateVariables',
          type: 'object',
          required: false,
          description: 'Template variables'
        }
      ];

      logger.debug('Loaded templates for issue workflow', { templateCount: templates.length });
      return fields;
    } catch (error) {
      this.getLogger().error('Failed to load templates', { error });
      return [
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'Issue title'
        }
      ];
    }
  }

  async loadIssuesForCloning(step, session) {
    try {
      const context = session.executionContext;
      if (!context) {
        step.form.fields[0].options = [];
        return;
      }

      const { services, client, logger } = context;
      const projectId = session.getState('projectId');

      if (!projectId) {
        step.form.fields[0].options = [];
        return;
      }

      const issues = await services.issueService.listIssues(client, projectId, 100);

      step.form.fields[0].options = issues.map(issue => ({
        value: issue.identifier,
        label: `${issue.identifier} - ${issue.title}`
      }));

      logger.debug('Loaded issues for cloning', { projectId, issueCount: issues.length });
    } catch (error) {
      this.getLogger().error('Failed to load issues for cloning', { error });
      step.form.fields[0].options = [];
    }
  }

  async loadAdvancedOptions(step, session) {
    try {
      const context = session.executionContext;
      if (!context) {
        return;
      }

      const { services, client, logger } = context;
      const projectId = session.getState('projectId');

      if (!projectId) {
        return;
      }

      // Load current milestones
      const milestones = await services.milestoneService.listMilestones(client, projectId);

      if (milestones.length > 0) {
        step.form.fields[0].description = `Add to milestone (${milestones[0].name})`;
      }

      // Load components for the project
      const components = await services.projectService.listComponents(client, projectId);

      if (step.form.fields[3]) {
        step.form.fields[3].options = components.map(component => ({
          value: component.label,
          label: component.label
        }));
      }

      // Load issues for linking
      const issues = await services.issueService.listIssues(client, projectId, 50);

      if (step.form.fields[4]) {
        step.form.fields[4].options = issues.map(issue => ({
          value: issue.identifier,
          label: `${issue.identifier} - ${issue.title}`
        }));
      }

      logger.debug('Loaded advanced options for issue workflow', {
        projectId,
        milestoneCount: milestones.length,
        componentCount: components.length,
        issueCount: issues.length
      });
    } catch (error) {
      this.getLogger().error('Failed to load advanced options', { error });
    }
  }

  generateReview(session) {
    const state = session.getAllState();
    const workflowType = state.workflowType;

    const review = {
      workflowType,
      project: state.projectId,
      automation: state.enableAutomation ? 'Enabled' : 'Disabled'
    };

    switch (workflowType) {
      case 'single':
        review.title = state.title;
        review.priority = state.priority;
        review.assignee = state.assignee || 'Unassigned';
        review.dueDate = state.dueDate || 'No due date';
        break;

      case 'bulk':
        review.issueCount = state.issues?.length || 0;
        review.commonPriority = state.commonPriority;
        break;

      case 'template':
        review.template = state.templateId;
        review.title = state.title;
        break;

      case 'import':
        review.format = state.importFormat;
        review.dataPreview = state.importData?.substring(0, 100) + '...';
        break;

      case 'clone':
        review.sourceCount = state.sourceIssues?.length || 0;
        review.cloneOptions = state.cloneOptions?.join(', ') || 'None';
        break;
    }

    if (state.addToSprint) review.sprint = 'Current sprint';
    if (state.autoAssign) review.assignment = 'Auto-assign enabled';
    if (state.createSubtasks) review.subtasks = 'Standard subtasks will be created';

    return review;
  }

  async createIssues(session) {
    const context = session.executionContext;
    if (!context) {
      throw new Error('Execution context not available - wizard session may be invalid');
    }

    const { services, client, logger } = context;
    const state = session.getAllState();

    try {
      const issues = [];

      switch (state.workflowType) {
        case 'single': {
          const issue = await services.issueService.createIssue(
            client,
            state.projectId,
            state.title,
            state.description || '',
            state.priority || 'medium'
          );
          issues.push(issue);
          break;
        }

        case 'bulk': {
          const bulkData = state.issues.map(title => ({
            title,
            description: '',
            priority: state.commonPriority || 'medium'
          }));

          const created = await services.issueService.bulkCreateIssues(
            client,
            state.projectId,
            bulkData
          );
          issues.push(...created);
          break;
        }

        case 'template': {
          const templateIssue = await services.templateService.createIssueFromTemplate(
            client,
            state.templateId,
            state.title || 'New Issue from Template',
            state.projectId
          );
          issues.push(templateIssue);
          break;
        }

        default: {
          logger.warn('Unknown workflow type', { workflowType: state.workflowType });
          break;
        }
      }

      logger.info('Issues created successfully', {
        workflowType: state.workflowType,
        issueCount: issues.length,
        projectId: state.projectId
      });

      return issues;

    } catch (error) {
      logger.error('Failed to create issues', { error: error.message, state });
      throw new Error(`Failed to create issues: ${error.message}`);
    }
  }

  async parseImportData(data, format, projectId) {
    switch (format) {
      case 'csv':
        return this.parseCSV(data, projectId);
      case 'json':
        return JSON.parse(data).map(item => ({
          ...item,
          projectId
        }));
      case 'markdown':
        return this.parseMarkdown(data, projectId);
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  parseCSV(csvData, projectId) {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const issue = { projectId };

      headers.forEach((header, index) => {
        if (values[index]) {
          issue[header.toLowerCase()] = values[index];
        }
      });

      return issue;
    });
  }

  parseMarkdown(mdData, projectId) {
    const issues = [];
    const lines = mdData.trim().split('\n');

    for (const line of lines) {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        issues.push({
          title: line.substring(2).trim(),
          projectId,
          priority: 'Medium'
        });
      }
    }

    return issues;
  }

  async cloneIssue(issueService, sourceId, options, projectId) {
    const source = await issueService.getIssueDetails(sourceId);

    const clonedData = {
      title: `[Clone] ${source.title}`,
      projectId,
      priority: source.priority
    };

    if (options.includes('description')) {
      clonedData.description = source.description;
    }

    if (options.includes('labels')) {
      clonedData.labels = source.labels;
    }

    const cloned = await issueService.createIssue(clonedData);

    if (options.includes('subtasks') && source.subtasks) {
      for (const subtask of source.subtasks) {
        await issueService.createSubissue(cloned._id, {
          title: subtask.title,
          description: subtask.description
        });
      }
    }

    return cloned;
  }

  async createStandardSubtasks(issueService, parentIssues) {
    const standardSubtasks = [
      { title: 'Design review', description: 'Review design and requirements' },
      { title: 'Implementation', description: 'Implement the feature' },
      { title: 'Testing', description: 'Test the implementation' },
      { title: 'Documentation', description: 'Update documentation' }
    ];

    for (const parent of parentIssues) {
      for (const subtask of standardSubtasks) {
        await issueService.createSubissue(parent._id, subtask);
      }
    }
  }

  async linkIssues(issueService, newIssues, targetIssueIds) {
    // Implementation would create relationships between issues
    // This is a placeholder for the actual linking logic
    this.getLogger().info('Linking issues', {
      newCount: newIssues.length,
      targetCount: targetIssueIds.length
    });
  }

  async setupAutomation(issues, state) {
    // Placeholder for automation setup
    // Would integrate with workflow automation system
    this.getLogger().info('Setting up automation', {
      issueCount: issues.length,
      rules: {
        autoTransition: state.autoTransition,
        notifications: state.notificationRules
      }
    });
  }
}

export default IssueWorkflowWizard;

// Create wizard instance
export const issueWorkflowWizard = new IssueWorkflowWizard();

/**
 * Register prompts for auto-loading
 * @param {PromptRegistry} registry - The prompt registry instance
 */
export async function registerPrompts(registry) {
  registry.register(issueWorkflowWizard);
}