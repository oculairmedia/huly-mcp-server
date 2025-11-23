# PRD: `huly_issue_ops` - Issue Operations Tool

## Document Information
- **Tool Name:** `huly_issue_ops`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Consolidate all issue mutation operations (create, update, delete) into a single powerful tool with support for single operations, bulk operations, multi-field updates, and post-action workflows.

### Goals
- Reduce 9 granular issue tools into one unified interface
- Enable multi-field updates in single operation (eliminate 4-5 call workflows)
- Support batch operations with shared defaults
- Add post-creation/update actions (comments, notifications)
- Provide consistent error handling and validation

### Success Metrics
- **Calls per workflow:** Reduce from 4-5 → 1
- **Multi-field updates:** 100% of cases supported
- **Batch performance:** Process 100 issues in < 10 seconds
- **Error rate:** < 1% for valid operations

---

## 2. Current State Analysis

### Existing Tools Being Consolidated
1. `huly_create_issue` - Create single issue
2. `huly_update_issue` - Update ONE field at a time
3. `huly_delete_issue` - Delete single issue
4. `huly_create_subissue` - Create subissue
5. `huly_bulk_create_issues` - Create multiple issues
6. `huly_bulk_update_issues` - Update multiple issues (one field each)
7. `huly_bulk_delete_issues` - Delete multiple issues

### Current Pain Points

1. **Multi-field updates require multiple calls**
```javascript
// Current: Need 4 separate calls to update one issue!
huly_update_issue('PROJ-123', 'status', 'In Progress')
huly_update_issue('PROJ-123', 'priority', 'high')
huly_update_issue('PROJ-123', 'assignee', 'dev@example.com')
huly_update_issue('PROJ-123', 'component', 'Backend')
```

2. **No post-action support**
```javascript
// Current: Need 2 calls to create issue and add comment
huly_create_issue({...})  // Returns PROJ-123
huly_create_comment('PROJ-123', 'Initial comment')
```

3. **No default inheritance in bulk operations**
```javascript
// Current: Must repeat same values for every issue
huly_bulk_create_issues({
  issues: [
    {title: 'A', priority: 'high', component: 'Backend'},
    {title: 'B', priority: 'high', component: 'Backend'},  // Repetition!
    {title: 'C', priority: 'high', component: 'Backend'}   // Repetition!
  ]
})
```

---

## 3. Proposed Solution

### Core Capabilities

1. **Single Operations** - Create, update, delete one issue
2. **Multi-Field Updates** - Update multiple fields in one call
3. **Batch Operations** - Operate on multiple issues with shared defaults
4. **Post-Actions** - Execute actions after create/update (comments, notifications)
5. **Subissue Creation** - Create issues with parent relationships
6. **Validation & Dry-Run** - Preview changes before applying

---

## 4. Technical Specification

### 4.1 Tool Definition

```javascript
{
  name: 'huly_issue_ops',
  description: 'Perform create, update, delete operations on issues (single or batch)',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: 'Operation to perform on issue(s)'
      },

      // === SINGLE OPERATION MODE ===
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier for update/delete operations (e.g., "PROJ-123")'
      },

      data: {
        type: 'object',
        description: 'Issue data for create/update',
        properties: {
          // Create fields
          project_identifier: {
            type: 'string',
            description: 'Project identifier (required for create)'
          },
          title: {
            type: 'string',
            description: 'Issue title'
          },
          description: {
            type: 'string',
            description: 'Issue description (supports markdown)'
          },

          // Common fields
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent', 'NoPriority'],
            description: 'Issue priority'
          },
          status: {
            type: 'string',
            description: 'Issue status (e.g., "Backlog", "In Progress", "Done")'
          },
          assignee: {
            type: 'string',
            description: 'Assignee email address'
          },
          component: {
            type: 'string',
            description: 'Component name'
          },
          milestone: {
            type: 'string',
            description: 'Milestone name'
          },
          estimation: {
            type: 'number',
            description: 'Estimated hours'
          },
          due_date: {
            type: 'string',
            description: 'Due date (ISO 8601 format)'
          },

          // Subissue support
          parent_issue: {
            type: 'string',
            description: 'Parent issue identifier for creating subissues'
          },

          // MULTI-FIELD UPDATE SUPPORT (KEY FEATURE!)
          updates: {
            type: 'object',
            description: 'Multiple fields to update at once (for update operation)',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string' },
              assignee: { type: 'string' },
              component: { type: 'string' },
              milestone: { type: 'string' },
              estimation: { type: 'number' },
              due_date: { type: 'string' }
            }
          }
        }
      },

      // === BATCH OPERATION MODE ===
      batch: {
        type: 'object',
        description: 'Batch operation configuration',
        properties: {
          items: {
            type: 'array',
            description: 'Array of items to process',
            items: {
              type: 'object',
              description: 'Item configuration',
              properties: {
                // For update/delete operations
                issue_identifier: {
                  type: 'string',
                  description: 'Issue identifier'
                },
                // For create operations
                title: { type: 'string' },
                description: { type: 'string' },
                // Can override defaults
                priority: { type: 'string' },
                status: { type: 'string' },
                component: { type: 'string' },
                milestone: { type: 'string' },
                // For update operations
                updates: {
                  type: 'object',
                  description: 'Fields to update for this item'
                }
              }
            },
            minItems: 1,
            maxItems: 1000
          },

          defaults: {
            type: 'object',
            description: 'Default values applied to all items (can be overridden per item)',
            properties: {
              project_identifier: { type: 'string' },
              priority: { type: 'string' },
              status: { type: 'string' },
              assignee: { type: 'string' },
              component: { type: 'string' },
              milestone: { type: 'string' }
            }
          },

          options: {
            type: 'object',
            description: 'Batch processing options',
            properties: {
              batch_size: {
                type: 'number',
                default: 10,
                minimum: 1,
                maximum: 100,
                description: 'Number of items to process per batch'
              },
              continue_on_error: {
                type: 'boolean',
                default: true,
                description: 'Continue processing if an item fails'
              },
              dry_run: {
                type: 'boolean',
                default: false,
                description: 'Validate without executing'
              },
              parallel: {
                type: 'boolean',
                default: false,
                description: 'Process items in parallel (use with caution)'
              }
            }
          }
        },
        required: ['items']
      },

      // === POST-ACTIONS (KEY FEATURE!) ===
      post_actions: {
        type: 'object',
        description: 'Actions to perform after create/update',
        properties: {
          add_comment: {
            type: 'string',
            description: 'Comment to add to issue(s) after operation'
          },
          notify_assignee: {
            type: 'boolean',
            default: false,
            description: 'Send notification to assignee'
          },
          link_to_issues: {
            type: 'array',
            items: { type: 'string' },
            description: 'Link created/updated issue to these issues'
          },
          auto_transition: {
            type: 'boolean',
            default: false,
            description: 'Auto-transition based on workflow rules'
          },
          add_to_sprint: {
            type: 'string',
            description: 'Add issue to sprint/milestone'
          }
        }
      },

      // === DELETION OPTIONS ===
      deletion_options: {
        type: 'object',
        description: 'Options for delete operation',
        properties: {
          delete_subissues: {
            type: 'boolean',
            default: false,
            description: 'Also delete all subissues'
          },
          force: {
            type: 'boolean',
            default: false,
            description: 'Force deletion without validation'
          },
          archive_instead: {
            type: 'boolean',
            default: false,
            description: 'Archive instead of delete'
          }
        }
      }
    },
    required: ['operation']
  },
  annotations: {
    title: 'Issue Operations',
    readOnlyHint: false,
    destructiveHint: false, // Only for delete operation
    idempotentHint: false,
    openWorldHint: true
  }
}
```

---

## 5. Usage Examples

### Example 1: Multi-Field Update (KEY USE CASE!)

**Before (4 calls):**
```javascript
huly_update_issue('PROJ-123', 'status', 'In Progress')
huly_update_issue('PROJ-123', 'priority', 'high')
huly_update_issue('PROJ-123', 'assignee', 'dev@example.com')
huly_update_issue('PROJ-123', 'component', 'Backend')
```

**After (1 call):**
```javascript
{
  operation: 'update',
  issue_identifier: 'PROJ-123',
  data: {
    updates: {
      status: 'In Progress',
      priority: 'high',
      assignee: 'dev@example.com',
      component: 'Backend'
    }
  }
}
```

**Reduces 4 calls → 1 call ✅**

---

### Example 2: Create Issue with Comment

**Before (2 calls):**
```javascript
// Call 1
const result = huly_create_issue({
  project: 'PROJ',
  title: 'New feature',
  description: 'Add authentication'
})
// Returns: PROJ-124

// Call 2
huly_create_comment('PROJ-124', 'Started working on this')
```

**After (1 call):**
```javascript
{
  operation: 'create',
  data: {
    project_identifier: 'PROJ',
    title: 'New feature',
    description: 'Add authentication',
    priority: 'high',
    status: 'In Progress',
    assignee: 'dev@example.com'
  },
  post_actions: {
    add_comment: 'Started working on this',
    notify_assignee: true
  }
}
```

**Reduces 2 calls → 1 call ✅**

---

### Example 3: Batch Create with Defaults

**Before:**
```javascript
{
  issues: [
    {title: 'Task 1', priority: 'high', component: 'Backend', milestone: 'MVP'},
    {title: 'Task 2', priority: 'high', component: 'Backend', milestone: 'MVP'},
    {title: 'Task 3', priority: 'high', component: 'Backend', milestone: 'MVP'}
  ]
}
// Lots of repetition!
```

**After:**
```javascript
{
  operation: 'create',
  batch: {
    defaults: {
      project_identifier: 'PROJ',
      priority: 'high',
      component: 'Backend',
      milestone: 'MVP'
    },
    items: [
      {title: 'Task 1'},
      {title: 'Task 2'},
      {title: 'Task 3', priority: 'urgent'}  // Override for one item
    ]
  },
  post_actions: {
    add_comment: 'Created as part of MVP sprint'
  }
}
```

**Much cleaner and less repetitive ✅**

---

### Example 4: Create Subissues

```javascript
{
  operation: 'create',
  batch: {
    defaults: {
      parent_issue: 'PROJ-100',  // All items are subissues
      priority: 'medium',
      component: 'Backend'
    },
    items: [
      {title: 'Subtask 1: Database schema'},
      {title: 'Subtask 2: API endpoints'},
      {title: 'Subtask 3: Tests', component: 'Testing'}  // Override
    ]
  }
}
```

---

### Example 5: Batch Update Different Fields

```javascript
{
  operation: 'update',
  batch: {
    items: [
      {
        issue_identifier: 'PROJ-1',
        updates: {status: 'Done', priority: 'low'}
      },
      {
        issue_identifier: 'PROJ-2',
        updates: {assignee: 'dev2@example.com', milestone: 'Sprint 2'}
      },
      {
        issue_identifier: 'PROJ-3',
        updates: {status: 'In Progress', component: 'Frontend'}
      }
    ],
    options: {
      continue_on_error: true
    }
  },
  post_actions: {
    add_comment: 'Bulk updated on 2025-01-23'
  }
}
```

---

### Example 6: Dry Run Validation

```javascript
{
  operation: 'update',
  batch: {
    items: [/* ... 100 items ... */],
    options: {
      dry_run: true  // Validate without executing
    }
  }
}

// Response:
{
  success: true,
  dry_run: true,
  valid_count: 98,
  invalid_count: 2,
  validation_errors: [
    {item_index: 15, error: 'Issue PROJ-999 not found'},
    {item_index: 42, error: 'Invalid status: "Working"'}
  ]
}
```

---

### Example 7: Delete with Subissues

```javascript
{
  operation: 'delete',
  issue_identifier: 'PROJ-100',
  deletion_options: {
    delete_subissues: true,  // Also delete all children
    force: false  // Still validate
  }
}
```

---

## 6. Implementation Details

### 6.1 Service Layer Changes

**File:** `src/services/IssueOperationsService.js` (NEW)

```javascript
class IssueOperationsService {
  /**
   * Execute issue operation (single or batch)
   */
  async executeOperation(client, params) {
    const { operation, batch } = params;

    if (batch) {
      return this.executeBatchOperation(client, operation, batch, params);
    } else {
      return this.executeSingleOperation(client, operation, params);
    }
  }

  /**
   * Execute single operation
   */
  async executeSingleOperation(client, operation, params) {
    switch (operation) {
      case 'create':
        return this.createIssue(client, params.data, params.post_actions);
      case 'update':
        return this.updateIssue(client, params.issue_identifier, params.data, params.post_actions);
      case 'delete':
        return this.deleteIssue(client, params.issue_identifier, params.deletion_options);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Update issue with multi-field support (KEY METHOD!)
   */
  async updateIssue(client, issueIdentifier, data, postActions) {
    const issue = await client.findOne(tracker.class.Issue, {
      identifier: issueIdentifier
    });

    if (!issue) {
      throw HulyError.notFound('issue', issueIdentifier);
    }

    // Build update object from data.updates
    const updateData = {};
    const updates = data.updates || {};

    // Process each field
    for (const [field, value] of Object.entries(updates)) {
      switch (field) {
        case 'title':
          updateData.title = value;
          break;

        case 'description':
          updateData.description = await this.createDescriptionMarkup(
            client,
            issue._id,
            value
          );
          break;

        case 'status':
          updateData.status = await this.resolveStatus(client, issue.space, value);
          break;

        case 'priority':
          updateData.priority = PRIORITY_MAP[normalizePriority(value)];
          break;

        case 'assignee':
          const account = await client.findOne(core.class.Account, { email: value });
          if (account) {
            updateData.assignee = account._id;
          }
          break;

        case 'component':
          const component = await this.resolveComponent(client, issue.space, value);
          if (component) {
            updateData.component = component._id;
          }
          break;

        case 'milestone':
          const milestone = await this.resolveMilestone(client, issue.space, value);
          if (milestone) {
            updateData.milestone = milestone._id;
          }
          break;

        case 'estimation':
          updateData.estimation = value;
          break;

        case 'due_date':
          updateData.dueTo = new Date(value).getTime();
          break;
      }
    }

    // Execute update
    await client.updateDoc(tracker.class.Issue, issue.space, issue._id, updateData);

    // Execute post-actions
    if (postActions) {
      await this.executePostActions(client, issue, postActions);
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Updated issue ${issueIdentifier}\n\nFields updated: ${Object.keys(updates).join(', ')}`
      }],
      data: {
        identifier: issueIdentifier,
        updated_fields: Object.keys(updates)
      }
    };
  }

  /**
   * Execute post-actions (KEY METHOD!)
   */
  async executePostActions(client, issue, postActions) {
    const actions = [];

    // Add comment
    if (postActions.add_comment) {
      await client.addCollection(
        chunter.class.ChatMessage,
        issue.space,
        issue._id,
        tracker.class.Issue,
        'comments',
        {
          message: postActions.add_comment,
          attachedTo: issue._id,
          attachedToClass: tracker.class.Issue,
          collection: 'comments'
        }
      );
      actions.push('comment_added');
    }

    // Link to issues
    if (postActions.link_to_issues && postActions.link_to_issues.length > 0) {
      for (const targetId of postActions.link_to_issues) {
        const target = await client.findOne(tracker.class.Issue, {
          identifier: targetId
        });
        if (target) {
          // Create relation
          await this.createRelation(client, issue._id, target._id);
          actions.push(`linked_to_${targetId}`);
        }
      }
    }

    // Notify assignee
    if (postActions.notify_assignee && issue.assignee) {
      // Trigger notification (implementation depends on notification system)
      await this.sendNotification(client, issue.assignee, issue._id);
      actions.push('notification_sent');
    }

    return actions;
  }

  /**
   * Execute batch operation with defaults
   */
  async executeBatchOperation(client, operation, batch, params) {
    const { items, defaults = {}, options = {} } = batch;
    const {
      batch_size = 10,
      continue_on_error = true,
      dry_run = false,
      parallel = false
    } = options;

    // Merge defaults with each item
    const mergedItems = items.map(item => ({
      ...defaults,
      ...item,
      // For updates, merge update objects
      updates: {
        ...defaults.updates,
        ...item.updates
      }
    }));

    if (dry_run) {
      return this.validateBatch(client, operation, mergedItems);
    }

    // Execute batch
    const bulkService = new BulkOperationService({}, this.logger);

    const result = await bulkService.executeBulkOperation({
      items: mergedItems,
      operation: async (item) => {
        switch (operation) {
          case 'create':
            return this.createIssue(client, item, params.post_actions);
          case 'update':
            return this.updateIssue(client, item.issue_identifier, item, params.post_actions);
          case 'delete':
            return this.deleteIssue(client, item.issue_identifier, params.deletion_options);
        }
      },
      options: {
        batchSize: batch_size,
        continueOnError: continue_on_error,
        parallel
      }
    });

    return this.formatBatchResult(result, operation);
  }
}
```

---

## 7. Migration Plan

### Phase 1: Core Implementation (Week 1)
- [ ] Create IssueOperationsService
- [ ] Implement multi-field update logic
- [ ] Implement post-actions framework
- [ ] Add batch operations with defaults

### Phase 2: Testing (Week 1-2)
- [ ] Unit tests for multi-field updates
- [ ] Unit tests for post-actions
- [ ] Integration tests for batch operations
- [ ] Performance tests

### Phase 3: Deployment (Week 2)
- [ ] Deploy to staging
- [ ] Migration guide for users
- [ ] Deprecate old tools
- [ ] Monitor usage

---

## 8. Success Criteria

- [ ] Multi-field updates working (100% test coverage)
- [ ] Post-actions framework complete
- [ ] Batch operations 10x faster than sequential
- [ ] All 9 old tools consolidated
- [ ] Token usage reduced 75%+
- [ ] Zero breaking changes for existing users

---

## 9. Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Single update | < 200ms | p95 |
| Multi-field update (5 fields) | < 300ms | p95 |
| Batch create (100 issues) | < 10s | p95 |
| Batch update (100 issues) | < 15s | p95 |

---

## Appendix: Backward Compatibility

Old tools will be deprecated but remain functional for 6 months:
- `huly_update_issue(id, field, value)` → Maps to `huly_issue_ops({operation: 'update', issue_identifier: id, data: {updates: {[field]: value}}})`
- Similar mappings for all other old tools
