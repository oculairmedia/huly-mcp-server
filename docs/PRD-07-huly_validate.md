# PRD: `huly_validate` - Validation & Impact Analysis Tool

## Document Information
- **Tool Name:** `huly_validate`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Provide validation, impact analysis, and dry-run capabilities for all operations. Prevent accidental data loss and enable preview-before-execute workflows.

### Goals
- Prevent accidental deletions
- Enable dry-run for any operation
- Provide impact analysis
- Validate data consistency
- Check permissions before operations

### Success Metrics
- **Analysis time:** < 500ms for impact analysis
- **False positives:** < 5% for validation
- **Prevention rate:** 100% of dangerous operations flagged

---

## 2. Technical Specification

```javascript
{
  name: 'huly_validate',
  description: 'Validate operations and analyze impact',
  inputSchema: {
    type: 'object',
    properties: {
      validation_type: {
        type: 'string',
        enum: [
          'deletion_impact',
          'dry_run',
          'data_consistency',
          'permission_check',
          'workflow_validation'
        ]
      },

      // Deletion impact analysis
      deletion: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['issue', 'project', 'component', 'milestone', 'template'] },
          identifier: { type: 'string' },
          show_affected: { type: 'boolean', default: true },
          analyze_cascade: { type: 'boolean', default: true }
        }
      },

      // Dry run any operation
      dry_run: {
        type: 'object',
        properties: {
          tool: { type: 'string', description: 'Tool to dry-run' },
          params: { type: 'object', description: 'Parameters for the tool' }
        }
      },

      // Data consistency check
      consistency: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['project', 'workspace', 'issue'],
            default: 'project'
          },
          project_identifier: { type: 'string' },
          checks: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'orphaned_issues',
                'missing_assignees',
                'invalid_statuses',
                'broken_relations',
                'circular_dependencies'
              ]
            }
          }
        }
      },

      // Permission check
      permission: {
        type: 'object',
        properties: {
          user_email: { type: 'string' },
          operation: { type: 'string' },
          resource: { type: 'string' }
        }
      }
    },
    required: ['validation_type']
  }
}
```

---

## 3. Usage Examples

### Example 1: Deletion Impact Analysis

```javascript
{
  validation_type: 'deletion_impact',
  deletion: {
    entity_type: 'project',
    identifier: 'PROJ',
    show_affected: true,
    analyze_cascade: true
  }
}

// Response:
{
  safe_to_delete: false,
  impact: {
    issues: 127,
    components: 5,
    milestones: 3,
    templates: 8,
    comments: 456,
    attachments: 23
  },
  dependencies: {
    linked_issues: 15,  // Issues in other projects linking to this one
    external_references: 3
  },
  warnings: [
    'Project has 127 open issues',
    '15 issues from other projects link to issues in this project',
    'GitHub repository "org/repo" is assigned to this project'
  ],
  recommendations: [
    'Archive project instead of deleting',
    'Move open issues to another project first',
    'Consider exporting data before deletion'
  ],
  affected_entities: [
    { type: 'issue', identifier: 'PROJ-1', title: '...' },
    // ... more entities
  ]
}
```

---

### Example 2: Dry Run Operation

```javascript
{
  validation_type: 'dry_run',
  dry_run: {
    tool: 'huly_workflow',
    params: {
      workflow_type: 'transform',
      transform: {
        search: {
          entity_type: 'issue',
          filters: { status: 'Backlog', priority: 'low' }
        },
        apply: {
          operation: 'update',
          data: { updates: { milestone: 'Cleanup' } }
        }
      }
    }
  }
}

// Response:
{
  valid: true,
  would_affect: 45,
  affected_issues: ['PROJ-1', 'PROJ-5', 'PROJ-12', ...],
  validation_errors: [],
  estimated_duration: '5-10 seconds',
  warnings: [
    'This will update 45 issues',
    'Milestone "Cleanup" will have 45 additional issues'
  ]
}
```

---

### Example 3: Data Consistency Check

```javascript
{
  validation_type: 'data_consistency',
  consistency: {
    scope: 'project',
    project_identifier: 'PROJ',
    checks: [
      'orphaned_issues',
      'missing_assignees',
      'invalid_statuses',
      'broken_relations'
    ]
  }
}

// Response:
{
  consistent: false,
  issues_found: 8,
  checks: {
    orphaned_issues: {
      count: 0,
      issues: []
    },
    missing_assignees: {
      count: 5,
      issues: ['PROJ-10', 'PROJ-15', 'PROJ-23', 'PROJ-42', 'PROJ-87']
    },
    invalid_statuses: {
      count: 2,
      issues: ['PROJ-5', 'PROJ-99'],
      details: [
        { issue: 'PROJ-5', status: 'deleted-status-id', problem: 'Status no longer exists' }
      ]
    },
    broken_relations: {
      count: 1,
      issues: ['PROJ-33'],
      details: [
        { issue: 'PROJ-33', problem: 'Links to deleted issue PROJ-999' }
      ]
    }
  },
  recommendations: [
    'Assign 5 issues that are missing assignees',
    'Update 2 issues with invalid statuses',
    'Fix broken relation in PROJ-33'
  ]
}
```

---

### Example 4: Workflow Validation

```javascript
{
  validation_type: 'workflow_validation',
  workflow: {
    steps: [
      { /* step 1 */ },
      { /* step 2 */ },
      { /* step 3 */ }
    ]
  }
}

// Response:
{
  valid: false,
  errors: [
    {
      step: 2,
      error: 'References undefined variable ${step1.results}',
      suggestion: 'Check step name: should be ${step_1.results}'
    }
  ],
  warnings: [
    {
      step: 3,
      warning: 'Condition may never be true',
      details: 'Step 2 always returns count > 0'
    }
  ]
}
```

---

## 4. Implementation

```javascript
class ValidationService {
  async analyzeDeletionImpact(client, entityType, identifier) {
    switch (entityType) {
      case 'project':
        return this.analyzeProjectDeletion(client, identifier);
      case 'issue':
        return this.analyzeIssueDeletion(client, identifier);
      // ... other types
    }
  }

  async analyzeProjectDeletion(client, projectId) {
    const project = await client.findOne(tracker.class.Project, {
      identifier: projectId
    });

    if (!project) {
      throw HulyError.notFound('project', projectId);
    }

    // Count affected entities
    const issues = await client.findAll(tracker.class.Issue, {
      space: project._id
    });

    const components = await client.findAll(tracker.class.Component, {
      space: project._id
    });

    const milestones = await client.findAll(tracker.class.Milestone, {
      space: project._id
    });

    // Check for external dependencies
    const linkedIssues = await this.findCrossProjectLinks(client, project._id);

    const safeToDelete = issues.length === 0 && linkedIssues.length === 0;

    return {
      safe_to_delete: safeToDelete,
      impact: {
        issues: issues.length,
        components: components.length,
        milestones: milestones.length
      },
      dependencies: {
        linked_issues: linkedIssues.length
      },
      warnings: this.generateWarnings(issues, linkedIssues),
      recommendations: this.generateRecommendations(issues, linkedIssues)
    };
  }
}
```

---

## 5. Success Criteria

- [ ] Deletion impact analysis < 500ms
- [ ] Dry-run for all major operations
- [ ] Data consistency checks working
- [ ] 100% of dangerous operations flagged
- [ ] < 5% false positive rate
