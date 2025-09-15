/**
 * SprintPlanningWizard.js
 *
 * Interactive wizard for planning sprints, setting goals, and prioritizing issues.
 * Provides guided workflow for sprint setup with team collaboration features.
 */

import { WizardPrompt } from '../base/PromptInterface.js';
import { getLogger } from '../../utils/index.js';
// Remove unused imports - these services are not needed for prompt definitions
// The actual services will be provided through the execution context

export class SprintPlanningWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'sprint-planning-wizard',
      description: 'Interactive wizard for planning sprints, setting goals, and prioritizing issues',
      category: 'project-management',
      annotations: {
        wizard: true,
        maxSteps: 6,
        estimatedTime: '10-15 minutes',
        tags: ['sprint', 'planning', 'milestone', 'agile']
      },
      arguments: [
        {
          name: 'projectId',
          description: 'Project ID to create sprint for (optional)',
          required: false
        },
        {
          name: 'sprintName',
          description: 'Suggested sprint name (optional)',
          required: false
        }
      ],
      // Use arrow function to delegate to execute method
      handler: async (...args) => this.execute(...args)
    });

    // Store steps on the instance directly
    this.steps = [
        {
          id: 'sprint-details',
          name: 'Sprint Details',
          description: 'Define sprint name, duration, and goals',
          form: {
            fields: [
              {
                name: 'name',
                type: 'string',
                required: true,
                description: 'Sprint name (e.g., Sprint 1, Q1 Sprint)',
                placeholder: 'Sprint 1'
              },
              {
                name: 'goal',
                type: 'string',
                required: true,
                description: 'Sprint goal - what will be accomplished',
                placeholder: 'Complete user authentication features'
              },
              {
                name: 'startDate',
                type: 'date',
                required: true,
                description: 'Sprint start date',
                defaultValue: new Date().toISOString().split('T')[0]
              },
              {
                name: 'endDate',
                type: 'date',
                required: true,
                description: 'Sprint end date (typically 2 weeks)',
                defaultValue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              },
              {
                name: 'description',
                type: 'text',
                required: false,
                description: 'Detailed sprint description and objectives',
                placeholder: 'This sprint focuses on...'
              }
            ]
          }
        },
        {
          id: 'project-selection',
          name: 'Project Selection',
          description: 'Select the project for this sprint',
          form: {
            fields: [
              {
                name: 'projectId',
                type: 'select',
                required: true,
                description: 'Select project',
                dynamic: true, // Will be populated with available projects
                placeholder: 'Choose a project'
              },
              {
                name: 'teamCapacity',
                type: 'number',
                required: false,
                description: 'Team capacity in story points (optional)',
                placeholder: '40',
                min: 0
              }
            ]
          }
        },
        {
          id: 'issue-selection',
          name: 'Issue Selection',
          description: 'Select issues to include in the sprint',
          form: {
            fields: [
              {
                name: 'issueIds',
                type: 'multiselect',
                required: false,
                description: 'Select issues for the sprint backlog',
                dynamic: true, // Will be populated with available issues
                placeholder: 'Choose issues'
              },
              {
                name: 'autoInclude',
                type: 'checkbox',
                required: false,
                description: 'Auto-include high priority issues',
                defaultValue: false
              },
              {
                name: 'maxIssues',
                type: 'number',
                required: false,
                description: 'Maximum number of issues to include',
                placeholder: '20',
                min: 1,
                max: 100
              }
            ]
          }
        },
        {
          id: 'priority-ordering',
          name: 'Priority & Ordering',
          description: 'Set issue priorities and order for the sprint',
          form: {
            fields: [
              {
                name: 'prioritizationMethod',
                type: 'select',
                required: true,
                description: 'How to prioritize issues',
                options: [
                  { value: 'manual', label: 'Manual ordering' },
                  { value: 'priority', label: 'By priority level' },
                  { value: 'effort', label: 'By effort estimate' },
                  { value: 'value', label: 'By business value' }
                ],
                defaultValue: 'priority'
              },
              {
                name: 'includeStretchGoals',
                type: 'checkbox',
                required: false,
                description: 'Include stretch goals',
                defaultValue: true
              }
            ]
          }
        },
        {
          id: 'team-assignments',
          name: 'Team Assignments',
          description: 'Assign team members to sprint issues',
          form: {
            fields: [
              {
                name: 'assignmentStrategy',
                type: 'select',
                required: true,
                description: 'Assignment strategy',
                options: [
                  { value: 'balanced', label: 'Balance workload' },
                  { value: 'expertise', label: 'Based on expertise' },
                  { value: 'availability', label: 'Based on availability' },
                  { value: 'manual', label: 'Manual assignment' }
                ],
                defaultValue: 'balanced'
              },
              {
                name: 'teamMembers',
                type: 'multiselect',
                required: false,
                description: 'Team members for this sprint',
                dynamic: true, // Will be populated with available team members
                placeholder: 'Select team members'
              }
            ]
          }
        },
        {
          id: 'review-create',
          name: 'Review & Create',
          description: 'Review sprint plan and create milestone',
          review: true // This step shows a summary
        }
    ];

    this.logger = null; // Lazy initialization
  }

  getLogger() {
    if (!this.logger) {
      this.logger = getLogger('sprint-planning-wizard');
    }
    return this.logger;
  }

  async execute(args = {}, context = {}) {
    try {
      const { sessionId } = context;
      const stateManager = (await import('../base/WizardState.js')).getWizardStateManager();

      // Get or create session
      let session = sessionId ? stateManager.getSession(sessionId) : null;
      if (!session) {
        session = stateManager.createSession(this.name, {
          projectId: args.projectId,
          sprintName: args.sprintName
        });
        session.setSteps(this.steps);
        context.sessionId = session.id;
      }

      // Handle different actions
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
          return {
            success: false,
            error: `Unknown action: ${action}`
          };
      }
    } catch (error) {
      this.getLogger().error('Sprint planning wizard execution failed', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleStart(session) {
    const currentStep = session.getCurrentStep();

    // Enhance step with dynamic data if needed
    if (currentStep.id === 'sprint-details' && session.getState('sprintName')) {
      currentStep.form.fields[0].defaultValue = session.getState('sprintName');
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
      // Validate step data based on current step
      const currentStep = session.getCurrentStep();
      await this.validateStepData(currentStep.id, stepData, session);

      // Move to next step
      await session.nextStep(stepData);

      const newStep = session.getCurrentStep();

      // Enhance next step with dynamic data
      if (newStep.id === 'project-selection') {
        await this.loadProjects(newStep, session);
      } else if (newStep.id === 'issue-selection') {
        await this.loadIssues(newStep, session);
      } else if (newStep.id === 'team-assignments') {
        await this.loadTeamMembers(newStep, session);
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
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handlePrevious(session) {
    try {
      await session.previousStep();
      const currentStep = session.getCurrentStep();

      return {
        success: true,
        data: {
          sessionId: session.id,
          currentStep,
          progress: session.getProgress(),
          canGoBack: session.canGoBack(),
          canGoForward: true
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleCancel(session) {
    session.abort();
    return {
      success: true,
      data: {
        cancelled: true,
        sessionId: session.id
      }
    };
  }

  async handleFinish(session) {
    try {
      // Create the sprint milestone
      const sprintData = this.buildSprintData(session);
      const sprint = await this.createSprint(sprintData, session);

      // Mark session as completed
      session.complete();

      return {
        success: true,
        data: {
          completed: true,
          sprint,
          sessionId: session.id,
          summary: {
            name: sprint.name,
            goal: sprint.goal,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            issueCount: sprintData.issueIds?.length || 0,
            teamSize: sprintData.teamMembers?.length || 0
          }
        }
      };
    } catch (error) {
      this.getLogger().error('Failed to create sprint', { error });
      return {
        success: false,
        error: `Failed to create sprint: ${error.message}`
      };
    }
  }

  async validateStepData(stepId, data, session) {
    switch (stepId) {
      case 'sprint-details':
        if (!data.name?.trim()) {
          throw new Error('Sprint name is required');
        }
        if (!data.goal?.trim()) {
          throw new Error('Sprint goal is required');
        }
        if (!data.startDate) {
          throw new Error('Start date is required');
        }
        if (!data.endDate) {
          throw new Error('End date is required');
        }
        if (new Date(data.endDate) <= new Date(data.startDate)) {
          throw new Error('End date must be after start date');
        }
        break;

      case 'project-selection':
        if (!data.projectId) {
          throw new Error('Project selection is required');
        }
        if (data.teamCapacity && data.teamCapacity < 0) {
          throw new Error('Team capacity must be positive');
        }
        break;

      case 'issue-selection':
        if (data.maxIssues && data.maxIssues < 1) {
          throw new Error('Maximum issues must be at least 1');
        }
        if (data.issueIds && data.maxIssues && data.issueIds.length > data.maxIssues) {
          throw new Error(`Cannot select more than ${data.maxIssues} issues`);
        }
        break;

      case 'priority-ordering':
        if (!data.prioritizationMethod) {
          throw new Error('Prioritization method is required');
        }
        break;

      case 'team-assignments':
        if (!data.assignmentStrategy) {
          throw new Error('Assignment strategy is required');
        }
        break;
    }
  }

  async loadProjects(step, session) {
    try {
      const context = session.executionContext;
      if (!context) {
        step.form.fields[0].options = [];
        return;
      }

      const { services, client, logger } = context;
      const projects = await services.projectService.listProjects(client);

      step.form.fields[0].options = projects.map(p => ({
        value: p.identifier,
        label: `${p.identifier} - ${p.name || 'Unnamed Project'}`
      }));

      // If projectId was provided initially, set it as default
      const initialProjectId = session.getState('projectId');
      if (initialProjectId) {
        step.form.fields[0].defaultValue = initialProjectId;
      }

      logger.debug('Loaded projects for sprint planning', { projectCount: projects.length });
    } catch (error) {
      this.getLogger().error('Failed to load projects', { error });
      step.form.fields[0].options = [];
    }
  }

  async loadIssues(step, session) {
    try {
      const projectId = session.getState('projectId');
      if (!projectId) {
        step.form.fields[0].options = [];
        return;
      }

      const context = session.executionContext;
      if (!context) {
        step.form.fields[0].options = [];
        return;
      }

      const { services, client, logger } = context;

      // Load issues from the project
      const issues = await services.issueService.listIssues(client, projectId, 50);

      step.form.fields[0].options = issues.map(issue => ({
        value: issue.identifier,
        label: `${issue.identifier} - ${issue.title}`,
        metadata: {
          priority: issue.priority || 'medium',
          status: issue.status || 'backlog'
        }
      }));

      logger.debug('Loaded issues for sprint planning', {
        projectId,
        issueCount: issues.length
      });
    } catch (error) {
      this.getLogger().error('Failed to load issues', { error });
      step.form.fields[0].options = [];
    }
  }

  async loadTeamMembers(step, session) {
    try {
      const projectId = session.getState('projectId');
      if (!projectId) {
        step.form.fields[1].options = [];
        return;
      }

      const context = session.executionContext;
      if (!context) {
        step.form.fields[1].options = [];
        return;
      }

      const { services, client, logger } = context;

      // Load employees as potential team members
      const employees = await services.employeeService.listEmployees(client, { active: true }, 20);

      step.form.fields[1].options = employees.map(employee => ({
        value: employee.id,
        label: employee.firstName && employee.lastName
          ? `${employee.firstName} ${employee.lastName}`
          : employee.email || employee.id
      }));

      logger.debug('Loaded team members for sprint planning', {
        projectId,
        memberCount: employees.length
      });
    } catch (error) {
      this.getLogger().error('Failed to load team members', { error });
      step.form.fields[1].options = [];
    }
  }

  generateReview(session) {
    const state = session.getAllState();
    return {
      name: state.name,
      goal: state.goal,
      duration: `${state.startDate} to ${state.endDate}`,
      project: state.projectId,
      issues: state.issueIds?.length || 0,
      teamCapacity: state.teamCapacity || 'Not specified',
      prioritization: state.prioritizationMethod,
      assignmentStrategy: state.assignmentStrategy,
      teamMembers: state.teamMembers?.length || 0,
      includeStretchGoals: state.includeStretchGoals
    };
  }

  buildSprintData(session) {
    const state = session.getAllState();
    return {
      name: state.name,
      goal: state.goal,
      description: state.description,
      startDate: state.startDate,
      endDate: state.endDate,
      projectId: state.projectId,
      teamCapacity: state.teamCapacity,
      issueIds: state.issueIds || [],
      prioritizationMethod: state.prioritizationMethod,
      includeStretchGoals: state.includeStretchGoals,
      assignmentStrategy: state.assignmentStrategy,
      teamMembers: state.teamMembers || []
    };
  }

  async createSprint(data, session) {
    // Get execution context from session
    const context = session.executionContext;
    if (!context) {
      throw new Error('Execution context not available - wizard session may be invalid');
    }

    const { services, client, logger } = context;

    try {
      // Create milestone for the sprint
      logger.debug('Creating sprint milestone', { data });

      const milestoneResult = await services.milestoneService.createMilestone(
        client,
        data.projectId,
        data.name,
        `Sprint Goal: ${data.goal}\n\n${data.description || ''}`,
        data.endDate
      );

      // Assign issues to the sprint milestone
      if (data.issueIds && data.issueIds.length > 0) {
        logger.debug('Assigning issues to sprint', { issueCount: data.issueIds.length });

        for (const issueId of data.issueIds) {
          try {
            await services.issueService.updateIssue(client, issueId, 'milestone', milestoneResult.name);
            logger.debug('Assigned issue to sprint', { issueId, milestone: milestoneResult.name });
          } catch (error) {
            logger.warn('Failed to assign issue to sprint', { issueId, error: error.message });
          }
        }
      }

      // Handle team assignments based on strategy
      if (data.assignmentStrategy !== 'manual' && data.teamMembers?.length > 0) {
        await this.autoAssignIssues(
          services.issueService,
          client,
          data.issueIds,
          data.teamMembers,
          data.assignmentStrategy,
          logger
        );
      }

      return {
        id: milestoneResult.id,
        name: milestoneResult.name || data.name,
        goal: data.goal,
        startDate: data.startDate,
        endDate: data.endDate,
        projectId: data.projectId
      };

    } catch (error) {
      logger.error('Failed to create sprint', { error: error.message, data });
      throw new Error(`Failed to create sprint: ${error.message}`);
    }
  }

  async autoAssignIssues(issueService, client, issueIds, teamMembers, strategy, logger) {
    if (!issueIds || issueIds.length === 0 || !teamMembers || teamMembers.length === 0) {
      return;
    }

    try {
      switch (strategy) {
        case 'balanced':
          // Round-robin assignment
          for (let i = 0; i < issueIds.length; i++) {
            const assignee = teamMembers[i % teamMembers.length];
            try {
              await issueService.updateIssue(client, issueIds[i], 'assignee', assignee);
              logger.debug('Auto-assigned issue', { issueId: issueIds[i], assignee });
            } catch (error) {
              logger.warn('Failed to auto-assign issue', { issueId: issueIds[i], assignee, error: error.message });
            }
          }
          break;

        case 'expertise':
        case 'availability':
          // These would require more complex logic based on team member profiles
          // For now, fall back to balanced distribution
          await this.autoAssignIssues(issueService, client, issueIds, teamMembers, 'balanced', logger);
          break;
      }
    } catch (error) {
      logger.error('Failed to auto-assign issues', { error: error.message, strategy });
    }
  }
}

// Export for use in prompt registry
export default SprintPlanningWizard;

// Create wizard instance
export const sprintPlanningWizard = new SprintPlanningWizard();

/**
 * Register prompts for auto-loading
 * @param {PromptRegistry} registry - The prompt registry instance
 */
export async function registerPrompts(registry) {
  registry.register(sprintPlanningWizard);
}