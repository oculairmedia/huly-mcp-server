/**
 * ReleaseManagerWizard.js
 *
 * Interactive wizard for comprehensive release management.
 * Handles release planning, milestone setup, team coordination, and quality gates.
 */

import { WizardPrompt } from '../base/PromptInterface.js';
import { getLogger } from '../../utils/index.js';

export class ReleaseManagerWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'release-manager-wizard',
      description:
        'Interactive wizard for comprehensive release management, planning, and coordination',
      category: 'release-management',
      annotations: {
        wizard: true,
        maxSteps: 6,
        estimatedTime: '15-20 minutes',
        tags: ['release', 'management', 'planning', 'milestone', 'quality'],
      },
      arguments: [
        {
          name: 'releaseVersion',
          description: 'Target release version (e.g., v2.1.0)',
          required: false,
        },
        {
          name: 'productName',
          description: 'Product name for the release',
          required: false,
        },
      ],
      // Use arrow function to delegate to execute method
      handler: async (...args) => this.execute(...args),
    });

    // Store steps on the instance directly
    this.steps = [
      {
        id: 'release-details',
        name: 'Release Information',
        description: 'Define release version, name, and type',
        form: {
          fields: [
            {
              name: 'version',
              type: 'string',
              required: true,
              description: 'Release version (e.g., v2.1.0)',
              placeholder: 'v2.1.0',
              validation: {
                pattern: '^v?\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]+)?$',
              },
            },
            {
              name: 'name',
              type: 'string',
              required: true,
              description: 'Release name or codename',
              placeholder: 'Phoenix Release',
            },
            {
              name: 'type',
              type: 'select',
              required: true,
              description: 'Release type',
              options: [
                { value: 'major', label: 'Major Release (v2.0.0)' },
                { value: 'minor', label: 'Minor Release (v2.1.0)' },
                { value: 'patch', label: 'Patch Release (v2.1.1)' },
                { value: 'hotfix', label: 'Hotfix Release' },
              ],
            },
            {
              name: 'description',
              type: 'text',
              required: false,
              description: 'Release description and key features',
              placeholder: 'This release introduces...',
            },
          ],
        },
      },
      {
        id: 'timeline-planning',
        name: 'Timeline & Milestones',
        description: 'Set release timeline and key milestones',
        form: {
          fields: [
            {
              name: 'startDate',
              type: 'date',
              required: true,
              description: 'Release development start date',
            },
            {
              name: 'alphaDate',
              type: 'date',
              required: true,
              description: 'Alpha release target date',
            },
            {
              name: 'betaDate',
              type: 'date',
              required: true,
              description: 'Beta release target date',
            },
            {
              name: 'rcDate',
              type: 'date',
              required: true,
              description: 'Release candidate target date',
            },
            {
              name: 'gaDate',
              type: 'date',
              required: true,
              description: 'General availability (production) date',
            },
            {
              name: 'createMilestones',
              type: 'boolean',
              required: false,
              description: 'Create milestone tracking issues',
              defaultValue: true,
            },
          ],
        },
      },
      {
        id: 'feature-selection',
        name: 'Feature Selection',
        description: 'Select features and issues to include in the release',
        form: {
          fields: [
            {
              name: 'sourceProject',
              type: 'select',
              required: true,
              description: 'Source project for feature selection',
              options: [], // Will be populated dynamically
            },
            {
              name: 'includeIssues',
              type: 'multiselect',
              required: false,
              description: 'Issues to include in the release',
              options: [], // Will be populated dynamically
            },
            {
              name: 'featureFreeze',
              type: 'date',
              required: false,
              description: 'Feature freeze date (optional)',
            },
            {
              name: 'codeFreeze',
              type: 'date',
              required: false,
              description: 'Code freeze date (optional)',
            },
          ],
        },
      },
      {
        id: 'quality-gates',
        name: 'Quality Requirements',
        description: 'Define testing and quality assurance requirements',
        form: {
          fields: [
            {
              name: 'testingStrategy',
              type: 'multiselect',
              required: true,
              description: 'Required testing phases',
              options: [
                { value: 'unit', label: 'Unit Testing' },
                { value: 'integration', label: 'Integration Testing' },
                { value: 'performance', label: 'Performance Testing' },
                { value: 'security', label: 'Security Testing' },
                { value: 'uat', label: 'User Acceptance Testing' },
                { value: 'regression', label: 'Regression Testing' },
              ],
            },
            {
              name: 'coverage',
              type: 'number',
              required: false,
              description: 'Minimum code coverage percentage',
              placeholder: '80',
              validation: {
                min: 0,
                max: 100,
              },
            },
            {
              name: 'approvals',
              type: 'multiselect',
              required: false,
              description: 'Required approvals',
              options: [
                { value: 'security', label: 'Security Team Approval' },
                { value: 'legal', label: 'Legal Team Approval' },
                { value: 'compliance', label: 'Compliance Review' },
                { value: 'product', label: 'Product Manager Approval' },
                { value: 'engineering', label: 'Engineering Lead Approval' },
              ],
            },
            {
              name: 'documentation',
              type: 'boolean',
              required: false,
              description: 'Require documentation updates',
              defaultValue: true,
            },
          ],
        },
      },
      {
        id: 'team-assignments',
        name: 'Release Team',
        description: 'Assign team members and responsibilities',
        form: {
          fields: [
            {
              name: 'releaseManager',
              type: 'select',
              required: true,
              description: 'Release manager',
              options: [], // Will be populated dynamically
            },
            {
              name: 'qaLead',
              type: 'select',
              required: false,
              description: 'QA lead',
              options: [], // Will be populated dynamically
            },
            {
              name: 'devopsLead',
              type: 'select',
              required: false,
              description: 'DevOps lead',
              options: [], // Will be populated dynamically
            },
            {
              name: 'teamMembers',
              type: 'multiselect',
              required: false,
              description: 'Release team members',
              options: [], // Will be populated dynamically
            },
            {
              name: 'stakeholders',
              type: 'multiselect',
              required: false,
              description: 'Key stakeholders to notify',
              options: [], // Will be populated dynamically
            },
          ],
        },
      },
      {
        id: 'review-create',
        name: 'Review & Create',
        description: 'Review release plan and create release structure',
        review: true, // This step shows a summary
      },
    ];

    this.logger = null; // Lazy initialization
  }

  getLogger() {
    if (!this.logger) {
      this.logger = getLogger('release-manager-wizard');
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
          releaseVersion: args.releaseVersion,
          productName: args.productName,
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
          return this.handleFinish(session, args.options || {});

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.getLogger().error('Release Manager Wizard execution failed', { error, args });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async handleStart(session) {
    try {
      const currentStep = session.getCurrentStep();

      // Pre-populate version if provided
      const releaseVersion = session.getState('releaseVersion');
      if (releaseVersion && currentStep.form.fields[0]) {
        currentStep.form.fields[0].defaultValue = releaseVersion;
      }

      // Pre-populate product name if provided
      const productName = session.getState('productName');
      if (productName && currentStep.form.fields[1]) {
        currentStep.form.fields[1].defaultValue = productName;
      }

      return {
        success: true,
        data: {
          sessionId: session.id,
          currentStep,
          progress: session.getProgress(),
          canGoBack: false,
          canGoForward: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async handleNext(session, stepData) {
    try {
      const _currentStep = session.getCurrentStep();

      // Store step data
      session.updateState(stepData);
      await session.nextStep();

      const newStep = session.getCurrentStep();

      // Enhance next step with dynamic data
      if (newStep.id === 'feature-selection') {
        await this.loadProjects(newStep, session);
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
          canGoForward: session.hasCompletedStep(newStep.id),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
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
          canGoForward: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async handleCancel(session) {
    session.abort();
    return {
      success: true,
      data: {
        cancelled: true,
        sessionId: session.id,
      },
    };
  }

  async handleFinish(session, _options = {}) {
    try {
      // Create the release structure
      const releaseData = this.buildReleaseData(session);
      const release = await this.createRelease(releaseData, session);

      // Mark session as completed
      session.complete();

      return {
        success: true,
        data: {
          completed: true,
          release,
          sessionId: session.id,
          summary: {
            version: release.version,
            name: release.name,
            type: release.type,
            projectId: release.projectId,
            milestoneCount: release.milestones?.length || 0,
            issueCount: release.issues?.length || 0,
            teamSize: release.teamMembers?.length || 0,
          },
        },
      };
    } catch (error) {
      this.getLogger().error('Failed to create release', { error });
      return {
        success: false,
        error: `Failed to create release: ${error.message}`,
      };
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

      step.form.fields[0].options = projects.map((p) => ({
        value: p.identifier,
        label: `${p.identifier} - ${p.name || 'Unnamed Project'}`,
      }));

      // When project is selected, load its issues
      if (step.form.fields[0].value) {
        await this.loadIssuesForProject(step, session, step.form.fields[0].value);
      }

      logger.debug('Loaded projects for release manager', { projectCount: projects.length });
    } catch (error) {
      this.getLogger().error('Failed to load projects', { error });
      step.form.fields[0].options = [];
    }
  }

  async loadIssuesForProject(step, session, projectId) {
    try {
      const context = session.executionContext;
      if (!context) {
        return;
      }

      const { services, client, logger } = context;
      const issues = await services.issueService.listIssues(client, projectId, 100);

      step.form.fields[1].options = issues.map((issue) => ({
        value: issue.identifier,
        label: `${issue.identifier} - ${issue.title}`,
        metadata: {
          priority: issue.priority || 'medium',
          status: issue.status || 'backlog',
        },
      }));

      logger.debug('Loaded issues for release', { projectId, issueCount: issues.length });
    } catch (error) {
      this.getLogger().error('Failed to load issues for project', { error, projectId });
    }
  }

  async loadTeamMembers(step, session) {
    try {
      const context = session.executionContext;
      if (!context) {
        return;
      }

      const { services, client, logger } = context;
      const employees = await services.employeeService.listEmployees(client, { active: true }, 50);

      const memberOptions = employees.map((employee) => ({
        value: employee.id,
        label:
          employee.firstName && employee.lastName
            ? `${employee.firstName} ${employee.lastName}`
            : employee.email || employee.id,
        metadata: {
          position: employee.position,
          department: employee.department,
        },
      }));

      // Populate all team member fields
      ['releaseManager', 'qaLead', 'devopsLead', 'teamMembers', 'stakeholders'].forEach(
        (fieldName, index) => {
          if (step.form.fields[index]) {
            step.form.fields[index].options = memberOptions;
          }
        }
      );

      logger.debug('Loaded team members for release', { memberCount: employees.length });
    } catch (error) {
      this.getLogger().error('Failed to load team members', { error });
    }
  }

  generateReview(session) {
    const state = session.getAllState();
    return {
      version: state.version,
      name: state.name,
      type: state.type,
      description: state.description,
      timeline: {
        start: state.startDate,
        alpha: state.alphaDate,
        beta: state.betaDate,
        rc: state.rcDate,
        ga: state.gaDate,
      },
      features: {
        sourceProject: state.sourceProject,
        issueCount: state.includeIssues?.length || 0,
        featureFreeze: state.featureFreeze,
        codeFreeze: state.codeFreeze,
      },
      quality: {
        testingStrategy: state.testingStrategy || [],
        coverage: state.coverage,
        approvals: state.approvals || [],
        documentation: state.documentation,
      },
      team: {
        releaseManager: state.releaseManager,
        qaLead: state.qaLead,
        devopsLead: state.devopsLead,
        memberCount: state.teamMembers?.length || 0,
        stakeholderCount: state.stakeholders?.length || 0,
      },
    };
  }

  buildReleaseData(session) {
    const state = session.getAllState();
    return {
      version: state.version,
      name: state.name,
      type: state.type,
      description: state.description,
      startDate: state.startDate,
      alphaDate: state.alphaDate,
      betaDate: state.betaDate,
      rcDate: state.rcDate,
      gaDate: state.gaDate,
      createMilestones: state.createMilestones !== false,
      sourceProject: state.sourceProject,
      includeIssues: state.includeIssues || [],
      featureFreeze: state.featureFreeze,
      codeFreeze: state.codeFreeze,
      testingStrategy: state.testingStrategy || [],
      coverage: state.coverage,
      approvals: state.approvals || [],
      documentation: state.documentation !== false,
      releaseManager: state.releaseManager,
      qaLead: state.qaLead,
      devopsLead: state.devopsLead,
      teamMembers: state.teamMembers || [],
      stakeholders: state.stakeholders || [],
    };
  }

  async createRelease(data, session) {
    // Get execution context from session
    const context = session.executionContext;
    if (!context) {
      throw new Error('Execution context not available - wizard session may be invalid');
    }

    const { services, client, logger } = context;

    try {
      logger.info('Starting release creation via wizard', { data });

      // 1. Create release project
      const projectIdentifier = `REL-${data.version.replace(/[^\w]/g, '')}`.slice(0, 5);
      const projectName = `${data.name} Release (${data.version})`;

      logger.debug('Creating release project', {
        identifier: projectIdentifier,
        name: projectName,
      });

      const projectResult = await services.projectService.createProject(
        client,
        projectName,
        data.description || `Release management project for ${data.version}`,
        projectIdentifier
      );

      logger.info('Release project created successfully', { projectResult });

      // Track created entities
      const createdMilestones = [];
      const createdComponents = [];
      const createdIssues = [];

      // 2. Create standard release components
      const releaseComponents = ['Frontend', 'Backend', 'API', 'QA', 'Documentation', 'DevOps'];

      for (const componentName of releaseComponents) {
        try {
          const componentResult = await services.projectService.createComponent(
            client,
            projectIdentifier,
            componentName,
            `${componentName} component for ${data.version} release`
          );

          createdComponents.push({
            name: componentName,
            id: componentResult.id || componentName,
            label: componentName,
          });

          logger.debug('Release component created', { componentName, result: componentResult });
        } catch (componentError) {
          logger.warn('Failed to create release component', {
            componentName,
            error: componentError.message,
          });
        }
      }

      // 3. Create release milestones
      if (data.createMilestones) {
        const milestones = [
          { name: 'Alpha Release', date: data.alphaDate, description: 'Internal testing phase' },
          { name: 'Beta Release', date: data.betaDate, description: 'External beta testing' },
          { name: 'Release Candidate', date: data.rcDate, description: 'Final testing before GA' },
          { name: 'General Availability', date: data.gaDate, description: 'Production release' },
        ];

        for (const milestone of milestones) {
          if (milestone.date) {
            try {
              const milestoneResult = await services.milestoneService.createMilestone(
                client,
                projectIdentifier,
                milestone.name,
                milestone.description,
                milestone.date
              );

              createdMilestones.push({
                name: milestone.name,
                id: milestoneResult.id || milestone.name,
                date: milestone.date,
                description: milestone.description,
              });

              logger.debug('Release milestone created', {
                milestone: milestone.name,
                result: milestoneResult,
              });
            } catch (milestoneError) {
              logger.warn('Failed to create release milestone', {
                milestone: milestone.name,
                error: milestoneError.message,
              });
            }
          }
        }
      }

      // 4. Create release tracking issues from template
      if (data.includeIssues && data.includeIssues.length > 0) {
        const sampleIssues = [
          {
            title: 'Release Preparation Checklist',
            description: `Preparation checklist for ${data.version} release:\n\n- [ ] Code freeze\n- [ ] Testing complete\n- [ ] Documentation updated\n- [ ] Security review\n- [ ] Performance validation`,
            priority: 'high',
            component: 'QA',
          },
          {
            title: 'Release Notes Creation',
            description: `Create comprehensive release notes for ${data.version}`,
            priority: 'medium',
            component: 'Documentation',
          },
          {
            title: 'Production Deployment Planning',
            description: `Plan and coordinate production deployment for ${data.version}`,
            priority: 'high',
            component: 'DevOps',
          },
        ];

        for (const issueData of sampleIssues) {
          try {
            const issueResult = await services.issueService.createIssue(
              client,
              projectIdentifier,
              issueData.title,
              issueData.description,
              issueData.priority,
              issueData.component,
              createdMilestones[0]?.name // Assign to first milestone
            );

            createdIssues.push({
              identifier: issueResult.identifier,
              title: issueData.title,
              component: issueData.component,
            });

            logger.debug('Release tracking issue created', {
              issue: issueData.title,
              result: issueResult,
            });
          } catch (issueError) {
            logger.warn('Failed to create release tracking issue', {
              issue: issueData.title,
              error: issueError.message,
            });
          }
        }
      }

      // 5. Log final results
      const releaseStructure = {
        id: projectResult.id,
        projectId: projectIdentifier,
        version: data.version,
        name: data.name,
        type: data.type,
        components: createdComponents,
        milestones: createdMilestones,
        issues: createdIssues,
        teamMembers: data.teamMembers,
        releaseManager: data.releaseManager,
      };

      logger.info('Release structure created successfully', {
        projectId: projectIdentifier,
        componentCount: createdComponents.length,
        milestoneCount: createdMilestones.length,
        issueCount: createdIssues.length,
      });

      return releaseStructure;
    } catch (error) {
      logger.error('Failed to create release structure', { error: error.message, data });
      throw new Error(`Failed to create release structure: ${error.message}`);
    }
  }
}

// Export for use in prompt registry
export const releaseManagerWizard = new ReleaseManagerWizard();
