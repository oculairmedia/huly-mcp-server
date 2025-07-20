# Bulk Operations Guide

This guide covers the bulk operations available in the Huly MCP Server, including bulk creation, update, and deletion of issues.

## Table of Contents

- [Overview](#overview)
- [Bulk Create Issues](#bulk-create-issues)
- [Bulk Update Issues](#bulk-update-issues)
- [Bulk Delete Issues](#bulk-delete-issues)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)

## Overview

Bulk operations allow you to perform actions on multiple issues simultaneously, significantly improving efficiency when dealing with large datasets. All bulk operations support:

- **Batch processing**: Operations are processed in configurable batches
- **Progress tracking**: Monitor the status of each operation
- **Error handling**: Continue processing even if individual operations fail
- **Dry run mode**: Preview changes before applying them

## Bulk Create Issues

The `huly_bulk_create_issues` tool allows you to create multiple issues in a single operation.

### Basic Usage

```json
{
  "project_identifier": "PROJ",
  "issues": [
    {
      "title": "Implement feature A",
      "description": "Detailed description",
      "priority": "high"
    },
    {
      "title": "Fix bug B",
      "description": "Bug description",
      "priority": "urgent"
    }
  ]
}
```

### With Default Values

You can specify default values that apply to all issues:

```json
{
  "project_identifier": "PROJ",
  "defaults": {
    "component": "Backend",
    "milestone": "v1.0",
    "priority": "medium"
  },
  "issues": [
    {
      "title": "API endpoint 1"
    },
    {
      "title": "API endpoint 2",
      "priority": "high"  // Overrides default
    }
  ]
}
```

### Creating Sub-issues

To create sub-issues, specify the parent issue:

```json
{
  "project_identifier": "PROJ",
  "issues": [
    {
      "title": "Main task",
      "description": "Parent issue"
    },
    {
      "title": "Subtask 1",
      "parent_issue": "PROJ-123"
    }
  ]
}
```

### Options

- `dry_run` (boolean): Validate without creating issues
- `continue_on_error` (boolean): Continue if an issue fails to create
- `batch_size` (number): Number of issues per batch (1-50, default: 10)

### Example Response

```json
{
  "success": true,
  "created": 25,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "success": true,
      "identifier": "PROJ-101",
      "title": "Implement feature A"
    }
  ],
  "duration": 2500
}
```

## Bulk Update Issues

The `huly_bulk_update_issues` tool allows you to update multiple issues with different values.

### Basic Usage

```json
{
  "updates": [
    {
      "issue_identifier": "PROJ-1",
      "field": "status",
      "value": "done"
    },
    {
      "issue_identifier": "PROJ-2",
      "field": "priority",
      "value": "high"
    }
  ]
}
```

### Supported Fields

- `title`: Issue title
- `description`: Issue description
- `status`: Issue status (backlog, todo, in-progress, done, canceled)
- `priority`: Issue priority (urgent, high, medium, low, none)
- `component`: Component name
- `milestone`: Milestone name

### Batch Updates

Update multiple issues with the same value:

```json
{
  "updates": [
    {
      "issue_identifier": "PROJ-1",
      "field": "milestone",
      "value": "v2.0"
    },
    {
      "issue_identifier": "PROJ-2",
      "field": "milestone",
      "value": "v2.0"
    },
    {
      "issue_identifier": "PROJ-3",
      "field": "milestone",
      "value": "v2.0"
    }
  ]
}
```

### Options

- `dry_run` (boolean): Preview updates without applying
- `continue_on_error` (boolean): Continue if an update fails
- `batch_size` (number): Updates per batch (1-100, default: 10)

### Example Response

```json
{
  "success": true,
  "processed": 50,
  "succeeded": 48,
  "failed": 2,
  "results": [
    {
      "issueIdentifier": "PROJ-1",
      "success": true,
      "field": "status",
      "oldValue": "in-progress",
      "newValue": "done"
    },
    {
      "issueIdentifier": "PROJ-99",
      "success": false,
      "error": "Issue not found"
    }
  ]
}
```

## Bulk Delete Issues

The `huly_bulk_delete_issues` tool allows you to delete multiple issues and their sub-issues.

### Basic Usage

```json
{
  "issue_identifiers": ["PROJ-1", "PROJ-2", "PROJ-3"]
}
```

### With Options

```json
{
  "issue_identifiers": ["PROJ-1", "PROJ-2", "PROJ-3"],
  "options": {
    "cascade": true,        // Delete sub-issues
    "force": false,         // Force deletion despite blockers
    "dry_run": true,        // Preview without deleting
    "continue_on_error": true,
    "batch_size": 5
  }
}
```

### Cascade Deletion

When `cascade` is true (default), sub-issues are automatically deleted:

```
PROJ-1 (deleted)
  ├── PROJ-1a (deleted)
  └── PROJ-1b (deleted)
PROJ-2 (deleted)
```

### Example Response

```json
{
  "success": true,
  "totalRequested": 10,
  "successCount": 10,
  "failedCount": 0,
  "deletedCount": 15,  // Including sub-issues
  "batches": 2,
  "duration": 1200,
  "results": [
    {
      "issueIdentifier": "PROJ-1",
      "success": true,
      "deletedCount": 3,  // Parent + 2 sub-issues
      "deletedIssues": ["PROJ-1", "PROJ-1a", "PROJ-1b"]
    }
  ]
}
```

## Best Practices

### 1. Use Dry Run Mode

Always test bulk operations with dry run first:

```json
{
  "options": {
    "dry_run": true
  }
}
```

### 2. Batch Size Optimization

- Small batches (5-10): Better error isolation, more frequent progress updates
- Large batches (20-50): Better performance for simple operations
- Default (10): Good balance for most use cases

### 3. Error Handling Strategy

```json
{
  "options": {
    "continue_on_error": true  // Recommended for bulk operations
  }
}
```

### 4. Validation Before Deletion

Use the validation tool before bulk deletion:

```json
{
  "entity_type": "issue",
  "entity_identifier": "PROJ-123"
}
```

## Error Handling

### Common Errors

1. **Invalid Identifiers**
   - Error: "Invalid issue identifier at index X"
   - Solution: Ensure all identifiers match pattern "PROJ-123"

2. **Permission Errors**
   - Error: "Insufficient permissions to delete issue"
   - Solution: Check user permissions for the project

3. **Reference Errors**
   - Error: "Issue is referenced by other issues"
   - Solution: Use force option or resolve references first

### Error Response Format

```json
{
  "success": false,
  "error": "Bulk operation failed",
  "totalRequested": 100,
  "successCount": 75,
  "failedCount": 25,
  "failedIssues": [
    {
      "identifier": "PROJ-99",
      "error": "Issue not found"
    }
  ]
}
```

## Performance Considerations

### Large Operations (100+ items)

1. **Use appropriate batch sizes**
   ```json
   {
     "options": {
       "batch_size": 25  // Larger batches for simple operations
     }
   }
   ```

2. **Monitor progress**
   - Operations return batch progress information
   - Use smaller batches for better progress granularity

3. **Consider timeouts**
   - Very large operations may take several minutes
   - Plan for potential timeouts in automation

### Memory Usage

- Bulk operations load data in batches
- Memory usage scales with batch size, not total operation size
- Default batch sizes are optimized for typical server resources

### Rate Limiting

- The server implements internal rate limiting
- Batches include automatic delays to prevent overload
- No manual rate limiting needed in client code

## Examples

### Example 1: Sprint Planning

Create all issues for a new sprint:

```json
{
  "project_identifier": "PROJ",
  "defaults": {
    "milestone": "Sprint 15",
    "component": "Frontend"
  },
  "issues": [
    {
      "title": "Update dashboard UI",
      "priority": "high",
      "description": "Modernize dashboard components"
    },
    {
      "title": "Fix responsive layout",
      "priority": "medium"
    },
    {
      "title": "Add dark mode support",
      "priority": "low"
    }
  ]
}
```

### Example 2: Milestone Cleanup

Move all issues from old milestone to new one:

```json
{
  "updates": [
    {
      "issue_identifier": "PROJ-101",
      "field": "milestone",
      "value": "v2.1"
    },
    {
      "issue_identifier": "PROJ-102",
      "field": "milestone",
      "value": "v2.1"
    }
    // ... more issues
  ],
  "options": {
    "batch_size": 25,
    "continue_on_error": true
  }
}
```

### Example 3: Project Cleanup

Delete all completed issues older than 6 months:

```json
{
  "issue_identifiers": [
    "PROJ-1", "PROJ-2", "PROJ-3"
    // ... old completed issues
  ],
  "options": {
    "cascade": true,
    "dry_run": true,  // Always test first!
    "batch_size": 10
  }
}
```

## Troubleshooting

### Slow Performance

1. Increase batch size for simple operations
2. Check server logs for errors
3. Verify network connectivity

### Partial Failures

1. Review the results array for specific errors
2. Retry failed operations separately
3. Check for data inconsistencies

### Validation Errors

1. Use dry run mode to identify issues
2. Validate data format before submission
3. Check field value constraints

## See Also

- [API Reference](./api-reference.md) - Detailed API documentation
- [Templates Guide](./templates.md) - Using templates for bulk creation
- [Deletion Guide](./deletion-operations.md) - Safe deletion practices