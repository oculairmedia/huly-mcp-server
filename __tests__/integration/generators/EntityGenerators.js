/**
 * Entity Generators for Integration Testing
 *
 * Provides realistic test data generation for all Huly entities using faker.js
 */

import { faker } from '@faker-js/faker';

export class EntityGenerators {
  constructor(options = {}) {
    this.locale = options.locale || 'en';
    this.seed = options.seed || Date.now();
    faker.seed(this.seed);
  }

  /**
   * Generate realistic Person data
   * @param {Object} overrides - Override default values
   * @returns {Object} Person data
   */
  generatePerson(overrides = {}) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      first_name: firstName,
      last_name: lastName,
      middle_name: faker.datatype.boolean(0.3) ? faker.person.middleName() : undefined,
      email: faker.internet.email({ firstName, lastName }),
      phone: faker.phone.number(),
      city: faker.location.city(),
      country: faker.location.country(),
      ...overrides,
    };
  }

  /**
   * Generate realistic Employee data
   * @param {Object} overrides - Override default values
   * @returns {Object} Employee data
   */
  generateEmployee(overrides = {}) {
    const person = this.generatePerson();
    const departments = [
      'Engineering',
      'Product',
      'Design',
      'Marketing',
      'Sales',
      'HR',
      'Operations',
    ];

    return {
      ...person,
      position: faker.person.jobTitle(),
      department: faker.helpers.arrayElement(departments),
      active: faker.datatype.boolean(0.9), // 90% active employees
      ...overrides,
    };
  }

  /**
   * Generate realistic Account data
   * @param {Object} overrides - Override default values
   * @returns {Object} Account data
   */
  generateAccount(overrides = {}) {
    return {
      email: faker.internet.email(),
      password: faker.internet.password({ length: 12, memorable: false }),
      workspace: `test-${faker.string.alphanumeric(8).toLowerCase()}`,
      confirmed: faker.datatype.boolean(0.8), // 80% confirmed accounts
      role: faker.helpers.arrayElement(['user', 'admin', 'viewer']),
      ...overrides,
    };
  }

  /**
   * Generate realistic Project data
   * @param {Object} overrides - Override default values
   * @returns {Object} Project data
   */
  generateProject(overrides = {}) {
    const name = faker.company.name();
    const identifier = name
      .substring(0, 5)
      .toUpperCase()
      .replace(/[^A-Z]/g, 'X');

    return {
      name,
      identifier,
      description: faker.lorem.paragraph(),
      ...overrides,
    };
  }

  /**
   * Generate realistic Issue data
   * @param {string} projectIdentifier - Project identifier
   * @param {Object} overrides - Override default values
   * @returns {Object} Issue data
   */
  generateIssue(projectIdentifier, overrides = {}) {
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const statuses = ['backlog', 'todo', 'in-progress', 'done', 'canceled'];

    return {
      project_identifier: projectIdentifier,
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
      priority: faker.helpers.arrayElement(priorities),
      status: faker.helpers.arrayElement(statuses),
      ...overrides,
    };
  }

  /**
   * Generate realistic Component data
   * @param {string} projectIdentifier - Project identifier
   * @param {Object} overrides - Override default values
   * @returns {Object} Component data
   */
  generateComponent(projectIdentifier, overrides = {}) {
    const componentTypes = [
      'Frontend',
      'Backend',
      'API',
      'Database',
      'UI/UX',
      'Testing',
      'DevOps',
      'Documentation',
      'Security',
    ];

    return {
      project_identifier: projectIdentifier,
      label: faker.helpers.arrayElement(componentTypes),
      description: faker.lorem.sentence(),
      ...overrides,
    };
  }

  /**
   * Generate realistic Milestone data
   * @param {string} projectIdentifier - Project identifier
   * @param {Object} overrides - Override default values
   * @returns {Object} Milestone data
   */
  generateMilestone(projectIdentifier, overrides = {}) {
    const futureDate = faker.date.future({ years: 1 });
    const statuses = ['planned', 'in_progress', 'completed', 'canceled'];

    return {
      project_identifier: projectIdentifier,
      label: `${faker.lorem.word()} ${faker.date.month()} Release`,
      description: faker.lorem.sentence(),
      target_date: futureDate.toISOString().split('T')[0],
      status: faker.helpers.arrayElement(statuses),
      ...overrides,
    };
  }

  /**
   * Generate bulk Issues
   * @param {string} projectIdentifier - Project identifier
   * @param {number} count - Number of issues to generate
   * @param {Object} overrides - Override default values
   * @returns {Array} Array of issue data
   */
  generateBulkIssues(projectIdentifier, count, overrides = {}) {
    return Array.from({ length: count }, () => this.generateIssue(projectIdentifier, overrides));
  }

  /**
   * Generate bulk Employees
   * @param {number} count - Number of employees to generate
   * @param {Object} overrides - Override default values
   * @returns {Array} Array of employee data
   */
  generateBulkEmployees(count, overrides = {}) {
    return Array.from({ length: count }, () => this.generateEmployee(overrides));
  }

  /**
   * Generate bulk Persons
   * @param {number} count - Number of persons to generate
   * @param {Object} overrides - Override default values
   * @returns {Array} Array of person data
   */
  generateBulkPersons(count, overrides = {}) {
    return Array.from({ length: count }, () => this.generatePerson(overrides));
  }

  /**
   * Generate complete Project hierarchy
   * @param {Object} options - Configuration options
   * @returns {Object} Complete project hierarchy
   */
  generateProjectHierarchy(options = {}) {
    const {
      componentsCount = 5,
      milestonesCount = 3,
      issuesCount = 20,
      subIssuesPerIssue = 2,
    } = options;

    const project = this.generateProject();

    const components = Array.from({ length: componentsCount }, () =>
      this.generateComponent(project.identifier)
    );

    const milestones = Array.from({ length: milestonesCount }, () =>
      this.generateMilestone(project.identifier)
    );

    const issues = Array.from({ length: issuesCount }, () => {
      const issue = this.generateIssue(project.identifier);

      // Randomly assign components and milestones
      if (components.length > 0 && faker.datatype.boolean(0.7)) {
        issue.component = faker.helpers.arrayElement(components).label;
      }
      if (milestones.length > 0 && faker.datatype.boolean(0.5)) {
        issue.milestone = faker.helpers.arrayElement(milestones).label;
      }

      return issue;
    });

    // Generate sub-issues for some issues
    const subIssues = [];
    const parentIssues = issues.slice(0, Math.floor(issuesCount / 3));

    parentIssues.forEach((parentIssue, parentIndex) => {
      for (let i = 0; i < subIssuesPerIssue; i++) {
        const subIssue = this.generateIssue(project.identifier);
        subIssue.parent_issue_identifier = `${project.identifier}-${parentIndex + 1}`;
        subIssues.push(subIssue);
      }
    });

    return {
      project,
      components,
      milestones,
      issues,
      subIssues,
    };
  }

  /**
   * Generate organization setup scenario
   * @param {Object} options - Configuration options
   * @returns {Object} Complete organization data
   */
  generateOrganizationScenario(options = {}) {
    const {
      departments = ['Engineering', 'Product', 'Design', 'Marketing'],
      employeesPerDept = 10,
      managersPerDept = 2,
      projectsPerDept = 2,
    } = options;

    const organization = {
      name: faker.company.name(),
      departments: [],
      employees: [],
      managers: [],
      projects: [],
    };

    departments.forEach((department) => {
      // Create department structure
      const deptData = {
        name: department,
        employees: [],
        managers: [],
        projects: [],
      };

      // Generate employees
      for (let i = 0; i < employeesPerDept; i++) {
        const employee = this.generateEmployee({ department });
        deptData.employees.push(employee);
        organization.employees.push(employee);
      }

      // Generate managers
      for (let i = 0; i < managersPerDept; i++) {
        const manager = this.generateEmployee({
          department,
          position: `${department} Manager`,
          role: 'manager',
        });
        deptData.managers.push(manager);
        organization.managers.push(manager);
      }

      // Generate projects
      for (let i = 0; i < projectsPerDept; i++) {
        const project = this.generateProject({
          name: `${department} ${faker.lorem.word()} Project`,
        });
        deptData.projects.push(project);
        organization.projects.push(project);
      }

      organization.departments.push(deptData);
    });

    return organization;
  }

  /**
   * Generate complex workflow scenario
   * @param {Object} options - Configuration options
   * @returns {Object} Complex workflow data
   */
  generateComplexWorkflowScenario(options = {}) {
    const { projectCount = 3, usersPerProject = 5, issuesPerProject = 30 } = options;

    const scenario = {
      projects: [],
      users: [],
      workflows: [],
    };

    // Generate users first
    for (let i = 0; i < projectCount * usersPerProject; i++) {
      const user = this.generateEmployee();
      scenario.users.push(user);
    }

    // Generate projects with complex workflows
    for (let i = 0; i < projectCount; i++) {
      const projectHierarchy = this.generateProjectHierarchy({
        componentsCount: 8,
        milestonesCount: 4,
        issuesCount: issuesPerProject,
        subIssuesPerIssue: 3,
      });

      // Assign users to project
      const projectUsers = faker.helpers.arrayElements(scenario.users, usersPerProject);

      const workflow = {
        project: projectHierarchy,
        assignedUsers: projectUsers,
        workflows: [
          {
            name: 'Development Workflow',
            steps: ['backlog', 'todo', 'in-progress', 'review', 'done'],
            transitions: this.generateWorkflowTransitions(),
          },
          {
            name: 'Bug Triage Workflow',
            steps: ['reported', 'triaged', 'assigned', 'fixed', 'verified'],
            transitions: this.generateWorkflowTransitions(),
          },
        ],
      };

      scenario.workflows.push(workflow);
      scenario.projects.push(projectHierarchy.project);
    }

    return scenario;
  }

  /**
   * Generate workflow transitions
   * @returns {Array} Workflow transitions
   */
  generateWorkflowTransitions() {
    return [
      { from: 'backlog', to: 'todo', conditions: ['priority_set', 'assignee_set'] },
      { from: 'todo', to: 'in-progress', conditions: ['developer_assigned'] },
      { from: 'in-progress', to: 'review', conditions: ['work_completed'] },
      { from: 'review', to: 'done', conditions: ['review_approved'] },
      { from: 'review', to: 'in-progress', conditions: ['changes_requested'] },
    ];
  }

  /**
   * Generate test data for specific test scenarios
   * @param {string} scenarioType - Type of scenario
   * @param {Object} options - Configuration options
   * @returns {Object} Scenario-specific test data
   */
  generateTestScenario(scenarioType, options = {}) {
    switch (scenarioType) {
      case 'small_project':
        return this.generateProjectHierarchy({
          componentsCount: 2,
          milestonesCount: 1,
          issuesCount: 5,
          subIssuesPerIssue: 1,
        });

      case 'large_project':
        return this.generateProjectHierarchy({
          componentsCount: 15,
          milestonesCount: 8,
          issuesCount: 100,
          subIssuesPerIssue: 5,
        });

      case 'organization_setup':
        return this.generateOrganizationScenario(options);

      case 'complex_workflow':
        return this.generateComplexWorkflowScenario(options);

      case 'bulk_operations':
        return {
          issues: this.generateBulkIssues('BULK', 50),
          employees: this.generateBulkEmployees(25),
          projects: Array.from({ length: 5 }, () => this.generateProject()),
        };

      case 'concurrent_operations':
        return {
          operations: Array.from({ length: 20 }, (_, i) => ({
            id: i,
            type: faker.helpers.arrayElement(['create', 'update', 'delete']),
            entity: faker.helpers.arrayElement(['issue', 'employee', 'project']),
            data: this.generateIssue('CONCURRENT'),
          })),
        };

      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`);
    }
  }

  /**
   * Reset faker seed for consistent test data
   * @param {number} seed - Seed value
   */
  setSeed(seed) {
    this.seed = seed;
    faker.seed(seed);
  }

  /**
   * Get current faker seed
   * @returns {number} Current seed
   */
  getSeed() {
    return this.seed;
  }
}

// Export singleton instance for convenience
export const entityGenerators = new EntityGenerators();
