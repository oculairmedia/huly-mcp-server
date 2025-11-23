# PRD: `huly_entity` - Entity Management Tool

## Document Information
- **Tool Name:** `huly_entity`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Consolidate all project, component, and milestone operations with support for atomic project setup (create project with components, milestones, and initial issues in one call).

### Goals
- Reduce 10-15 calls for project setup → 1 call
- Unified interface for all entity types (projects, components, milestones)
- Support atomic composite creation
- Enable bulk operations for components/milestones

### Success Metrics
- **Project setup:** Reduce 10-15 calls → 1 call (90% reduction)
- **Entity operations:** < 300ms response time
- **Success rate:** > 99% for valid operations

---

## 2. Current State Analysis

### Existing Tools Being Consolidated
1. `huly_create_project` - Create project
2. `huly_delete_project` - Delete project
3. `huly_archive_project` - Archive project
4. `huly_create_component` - Create component
5. `huly_delete_component` - Delete component
6. `huly_create_milestone` - Create milestone
7. `huly_delete_milestone` - Delete milestone

### Current Pain Points

**Problem: Project setup requires many calls**
```javascript
// Current: 11 calls to set up a new project!
huly_create_project('New Project', 'DESC', 'NP')  // 1
huly_create_component('NP', 'Backend')  // 2
huly_create_component('NP', 'Frontend')  // 3
huly_create_component('NP', 'DevOps')  // 4
huly_create_milestone('NP', 'MVP', '2025-03-01')  // 5
huly_create_milestone('NP', 'Beta', '2025-06-01')  // 6
huly_create_milestone('NP', 'Release', '2025-09-01')  // 7
huly_create_issue('NP', 'Setup CI/CD')  // 8
huly_create_issue('NP', 'Database schema')  // 9
huly_create_issue('NP', 'API design')  // 10
huly_assign_repository('NP', 'org/repo')  // 11
```

---

## 3. Technical Specification

### 3.1 Tool Definition

```javascript
{
  name: 'huly_entity',
  description: 'Manage projects, components, and milestones with atomic setup support',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['project', 'component', 'milestone'],
        description: 'Type of entity to manage'
      },

      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'archive'],
        description: 'Operation to perform'
      },

      identifier: {
        type: 'string',
        description: 'Entity identifier (for update/delete/archive)'
      },

      data: {
        type: 'object',
        description: 'Entity data for create/update',
        properties: {
          // Project fields
          name: { type: 'string' },
          description: { type: 'string' },
          project_identifier: { type: 'string' },

          // Component/Milestone fields
          label: { type: 'string' },

          // Milestone specific
          target_date: { type: 'string' },
          status: { type: 'string' }
        }
      },

      // === PROJECT SETUP (KEY FEATURE!) ===
      project_setup: {
        type: 'object',
        description: 'Atomic project creation with structure',
        properties: {
          project: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Project name' },
              description: { type: 'string' },
              identifier: { type: 'string', description: 'Project ID (auto-generated if not provided)' }
            },
            required: ['name']
          },

          components: {
            type: 'array',
            description: 'Components to create',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                lead: { type: 'string', description: 'Component lead email' }
              },
              required: ['label']
            }
          },

          milestones: {
            type: 'array',
            description: 'Milestones to create',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                target_date: { type: 'string' },
                status: { type: 'string', enum: ['planned', 'active', 'paused', 'completed', 'canceled'] }
              },
              required: ['label', 'target_date']
            }
          },

          initial_issues: {
            type: 'array',
            description: 'Initial issues to create',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string' },
                component: { type: 'string', description: 'Component label (from components array)' },
                milestone: { type: 'string', description: 'Milestone label (from milestones array)' },
                assignee: { type: 'string' }
              },
              required: ['title']
            }
          },

          github_repository: {
            type: 'string',
            description: 'GitHub repository to assign (e.g., "org/repo")'
          },

          team_members: {
            type: 'array',
            items: { type: 'string' },
            description: 'Team member emails to add to project'
          }
        },
        required: ['project']
      },

      // Batch operations
      batch: {
        type: 'object',
        description: 'Batch entity operations',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                target_date: { type: 'string' }
              }
            }
          },
          defaults: {
            type: 'object',
            description: 'Default values for all items'
          }
        }
      }
    },
    required: ['entity_type', 'operation']
  }
}
```

---

## 4. Usage Examples

### Example 1: Atomic Project Setup (KEY USE CASE!)

**Before (11+ calls):**
```javascript
// Many individual calls as shown in section 2
```

**After (1 call):**
```javascript
{
  entity_type: 'project',
  operation: 'create',
  project_setup: {
    project: {
      name: 'New Product',
      description: 'Revolutionary new product',
      identifier: 'NP'
    },
    components: [
      { label: 'Backend', description: 'Server-side components' },
      { label: 'Frontend', description: 'Client-side UI' },
      { label: 'Mobile', description: 'iOS and Android apps' },
      { label: 'DevOps', description: 'Infrastructure and deployment' }
    ],
    milestones: [
      { label: 'MVP', target_date: '2025-03-01', status: 'active' },
      { label: 'Beta', target_date: '2025-06-01', status: 'planned' },
      { label: 'Release 1.0', target_date: '2025-09-01', status: 'planned' }
    ],
    initial_issues: [
      {
        title: 'Setup CI/CD pipeline',
        description: 'Configure automated testing and deployment',
        priority: 'high',
        component: 'DevOps',
        milestone: 'MVP'
      },
      {
        title: 'Database schema design',
        description: 'Design initial database structure',
        priority: 'high',
        component: 'Backend',
        milestone: 'MVP'
      },
      {
        title: 'API design',
        description: 'Design RESTful API endpoints',
        priority: 'high',
        component: 'Backend',
        milestone: 'MVP'
      },
      {
        title: 'UI mockups',
        description: 'Create initial UI designs',
        priority: 'medium',
        component: 'Frontend',
        milestone: 'MVP'
      }
    ],
    github_repository: 'company/new-product',
    team_members: [
      'dev1@example.com',
      'dev2@example.com',
      'designer@example.com'
    ]
  }
}

// Response:
{
  success: true,
  project: {
    identifier: 'NP',
    name: 'New Product'
  },
  created: {
    components: 4,
    milestones: 3,
    issues: 4,
    team_members: 3
  },
  github_repository_assigned: true
}
```

**Reduces 11+ calls → 1 call ✅**

---

### Example 2: Batch Create Components

```javascript
{
  entity_type: 'component',
  operation: 'create',
  batch: {
    defaults: {
      project_identifier: 'PROJ'
    },
    items: [
      { label: 'Authentication', description: 'User auth system' },
      { label: 'Payments', description: 'Payment processing' },
      { label: 'Analytics', description: 'Usage analytics' },
      { label: 'Notifications', description: 'Push notifications' }
    ]
  }
}
```

---

### Example 3: Create Quarterly Milestones

```javascript
{
  entity_type: 'milestone',
  operation: 'create',
  batch: {
    defaults: {
      project_identifier: 'PROJ',
      status: 'planned'
    },
    items: [
      { label: 'Q1 2025', target_date: '2025-03-31' },
      { label: 'Q2 2025', target_date: '2025-06-30' },
      { label: 'Q3 2025', target_date: '2025-09-30' },
      { label: 'Q4 2025', target_date: '2025-12-31' }
    ]
  }
}
```

---

### Example 4: Archive Old Project

```javascript
{
  entity_type: 'project',
  operation: 'archive',
  identifier: 'OLD',
  options: {
    archive_issues: true,  // Also archive all issues
    keep_data: true  // Don't delete, just hide
  }
}
```

---

## 5. Implementation Details

### 5.1 Project Setup Service

```javascript
class EntityService {
  /**
   * Atomic project setup
   */
  async setupProject(client, config) {
    const { project, components = [], milestones = [], initial_issues = [], github_repository, team_members = [] } = config;

    // Create project
    const createdProject = await this.createProject(
      client,
      project.name,
      project.description,
      project.identifier
    );

    const projectId = createdProject.data.identifier;
    const componentMap = {};
    const milestoneMap = {};

    // Create components
    for (const comp of components) {
      const result = await this.createComponent(
        client,
        projectId,
        comp.label,
        comp.description
      );
      componentMap[comp.label] = result.data.id;
    }

    // Create milestones
    for (const milestone of milestones) {
      const result = await this.createMilestone(
        client,
        projectId,
        milestone.label,
        milestone.description,
        milestone.target_date,
        milestone.status
      );
      milestoneMap[milestone.label] = result.data.id;
    }

    // Create initial issues
    const createdIssues = [];
    for (const issue of initial_issues) {
      const result = await issueService.createIssue(
        client,
        projectId,
        issue.title,
        issue.description,
        issue.priority,
        issue.component,  // Will be resolved by label
        issue.milestone   // Will be resolved by label
      );
      createdIssues.push(result.data);
    }

    // Assign GitHub repository
    let repoAssigned = false;
    if (github_repository) {
      try {
        await this.assignRepository(client, projectId, github_repository);
        repoAssigned = true;
      } catch (error) {
        // Log but don't fail
        this.logger.warn('Failed to assign repository:', error);
      }
    }

    // Add team members
    for (const email of team_members) {
      try {
        await this.addTeamMember(client, projectId, email);
      } catch (error) {
        this.logger.warn(`Failed to add team member ${email}:`, error);
      }
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Project setup complete!\n\n` +
              `**Project:** ${project.name} (${projectId})\n` +
              `**Components:** ${components.length}\n` +
              `**Milestones:** ${milestones.length}\n` +
              `**Initial Issues:** ${initial_issues.length}\n` +
              `**Team Members:** ${team_members.length}\n` +
              `**GitHub Repository:** ${repoAssigned ? '✓' : '✗'}`
      }],
      data: {
        project: { identifier: projectId, name: project.name },
        created: {
          components: components.length,
          milestones: milestones.length,
          issues: initial_issues.length,
          team_members: team_members.length
        },
        github_repository_assigned: repoAssigned,
        issue_identifiers: createdIssues.map(i => i.identifier)
      }
    };
  }
}
```

---

## 6. Migration Plan

### Phase 1: Implementation (Week 1)
- [ ] Implement project_setup method
- [ ] Add batch operations for components/milestones
- [ ] Add validation

### Phase 2: Integration (Week 1)
- [ ] Integrate with GitHub assignment
- [ ] Add team member management
- [ ] Add tests

### Phase 3: Deployment (Week 2)
- [ ] Deploy to staging
- [ ] Migration guide
- [ ] Deprecate old tools

---

## 7. Success Criteria

- [ ] Project setup in 1 call (vs 10-15 calls)
- [ ] 100% of entity operations consolidated
- [ ] Atomic operations (all or nothing)
- [ ] < 300ms response time
- [ ] > 99% success rate

---

## Appendix: Project Templates

### Starter Template
```javascript
{
  project: { name: 'Starter Project', identifier: 'START' },
  components: [
    { label: 'Core' }
  ],
  milestones: [
    { label: 'Launch', target_date: '2025-12-31' }
  ]
}
```

### Full-Stack Template
```javascript
{
  project: { name: 'Full Stack App', identifier: 'FSA' },
  components: [
    { label: 'Backend' },
    { label: 'Frontend' },
    { label: 'Mobile' },
    { label: 'DevOps' }
  ],
  milestones: [
    { label: 'MVP', target_date: '2025-03-31' },
    { label: 'Beta', target_date: '2025-06-30' },
    { label: 'Release', target_date: '2025-12-31' }
  ],
  initial_issues: [
    { title: 'Setup infrastructure', component: 'DevOps', milestone: 'MVP', priority: 'high' },
    { title: 'Database design', component: 'Backend', milestone: 'MVP', priority: 'high' },
    { title: 'API endpoints', component: 'Backend', milestone: 'MVP', priority: 'high' },
    { title: 'UI framework', component: 'Frontend', milestone: 'MVP', priority: 'medium' },
    { title: 'Mobile app shell', component: 'Mobile', milestone: 'Beta', priority: 'low' }
  ]
}
```
