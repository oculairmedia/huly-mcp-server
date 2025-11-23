# PRD: `huly_account_ops` - Account & User Operations Tool

## Document Information
- **Tool Name:** `huly_account_ops`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Manage user accounts, workload analysis, bulk assignment, and intelligent auto-assignment of issues based on team capacity and skills.

### Goals
- Provide user/account management capabilities
- Enable workload analysis and balancing
- Support bulk assignment operations
- Implement smart auto-assignment algorithms
- Enable delegation (transfer all work from one user to another)

### Success Metrics
- **Bulk assignment:** Assign 100 issues in < 5 seconds
- **Workload calculation:** < 200ms per user
- **Auto-assignment:** Fair distribution (< 20% variance)

---

## 2. Core Capabilities

### 2.1 User Operations
- List users in workspace
- Get user details and current workload
- Search users by criteria

### 2.2 Assignment Operations
- Bulk assign issues to user(s)
- Auto-assign based on algorithms
- Delegate all issues from user A to user B
- Reassign by component/milestone

### 2.3 Workload Management
- Calculate user workload
- Find least loaded team members
- Balance workload across team
- Workload forecasting

---

## 3. Technical Specification

```javascript
{
  name: 'huly_account_ops',
  description: 'Manage accounts, assignments, and workload',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'list_users',
          'get_user',
          'get_workload',
          'bulk_assign',
          'auto_assign',
          'delegate',
          'balance_workload'
        ]
      },

      // User operations
      user_email: {
        type: 'string',
        description: 'User email address'
      },

      filters: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          team: { type: 'string' },
          active: { type: 'boolean' }
        }
      },

      // Workload options
      workload_options: {
        type: 'object',
        properties: {
          include_completed: { type: 'boolean', default: false },
          group_by: {
            type: 'string',
            enum: ['status', 'priority', 'project', 'component'],
            default: 'status'
          },
          calculation_method: {
            type: 'string',
            enum: ['count', 'estimation', 'weighted'],
            default: 'count',
            description: 'How to calculate workload: count=number of issues, estimation=sum of estimates, weighted=priority-weighted'
          }
        }
      },

      // Bulk assignment
      bulk_assign: {
        type: 'object',
        properties: {
          user_email: { type: 'string' },
          issue_identifiers: {
            type: 'array',
            items: { type: 'string' }
          },
          also_update: {
            type: 'object',
            description: 'Additional fields to update'
          }
        }
      },

      // Auto-assignment
      auto_assign: {
        type: 'object',
        properties: {
          issue_identifiers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issues to auto-assign'
          },
          team_members: {
            type: 'array',
            items: { type: 'string' },
            description: 'Team members to assign among'
          },
          strategy: {
            type: 'string',
            enum: ['round_robin', 'least_loaded', 'by_component', 'by_skill'],
            default: 'least_loaded',
            description: 'Assignment strategy'
          },
          component_assignments: {
            type: 'object',
            description: 'Map components to team members (for by_component strategy)',
            additionalProperties: { type: 'string' }
          },
          preserve_existing: {
            type: 'boolean',
            default: true,
            description: 'Skip issues that already have assignees'
          }
        }
      },

      // Delegation
      delegate: {
        type: 'object',
        properties: {
          from_user: { type: 'string' },
          to_user: { type: 'string' },
          filters: {
            type: 'object',
            description: 'Only delegate matching issues',
            properties: {
              project_identifier: { type: 'string' },
              status: { type: 'string' },
              component: { type: 'string' }
            }
          },
          add_comment: {
            type: 'boolean',
            default: true,
            description: 'Add comment explaining delegation'
          }
        }
      },

      // Workload balancing
      balance_workload: {
        type: 'object',
        properties: {
          team_members: {
            type: 'array',
            items: { type: 'string' }
          },
          target_variance: {
            type: 'number',
            default: 0.1,
            description: 'Maximum acceptable variance (0.1 = 10%)'
          },
          scope: {
            type: 'object',
            description: 'Issues to consider for balancing',
            properties: {
              project_identifier: { type: 'string' },
              status: { type: 'string' },
              component: { type: 'string' }
            }
          },
          dry_run: { type: 'boolean', default: false }
        }
      }
    },
    required: ['operation']
  }
}
```

---

## 4. Usage Examples

### Example 1: Get User Workload

```javascript
{
  operation: 'get_workload',
  user_email: 'dev@example.com',
  workload_options: {
    include_completed: false,
    group_by: 'status',
    calculation_method: 'estimation'
  }
}

// Response:
{
  user: 'dev@example.com',
  total_workload: 45,  // hours
  by_status: {
    'Backlog': 10,
    'Todo': 15,
    'In Progress': 20
  },
  by_priority: {
    'urgent': 8,
    'high': 22,
    'medium': 15
  },
  issue_count: 12
}
```

---

### Example 2: Auto-Assign by Load

```javascript
{
  operation: 'auto_assign',
  auto_assign: {
    issue_identifiers: ['PROJ-1', 'PROJ-2', 'PROJ-3', 'PROJ-4', 'PROJ-5'],
    team_members: [
      'dev1@example.com',  // Currently: 20 hours
      'dev2@example.com',  // Currently: 15 hours
      'dev3@example.com'   // Currently: 25 hours
    ],
    strategy: 'least_loaded',
    preserve_existing: true
  }
}

// Result: Assigns to dev2 first (least loaded), then dev1, etc.
{
  assignments: [
    { issue: 'PROJ-1', assigned_to: 'dev2@example.com' },
    { issue: 'PROJ-2', assigned_to: 'dev2@example.com' },
    { issue: 'PROJ-3', assigned_to: 'dev1@example.com' },
    { issue: 'PROJ-4', assigned_to: 'dev1@example.com' },
    { issue: 'PROJ-5', assigned_to: 'dev3@example.com' }
  ],
  final_workload: {
    'dev1@example.com': 24,
    'dev2@example.com': 23,
    'dev3@example.com': 28
  }
}
```

---

### Example 3: Delegate All Work

```javascript
{
  operation: 'delegate',
  delegate: {
    from_user: 'old-dev@example.com',
    to_user: 'new-dev@example.com',
    filters: {
      status: 'In Progress'  // Only delegate active work
    },
    add_comment: true
  }
}

// Result:
{
  delegated_count: 8,
  issues: ['PROJ-1', 'PROJ-2', ...],
  comment_added: 'Delegated from old-dev@example.com to new-dev@example.com on 2025-01-23'
}
```

---

### Example 4: Balance Team Workload

```javascript
{
  operation: 'balance_workload',
  balance_workload: {
    team_members: [
      'dev1@example.com',
      'dev2@example.com',
      'dev3@example.com'
    ],
    target_variance: 0.1,  // 10% max variance
    scope: {
      project_identifier: 'PROJ',
      status: 'Todo'  // Only balance unstarted work
    },
    dry_run: false
  }
}

// Result: Redistributes issues to achieve balanced workload
{
  before: {
    'dev1@example.com': 30,
    'dev2@example.com': 15,
    'dev3@example.com': 25
  },
  after: {
    'dev1@example.com': 23,
    'dev2@example.com': 23,
    'dev3@example.com': 24
  },
  variance_before: 0.33,
  variance_after: 0.02,
  reassignments: 7
}
```

---

### Example 5: Component-Based Assignment

```javascript
{
  operation: 'auto_assign',
  auto_assign: {
    issue_identifiers: ['PROJ-10', 'PROJ-11', 'PROJ-12'],
    team_members: [
      'backend-dev@example.com',
      'frontend-dev@example.com'
    ],
    strategy: 'by_component',
    component_assignments: {
      'Backend': 'backend-dev@example.com',
      'Frontend': 'frontend-dev@example.com',
      'DevOps': 'backend-dev@example.com'
    }
  }
}
```

---

## 5. Implementation Details

### 5.1 Workload Calculation

```javascript
class AccountService {
  async calculateWorkload(client, userEmail, options) {
    const { calculation_method = 'count', include_completed = false } = options;

    // Find user
    const user = await client.findOne(core.class.Account, { email: userEmail });
    if (!user) {
      throw HulyError.notFound('user', userEmail);
    }

    // Build query
    const query = {
      assignee: user._id
    };

    if (!include_completed) {
      query.status = { $ne: 'tracker:status:Done' };
    }

    // Get assigned issues
    const issues = await client.findAll(tracker.class.Issue, query);

    // Calculate workload based on method
    let totalWorkload = 0;

    switch (calculation_method) {
      case 'count':
        totalWorkload = issues.length;
        break;

      case 'estimation':
        totalWorkload = issues.reduce((sum, issue) => sum + (issue.estimation || 0), 0);
        break;

      case 'weighted':
        // Weighted by priority: urgent=4, high=3, medium=2, low=1
        const weights = { 1: 4, 2: 3, 3: 2, 4: 1 };  // Priority enum values
        totalWorkload = issues.reduce((sum, issue) => {
          const weight = weights[issue.priority] || 1;
          const estimation = issue.estimation || 1;
          return sum + (estimation * weight);
        }, 0);
        break;
    }

    // Group by status
    const byStatus = {};
    for (const issue of issues) {
      const status = await this.resolveStatus(client, issue.status);
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return {
      user: userEmail,
      total_workload: totalWorkload,
      issue_count: issues.length,
      by_status: byStatus
    };
  }

  /**
   * Auto-assign using least-loaded strategy
   */
  async autoAssignLeastLoaded(client, issueIds, teamMembers) {
    // Calculate current workload for each team member
    const workloads = new Map();

    for (const email of teamMembers) {
      const workload = await this.calculateWorkload(client, email, {
        calculation_method: 'estimation'
      });
      workloads.set(email, workload.total_workload);
    }

    // Assign each issue to least loaded person
    const assignments = [];

    for (const issueId of issueIds) {
      // Find least loaded member
      let leastLoaded = null;
      let minLoad = Infinity;

      for (const [email, load] of workloads.entries()) {
        if (load < minLoad) {
          minLoad = load;
          leastLoaded = email;
        }
      }

      // Assign issue
      await issueService.updateIssue(client, issueId, {
        updates: { assignee: leastLoaded }
      });

      // Get issue estimation to update workload
      const issue = await client.findOne(tracker.class.Issue, {
        identifier: issueId
      });

      const estimation = issue.estimation || 1;
      workloads.set(leastLoaded, workloads.get(leastLoaded) + estimation);

      assignments.push({
        issue: issueId,
        assigned_to: leastLoaded
      });
    }

    return {
      assignments,
      final_workload: Object.fromEntries(workloads)
    };
  }
}
```

---

## 6. Success Criteria

- [ ] Workload calculation < 200ms
- [ ] Auto-assignment distributes fairly (< 20% variance)
- [ ] Bulk operations handle 100+ issues
- [ ] Delegation working correctly
- [ ] Workload balancing achieves target variance

---

## Appendix: Assignment Strategies

### 1. Round Robin
Assigns issues sequentially to team members in order.

### 2. Least Loaded
Assigns to team member with lowest current workload (calculated by estimation hours).

### 3. By Component
Assigns based on component ownership map.

### 4. By Skill
Assigns based on skill matching (requires skill data).
