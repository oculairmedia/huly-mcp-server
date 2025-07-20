# Huly Issue Manipulation Comprehensive Guide

## Overview

This guide provides concrete, actionable information for manipulating issues in Huly, covering all CRUD operations, relationships, status management, and advanced features needed for MCP server implementation.

## Issue Structure and Types

### Complete Issue Interface

```typescript
interface Issue extends Task {
  // Core identification
  _id: Ref<Issue>
  _class: 'tracker:class:Issue'
  space: Ref<Project>                    // Project this issue belongs to
  number: number                         // Auto-generated issue number
  identifier: string                     // Human-readable ID (e.g., "PROJ-123")

  // Basic properties
  title: string
  description: MarkupBlobRef | null      // Rich text description
  status: Ref<IssueStatus>
  priority: IssuePriority                // Enum: 0-4
  assignee: Ref<Person> | null

  // Organization
  component: Ref<Component> | null
  milestone: Ref<Milestone> | null
  dueDate: Timestamp | null

  // Hierarchy and relationships
  attachedTo: Ref<Issue>                 // Parent issue (for sub-issues)
  subIssues: number                      // Count of child issues
  blockedBy?: RelatedDocument[]          // Issues blocking this one
  relations?: RelatedDocument[]          // Related issues/documents
  parents: IssueParentInfo[]             // Parent chain info
  childInfo: IssueChildInfo[]            // Child issue summaries

  // Time tracking
  estimation: number                     // Estimated hours
  remainingTime: number                  // Remaining hours (auto-calculated)
  reportedTime: number                   // Actual time spent (auto-calculated)
  reports: number                        // Count of time reports

  // Collections (auto-maintained counters)
  comments: number                       // Comment count
  attachments: number                    // Attachment count
  labels: number                         // Label count

  // Metadata
  createdBy: PersonId
  createdOn: Timestamp
  modifiedBy: PersonId
  modifiedOn: Timestamp
}
```

## Detailed Model Definitions

### Issue Model (TIssue)

```typescript
@Model(tracker.class.Issue, task.class.Task)
@UX(tracker.string.Issue, tracker.icon.Issue, 'TSK', 'title', undefined, tracker.string.Issues)
export class TIssue extends TTask implements Issue {
  // Parent issue reference (for sub-issues)
  @Prop(TypeRef(tracker.class.Issue), tracker.string.Parent)
  declare attachedTo: Ref<Issue>

  // Issue title with full-text search
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
    title!: string

  // Rich text description stored as collaborative document
  @Prop(TypeCollaborativeDoc(), tracker.string.Description)
  @Index(IndexKind.FullText)
    description!: MarkupBlobRef | null

  // Status with custom icon component
  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.Status, {
    _id: tracker.attribute.IssueStatus,
    iconComponent: tracker.activity.StatusIcon
  })
  @Index(IndexKind.Indexed)
  declare status: Ref<IssueStatus>

  // Priority with custom icon component
  @Prop(TypeIssuePriority(), tracker.string.Priority, {
    iconComponent: tracker.activity.PriorityIcon
  })
  @Index(IndexKind.Indexed)
    priority!: IssuePriority

  // Auto-generated issue number (read-only)
  @Prop(TypeNumber(), tracker.string.Number)
  @Index(IndexKind.FullText)
  @ReadOnly()
  declare number: number

  // Assignee reference
  @Prop(TypeRef(contact.class.Person), tracker.string.Assignee)
  @Index(IndexKind.Indexed)
  declare assignee: Ref<Person> | null

  // Component assignment
  @Prop(TypeRef(tracker.class.Component), tracker.string.Component, { icon: tracker.icon.Component })
  @Index(IndexKind.Indexed)
    component!: Ref<Component> | null

  // Sub-issues collection counter
  @Prop(Collection(tracker.class.Issue), tracker.string.SubIssues)
    subIssues!: number

  // Labels collection counter
  @Prop(Collection(tags.class.TagReference), tracker.string.Labels)
  declare labels: number

  // Project space (read-only)
  @Prop(TypeRef(tracker.class.Project), tracker.string.Project, { icon: tracker.icon.Issues })
  @Index(IndexKind.Indexed)
  @ReadOnly()
  declare space: Ref<Project>

  // Due date
  @Prop(TypeDate(DateRangeMode.DATETIME), tracker.string.DueDate)
  declare dueDate: Timestamp | null

  // Milestone assignment
  @Prop(TypeRef(tracker.class.Milestone), tracker.string.Milestone, { icon: tracker.icon.Milestone })
  @Index(IndexKind.Indexed)
    milestone!: Ref<Milestone> | null

  // Time estimation
  @Prop(TypeEstimation(), tracker.string.Estimation)
    estimation!: number

  // Reported time (auto-calculated by triggers)
  @Prop(TypeReportedTime(), tracker.string.ReportedTime)
    reportedTime!: number

  // Remaining time (auto-calculated, read-only)
  @Prop(TypeRemainingTime(), tracker.string.RemainingTime)
  @ReadOnly()
    remainingTime!: number

  // Time reports collection counter
  @Prop(Collection(tracker.class.TimeSpendReport), tracker.string.TimeSpendReports)
    reports!: number

  // Action items collection
  @Prop(Collection(time.class.ToDo), getEmbeddedLabel('Action Items'))
    todos?: CollectionSize<ToDo>

  // Parent and child info arrays (not decorated - computed fields)
  declare childInfo: IssueChildInfo[]
  parents!: IssueParentInfo[]
}
```

### Project Model (TProject)

```typescript
@Model(tracker.class.Project, task.class.Project)
@UX(tracker.string.Project, tracker.icon.Issues, 'Project', 'name')
export class TProject extends TTaskProject implements Project {
  // Project identifier (e.g., "PROJ", "ALPHA")
  @Prop(TypeString(), tracker.string.ProjectIdentifier)
  @Index(IndexKind.FullText)
    identifier!: IntlString

  // Issue numbering sequence (hidden from UI)
  @Prop(TypeNumber(), tracker.string.Number)
  @Hidden()
    sequence!: number

  // Default status for new issues
  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.DefaultIssueStatus)
    defaultIssueStatus!: Ref<IssueStatus>

  // Default assignee for new issues
  @Prop(TypeRef(contact.mixin.Employee), tracker.string.DefaultAssignee)
    defaultAssignee!: Ref<Employee>

  // Time reporting configuration
  declare defaultTimeReportDay: TimeReportDayType

  // Related issue targets collection
  @Prop(Collection(tracker.class.RelatedIssueTarget), tracker.string.RelatedIssues)
    relatedIssueTargets!: number
}
```

### Component Model (TComponent)

```typescript
@Model(tracker.class.Component, core.class.Doc, DOMAIN_TRACKER)
@UX(tracker.string.Component, tracker.icon.Component, 'COMPONENT', 'label', undefined, tracker.string.Components)
export class TComponent extends TDoc implements Component {
  // Component name
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
    label!: string

  // Component description
  @Prop(TypeMarkup(), tracker.string.Description)
    description?: Markup

  // Component lead/owner
  @Prop(TypeRef(contact.mixin.Employee), tracker.string.ComponentLead)
    lead!: Ref<Employee> | null

  // Comments collection counter
  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments!: number

  // Attachments collection counter
  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, { shortLabel: attachment.string.Files })
    attachments?: number

  // Project space
  declare space: Ref<Project>
}
```

### Milestone Model (TMilestone)

```typescript
@Model(tracker.class.Milestone, core.class.Doc, DOMAIN_TRACKER)
@UX(tracker.string.Milestone, tracker.icon.Milestone, '', 'label', undefined, tracker.string.Milestones)
export class TMilestone extends TDoc implements Milestone {
  // Milestone name
  @Prop(TypeString(), tracker.string.Title)
    label!: string

  // Milestone description
  @Prop(TypeMarkup(), tracker.string.Description)
    description?: Markup

  // Milestone status
  @Prop(TypeMilestoneStatus(), tracker.string.Status)
  @Index(IndexKind.Indexed)
    status!: MilestoneStatus

  // Comments collection counter
  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments!: number

  // Attachments collection counter
  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, { shortLabel: attachment.string.Files })
    attachments?: number

  // Target completion date
  targetDate!: Timestamp

  // Project space
  declare space: Ref<Project>
}
```

### Issue Status Model (TIssueStatus)

```typescript
@Model(tracker.class.IssueStatus, core.class.Status)
@UX(tracker.string.IssueStatus, undefined, undefined, 'rank', 'name')
export class TIssueStatus extends TStatus implements IssueStatus {
  // Inherits from TStatus:

  // Status category (UnStarted, ToDo, Active, Won, Lost)
  @Prop(TypeRef(core.class.StatusCategory), core.string.StatusCategory)
    category?: Ref<StatusCategory>

  // Status name
  @Prop(TypeString(), core.string.Name)
    name!: string

  // Status color
  color!: number

  // Status description
  @Prop(TypeString(), core.string.Description)
    description!: string

  // Status rank for ordering
  rank!: Rank

  // Attribute this status applies to
  ofAttribute!: Ref<Attribute<Status>>
}
```

### Time Spend Report Model (TTimeSpendReport)

```typescript
@Model(tracker.class.TimeSpendReport, core.class.AttachedDoc, DOMAIN_TRACKER)
export class TTimeSpendReport extends TAttachedDoc implements TimeSpendReport {
  // Issue this report is attached to
  declare attachedTo: Ref<Issue>
  declare attachedToClass: Ref<Class<Issue>>

  // Employee who spent the time
  @Prop(TypeRef(contact.mixin.Employee), tracker.string.Employee)
    employee!: Ref<Employee> | null

  // Date of work
  @Prop(TypeDate(), tracker.string.Date)
    date!: Timestamp | null

  // Hours spent
  @Prop(TypeNumber(), tracker.string.Value)
    value!: number

  // Work description
  @Prop(TypeString(), tracker.string.Description)
    description!: string
}
```

### Type Definitions

```typescript
// Priority type definition
export function TypeIssuePriority(): Type<IssuePriority> {
  return { _class: tracker.class.TypeIssuePriority, label: tracker.string.TypeIssuePriority }
}

@Model(tracker.class.TypeIssuePriority, core.class.Type, DOMAIN_MODEL)
export class TTypeIssuePriority extends TType {}

// Estimation type (hours)
export function TypeEstimation(): Type<number> {
  return { _class: tracker.class.TypeEstimation, label: tracker.string.Estimation }
}

// Reported time type (auto-calculated hours)
export function TypeReportedTime(): Type<number> {
  return { _class: tracker.class.TypeReportedTime, label: tracker.string.ReportedTime }
}

// Remaining time type (auto-calculated hours)
export function TypeRemainingTime(): Type<number> {
  return { _class: tracker.class.TypeRemainingTime, label: tracker.string.RemainingTime }
}

// Milestone status type
export function TypeMilestoneStatus(): Type<MilestoneStatus> {
  return { _class: tracker.class.TypeMilestoneStatus, label: tracker.string.MilestoneStatus }
}
```

### Priority System

```typescript
enum IssuePriority {
  NoPriority = 0,    // No priority set
  Urgent = 1,        // Urgent priority (highest)
  High = 2,          // High priority
  Medium = 3,        // Medium priority
  Low = 4            // Low priority (lowest)
}

// Priority display information
const priorityInfo = {
  [IssuePriority.NoPriority]: { label: 'No Priority', icon: 'priority-none' },
  [IssuePriority.Urgent]: { label: 'Urgent', icon: 'priority-urgent' },
  [IssuePriority.High]: { label: 'High', icon: 'priority-high' },
  [IssuePriority.Medium]: { label: 'Medium', icon: 'priority-medium' },
  [IssuePriority.Low]: { label: 'Low', icon: 'priority-low' }
}

// Default priority ordering (for sorting)
const defaultPriorities = [
  IssuePriority.NoPriority,
  IssuePriority.Low,
  IssuePriority.Medium,
  IssuePriority.High,
  IssuePriority.Urgent
]
```

### Milestone Status System

```typescript
enum MilestoneStatus {
  Planned = 0,      // Milestone is planned
  InProgress = 1,   // Milestone is in progress
  Completed = 2,    // Milestone is completed
  Canceled = 3      // Milestone is canceled
}
```

### Key Decorators and Constraints

```typescript
// Property decorators
@Prop(type, label, options?)          // Define a property
@Index(IndexKind.FullText)           // Full-text search index
@Index(IndexKind.Indexed)            // Regular index for queries
@ReadOnly()                          // Property cannot be modified
@Hidden()                            // Property hidden from UI

// Collection decorators
@Prop(Collection(class), label)      // Auto-maintained collection counter
@Prop(TypeRef(class), label)         // Reference to another document
@Prop(TypeString(), label)           // String property
@Prop(TypeNumber(), label)           // Number property
@Prop(TypeDate(), label)             // Date/timestamp property
@Prop(TypeMarkup(), label)           // Direct markup storage
@Prop(TypeCollaborativeDoc(), label) // Collaborative document reference

// Model decorators
@Model(class, extends, domain?)      // Define model class
@UX(label, icon, identifier?, ...)  // UI configuration
```

### Domain and Storage

```typescript
// Domain definition for tracker objects
export const DOMAIN_TRACKER = 'tracker' as Domain

// All tracker objects are stored in the tracker domain:
// - Issues, Projects, Components, Milestones
// - TimeSpendReports, IssueTemplates
// - IssueStatus objects
```

### Class Hierarchy and Inheritance

```typescript
// Core inheritance chain
core.class.Obj                          // Root object
├── core.class.Doc                      // Base document
    ├── core.class.AttachedDoc          // Documents attached to others
    │   ├── tracker.class.TimeSpendReport
    │   └── activity.class.ActivityMessage
    ├── core.class.Space               // Workspace containers
    │   └── task.class.Project
    │       └── tracker.class.Project
    ├── core.class.Status              // Status definitions
    │   └── tracker.class.IssueStatus
    └── task.class.Task                 // Base task
        └── tracker.class.Issue

// Key relationships:
// - Issue extends Task (inherits assignee, dueDate, etc.)
// - Project extends TaskProject extends Space
// - IssueStatus extends Status (inherits category, rank, etc.)
// - TimeSpendReport extends AttachedDoc (attached to Issues)
```

### Field Inheritance from Task

```typescript
// Issue inherits these fields from Task:
interface Task extends AttachedDoc {
  assignee?: Ref<Person> | null         // Task assignee
  dueDate?: Timestamp | null            // Due date
  rank: Rank                            // Ordering rank
  kind: Ref<TaskType>                   // Task type

  // Collections inherited:
  comments: number                      // From task.class.Task
  attachments: number                   // From task.class.Task
}

// Issue inherits these fields from AttachedDoc:
interface AttachedDoc extends Doc {
  attachedTo: Ref<Doc>                  // Parent document
  attachedToClass: Ref<Class<Doc>>      // Parent document class
  collection: string                    // Collection name
}

// Issue inherits these fields from Doc:
interface Doc extends Obj {
  _id: Ref<this>                        // Document ID
  _class: Ref<Class<this>>              // Document class
  space: Ref<Space>                     // Workspace/project
  modifiedOn: Timestamp                 // Last modified time
  modifiedBy: Ref<Account>              // Last modified by
  createdOn?: Timestamp                 // Creation time
  createdBy?: Ref<Account>              // Created by
}
```

### Collection Mechanics

```typescript
// Collection counters are automatically maintained
// When you use addCollection/removeCollection:

// 1. Document is created/deleted
await client.addCollection(
  tracker.class.TimeSpendReport,
  projectSpace,
  issueId,                              // attachedTo
  tracker.class.Issue,                  // attachedToClass
  'reports',                            // collection name
  reportData
)

// 2. Parent document counter is automatically incremented
// issue.reports += 1

// 3. Triggers may fire for additional calculations
// For TimeSpendReport: issue.reportedTime += report.value

// Collection decorators define this behavior:
@Prop(Collection(tracker.class.TimeSpendReport), tracker.string.TimeSpendReports)
  reports!: number  // Auto-maintained counter

// The Collection() decorator tells the system:
// - What class of documents can be in this collection
// - To maintain a counter field
// - To update the counter on add/remove operations
```

## Issue CRUD Operations

### Creating Issues

#### Basic Issue Creation

```typescript
// Create a new issue with minimal required fields
const issueId = await client.addCollection(
  tracker.class.Issue,
  projectSpace,
  parentIssueId || tracker.ids.NoParent,  // Parent issue or NoParent
  tracker.class.Issue,
  'subIssues',
  {
    title: 'Fix critical bug in authentication',
    status: defaultStatusId,                // Get from project.defaultIssueStatus
    priority: IssuePriority.High,
    assignee: employeeId,
    estimation: 8,                          // 8 hours
    remainingTime: 8,
    component: componentId,
    milestone: milestoneId,
    dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000  // Due in 7 days
  }
)
```

#### Issue with Rich Description

```typescript
// Create issue with rich text description
const descriptionRef = await client.uploadMarkup(
  tracker.class.Issue,
  issueId,
  'description',
  '# Bug Description\n\nThe authentication system fails when...',
  'markdown'
)

const issueId = await client.addCollection(
  tracker.class.Issue,
  projectSpace,
  tracker.ids.NoParent,
  tracker.class.Issue,
  'subIssues',
  {
    title: 'Authentication Bug',
    description: descriptionRef,
    status: statusId,
    priority: IssuePriority.Urgent,
    // ... other fields
  }
)
```

#### Sub-issue Creation

```typescript
// Create a sub-issue attached to a parent
const subIssueId = await client.addCollection(
  tracker.class.Issue,
  projectSpace,
  parentIssueId,                          // Parent issue ID
  tracker.class.Issue,
  'subIssues',
  {
    title: 'Implement OAuth integration',
    status: statusId,
    priority: IssuePriority.Medium,
    assignee: developerId,
    estimation: 4
  }
)
```

### Reading Issues

#### Get Single Issue

```typescript
// Get issue with all related data
const issue = await client.findOne(
  tracker.class.Issue,
  { _id: issueId },
  {
    lookup: {
      assignee: contact.mixin.Employee,
      status: tracker.class.IssueStatus,
      component: tracker.class.Component,
      milestone: tracker.class.Milestone,
      space: tracker.class.Project
    }
  }
)

// Access looked up data
const assigneeName = issue.$lookup?.assignee?.name
const statusName = issue.$lookup?.status?.name
const projectName = issue.$lookup?.space?.name
```

#### Query Issues with Filters

```typescript
// Get issues by various criteria
const issues = await client.findAll(
  tracker.class.Issue,
  {
    space: projectId,
    status: { $in: activeStatusIds },
    priority: { $gte: IssuePriority.Medium },
    assignee: { $ne: null },
    dueDate: { $lt: Date.now() + 7 * 24 * 60 * 60 * 1000 }  // Due within 7 days
  },
  {
    sort: { 
      priority: SortingOrder.Ascending,    // Urgent first (lower number = higher priority)
      dueDate: SortingOrder.Ascending 
    },
    lookup: {
      assignee: contact.mixin.Employee,
      status: tracker.class.IssueStatus
    }
  }
)
```

#### Get Issue Hierarchy

```typescript
// Get parent issues
const parentIssues = await client.findAll(
  tracker.class.Issue,
  {
    _id: { $in: issue.parents.map(p => p.parentId) }
  }
)

// Get child issues
const childIssues = await client.findAll(
  tracker.class.Issue,
  {
    attachedTo: issueId
  },
  {
    sort: { number: SortingOrder.Ascending }
  }
)
```

### Updating Issues

#### Basic Field Updates

```typescript
// Update issue properties
await client.update(issue, {
  title: 'Updated issue title',
  priority: IssuePriority.Urgent,
  assignee: newAssigneeId,
  dueDate: newDueDate,
  estimation: 12,
  remainingTime: 8
})
```

#### Status Transitions

```typescript
// Change issue status with validation
const newStatus = await client.findOne(tracker.class.IssueStatus, {
  _id: newStatusId
})

if (newStatus && isValidStatusTransition(currentStatus, newStatus)) {
  await client.update(issue, {
    status: newStatusId
  })
}

// Helper function for status validation
function isValidStatusTransition(from: IssueStatus, to: IssueStatus): boolean {
  // Implement your workflow rules here
  // Example: Can't go from Done back to Todo without going through In Progress
  return true  // Simplified for example
}
```

#### Component and Milestone Assignment

```typescript
// Assign to component
await client.update(issue, {
  component: componentId
})

// Assign to milestone
await client.update(issue, {
  milestone: milestoneId
})

// Remove from milestone
await client.update(issue, {
  milestone: null
})
```

#### Description Updates

```typescript
// Update rich text description
const newDescriptionRef = await client.uploadMarkup(
  tracker.class.Issue,
  issueId,
  'description',
  '# Updated Description\n\nNew content here...',
  'markdown'
)

await client.update(issue, {
  description: newDescriptionRef
})
```

### Deleting Issues

```typescript
// Delete an issue (this also removes all sub-issues, comments, attachments)
await client.removeCollection(
  tracker.class.Issue,
  projectSpace,
  issueId,
  parentIssueId || tracker.ids.NoParent,
  tracker.class.Issue,
  'subIssues'
)
```

## Issue Relationships

### Parent-Child Relationships

```typescript
// Move issue to different parent
await client.update(issue, {
  attachedTo: newParentId
})

// Create issue hierarchy info
const parentInfo: IssueParentInfo = {
  parentId: parentIssue._id,
  identifier: parentIssue.identifier,
  parentTitle: parentIssue.title,
  space: parentIssue.space
}

await client.update(childIssue, {
  parents: [...childIssue.parents, parentInfo]
})
```

### Issue Blocking and Relations

```typescript
// Add blocking relationship
await client.update(issue, {
  $push: {
    blockedBy: {
      _id: blockingIssueId,
      _class: tracker.class.Issue
    }
  }
})

// Remove blocking relationship
await client.update(issue, {
  $pull: {
    blockedBy: { _id: blockingIssueId }
  }
})

// Add general relation
await client.update(issue, {
  $push: {
    relations: {
      _id: relatedDocId,
      _class: relatedDocClass
    }
  }
})
```

## Time Tracking

### Time Estimation and Reporting

```typescript
// Update time estimates
await client.update(issue, {
  estimation: 16,        // 16 hours estimated
  remainingTime: 12      // 12 hours remaining
})

// Add time report
const timeReportId = await client.addCollection(
  tracker.class.TimeSpendReport,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'reports',
  {
    employee: employeeId,
    date: Date.now(),
    value: 4,              // 4 hours spent
    description: 'Implemented authentication logic'
  }
)

// The reportedTime field is automatically updated by triggers
// remainingTime is automatically recalculated as: estimation - reportedTime
```

### Query Time Reports

```typescript
// Get all time reports for an issue
const timeReports = await client.findAll(
  tracker.class.TimeSpendReport,
  {
    attachedTo: issueId
  },
  {
    sort: { date: SortingOrder.Descending },
    lookup: {
      employee: contact.mixin.Employee
    }
  }
)

// Calculate total time by employee
const timeByEmployee = timeReports.reduce((acc, report) => {
  const employeeId = report.employee
  acc[employeeId] = (acc[employeeId] || 0) + report.value
  return acc
}, {} as Record<string, number>)
```

## Labels and Tags

### Label Management

```typescript
// Add label to issue
const labelId = await client.addCollection(
  tags.class.TagReference,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'labels',
  {
    title: 'bug',
    color: 0xff0000,  // Red color
    tag: tagElementId
  }
)

// Remove label
await client.removeCollection(
  tags.class.TagReference,
  projectSpace,
  labelId,
  issueId,
  tracker.class.Issue,
  'labels'
)

// Query issues by label
const bugIssues = await client.findAll(
  tracker.class.Issue,
  {
    space: projectId,
    labels: { $in: [bugTagId] }
  }
)
```

## Issue Number Generation

### Automatic Numbering

```typescript
// Issue numbers are automatically generated when creating issues
// The system maintains a sequence counter per project

// Get next issue number for project
async function getNextIssueNumber(projectId: Ref<Project>): Promise<number> {
  const project = await client.findOne(tracker.class.Project, { _id: projectId })
  if (!project) throw new Error('Project not found')
  
  // Increment sequence and return new number
  const result = await client.update(project, { $inc: { sequence: 1 } }, true)
  return (result as any).object.sequence
}

// Issue identifier format: {PROJECT_IDENTIFIER}-{NUMBER}
// Example: "PROJ-123", "ALPHA-45"
function formatIssueIdentifier(project: Project, number: number): string {
  return `${project.identifier}-${number}`
}
```

## Status Management

### Status Workflow

```typescript
// Get all statuses for a project
const statuses = await client.findAll(
  tracker.class.IssueStatus,
  { space: projectId },
  { sort: { rank: SortingOrder.Ascending } }
)

// Status categories define workflow stages
enum StatusCategory {
  UnStarted = 'UnStarted',    // Not yet started
  ToDo = 'ToDo',              // Ready to start
  Active = 'Active',          // In progress
  Won = 'Won',                // Completed successfully
  Lost = 'Lost'               // Cancelled/failed
}

// Create custom status
const statusId = await client.createDoc(
  tracker.class.IssueStatus,
  projectSpace,
  {
    name: 'Code Review',
    category: task.statusCategory.Active,
    color: 0x00ff00,
    description: 'Waiting for code review',
    rank: '50'  // Position in workflow
  }
)
```

## Component Management

### Component Operations

```typescript
// Create component
const componentId = await client.createDoc(
  tracker.class.Component,
  projectSpace,
  {
    label: 'Authentication Module',
    description: 'Handles user authentication and authorization',
    lead: teamLeadId,
    comments: 0,
    attachments: 0
  }
)

// Assign issues to component
await client.update(issue, {
  component: componentId
})

// Get all issues for a component
const componentIssues = await client.findAll(
  tracker.class.Issue,
  {
    component: componentId,
    space: projectId
  }
)
```

## Milestone Management

### Milestone Operations

```typescript
// Create milestone
const milestoneId = await client.createDoc(
  tracker.class.Milestone,
  projectSpace,
  {
    label: 'Version 2.0 Release',
    description: 'Major feature release',
    status: MilestoneStatus.Planned,
    targetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,  // 30 days from now
    comments: 0,
    attachments: 0
  }
)

// Assign issue to milestone
await client.update(issue, {
  milestone: milestoneId
})

// Get milestone progress
const milestoneIssues = await client.findAll(
  tracker.class.Issue,
  { milestone: milestoneId }
)

const completedIssues = milestoneIssues.filter(issue => 
  issue.$lookup?.status?.category === task.statusCategory.Won
)

const progress = completedIssues.length / milestoneIssues.length
```

## Advanced Queries and Aggregations

### Complex Issue Queries

```typescript
// Get overdue high-priority issues
const overdueIssues = await client.findAll(
  tracker.class.Issue,
  {
    space: projectId,
    priority: { $in: [IssuePriority.High, IssuePriority.Urgent] },
    dueDate: { $lt: Date.now() },
    status: { $nin: completedStatusIds }
  }
)

// Get issues by assignee workload
const assigneeWorkload = await client.findAll(
  tracker.class.Issue,
  {
    space: projectId,
    assignee: { $ne: null },
    status: { $in: activeStatusIds }
  },
  {
    projection: { assignee: 1, estimation: 1, remainingTime: 1 }
  }
)

// Group by assignee
const workloadByAssignee = assigneeWorkload.reduce((acc, issue) => {
  const assigneeId = issue.assignee!
  if (!acc[assigneeId]) {
    acc[assigneeId] = { totalEstimation: 0, totalRemaining: 0, issueCount: 0 }
  }
  acc[assigneeId].totalEstimation += issue.estimation
  acc[assigneeId].totalRemaining += issue.remainingTime
  acc[assigneeId].issueCount += 1
  return acc
}, {} as Record<string, { totalEstimation: number, totalRemaining: number, issueCount: number }>)
```

## Best Practices for MCP Implementation

### 1. Always Use Collection Operations
```typescript
// Use addCollection for creating issues, not createDoc
await client.addCollection(tracker.class.Issue, ...)
```

### 2. Handle Issue Numbers Properly
```typescript
// Let the system generate issue numbers automatically
// Don't manually set the number field
```

### 3. Validate Status Transitions
```typescript
// Implement workflow validation before status changes
if (!isValidTransition(currentStatus, newStatus)) {
  throw new Error('Invalid status transition')
}
```

### 4. Use Batch Operations for Related Changes
```typescript
// Use transactions for multiple related updates
const tx = client.apply()
await tx.update(issue, { status: newStatus })
await tx.addCollection(chunter.class.ChatMessage, ...)
await tx.commit()
```

### 5. Handle Time Tracking Automatically
```typescript
// Don't manually update reportedTime - it's calculated by triggers
// Only update estimation and let remainingTime be calculated
```

This comprehensive guide provides all the concrete operations needed to fully manipulate issues in Huly through your MCP server implementation.
