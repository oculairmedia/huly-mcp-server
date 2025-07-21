# Huly Deletion Operations Comprehensive Guide

## Overview

This guide provides complete information about deletion operations in Huly, covering issues, projects, milestones, components, and modules. It includes cascade behaviors, permission requirements, and best practices for MCP server implementation.

## Core Deletion Mechanisms

### Basic Deletion Operations

```typescript
// Core deletion methods available in TxOperations
interface TxOperations {
  // Remove a standalone document
  removeDoc<T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    objectId: Ref<T>
  ): Promise<TxResult>

  // Remove a collection item (attached document)
  removeCollection<T extends Doc, P extends AttachedDoc>(
    _class: Ref<Class<P>>,
    space: Ref<Space>,
    objectId: Ref<P>,
    attachedTo: Ref<T>,
    attachedToClass: Ref<Class<T>>,
    collection: string
  ): Promise<TxResult>

  // Generic remove method (auto-detects document type)
  remove<T extends Doc>(doc: T): Promise<TxResult>
}
```

### Automatic Document Type Detection

```typescript
// The remove() method automatically chooses the correct deletion approach
async function smartDelete(client: TxOperations, doc: Doc): Promise<void> {
  if (client.getHierarchy().isDerived(doc._class, core.class.AttachedDoc)) {
    // Attached document - use removeCollection
    const adoc = doc as AttachedDoc
    await client.removeCollection(
      doc._class,
      doc.space,
      adoc._id,
      adoc.attachedTo,
      adoc.attachedToClass,
      adoc.collection
    )
  } else {
    // Standalone document - use removeDoc
    await client.removeDoc(doc._class, doc.space, doc._id)
  }
}
```

## Issue Deletion

### Single Issue Deletion

```typescript
// Delete an individual issue
async function deleteIssue(issueId: Ref<Issue>, projectSpace: Ref<Project>): Promise<void> {
  const client = getClient()
  
  // Get the issue to determine parent relationship
  const issue = await client.findOne(tracker.class.Issue, { _id: issueId })
  if (!issue) throw new Error('Issue not found')

  // Delete using removeCollection (issues are attached documents)
  await client.removeCollection(
    tracker.class.Issue,
    projectSpace,
    issueId,
    issue.attachedTo || tracker.ids.NoParent,
    tracker.class.Issue,
    'subIssues'
  )
}
```

### Cascade Deletion for Issues

```typescript
// When an issue is deleted, the following are automatically removed:
// 1. All sub-issues (recursive)
// 2. All comments and activity messages
// 3. All attachments and their blob storage
// 4. All time reports
// 5. All label references
// 6. All related documents references

// Example: Delete issue with confirmation and cascade handling
async function deleteIssueWithConfirmation(
  issues: Issue | Issue[]
): Promise<void> {
  const client = getClient()
  const issueArray = Array.isArray(issues) ? issues : [issues]
  
  // Count sub-issues for confirmation
  let totalSubIssues = 0
  for (const issue of issueArray) {
    const subIssues = await client.findAll(tracker.class.Issue, {
      attachedTo: issue._id
    })
    totalSubIssues += subIssues.length
  }

  // Show confirmation dialog
  showPopup(MessageBox, {
    label: tracker.string.DeleteIssue,
    message: tracker.string.DeleteIssueConfirm,
    params: {
      issueCount: issueArray.length,
      subIssueCount: totalSubIssues
    },
    action: async () => {
      // Delete all issues (cascade deletion handles sub-issues)
      await deleteObjects(client, issueArray as Doc[])
    }
  })
}
```

### Batch Issue Deletion

```typescript
// Delete multiple issues efficiently
async function deleteMultipleIssues(issueIds: Ref<Issue>[]): Promise<void> {
  const client = getClient()
  
  // Get all issues to delete
  const issues = await client.findAll(tracker.class.Issue, {
    _id: { $in: issueIds }
  })
  
  // Use batch deletion
  await deleteObjects(client, issues)
}

// The deleteObjects utility handles permission checks and batch operations
async function deleteObjects(client: TxOperations, objects: Doc[]): Promise<void> {
  for (const object of objects) {
    await deleteObject(client, object)
  }
}
```

## Project Deletion

### Project Deletion Process

```typescript
// Delete an entire project and all its data
async function deleteProject(project: Project): Promise<void> {
  const client = getClient()
  
  // Show confirmation dialog
  showPopup(MessageBox, {
    label: tracker.string.DeleteProject,
    message: tracker.string.DeleteProjectConfirm,
    params: { projectName: project.name },
    action: async () => {
      // Project deletion cascades to:
      // 1. All issues in the project
      // 2. All components
      // 3. All milestones  
      // 4. All templates
      // 5. All project-specific statuses
      // 6. All time reports
      // 7. All attachments and blobs
      
      await client.removeDoc(tracker.class.Project, project.space, project._id)
    }
  })
}
```

### Project Archiving vs Deletion

```typescript
// Archive project (soft delete - preserves data)
async function archiveProject(project: Project): Promise<void> {
  const client = getClient()
  
  await client.update(project, {
    archived: true
  })
}

// Restore archived project
async function restoreProject(project: Project): Promise<void> {
  const client = getClient()
  
  await client.update(project, {
    archived: false
  })
}

// Permanent deletion (hard delete - removes all data)
async function permanentlyDeleteProject(project: Project): Promise<void> {
  const client = getClient()
  
  // This will trigger cascade deletion of all project data
  await client.removeDoc(tracker.class.Project, project.space, project._id)
}
```

## Milestone Deletion

### Milestone Deletion with Issue Handling

```typescript
// Delete milestone with option to move issues
async function deleteMilestone(milestones: Milestone | Milestone[]): Promise<void> {
  const client = getClient()
  const milestoneArray = Array.isArray(milestones) ? milestones : [milestones]
  
  // Check if there are other milestones to move issues to
  const availableMilestone = await client.findOne(tracker.class.Milestone, {
    _id: { $nin: milestoneArray.map(m => m._id) }
  })
  
  if (availableMilestone) {
    // Show popup to select target milestone
    showPopup(MoveAndDeleteMilestonePopup, {
      milestones: milestoneArray,
      moveAndDeleteMilestone: async (targetMilestone?: Milestone) => {
        await moveAndDeleteMilestones(client, milestoneArray, targetMilestone)
      }
    })
  } else {
    // No other milestones available, delete directly
    await moveAndDeleteMilestones(client, milestoneArray)
  }
}

// Move issues and delete milestone
async function moveAndDeleteMilestones(
  client: TxOperations,
  oldMilestones: Milestone[],
  newMilestone?: Milestone
): Promise<void> {
  for (const oldMilestone of oldMilestones) {
    // Move all issues to new milestone (or remove milestone assignment)
    const success = await moveIssuesToAnotherMilestone(
      client, 
      oldMilestone, 
      newMilestone
    )
    
    if (success) {
      // Delete the milestone after moving issues
      await client.removeDoc(
        tracker.class.Milestone,
        oldMilestone.space,
        oldMilestone._id
      )
    }
  }
}

// Move issues between milestones
async function moveIssuesToAnotherMilestone(
  client: TxOperations,
  oldMilestone: Milestone,
  newMilestone?: Milestone
): Promise<boolean> {
  try {
    // Find all issues assigned to the old milestone
    const issues = await client.findAll(tracker.class.Issue, {
      milestone: oldMilestone._id
    })
    
    // Update all issues to new milestone (or null)
    const updates = issues.map(issue =>
      client.update(issue, {
        milestone: newMilestone?._id ?? null
      })
    )
    
    await Promise.all(updates)
    return true
  } catch (error) {
    console.error('Error moving issues to another milestone:', error)
    return false
  }
}
```

## Component Deletion

### Component Deletion Process

```typescript
// Delete a component
async function deleteComponent(component: Component): Promise<void> {
  const client = getClient()
  
  // Check for issues assigned to this component
  const assignedIssues = await client.findAll(tracker.class.Issue, {
    component: component._id
  })
  
  if (assignedIssues.length > 0) {
    // Show confirmation with issue count
    showPopup(MessageBox, {
      label: tracker.string.DeleteComponent,
      message: tracker.string.DeleteComponentConfirm,
      params: {
        componentName: component.label,
        issueCount: assignedIssues.length
      },
      action: async () => {
        // Remove component assignment from all issues
        const updates = assignedIssues.map(issue =>
          client.update(issue, { component: null })
        )
        await Promise.all(updates)
        
        // Delete the component
        await client.removeDoc(
          tracker.class.Component,
          component.space,
          component._id
        )
      }
    })
  } else {
    // No issues assigned, delete directly
    await client.removeDoc(
      tracker.class.Component,
      component.space,
      component._id
    )
  }
}
```

## Template Deletion

### Template Deletion

```typescript
// Delete issue template
async function deleteTemplate(template: IssueTemplate): Promise<void> {
  const client = getClient()
  
  // Templates can be deleted directly as they don't affect existing issues
  await client.removeDoc(
    tracker.class.IssueTemplate,
    template.space,
    template._id
  )
}
```

## Permission-Based Deletion

### Deletion Permission Checks

```typescript
// Check if user can delete an object
async function canDeleteObject(object: Doc): Promise<boolean> {
  const client = getClient()
  const currentAccount = getCurrentAccount()
  
  // Owner can always delete
  if (currentAccount.role === AccountRole.Owner) {
    return true
  }
  
  // Check if user created the object
  const socialStrings = await getAllSocialStringsByPersonRef(
    client,
    getCurrentEmployee()
  )
  
  return socialStrings.has(object.createdBy as PersonId)
}

// Safe deletion with permission check
async function safeDeleteObject(object: Doc): Promise<void> {
  const client = getClient()
  
  if (!(await canDeleteObject(object))) {
    throw new Error('Insufficient permissions to delete object')
  }
  
  await deleteObject(client, object)
}
```

## Soft Delete vs Hard Delete

### Soft Delete (Archiving)

```typescript
// Soft delete for projects (archiving)
async function softDeleteProject(project: Project): Promise<void> {
  const client = getClient()
  
  await client.update(project, {
    archived: true
  })
}

// Soft delete for training (state change)
async function softDeleteTraining(training: Training): Promise<void> {
  const client = getClient()
  
  await client.update(training, {
    state: TrainingState.Deleted
  })
}

// Soft delete for documents (state change)
async function softDeleteDocument(document: ControlledDocument): Promise<void> {
  const client = getClient()
  
  await client.update(document, {
    state: DocumentState.Deleted
  })
}
```

### Hard Delete (Permanent Removal)

```typescript
// Hard delete removes data permanently
async function hardDeleteObject(object: Doc): Promise<void> {
  const client = getClient()
  
  if (client.getHierarchy().isDerived(object._class, core.class.AttachedDoc)) {
    const adoc = object as AttachedDoc
    await client.removeCollection(
      object._class,
      object.space,
      adoc._id,
      adoc.attachedTo,
      adoc.attachedToClass,
      adoc.collection
    )
  } else {
    await client.removeDoc(object._class, object.space, object._id)
  }
}
```

## Workspace Deletion

### Complete Workspace Deletion

```typescript
// Delete entire workspace (server-side operation)
async function deleteWorkspace(workspaceUuid: string): Promise<void> {
  // This is typically a server-side operation
  // Deletes all data across all domains for the workspace
  
  const domains = ['tracker', 'contact', 'chunter', 'attachment', 'time']
  
  for (const domain of domains) {
    // Delete all documents in domain for this workspace
    await client.unsafe(
      `delete from ${domain} where "workspaceId" = $1::uuid`,
      [workspaceUuid]
    )
  }
}
```

## Cascade Deletion Triggers

### Automatic Cleanup on Deletion

```typescript
// Server-side triggers handle cascade deletion
// When a document is deleted, triggers automatically:

// 1. Delete collaborative documents and blobs
export async function OnDelete(
  txes: Tx[],
  { hierarchy, storageAdapter, removedMap }: TriggerControl
): Promise<Tx[]> {
  const deleteTxes = txes.filter(tx => tx._class === core.class.TxRemoveDoc)
  
  for (const rmTx of deleteTxes) {
    const doc = removedMap.get(rmTx.objectId)
    if (!doc) continue
    
    // Find collaborative document attributes
    const attributes = hierarchy.getAllAttributes(rmTx.objectClass)
    const toDelete: CollaborativeDoc[] = []
    
    for (const attribute of attributes.values()) {
      if (hierarchy.isDerived(attribute.type._class, core.class.TypeCollaborativeDoc)) {
        toDelete.push(makeCollabId(doc._class, doc._id, attribute.name))
      }
    }
    
    // Delete collaborative documents from storage
    for (const collabDoc of toDelete) {
      await storageAdapter.remove(ctx, workspace, [collabDoc])
    }
  }
  
  return []
}
```

## Best Practices for MCP Implementation

### 1. Always Check Permissions
```typescript
// Verify user has permission to delete
const canDelete = await canDeleteObject(object)
if (!canDelete) {
  throw new Error('Insufficient permissions')
}
```

### 2. Use Confirmation Dialogs
```typescript
// Show confirmation for destructive operations
showPopup(MessageBox, {
  label: 'Delete Confirmation',
  message: 'This action cannot be undone',
  action: async () => {
    await deleteObject(client, object)
  }
})
```

### 3. Handle Cascade Effects
```typescript
// Consider what will be deleted automatically
const subIssues = await client.findAll(tracker.class.Issue, {
  attachedTo: issueId
})
// Inform user about cascade deletion
```

### 4. Use Batch Operations
```typescript
// For multiple deletions, use batch operations
const tx = client.apply()
for (const object of objects) {
  await tx.remove(object)
}
await tx.commit()
```

### 5. Prefer Soft Delete When Possible
```typescript
// Use archiving/state changes instead of permanent deletion
await client.update(object, { archived: true })
// vs
await client.removeDoc(object._class, object.space, object._id)
```

This comprehensive guide provides all the deletion mechanisms needed for implementing complete object lifecycle management in your MCP server.
