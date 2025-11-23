# PRD: `huly_workflow` - Workflow Automation Tool

## Document Information
- **Tool Name:** `huly_workflow`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Enable complex multi-step workflows, state transitions, and query-transform operations in a single tool call. This is the "power user" tool that chains multiple operations together.

### Goals
- Reduce 5-10 chained tool calls to 1 workflow call
- Support conditional logic and error handling
- Enable query + transform patterns (search → update)
- Implement pipeline/sequential operations
- Add workflow state transitions with validation

### Success Metrics
- **Call reduction:** 80-90% for complex workflows
- **Workflow success rate:** > 95%
- **Performance:** Complete 100-item workflows in < 30s

---

## 2. Workflow Types

### 2.1 Transform Workflow (Query + Action)
**Use Case:** Search for issues and apply transformations

**Current Pain (5+ calls):**
```javascript
// 1. Search for issues
const issues = huly_search_issues({status: 'Backlog'})

// 2-N. Update each issue
for (const issue of issues) {
  huly_update_issue(issue.identifier, 'milestone', 'Sprint 2')
}
```

**After (1 call):**
```javascript
{
  workflow_type: 'transform',
  transform: {
    search: {
      entity_type: 'issue',
      filters: {status: 'Backlog', priority: 'low'}
    },
    apply: {
      operation: 'update',
      data: {
        updates: {
          milestone: 'Backlog Cleanup',
          status: 'Todo'
        }
      }
    },
    options: {
      limit: 50,
      dry_run: false
    }
  }
}
```

---

### 2.2 Transition Workflow (Status Migration)
**Use Case:** Move issues through workflow states with rules

```javascript
{
  workflow_type: 'transition',
  transition: {
    from_status: 'In Progress',
    to_status: 'Done',
    filters: {
      project_identifier: 'PROJ',
      modified_before: '2025-01-01'  // Old issues
    },
    validation: {
      require_comment: true,
      require_estimation: true
    },
    actions: {
      add_comment: 'Auto-completed on ${date}',
      update_fields: {
        priority: 'low'
      },
      notify_assignees: true
    }
  }
}
```

---

### 2.3 Pipeline Workflow (Sequential Operations)
**Use Case:** Execute series of operations with dependencies

```javascript
{
  workflow_type: 'pipeline',
  pipeline: [
    {
      step: 'create_milestone',
      tool: 'huly_entity',
      params: {
        entity_type: 'milestone',
        operation: 'create',
        data: {
          project_identifier: 'PROJ',
          label: 'Sprint 5',
          target_date: '2025-02-28'
        }
      }
    },
    {
      step: 'find_backlog_issues',
      tool: 'huly_query',
      params: {
        entity_type: 'issue',
        filters: {
          project_identifier: 'PROJ',
          status: 'Backlog',
          priority: 'high'
        },
        output: {
          fields: ['identifier'],
          limit: 20
        }
      }
    },
    {
      step: 'assign_to_sprint',
      tool: 'huly_issue_ops',
      params: {
        operation: 'update',
        batch: {
          items: '${find_backlog_issues.results}',  // Use previous result
          defaults: {
            updates: {
              milestone: 'Sprint 5',
              status: 'Todo'
            }
          }
        }
      },
      condition: {
        if_step_succeeded: 'create_milestone',
        if_result_count_gt: ['find_backlog_issues', 0]
      }
    }
  ],
  options: {
    stop_on_error: true,
    return_all_results: true
  }
}
```

---

### 2.4 Clone Workflow
**Use Case:** Duplicate issues with modifications

```javascript
{
  workflow_type: 'clone',
  clone: {
    source_issues: ['PROJ-1', 'PROJ-2', 'PROJ-3'],
    modifications: {
      title_prefix: '[Clone] ',
      milestone: 'Sprint 2',
      assignee: 'dev2@example.com',
      clear_fields: ['estimation', 'due_date']
    },
    include_subissues: true,
    include_comments: false,
    link_to_original: true
  }
}
```

---

### 2.5 Cascade Update
**Use Case:** Update issue and all related entities

```javascript
{
  workflow_type: 'cascade_update',
  cascade: {
    root_issue: 'PROJ-100',
    updates: {
      milestone: 'Q2 2025',
      priority: 'high'
    },
    cascade_to: {
      subissues: true,
      related_issues: true,
      parent_issue: false
    },
    max_depth: 3
  }
}
```

---

## 3. Technical Specification

### 3.1 Full Tool Definition

```javascript
{
  name: 'huly_workflow',
  description: 'Execute complex multi-step workflows and state transitions',
  inputSchema: {
    type: 'object',
    properties: {
      workflow_type: {
        type: 'string',
        enum: ['transform', 'transition', 'pipeline', 'clone', 'cascade_update', 'migrate'],
        description: 'Type of workflow to execute'
      },

      // Transform workflow (query + action)
      transform: {
        type: 'object',
        properties: {
          search: {
            type: 'object',
            description: 'Query parameters (same as huly_query)'
          },
          apply: {
            type: 'object',
            description: 'Operation to apply to results (same as huly_issue_ops)'
          },
          options: {
            type: 'object',
            properties: {
              limit: { type: 'number', default: 100 },
              dry_run: { type: 'boolean', default: false },
              batch_size: { type: 'number', default: 10 }
            }
          }
        }
      },

      // Transition workflow
      transition: {
        type: 'object',
        properties: {
          from_status: { type: 'string' },
          to_status: { type: 'string' },
          from_milestone: { type: 'string' },
          to_milestone: { type: 'string' },
          filters: { type: 'object' },
          validation: {
            type: 'object',
            properties: {
              require_comment: { type: 'boolean' },
              require_estimation: { type: 'boolean' },
              require_assignee: { type: 'boolean' },
              custom_validation: { type: 'string' }
            }
          },
          actions: {
            type: 'object',
            properties: {
              add_comment: { type: 'string' },
              update_fields: { type: 'object' },
              notify_assignees: { type: 'boolean' },
              auto_assign: { type: 'string' }
            }
          }
        }
      },

      // Pipeline workflow (sequential operations)
      pipeline: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            step: {
              type: 'string',
              description: 'Step identifier (for referencing in later steps)'
            },
            tool: {
              type: 'string',
              enum: ['huly_query', 'huly_issue_ops', 'huly_template_ops', 'huly_entity'],
              description: 'Tool to invoke'
            },
            params: {
              type: 'object',
              description: 'Parameters for the tool. Can reference previous steps using ${step.field}'
            },
            condition: {
              type: 'object',
              description: 'Conditions for executing this step',
              properties: {
                if_step_succeeded: { type: 'string' },
                if_step_failed: { type: 'string' },
                if_result_count_gt: { type: 'array' },
                if_field_equals: { type: 'object' }
              }
            }
          },
          required: ['step', 'tool', 'params']
        }
      },

      // Clone workflow
      clone: {
        type: 'object',
        properties: {
          source_issues: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issue identifiers to clone'
          },
          modifications: {
            type: 'object',
            properties: {
              title_prefix: { type: 'string' },
              title_suffix: { type: 'string' },
              clear_fields: {
                type: 'array',
                items: { type: 'string' }
              },
              update_fields: { type: 'object' }
            }
          },
          include_subissues: { type: 'boolean', default: true },
          include_comments: { type: 'boolean', default: false },
          link_to_original: { type: 'boolean', default: true }
        }
      },

      // Cascade update
      cascade: {
        type: 'object',
        properties: {
          root_issue: { type: 'string' },
          updates: { type: 'object' },
          cascade_to: {
            type: 'object',
            properties: {
              subissues: { type: 'boolean', default: true },
              related_issues: { type: 'boolean', default: false },
              parent_issue: { type: 'boolean', default: false }
            }
          },
          max_depth: { type: 'number', default: 10 }
        }
      },

      // Common options
      options: {
        type: 'object',
        properties: {
          stop_on_error: { type: 'boolean', default: true },
          return_all_results: { type: 'boolean', default: false },
          dry_run: { type: 'boolean', default: false }
        }
      }
    },
    required: ['workflow_type']
  }
}
```

---

## 4. Implementation Details

### 4.1 Pipeline Execution Engine

```javascript
class WorkflowService {
  async executePipeline(client, pipeline, options) {
    const results = {};
    const errors = [];

    for (const step of pipeline) {
      try {
        // Check conditions
        if (step.condition && !this.evaluateCondition(step.condition, results)) {
          results[step.step] = { skipped: true, reason: 'condition_not_met' };
          continue;
        }

        // Resolve parameter references
        const resolvedParams = this.resolveParameters(step.params, results);

        // Execute tool
        const result = await this.executeTool(client, step.tool, resolvedParams);

        results[step.step] = {
          success: true,
          data: result
        };

      } catch (error) {
        errors.push({ step: step.step, error: error.message });

        if (options.stop_on_error) {
          throw new Error(`Pipeline failed at step ${step.step}: ${error.message}`);
        }

        results[step.step] = {
          success: false,
          error: error.message
        };
      }
    }

    return {
      pipeline_results: results,
      errors: errors.length > 0 ? errors : null,
      success: errors.length === 0
    };
  }

  /**
   * Resolve parameter references like ${step.field}
   */
  resolveParameters(params, results) {
    const resolved = JSON.parse(JSON.stringify(params));

    function traverse(obj) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          // Extract reference: ${step.field.subfield}
          const ref = value.slice(2, -1);
          const parts = ref.split('.');
          let refValue = results;

          for (const part of parts) {
            refValue = refValue?.[part];
          }

          obj[key] = refValue;
        } else if (typeof value === 'object' && value !== null) {
          traverse(value);
        }
      }
    }

    traverse(resolved);
    return resolved;
  }

  /**
   * Evaluate step conditions
   */
  evaluateCondition(condition, results) {
    if (condition.if_step_succeeded) {
      return results[condition.if_step_succeeded]?.success === true;
    }

    if (condition.if_step_failed) {
      return results[condition.if_step_failed]?.success === false;
    }

    if (condition.if_result_count_gt) {
      const [step, count] = condition.if_result_count_gt;
      const resultCount = results[step]?.data?.count || 0;
      return resultCount > count;
    }

    if (condition.if_field_equals) {
      const { step, field, value } = condition.if_field_equals;
      return results[step]?.data?.[field] === value;
    }

    return true;
  }
}
```

---

## 5. Usage Examples

### Example 1: Sprint Setup Pipeline

```javascript
{
  workflow_type: 'pipeline',
  pipeline: [
    {
      step: 'create_sprint_milestone',
      tool: 'huly_entity',
      params: {
        entity_type: 'milestone',
        operation: 'create',
        data: {
          project_identifier: 'PROJ',
          label: 'Sprint 5',
          target_date: '2025-02-28',
          description: 'Q1 2025 Sprint 5'
        }
      }
    },
    {
      step: 'find_high_priority_backlog',
      tool: 'huly_query',
      params: {
        entity_type: 'issue',
        filters: {
          project_identifier: 'PROJ',
          status: 'Backlog',
          priority: 'high'
        },
        output: {
          fields: ['identifier', 'title'],
          limit: 15
        }
      },
      condition: {
        if_step_succeeded: 'create_sprint_milestone'
      }
    },
    {
      step: 'assign_to_sprint',
      tool: 'huly_issue_ops',
      params: {
        operation: 'update',
        batch: {
          items: '${find_high_priority_backlog.results}',
          defaults: {
            updates: {
              milestone: 'Sprint 5',
              status: 'Todo'
            }
          }
        }
      },
      condition: {
        if_result_count_gt: ['find_high_priority_backlog', 0]
      }
    },
    {
      step: 'notify_team',
      tool: 'huly_issue_ops',
      params: {
        operation: 'create',
        data: {
          project_identifier: 'PROJ',
          title: 'Sprint 5 Planning Complete',
          description: 'Sprint 5 has been set up with ${find_high_priority_backlog.count} issues',
          priority: 'low',
          status: 'Done'
        }
      },
      condition: {
        if_step_succeeded: 'assign_to_sprint'
      }
    }
  ],
  options: {
    stop_on_error: true,
    return_all_results: true
  }
}

// Replaces 4-20 individual tool calls with 1 workflow call!
```

---

## 6. Success Criteria

- [ ] Pipeline execution working
- [ ] Transform workflow working
- [ ] Transition workflow working
- [ ] Parameter references working (${step.field})
- [ ] Conditional execution working
- [ ] Complex workflows < 30s execution time
- [ ] 80-90% call reduction for complex scenarios

---

## Appendix: Real-World Workflow Examples

### Example: Monthly Cleanup
```javascript
{
  workflow_type: 'transform',
  transform: {
    search: {
      entity_type: 'issue',
      filters: {
        status: 'Done',
        modified_before: '2025-12-01'  // Older than 1 month
      }
    },
    apply: {
      operation: 'update',
      data: {
        updates: {
          status: 'Archived'
        }
      }
    },
    options: {
      dry_run: false,
      limit: 500
    }
  }
}
```

### Example: Release Preparation
```javascript
{
  workflow_type: 'transition',
  transition: {
    from_milestone: 'Sprint 4',
    to_milestone: 'Release 1.0',
    filters: {
      status: 'Done',
      priority: ['high', 'urgent']
    },
    validation: {
      require_estimation: true
    },
    actions: {
      add_comment: 'Promoted to Release 1.0',
      notify_assignees: true
    }
  }
}
```
