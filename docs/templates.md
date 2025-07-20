# Template Management Guide

This guide covers the template functionality in the Huly MCP Server, allowing you to create reusable issue templates for standardized workflows.

## Table of Contents

- [Overview](#overview)
- [Creating Templates](#creating-templates)
- [Managing Templates](#managing-templates)
- [Using Templates](#using-templates)
- [Hierarchical Templates](#hierarchical-templates)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

Templates allow you to:
- Define reusable issue structures
- Standardize workflows across teams
- Create hierarchical task breakdowns
- Automate repetitive issue creation
- Ensure consistency in issue metadata

## Creating Templates

### Basic Template

Use the `huly_create_template` tool to create a simple template:

```json
{
  "project_identifier": "PROJ",
  "title": "Bug Report Template",
  "description": "Standard template for reporting bugs",
  "priority": "high"
}
```

### Template with All Fields

```json
{
  "project_identifier": "PROJ",
  "title": "Feature Implementation",
  "description": "Template for new feature development",
  "priority": "medium",
  "estimation": 16,
  "assignee": "developer@example.com",
  "component": "Backend",
  "milestone": "v2.0"
}
```

### Supported Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `title` | string | Template title (required) | - |
| `description` | string | Template description | Empty |
| `priority` | string | Issue priority (low, medium, high, urgent) | medium |
| `estimation` | number | Time estimation in hours | 0 |
| `assignee` | string | Default assignee email | None |
| `component` | string | Component name | None |
| `milestone` | string | Milestone name | None |

## Managing Templates

### List Templates

View all templates in a project:

```json
{
  "project_identifier": "PROJ",
  "limit": 50
}
```

Response includes:
- Template ID and title
- Description and metadata
- Child template count

### Get Template Details

Retrieve complete template information:

```json
{
  "template_id": "template-123"
}
```

Returns:
- All template fields
- Complete child template hierarchy
- Metadata and timestamps

### Update Template

Modify existing template fields:

```json
{
  "template_id": "template-123",
  "field": "priority",
  "value": "urgent"
}
```

Updatable fields:
- `title`
- `description`
- `priority`
- `estimation`
- `assignee`
- `component`
- `milestone`

### Delete Template

Remove a template and its children:

```json
{
  "template_id": "template-123"
}
```

**Note**: Deleting a template does not affect issues created from it.

### Search Templates

Find templates by title or description:

```json
{
  "query": "bug",
  "project_identifier": "PROJ",
  "limit": 20
}
```

## Using Templates

### Create Issue from Template

Generate a new issue using a template:

```json
{
  "template_id": "template-123"
}
```

### Override Template Values

Customize fields when creating from template:

```json
{
  "template_id": "template-123",
  "title": "Specific Bug: Login fails on mobile",
  "priority": "urgent",
  "assignee": "mobile-dev@example.com"
}
```

### Include/Exclude Children

Control child issue creation:

```json
{
  "template_id": "template-123",
  "include_children": false
}
```

## Hierarchical Templates

### Creating Templates with Children

Define a complete task breakdown:

```json
{
  "project_identifier": "PROJ",
  "title": "Epic: User Authentication",
  "description": "Implement complete authentication system",
  "priority": "high",
  "children": [
    {
      "title": "Design authentication flow",
      "description": "Create UX mockups and flow diagrams",
      "priority": "high",
      "estimation": 8
    },
    {
      "title": "Implement login endpoint",
      "description": "Create /auth/login API endpoint",
      "priority": "high",
      "estimation": 4
    },
    {
      "title": "Implement logout endpoint",
      "description": "Create /auth/logout API endpoint",
      "priority": "medium",
      "estimation": 2
    },
    {
      "title": "Add session management",
      "description": "Implement JWT token handling",
      "priority": "high",
      "estimation": 6
    }
  ]
}
```

### Adding Child Templates

Add children to existing template:

```json
{
  "template_id": "parent-template-123",
  "title": "Write integration tests",
  "description": "Test all authentication endpoints",
  "priority": "medium",
  "estimation": 4
}
```

### Removing Child Templates

Remove a child by index (0-based):

```json
{
  "template_id": "parent-template-123",
  "child_index": 2
}
```

### Hierarchical Creation

When creating issues from hierarchical templates:
1. Parent issue is created first
2. Child issues are created with parent reference
3. All metadata is preserved
4. Estimation rolls up to parent

## Best Practices

### 1. Naming Conventions

Use clear, descriptive names:
- ✅ "Bug Report - Frontend"
- ✅ "Feature Request - API Enhancement"
- ❌ "Template 1"
- ❌ "New Template"

### 2. Template Categories

Organize templates by type:
- **Bug Reports**: Standardized bug reporting
- **Feature Requests**: New feature proposals
- **Epics**: Large feature breakdowns
- **Maintenance**: Routine tasks
- **Documentation**: Doc updates

### 3. Field Defaults

Set sensible defaults:
```json
{
  "priority": "medium",
  "estimation": 0,
  "component": "General"
}
```

### 4. Child Template Guidelines

- Keep hierarchies shallow (2-3 levels max)
- Each child should be independently actionable
- Use consistent estimation units
- Avoid circular dependencies

### 5. Maintenance

- Review templates quarterly
- Update for process changes
- Archive obsolete templates
- Monitor template usage

## Examples

### Example 1: Bug Report Template

```json
{
  "project_identifier": "PROJ",
  "title": "Bug Report",
  "description": "Template for reporting software defects",
  "priority": "high",
  "component": "Unknown",
  "children": [
    {
      "title": "Reproduce the issue",
      "description": "Document steps to reproduce",
      "priority": "high",
      "estimation": 1
    },
    {
      "title": "Investigate root cause",
      "description": "Debug and identify the cause",
      "priority": "high",
      "estimation": 2
    },
    {
      "title": "Implement fix",
      "description": "Code the solution",
      "priority": "high",
      "estimation": 3
    },
    {
      "title": "Test fix",
      "description": "Verify the fix works",
      "priority": "medium",
      "estimation": 1
    }
  ]
}
```

### Example 2: Feature Development Template

```json
{
  "project_identifier": "PROJ",
  "title": "Feature Development",
  "description": "Standard workflow for new features",
  "priority": "medium",
  "children": [
    {
      "title": "Technical design",
      "description": "Create technical specification",
      "priority": "high",
      "estimation": 4,
      "assignee": "architect@example.com"
    },
    {
      "title": "Backend implementation",
      "description": "Implement server-side logic",
      "priority": "high",
      "estimation": 16,
      "component": "Backend"
    },
    {
      "title": "Frontend implementation",
      "description": "Implement UI components",
      "priority": "high",
      "estimation": 12,
      "component": "Frontend"
    },
    {
      "title": "Integration testing",
      "description": "Test frontend-backend integration",
      "priority": "medium",
      "estimation": 4
    },
    {
      "title": "Documentation",
      "description": "Update user and API docs",
      "priority": "low",
      "estimation": 2
    }
  ]
}
```

### Example 3: Sprint Planning Template

```json
{
  "project_identifier": "PROJ",
  "title": "Sprint Planning Template",
  "description": "Template for sprint planning sessions",
  "milestone": "Sprint 15",
  "children": [
    {
      "title": "Sprint planning meeting",
      "description": "Team planning session",
      "estimation": 2
    },
    {
      "title": "Update sprint backlog",
      "description": "Prioritize and assign tasks",
      "estimation": 1
    },
    {
      "title": "Sprint kick-off",
      "description": "Communicate goals to team",
      "estimation": 1
    }
  ]
}
```

### Example 4: Using Templates Programmatically

```javascript
// Create a template
const template = await createTemplate({
  project_identifier: 'PROJ',
  title: 'Weekly Maintenance',
  children: [
    { title: 'Check system logs' },
    { title: 'Update dependencies' },
    { title: 'Run security scan' }
  ]
});

// Use template weekly
const issue = await createIssueFromTemplate({
  template_id: template.id,
  title: `Maintenance - Week ${weekNumber}`
});
```

## Advanced Usage

### Template Variables

While not directly supported, you can implement template variables:

1. Use placeholders in descriptions:
   ```json
   {
     "description": "Fix bug in {{component}} affecting {{feature}}"
   }
   ```

2. Replace when creating issues:
   ```javascript
   const description = template.description
     .replace('{{component}}', 'Authentication')
     .replace('{{feature}}', 'login flow');
   ```

### Conditional Children

Create different child sets based on issue type:

```javascript
const children = issueType === 'bug' 
  ? bugChildren 
  : featureChildren;

await createTemplate({
  title: `${issueType} Template`,
  children
});
```

### Template Versioning

Track template versions:

```json
{
  "title": "Bug Report v2.1",
  "description": "Updated bug report template (v2.1)\nChanges: Added severity field"
}
```

## Troubleshooting

### Templates Not Appearing

- Verify project identifier is correct
- Check user permissions for the project
- Ensure template was created successfully

### Child Issues Not Created

- Check `include_children` parameter (default: true)
- Verify parent issue was created first
- Review error messages for validation issues

### Field Values Not Applied

- Ensure field names are correct
- Check if values are valid (e.g., component exists)
- Some fields may require specific formats

## API Reference

For detailed API information, see:
- [Create Template](../src/tools/templates/createTemplate.js)
- [List Templates](../src/tools/templates/listTemplates.js)
- [Create Issue from Template](../src/tools/templates/createIssueFromTemplate.js)
- [Template Service](../src/services/TemplateService.js)