/**
 * ProjectSetupWizard - Interactive wizard for creating new Huly projects
 *
 * This wizard guides users through the complete process of setting up
 * a new project in Huly with proper configuration, team members, and initial structure.
 */

import { WizardPrompt, PromptUtils } from '../base/PromptInterface.js';
import { getWizardStateManager } from '../base/WizardState.js';
import { getLogger } from '../../utils/index.js';
// Remove tracker import as it's not actually used in this wizard

/**
 * Project Setup Wizard implementation
 */
export class ProjectSetupWizard extends WizardPrompt {
  constructor() {
    // Call super with complete definition including annotations
    super({
      name: 'project-setup-wizard',
      description: 'Interactive wizard to create and configure new Huly projects',
      category: 'project-management',
      annotations: {
        wizard: true,
        maxSteps: 6,
        estimatedTime: '10-15 minutes',
      },
      arguments: [
        {
          name: 'mode',
          description: 'Wizard mode: start, continue, or status',
          type: 'string',
          enum: ['start', 'continue', 'status'],
          required: false,
          default: 'start',
        },
        {
          name: 'sessionId',
          description: 'Session ID for continuing existing wizard',
          type: 'string',
          required: false,
        },
        {
          name: 'stepData',
          description: 'Data for current step (when continuing)',
          type: 'object',
          required: false,
        },
      ],
      // Use arrow function to delegate to execute method
      handler: async (...args) => this.execute(...args),
    });

    // Define wizard steps
    this.steps = [
      {
        id: 'project-basic-info',
        name: 'Project Basic Information',
        description: 'Define basic project details and scope',
        required: true,
        validation: (data) => this.validateBasicInfo(data),
        handler: (data, context) => this.handleBasicInfo(data, context),
      },
      {
        id: 'project-settings',
        name: 'Project Settings',
        description: 'Configure project settings and preferences',
        required: true,
        validation: (data) => this.validateProjectSettings(data),
        handler: (data, context) => this.handleProjectSettings(data, context),
      },
      {
        id: 'team-setup',
        name: 'Team Setup',
        description: 'Add team members and assign roles',
        required: false,
        validation: (data) => this.validateTeamSetup(data),
        handler: (data, context) => this.handleTeamSetup(data, context),
      },
      {
        id: 'initial-structure',
        name: 'Initial Project Structure',
        description: 'Create initial project structure (milestones, components)',
        required: false,
        validation: (data) => this.validateInitialStructure(data),
        handler: (data, context) => this.handleInitialStructure(data, context),
      },
      {
        id: 'finalization',
        name: 'Project Creation',
        description: 'Create the project and finalize setup',
        required: true,
        validation: (data) => this.validateFinalization(data),
        handler: (data, context) => this.handleFinalization(data, context),
      },
    ];
  }

  /**
   * Get logger with fallback to default logger
   * @param {Object} context - Execution context
   * @returns {Object} Logger instance
   */
  getLoggerSafe(context) {
    return context && context.logger ? context.logger : getLogger();
  }

  /**
   * Main wizard execution handler
   */
  async execute(args, context) {
    const { mode = 'start', sessionId, stepData } = args;

    try {
      switch (mode) {
        case 'start':
          return await this.startWizard(context);
        case 'continue':
          return await this.continueWizard(sessionId, stepData, context);
        case 'status':
          return await this.getWizardStatus(sessionId, context);
        default:
          throw new Error(`Invalid wizard mode: ${mode}`);
      }
    } catch (error) {
      this.getLoggerSafe(context).error('Project setup wizard error:', error);
      return PromptUtils.createErrorResponse(`Project setup wizard error: ${error.message}`);
    }
  }

  /**
   * Start a new project setup wizard session
   */
  async startWizard(context) {
    const stateManager = getWizardStateManager();
    const session = stateManager.createSession('project-setup-wizard', {
      startedAt: new Date().toISOString(),
      context: {
        userId: context.config?.userId || 'unknown',
        workspace: context.config?.workspace || 'default',
      },
    });

    // Store execution context for API calls
    session.executionContext = context;

    // Initialize wizard steps
    session.setSteps(this.steps);

    this.getLoggerSafe(context).info(`Started project setup wizard session: ${session.sessionId}`);

    return this.renderCurrentStep(session, context);
  }

  /**
   * Continue existing wizard session
   */
  async continueWizard(sessionId, stepData, context) {
    if (!sessionId) {
      return PromptUtils.createErrorResponse('Session ID is required to continue wizard');
    }

    const stateManager = getWizardStateManager();
    const session = stateManager.getSession(sessionId);

    if (!session) {
      return PromptUtils.createErrorResponse(`Wizard session ${sessionId} not found or expired`);
    }

    // Store/update execution context for API calls
    session.executionContext = context;

    try {
      // Advance to next step with provided data
      await session.nextStep(stepData || {});

      if (session.isCompleted) {
        return this.renderCompletionSummary(session, context);
      }

      return this.renderCurrentStep(session, context);
    } catch (error) {
      this.getLoggerSafe(context).error('Error continuing wizard:', error);
      return PromptUtils.createErrorResponse(`Error continuing wizard: ${error.message}`);
    }
  }

  /**
   * Get wizard status
   */
  async getWizardStatus(sessionId, _context) {
    if (!sessionId) {
      return PromptUtils.createErrorResponse('Session ID is required to get wizard status');
    }

    const stateManager = getWizardStateManager();
    const session = stateManager.getSession(sessionId);

    if (!session) {
      return PromptUtils.createErrorResponse(`Wizard session ${sessionId} not found or expired`);
    }

    const progress = session.getProgress();
    return PromptUtils.createSuccessResponse('Wizard Status', {
      sessionId: progress.sessionId,
      progress: `${progress.completedSteps}/${progress.totalSteps} steps completed (${progress.percentage}%)`,
      currentStep: progress.currentStepInfo?.name || 'Unknown',
      isCompleted: progress.isCompleted,
      isAborted: progress.isAborted,
      state: session.getState(),
    });
  }

  /**
   * Render current step UI
   */
  renderCurrentStep(session, _context) {
    const currentStep = session.getCurrentStep();
    if (!currentStep) {
      return PromptUtils.createErrorResponse('No current step available');
    }

    const progress = session.getProgress();
    const state = session.getState();

    let content = `# 🚀 Project Setup Wizard\n\n`;
    content += `**Progress:** ${progress.completedSteps}/${progress.totalSteps} steps completed (${progress.percentage}%)\n\n`;
    content += `## ${currentStep.name}\n\n`;
    content += `${currentStep.description}\n\n`;

    // Render step-specific form
    switch (currentStep.id) {
      case 'project-basic-info':
        content += this.renderBasicInfoForm(state);
        break;
      case 'project-settings':
        content += this.renderProjectSettingsForm(state);
        break;
      case 'team-setup':
        content += this.renderTeamSetupForm(state);
        break;
      case 'initial-structure':
        content += this.renderInitialStructureForm(state);
        break;
      case 'finalization':
        content += this.renderFinalizationForm(state);
        break;
    }

    content += `\n\n---\n\n`;
    content += `**Session ID:** \`${session.sessionId}\`\n\n`;
    content += `To continue this wizard, use:\n`;
    content += `\`\`\`\n`;
    content += `project-setup-wizard(mode="continue", sessionId="${session.sessionId}", stepData={...})\n`;
    content += `\`\`\`\n\n`;

    if (progress.completedSteps > 0) {
      content += `To go back to the previous step or check status, you can navigate using the session ID.\n`;
    }

    return PromptUtils.createSuccessResponse('Project Setup Wizard', content);
  }

  /**
   * Render basic info form
   */
  renderBasicInfoForm(state) {
    return `Please provide the basic information for your new project:

**Required Fields:**
- **Project Name**: A clear, descriptive name for your project
- **Project Identifier**: Short identifier/code (e.g., "PROJ", "WEBSITE")
- **Description**: Brief description of the project's purpose

**Optional Fields:**
- **Project Type**: Type of project (software, marketing, research, etc.)
- **Priority**: Project priority level (low, medium, high, critical)

**Example stepData:**
\`\`\`json
{
  "name": "Website Redesign",
  "identifier": "WEB",
  "description": "Complete redesign of company website with modern UI/UX",
  "type": "software",
  "priority": "high"
}
\`\`\`

${state.name ? `✅ **Current Project Name**: ${state.name}` : ''}
${state.identifier ? `✅ **Current Identifier**: ${state.identifier}` : ''}`;
  }

  /**
   * Render project settings form
   */
  renderProjectSettingsForm(state) {
    return `Configure your project settings and preferences:

**Available Settings:**
- **Default Assignee**: Default person for new issues (email or user ID)
- **Issue Types**: Types of issues to enable (bug, task, story, epic)
- **Workflow**: Project workflow (simple, kanban, scrum)
- **Notifications**: Notification preferences
- **Privacy**: Project visibility (public, private, team)

**Example stepData:**
\`\`\`json
{
  "defaultAssignee": "john@company.com",
  "issueTypes": ["task", "bug", "story"],
  "workflow": "kanban",
  "notifications": true,
  "privacy": "team"
}
\`\`\`

**Current Project**: ${state.name || 'Unknown'} (${state.identifier || 'N/A'})`;
  }

  /**
   * Render team setup form
   */
  renderTeamSetupForm(state) {
    return `Add team members and assign roles to your project:

**Team Member Structure:**
- **Email**: Team member's email address
- **Role**: Member role (admin, member, viewer)
- **Permissions**: Specific permissions if needed

**Example stepData:**
\`\`\`json
{
  "members": [
    {
      "email": "alice@company.com",
      "role": "admin",
      "permissions": ["manage_project", "assign_issues"]
    },
    {
      "email": "bob@company.com",
      "role": "member",
      "permissions": ["create_issues", "comment"]
    }
  ]
}
\`\`\`

**Current Project**: ${state.name || 'Unknown'}
**Project Type**: ${state.type || 'Not specified'}

*Note: You can skip this step and add team members later.*`;
  }

  /**
   * Render initial structure form
   */
  renderInitialStructureForm(state) {
    return `Create the initial structure for your project:

**Structure Options:**
- **Milestones**: Key project milestones and deadlines
- **Components**: Project components or modules
- **Labels**: Custom labels for issue categorization
- **Templates**: Issue templates for common scenarios

**Example stepData:**
\`\`\`json
{
  "milestones": [
    {
      "name": "Phase 1 - Planning",
      "description": "Initial planning and design phase",
      "dueDate": "2024-02-15"
    },
    {
      "name": "Phase 2 - Development",
      "description": "Main development phase",
      "dueDate": "2024-04-30"
    }
  ],
  "components": ["Frontend", "Backend", "Database", "Documentation"],
  "labels": ["enhancement", "documentation", "urgent"],
  "createTemplates": true
}
\`\`\`

**Current Project**: ${state.name || 'Unknown'}
**Team Members**: ${state.members?.length || 0} configured

*Note: This step is optional and can be configured later.*`;
  }

  /**
   * Render finalization form
   */
  renderFinalizationForm(state) {
    const summary = this.generateProjectSummary(state);

    return `Ready to create your project! Please review the configuration:

${summary}

**Final Options:**
- **Create Sample Issues**: Create example issues to get started
- **Send Notifications**: Notify team members about the new project
- **Generate Report**: Create a project setup report

**Example stepData:**
\`\`\`json
{
  "createSampleIssues": true,
  "sendNotifications": true,
  "generateReport": false,
  "confirm": true
}
\`\`\`

**⚠️ Important**: Set \`"confirm": true\` to proceed with project creation.`;
  }

  /**
   * Generate project summary
   */
  generateProjectSummary(state) {
    let summary = `## 📋 Project Configuration Summary\n\n`;

    summary += `**📌 Basic Information:**\n`;
    summary += `- Name: ${state.name || 'Not specified'}\n`;
    summary += `- Identifier: ${state.identifier || 'Not specified'}\n`;
    summary += `- Description: ${state.description || 'Not specified'}\n`;
    summary += `- Type: ${state.type || 'Not specified'}\n`;
    summary += `- Priority: ${state.priority || 'Not specified'}\n\n`;

    if (state.workflow || state.defaultAssignee) {
      summary += `**⚙️ Project Settings:**\n`;
      if (state.workflow) summary += `- Workflow: ${state.workflow}\n`;
      if (state.defaultAssignee) summary += `- Default Assignee: ${state.defaultAssignee}\n`;
      if (state.issueTypes) summary += `- Issue Types: ${state.issueTypes.join(', ')}\n`;
      if (state.privacy) summary += `- Privacy: ${state.privacy}\n`;
      summary += `\n`;
    }

    if (state.members?.length > 0) {
      summary += `**👥 Team Members (${state.members.length}):**\n`;
      state.members.forEach((member) => {
        summary += `- ${member.email} (${member.role})\n`;
      });
      summary += `\n`;
    }

    if (state.milestones?.length > 0) {
      summary += `**🎯 Milestones (${state.milestones.length}):**\n`;
      state.milestones.forEach((milestone) => {
        summary += `- ${milestone.name}${milestone.dueDate ? ` (${milestone.dueDate})` : ''}\n`;
      });
      summary += `\n`;
    }

    if (state.components?.length > 0) {
      summary += `**🧩 Components:** ${state.components.join(', ')}\n\n`;
    }

    return summary;
  }

  /**
   * Render completion summary
   */
  renderCompletionSummary(session, _context) {
    const state = session.getState();
    let content = `# ✅ Project Created Successfully!\n\n`;

    if (state.creationFailed) {
      content = `# ❌ Project Creation Failed\n\n`;
      content += `Unfortunately, there was an error creating your project **${state.name}** (${state.identifier}).\n\n`;
      content += `**Error**: ${state.error}\n\n`;
      content += `Please try again or contact support if the issue persists.\n\n`;
      content += `**Session ID**: \`${session.sessionId}\` (for troubleshooting)\n`;
      return PromptUtils.createErrorResponse('Project Creation Failed', content);
    }

    content += `Your project **${state.name}** (${state.identifier}) has been created and configured.\n\n`;

    if (state.projectId) {
      content += `**🔗 Project URL**: https://pm.oculair.ca/workbench/agentspace/${state.projectId}\n\n`;
    }

    // Show creation summary
    if (state.creationSummary) {
      content += `## 📊 Creation Summary\n\n`;
      content += `- **Projects**: ${state.creationSummary.project}\n`;
      content += `- **Components**: ${state.creationSummary.components}\n`;
      content += `- **Milestones**: ${state.creationSummary.milestones}\n`;
      content += `- **Sample Issues**: ${state.creationSummary.issues}\n`;
      content += `- **Total Items Created**: ${state.creationSummary.totalItems}\n\n`;
    }

    if (state.createdComponents?.length > 0) {
      content += `## 🧩 Created Components\n\n`;
      state.createdComponents.forEach((comp) => {
        content += `- **${comp.name}** (${comp.label})\n`;
      });
      content += `\n`;
    }

    if (state.createdMilestones?.length > 0) {
      content += `## 🎯 Created Milestones\n\n`;
      state.createdMilestones.forEach((milestone) => {
        const dueDate = milestone.dueDate ? ` - Due: ${milestone.dueDate}` : '';
        content += `- **${milestone.name}**${dueDate}\n`;
      });
      content += `\n`;
    }

    if (state.createdIssues?.length > 0) {
      content += `## 📋 Sample Issues Created\n\n`;
      state.createdIssues.forEach((issue) => {
        const identifier = issue.identifier ? ` (${issue.identifier})` : '';
        content += `- **${issue.title}**${identifier} - Priority: ${issue.priority}\n`;
      });
      content += `\n`;
    }

    content += `## 🚀 Next Steps\n\n`;
    content += `1. **Visit your project** using the URL above\n`;
    content += `2. **Review the sample issues** to get started\n`;
    if (state.members?.length > 0) {
      content += `3. **Verify team member access** and permissions\n`;
    } else {
      content += `3. **Invite team members** to collaborate\n`;
    }
    content += `4. **Start creating real issues** for your work\n`;
    content += `5. **Configure additional project settings** as needed\n\n`;

    content += `---\n\n`;
    content += `**✨ Project Setup Wizard completed successfully!**\n`;
    content += `**Session**: ${session.metadata.completedSteps.length}/${session.steps.length} steps completed\n`;
    content += `**Created**: ${new Date(state.createdAt).toLocaleString()}\n`;
    content += `**Session ID**: \`${session.sessionId}\`\n`;

    return PromptUtils.createSuccessResponse('🎉 Project Setup Complete', content);
  }

  // Validation methods for each step
  async validateBasicInfo(data, _state) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return 'Project name is required and must be a non-empty string';
    }

    if (
      !data.identifier ||
      typeof data.identifier !== 'string' ||
      !/^[A-Z][A-Z0-9]{1,10}$/.test(data.identifier)
    ) {
      return 'Project identifier is required and must be 2-11 uppercase characters starting with a letter';
    }

    if (
      !data.description ||
      typeof data.description !== 'string' ||
      data.description.trim().length === 0
    ) {
      return 'Project description is required and must be a non-empty string';
    }

    return true;
  }

  async validateProjectSettings(data, _state) {
    if (data.issueTypes && (!Array.isArray(data.issueTypes) || data.issueTypes.length === 0)) {
      return 'Issue types must be a non-empty array if provided';
    }

    if (data.workflow && !['simple', 'kanban', 'scrum'].includes(data.workflow)) {
      return 'Workflow must be one of: simple, kanban, scrum';
    }

    if (data.privacy && !['public', 'private', 'team'].includes(data.privacy)) {
      return 'Privacy must be one of: public, private, team';
    }

    return true;
  }

  async validateTeamSetup(data, _state) {
    if (data.members) {
      if (!Array.isArray(data.members)) {
        return 'Team members must be an array';
      }

      for (const member of data.members) {
        if (!member.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
          return 'All team members must have valid email addresses';
        }
        if (!member.role || !['admin', 'member', 'viewer'].includes(member.role)) {
          return 'All team members must have a valid role (admin, member, viewer)';
        }
      }
    }

    return true;
  }

  async validateInitialStructure(data, _state) {
    if (data.milestones) {
      if (!Array.isArray(data.milestones)) {
        return 'Milestones must be an array';
      }

      for (const milestone of data.milestones) {
        if (!milestone.name || typeof milestone.name !== 'string') {
          return 'All milestones must have a name';
        }
        if (milestone.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(milestone.dueDate)) {
          return 'Milestone due dates must be in YYYY-MM-DD format';
        }
      }
    }

    if (data.components && !Array.isArray(data.components)) {
      return 'Components must be an array';
    }

    return true;
  }

  async validateFinalization(data, _state) {
    if (!data.confirm) {
      return 'You must set confirm: true to create the project';
    }

    return true;
  }

  // Handler methods for each step
  async handleBasicInfo(data, state, session) {
    // Store basic info in session state
    session.updateState({
      name: data.name.trim(),
      identifier: data.identifier.toUpperCase(),
      description: data.description.trim(),
      type: data.type || 'general',
      priority: data.priority || 'medium',
    });
  }

  async handleProjectSettings(data, state, session) {
    // Store project settings
    session.updateState({
      defaultAssignee: data.defaultAssignee,
      issueTypes: data.issueTypes || ['task', 'bug'],
      workflow: data.workflow || 'simple',
      notifications: data.notifications !== false,
      privacy: data.privacy || 'team',
    });
  }

  async handleTeamSetup(data, state, session) {
    // Store team configuration
    if (data.members) {
      session.updateState({
        members: data.members.map((member) => ({
          email: member.email,
          role: member.role,
          permissions: member.permissions || [],
        })),
      });
    }
  }

  async handleInitialStructure(data, state, session) {
    // Store initial structure configuration
    session.updateState({
      milestones: data.milestones || [],
      components: data.components || [],
      labels: data.labels || [],
      createTemplates: data.createTemplates || false,
    });
  }

  async handleFinalization(data, state, session) {
    // Get execution context from session
    const context = session.executionContext;
    if (!context) {
      throw new Error('Execution context not available - wizard session may be invalid');
    }

    const { services, logger } = context;
    const projectData = session.getState();

    try {
      logger.info('Starting project creation via wizard', { projectData, options: data });

      // 1. Create project in Huly
      logger.debug('Creating project', {
        name: projectData.name,
        identifier: projectData.identifier,
      });

      const projectResult = await services.projectService.createProject(
        context.client,
        projectData.name,
        projectData.description,
        projectData.identifier
      );

      logger.info('Project created successfully', { projectResult });

      // Track created components and milestones
      const createdComponents = [];
      const createdMilestones = [];
      const createdIssues = [];

      // 2. Create components
      if (projectData.components && projectData.components.length > 0) {
        logger.debug('Creating components', { components: projectData.components });

        for (const componentName of projectData.components) {
          try {
            const componentResult = await services.projectService.createComponent(
              context.client,
              projectData.identifier,
              componentName,
              `${componentName} component created via Project Setup Wizard`
            );

            createdComponents.push({
              name: componentName,
              id: componentResult.id || componentName,
              label: componentName,
            });

            logger.debug('Component created', { componentName, result: componentResult });
          } catch (componentError) {
            logger.warn('Failed to create component', {
              componentName,
              error: componentError.message,
            });
            // Continue with other components
          }
        }
      }

      // 3. Create milestones
      if (projectData.milestones && projectData.milestones.length > 0) {
        logger.debug('Creating milestones', { milestones: projectData.milestones });

        for (const milestone of projectData.milestones) {
          try {
            const milestoneResult = await services.projectService.createMilestone(
              context.client,
              projectData.identifier,
              milestone.name,
              milestone.description ||
                `${milestone.name} milestone created via Project Setup Wizard`,
              milestone.dueDate,
              'planned'
            );

            createdMilestones.push({
              name: milestone.name,
              id: milestoneResult.id || milestone.name,
              label: milestone.name,
              dueDate: milestone.dueDate,
              description: milestone.description,
            });

            logger.debug('Milestone created', {
              milestone: milestone.name,
              result: milestoneResult,
            });
          } catch (milestoneError) {
            logger.warn('Failed to create milestone', {
              milestone: milestone.name,
              error: milestoneError.message,
            });
            // Continue with other milestones
          }
        }
      }

      // 4. Create sample issues if requested
      if (data.createSampleIssues) {
        logger.debug('Creating sample issues');

        const sampleIssues = [
          {
            title: '🚀 Project Setup Complete',
            description: `# Welcome to ${projectData.name}!\n\nYour project has been successfully set up via the Project Setup Wizard.\n\n## Project Details\n- **Identifier**: ${projectData.identifier}\n- **Components**: ${createdComponents.length}\n- **Milestones**: ${createdMilestones.length}\n\n## Next Steps\n1. Review project configuration\n2. Invite team members\n3. Start creating issues for your work\n4. Configure any additional settings\n\nHappy project management! 🎉`,
            priority: 'medium',
          },
          {
            title: '👥 Team Onboarding',
            description: `# Team Onboarding Checklist\n\nUse this issue to track team member onboarding progress.\n\n## Tasks\n- [ ] Invite team members to project\n- [ ] Share project documentation\n- [ ] Set up communication channels\n- [ ] Review project goals and timeline\n- [ ] Assign initial responsibilities\n\n**Team Members**: ${projectData.members?.length || 0} configured`,
            priority: 'high',
          },
        ];

        for (const issue of sampleIssues) {
          try {
            const issueResult = await services.issueService.createIssue(
              context.client,
              projectData.identifier,
              issue.title,
              issue.description,
              issue.priority
            );

            createdIssues.push({
              title: issue.title,
              identifier: issueResult.data?.identifier,
              priority: issue.priority,
            });

            logger.debug('Sample issue created', { title: issue.title, result: issueResult });
          } catch (issueError) {
            logger.warn('Failed to create sample issue', {
              title: issue.title,
              error: issueError.message,
            });
            // Continue with other issues
          }
        }
      }

      // 5. Store creation results
      session.updateState({
        projectId: projectResult.identifier || projectData.identifier,
        projectCreated: true,
        createdAt: new Date().toISOString(),
        createSampleIssues: data.createSampleIssues,
        sendNotifications: data.sendNotifications,
        generateReport: data.generateReport,
        createdComponents,
        createdMilestones,
        createdIssues,
        creationSummary: {
          project: 1,
          components: createdComponents.length,
          milestones: createdMilestones.length,
          issues: createdIssues.length,
          totalItems:
            1 + createdComponents.length + createdMilestones.length + createdIssues.length,
        },
      });

      logger.info('Project setup wizard completed successfully', {
        projectId: projectResult.identifier,
        summary: {
          components: createdComponents.length,
          milestones: createdMilestones.length,
          issues: createdIssues.length,
        },
      });
    } catch (error) {
      logger.error('Project creation failed in wizard', {
        error: error.message,
        projectData: projectData.name,
        stack: error.stack,
      });

      // Store failure state
      session.updateState({
        creationFailed: true,
        error: error.message,
        failedAt: new Date().toISOString(),
      });

      throw new Error(`Failed to create project: ${error.message}`);
    }
  }
}

// Export the wizard instance
export const projectSetupWizard = new ProjectSetupWizard();

/**
 * Register prompts for auto-loading
 * @param {PromptRegistry} registry - The prompt registry instance
 */
export async function registerPrompts(registry) {
  registry.register(projectSetupWizard);
}
