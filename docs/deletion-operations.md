# Deletion Operations Guide

This guide covers safe deletion practices in the Huly MCP Server, including validation, cascade deletion, and impact analysis.

## Table of Contents

- [Overview](#overview)
- [Deletion Concepts](#deletion-concepts)
- [Available Deletion Tools](#available-deletion-tools)
- [Validation and Safety](#validation-and-safety)
- [Individual Deletions](#individual-deletions)
- [Bulk Deletions](#bulk-deletions)
- [Best Practices](#best-practices)
- [Recovery and Rollback](#recovery-and-rollback)

## Overview

The Huly MCP Server provides comprehensive deletion capabilities with built-in safety features:

- **Validation**: Check if entities can be safely deleted
- **Impact Preview**: See what will be affected before deletion
- **Cascade Options**: Control deletion of related entities
- **Dry Run Mode**: Test deletions without executing
- **Force Deletion**: Override safety checks when necessary
- **Bulk Operations**: Delete multiple entities efficiently

## Deletion Concepts

### Cascade Deletion

When deleting parent entities, child entities can be automatically deleted:

```
Project (deleted)
├── Issues (deleted)
│   ├── Sub-issues (deleted)
│   ├── Comments (deleted)
│   └── Attachments (deleted)
├── Components (deleted)
├── Milestones (deleted)
└── Templates (deleted)
```

### Soft vs Hard Deletion

- **Soft Delete (Archive)**: Entity is hidden but data preserved
- **Hard Delete**: Entity and all data permanently removed

### Blockers and Warnings

- **Blockers**: Prevent deletion (e.g., active integrations)
- **Warnings**: Allow deletion but indicate impact (e.g., sub-issues)

## Available Deletion Tools

### Validation Tools

| Tool | Description |
|------|-------------|
| `huly_validate_deletion` | Check if an entity can be deleted |
| `huly_deletion_impact_preview` | Preview full deletion impact |

### Deletion Tools

| Tool | Description |
|------|-------------|
| `huly_delete_issue` | Delete single issue with options |
| `huly_bulk_delete_issues` | Delete multiple issues |
| `huly_delete_project` | Delete entire project |
| `huly_archive_project` | Soft delete (archive) project |
| `huly_delete_component` | Delete component |
| `huly_delete_milestone` | Delete milestone |

## Validation and Safety

### Validate Before Deleting

Always validate deletions before executing:

```json
{
  "entity_type": "issue",
  "entity_identifier": "PROJ-123"
}
```

Response indicates:
- Can delete (yes/no)
- Blockers preventing deletion
- Warnings about impact
- Dependencies affected

### Preview Deletion Impact

Get detailed impact analysis:

```json
{
  "entity_type": "project",
  "entity_identifier": "PROJ",
  "detailed": true
}
```

Shows:
- Direct impact (primary entity)
- Cascade impact (related entities)
- Total entities affected
- Detailed breakdown by type

## Individual Deletions

### Delete Issue

Basic issue deletion:

```json
{
  "issue_identifier": "PROJ-123"
}
```

With options:

```json
{
  "issue_identifier": "PROJ-123",
  "cascade": true,      // Delete sub-issues (default: true)
  "force": false,       // Override blockers (default: false)
  "dry_run": false      // Preview only (default: false)
}
```

### Delete Project

**⚠️ Warning**: This permanently deletes ALL project data!

```json
{
  "project_identifier": "PROJ",
  "force": false,
  "dry_run": true  // Always test first!
}
```

Project deletion removes:
- All issues and sub-issues
- All components
- All milestones  
- All templates
- All comments and attachments

### Archive Project

Soft delete that preserves data:

```json
{
  "project_identifier": "PROJ"
}
```

Archived projects:
- Are hidden from active views
- Can be restored later
- Preserve all data and relationships

### Delete Component

```json
{
  "project_identifier": "PROJ",
  "component_label": "Backend",
  "force": false,
  "dry_run": false
}
```

Effects:
- Component is removed
- Issues using this component have it cleared
- No issues are deleted

### Delete Milestone

```json
{
  "project_identifier": "PROJ",
  "milestone_label": "v1.0",
  "force": false,
  "dry_run": false
}
```

Effects:
- Milestone is removed
- Issues using this milestone have it cleared
- No issues are deleted

## Bulk Deletions

### Bulk Delete Issues

Delete multiple issues efficiently:

```json
{
  "issue_identifiers": ["PROJ-1", "PROJ-2", "PROJ-3"],
  "options": {
    "cascade": true,
    "force": false,
    "dry_run": false,
    "continue_on_error": true,
    "batch_size": 10
  }
}
```

Features:
- Process in batches for performance
- Continue on individual failures
- Cascade to sub-issues
- Progress tracking

### Example: Cleanup Old Issues

Delete all completed issues older than 6 months:

```javascript
// First, search for old completed issues
const oldIssues = await searchIssues({
  status: "done",
  modified_before: sixMonthsAgo
});

// Validate impact
const identifiers = oldIssues.map(i => i.identifier);
await bulkDeleteIssues({
  issue_identifiers: identifiers,
  options: {
    dry_run: true  // Preview first!
  }
});

// If satisfied, execute deletion
await bulkDeleteIssues({
  issue_identifiers: identifiers,
  options: {
    cascade: true,
    batch_size: 25
  }
});
```

## Best Practices

### 1. Always Validate First

```javascript
// ❌ Bad: Direct deletion
await deleteIssue("PROJ-123");

// ✅ Good: Validate first
const validation = await validateDeletion({
  entity_type: "issue",
  entity_identifier: "PROJ-123"
});

if (validation.canDelete) {
  await deleteIssue("PROJ-123");
}
```

### 2. Use Dry Run Mode

Test complex deletions:

```json
{
  "project_identifier": "PROJ",
  "dry_run": true
}
```

### 3. Handle Cascade Carefully

Understand cascade behavior:

- Issues → Sub-issues, Comments, Attachments
- Projects → Everything in project
- Components/Milestones → Only clear references

### 4. Batch Large Deletions

For 50+ items, use bulk operations:

```json
{
  "issue_identifiers": [...],
  "options": {
    "batch_size": 25,
    "continue_on_error": true
  }
}
```

### 5. Document Deletions

Keep audit trail:
- Why deleted
- Who authorized
- What was affected

### 6. Implement Retention Policies

- Define retention periods
- Automate cleanup
- Archive before deleting

## Recovery and Rollback

### Prevention

1. **Regular Backups**: Maintain database backups
2. **Archive First**: Use soft delete when possible
3. **Test Thoroughly**: Use dry run mode
4. **Restrict Permissions**: Limit who can delete

### Recovery Options

1. **From Archive**: Restore soft-deleted items
2. **From Backup**: Restore database backup
3. **Recreate**: Manually recreate if needed

### Cannot Be Recovered

Once hard-deleted:
- Issue content and history
- Comments and attachments
- Component/milestone definitions
- Template structures

## Common Scenarios

### Scenario 1: Project Cleanup

Clean up abandoned project:

```javascript
// 1. Validate project can be deleted
const validation = await validateDeletion({
  entity_type: "project",
  entity_identifier: "OLD-PROJ"
});

// 2. Preview impact
const impact = await deletionImpactPreview({
  entity_type: "project",
  entity_identifier: "OLD-PROJ",
  detailed: true
});

// 3. Archive first (soft delete)
await archiveProject({
  project_identifier: "OLD-PROJ"
});

// 4. Later, if certain, hard delete
await deleteProject({
  project_identifier: "OLD-PROJ",
  force: true
});
```

### Scenario 2: Issue Housekeeping

Remove resolved issues:

```javascript
// Find old resolved issues
const resolved = await searchIssues({
  status: "done",
  modified_before: "2024-01-01"
});

// Bulk delete with validation
await bulkDeleteIssues({
  issue_identifiers: resolved.map(i => i.identifier),
  options: {
    dry_run: true  // Test first
  }
});
```

### Scenario 3: Component Reorganization

Merge components:

```javascript
// 1. Update issues to new component
await bulkUpdateIssues({
  updates: affectedIssues.map(issue => ({
    issue_identifier: issue.identifier,
    field: "component",
    value: "NewComponent"
  }))
});

// 2. Delete old component
await deleteComponent({
  project_identifier: "PROJ",
  component_label: "OldComponent"
});
```

## Error Handling

### Common Errors

1. **Entity Not Found**
   ```
   Error: Issue not found: PROJ-999
   ```
   - Verify identifier is correct
   - Check if already deleted

2. **Permission Denied**
   ```
   Error: Insufficient permissions to delete project
   ```
   - Check user permissions
   - May need admin access

3. **Deletion Blocked**
   ```
   Error: Cannot delete: Project has active integrations
   ```
   - Resolve blockers first
   - Or use force option

4. **Cascade Failure**
   ```
   Error: Failed to delete sub-issue PROJ-123
   ```
   - Check sub-issue blockers
   - May need individual handling

### Error Recovery

```javascript
try {
  await bulkDeleteIssues({
    issue_identifiers: [...],
    options: {
      continue_on_error: true
    }
  });
} catch (error) {
  // Check partial results
  console.log(error.results);
  
  // Retry failed items
  const failed = error.results
    .filter(r => !r.success)
    .map(r => r.issueIdentifier);
    
  // Handle failed items individually
}
```

## API Reference

For detailed API information, see:
- [DeletionService](../src/services/DeletionService.js)
- [Delete Issue Tool](../src/tools/issues/deleteIssue.js)
- [Bulk Delete Tool](../src/tools/issues/bulkDeleteIssues.js)
- [Validation Tool](../src/tools/validation/validateDeletion.js)

## Safety Checklist

Before major deletions:

- [ ] Backup data
- [ ] Validate deletion allowed
- [ ] Preview impact
- [ ] Test with dry run
- [ ] Get authorization
- [ ] Document reason
- [ ] Execute deletion
- [ ] Verify completion
- [ ] Update documentation