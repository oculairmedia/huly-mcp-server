# PRD: `huly_template_ops` - Template Operations Tool

## Document Information
- **Tool Name:** `huly_template_ops`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Consolidate all template operations and enable powerful template instantiation with batch creation, naming patterns, and automatic linking.

### Goals
- Consolidate 8 template tools into one unified interface
- Enable batch template instantiation (create N issues from template)
- Support naming patterns for generated issues
- Add template hierarchy management
- Reduce N+2 calls to 1 call for template-based issue creation

### Success Metrics
- **Template instantiation:** Create 10 issues in 1 call (vs 11 calls currently)
- **Pattern support:** 100% of naming/numbering patterns supported
- **Hierarchy creation:** Full parent-child chains in 1 call

---

## 2. Current State Analysis

### Existing Tools Being Consolidated
1. `huly_create_template` - Create template
2. `huly_update_template` - Update template
3. `huly_delete_template` - Delete template
4. `huly_list_templates` - List templates (moving to huly_query)
5. `huly_search_templates` - Search templates (moving to huly_query)
6. `huly_get_template_details` - Get template (moving to huly_query)
7. `huly_add_child_template` - Add child to template
8. `huly_remove_child_template` - Remove child from template
9. `huly_create_issue_from_template` - Instantiate template

### Current Pain Points

**Problem 1: Multiple calls for batch instantiation**
```javascript
// Current: Need N+2 calls to create N issues from template
huly_list_templates(project)  // Call 1
huly_get_template_details(template_id)  // Call 2
huly_create_issue_from_template(template_id)  // Call 3
huly_create_issue_from_template(template_id)  // Call 4
huly_create_issue_from_template(template_id)  // Call 5
// ... repeat N times
```

**Problem 2: No naming patterns**
```javascript
// Current: All issues get same title from template
// Want: "Sprint 1: Feature A", "Sprint 2: Feature A", etc.
```

**Problem 3: No automatic linking**
```javascript
// Current: Created issues are independent
// Want: Auto-link all issues created from same template
```

---

## 3. Technical Specification

### 3.1 Tool Definition

```javascript
{
  name: 'huly_template_ops',
  description: 'Manage issue templates and instantiate them with advanced patterns',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'instantiate', 'add_child', 'remove_child'],
        description: 'Operation to perform'
      },

      // For create/update/delete/get
      template_id: {
        type: 'string',
        description: 'Template ID'
      },

      data: {
        type: 'object',
        description: 'Template data for create/update',
        properties: {
          project_identifier: {
            type: 'string',
            description: 'Project identifier (required for create)'
          },
          title: {
            type: 'string',
            description: 'Template title'
          },
          description: {
            type: 'string',
            description: 'Template description'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Default priority'
          },
          estimation: {
            type: 'number',
            description: 'Default estimation in hours'
          },
          component: {
            type: 'string',
            description: 'Default component'
          },
          milestone: {
            type: 'string',
            description: 'Default milestone'
          },
          assignee: {
            type: 'string',
            description: 'Default assignee email'
          },
          children: {
            type: 'array',
            items: { type: 'object' },
            description: 'Child templates (for hierarchical templates)'
          }
        }
      },

      // === INSTANTIATION (KEY FEATURE!) ===
      instantiate: {
        type: 'object',
        description: 'Template instantiation configuration',
        properties: {
          count: {
            type: 'number',
            default: 1,
            minimum: 1,
            maximum: 100,
            description: 'Number of issues to create from this template'
          },

          naming_pattern: {
            type: 'string',
            description: 'Pattern for issue titles. Supports: ${n}, ${title}, ${date}, ${project}',
            examples: [
              'Sprint ${n}: ${title}',
              '${title} - ${date}',
              '${project}-Feature-${n}'
            ]
          },

          start_number: {
            type: 'number',
            default: 1,
            description: 'Starting number for ${n} in naming pattern'
          },

          overrides: {
            type: 'object',
            description: 'Override template defaults',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string' },
              component: { type: 'string' },
              milestone: { type: 'string' },
              assignee: { type: 'string' },
              status: { type: 'string' }
            }
          },

          include_children: {
            type: 'boolean',
            default: true,
            description: 'Include child templates as subissues'
          },

          link_created: {
            type: 'boolean',
            default: false,
            description: 'Link all created issues as related'
          },

          distribute_assignees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Distribute created issues among these assignees'
          }
        }
      },

      // For batch instantiation
      batch_instantiate: {
        type: 'array',
        description: 'Create issues from multiple templates',
        items: {
          type: 'object',
          properties: {
            template_id: { type: 'string' },
            count: { type: 'number' },
            naming_pattern: { type: 'string' },
            overrides: { type: 'object' }
          },
          required: ['template_id']
        }
      },

      // For hierarchy management
      child_operation: {
        type: 'object',
        description: 'Add or remove child template',
        properties: {
          parent_template_id: {
            type: 'string',
            description: 'Parent template ID'
          },
          child_template_id: {
            type: 'string',
            description: 'Child template ID'
          }
        }
      }
    },
    required: ['operation']
  }
}
```

---

## 4. Usage Examples

### Example 1: Batch Template Instantiation (KEY USE CASE!)

**Before (11 calls):**
```javascript
huly_list_templates('PROJ')  // 1
huly_get_template_details(template_id)  // 2
huly_create_issue_from_template(template_id)  // 3
huly_create_issue_from_template(template_id)  // 4
huly_create_issue_from_template(template_id)  // 5
// ... 6 more calls for 10 total issues
```

**After (1 call):**
```javascript
{
  operation: 'instantiate',
  template_id: 'template-123',
  instantiate: {
    count: 10,
    naming_pattern: 'Sprint ${n}: ${title}',
    start_number: 1,
    overrides: {
      milestone: 'Q1 2025',
      priority: 'high'
    },
    include_children: true,
    link_created: true
  }
}

// Creates:
// - Sprint 1: Feature Implementation
// - Sprint 2: Feature Implementation
// - ...
// - Sprint 10: Feature Implementation
// All linked together, all with subissues from child templates
```

**Reduces 11 calls → 1 call ✅**

---

### Example 2: Distribute Among Team

```javascript
{
  operation: 'instantiate',
  template_id: 'template-code-review',
  instantiate: {
    count: 6,
    naming_pattern: 'Code Review ${n}',
    distribute_assignees: [
      'dev1@example.com',
      'dev2@example.com',
      'dev3@example.com'
    ]
    // Will assign 2 issues to each developer
  }
}
```

---

### Example 3: Multi-Template Batch

```javascript
{
  operation: 'instantiate',
  batch_instantiate: [
    {
      template_id: 'template-backend',
      count: 3,
      naming_pattern: 'Backend ${n}: ${title}',
      overrides: { component: 'Backend' }
    },
    {
      template_id: 'template-frontend',
      count: 3,
      naming_pattern: 'Frontend ${n}: ${title}',
      overrides: { component: 'Frontend' }
    },
    {
      template_id: 'template-testing',
      count: 2,
      naming_pattern: 'Test ${n}: ${title}',
      overrides: { component: 'QA' }
    }
  ]
}
// Creates 8 issues total from 3 different templates in 1 call!
```

---

### Example 4: Create Template with Hierarchy

```javascript
{
  operation: 'create',
  data: {
    project_identifier: 'PROJ',
    title: 'Feature Implementation',
    description: 'Standard feature template',
    priority: 'medium',
    estimation: 8,
    children: [
      {
        title: 'Design',
        description: 'Design the feature',
        estimation: 2
      },
      {
        title: 'Implementation',
        description: 'Implement the feature',
        estimation: 4
      },
      {
        title: 'Testing',
        description: 'Test the feature',
        estimation: 2
      }
    ]
  }
}
// Creates parent template with 3 child templates in 1 call!
```

---

### Example 5: Date-Based Naming

```javascript
{
  operation: 'instantiate',
  template_id: 'template-daily-standup',
  instantiate: {
    count: 5,
    naming_pattern: 'Daily Standup - ${date}',
    // ${date} automatically increments for each issue
  }
}
// Creates:
// - Daily Standup - 2025-01-23
// - Daily Standup - 2025-01-24
// - Daily Standup - 2025-01-25
// - Daily Standup - 2025-01-26
// - Daily Standup - 2025-01-27
```

---

## 5. Implementation Details

### 5.1 Naming Pattern Variables

```javascript
const PATTERN_VARIABLES = {
  '${n}': (index, start) => start + index,  // Sequential number
  '${title}': (index, template) => template.title,  // Template title
  '${date}': (index) => formatDate(addDays(new Date(), index)),  // Incremented dates
  '${project}': (index, template, project) => project.identifier,  // Project ID
  '${component}': (index, template, project, overrides) => overrides.component || template.component,
  '${milestone}': (index, template, project, overrides) => overrides.milestone || template.milestone
};

function applyNamingPattern(pattern, index, context) {
  let result = pattern;
  for (const [variable, fn] of Object.entries(PATTERN_VARIABLES)) {
    if (result.includes(variable)) {
      const value = fn(index, context.template, context.project, context.overrides);
      result = result.replace(new RegExp(escapeRegex(variable), 'g'), value);
    }
  }
  return result;
}
```

### 5.2 Template Service Methods

```javascript
class TemplateService {
  /**
   * Instantiate template with pattern support
   */
  async instantiateTemplate(client, templateId, config) {
    const {
      count = 1,
      naming_pattern,
      start_number = 1,
      overrides = {},
      include_children = true,
      link_created = false,
      distribute_assignees = []
    } = config;

    // Get template
    const template = await this.getTemplate(client, templateId);
    const project = await this.getProject(client, template.space);

    const createdIssues = [];

    for (let i = 0; i < count; i++) {
      // Apply naming pattern
      const title = naming_pattern
        ? applyNamingPattern(naming_pattern, i, {
            template,
            project,
            overrides,
            start_number
          })
        : template.title;

      // Distribute assignees
      const assignee = distribute_assignees.length > 0
        ? distribute_assignees[i % distribute_assignees.length]
        : overrides.assignee || template.assignee;

      // Create issue from template
      const issueData = {
        title,
        description: overrides.description || template.description,
        priority: overrides.priority || template.priority,
        component: overrides.component || template.component,
        milestone: overrides.milestone || template.milestone,
        estimation: overrides.estimation || template.estimation,
        assignee,
        status: overrides.status
      };

      const issue = await issueService.createIssue(
        client,
        project.identifier,
        issueData.title,
        issueData.description,
        issueData.priority,
        issueData.component,
        issueData.milestone
      );

      createdIssues.push(issue);

      // Create children if requested
      if (include_children && template.children && template.children.length > 0) {
        for (const childTemplate of template.children) {
          await issueService.createSubissue(
            client,
            issue.data.identifier,
            childTemplate.title,
            childTemplate.description,
            childTemplate.priority,
            childTemplate.component,
            childTemplate.milestone
          );
        }
      }
    }

    // Link all created issues if requested
    if (link_created && createdIssues.length > 1) {
      await this.linkIssues(client, createdIssues);
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Created ${count} issue(s) from template ${template.title}\n\n` +
              `Identifiers: ${createdIssues.map(i => i.data.identifier).join(', ')}`
      }],
      data: {
        count,
        created: createdIssues.map(i => i.data)
      }
    };
  }

  /**
   * Link multiple issues as related
   */
  async linkIssues(client, issues) {
    for (let i = 0; i < issues.length - 1; i++) {
      for (let j = i + 1; j < issues.length; j++) {
        await this.createRelation(
          client,
          issues[i].data.identifier,
          issues[j].data.identifier
        );
      }
    }
  }
}
```

---

## 6. Migration Plan

### Phase 1: Core Implementation (Week 1)
- [ ] Implement naming pattern engine
- [ ] Add batch instantiation support
- [ ] Add assignee distribution
- [ ] Add automatic linking

### Phase 2: Advanced Features (Week 2)
- [ ] Date pattern support
- [ ] Batch multi-template instantiation
- [ ] Template hierarchy creation

### Phase 3: Migration (Week 2)
- [ ] Migrate existing templates
- [ ] Deprecate old tools
- [ ] Update documentation

---

## 7. Success Criteria

- [ ] Batch instantiation working (1 call for N issues)
- [ ] All naming patterns supported
- [ ] Assignee distribution working
- [ ] Auto-linking working
- [ ] Template hierarchy creation in 1 call
- [ ] All 8 old tools consolidated

---

## Appendix: Naming Pattern Examples

```javascript
// Sequential numbering
'Task ${n}' → 'Task 1', 'Task 2', 'Task 3', ...

// With template title
'Sprint ${n}: ${title}' → 'Sprint 1: Feature A', 'Sprint 2: Feature A', ...

// With dates
'${title} - ${date}' → 'Standup - 2025-01-23', 'Standup - 2025-01-24', ...

// Complex patterns
'${project}-${component}-${n}' → 'PROJ-Backend-1', 'PROJ-Backend-2', ...

// Custom start number
'Issue ${n}' with start_number: 100 → 'Issue 100', 'Issue 101', ...
```
