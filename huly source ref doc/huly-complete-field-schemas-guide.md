# Huly Complete Field Schemas and Requirements Guide

## Overview

This guide provides comprehensive field schemas, requirements, and default values for creating all major Huly document types, including inheritance chains and validation rules.

## Base Document Fields (core.class.Doc)

All Huly documents inherit from `core.class.Doc`:

```typescript
@Model(core.class.Doc, core.class.Obj)
export class TDoc extends TObj implements Doc {
  // REQUIRED - Document ID (auto-generated if not provided)
  @Prop(TypeRef(core.class.Doc), core.string.Id)
  @Hidden()
    _id!: Ref<this>

  // REQUIRED - Space/Project reference
  @Prop(TypeRef(core.class.Space), core.string.Space)
  @Index(IndexKind.Indexed)
  @Hidden()
    space!: Ref<Space>

  // AUTO-GENERATED - Modification timestamp
  @Prop(TypeTimestamp(), core.string.ModifiedDate)
  @Index(IndexKind.Indexed)
    modifiedOn!: Timestamp

  // AUTO-GENERATED - User who modified
  @Prop(TypePersonId(), core.string.ModifiedBy)
  @Index(IndexKind.Indexed)
    modifiedBy!: PersonId

  // AUTO-GENERATED - User who created
  @Prop(TypePersonId(), core.string.CreatedBy)
  @Index(IndexKind.Indexed)
    createdBy!: PersonId

  // AUTO-GENERATED - Creation timestamp
  @Prop(TypeTimestamp(), core.string.CreatedDate)
  @ReadOnly()
  @Index(IndexKind.IndexedDsc)
    createdOn!: Timestamp
}
```

## Task Base Fields (task.class.Task)

Issues inherit from `task.class.Task`:

```typescript
@Model(task.class.Task, core.class.AttachedDoc)
export class TTask extends TAttachedDoc implements Task {
  // REQUIRED - Task status reference
  @Prop(TypeRef(core.class.Status), task.string.TaskState)
  @Index(IndexKind.Indexed)
    status!: Ref<Status>

  // REQUIRED - Task type reference
  @Prop(TypeRef(task.class.TaskType), task.string.TaskType)
  @Index(IndexKind.Indexed)
  @ReadOnly()
    kind!: Ref<TaskType>

  // AUTO-GENERATED - Task number
  @Prop(TypeString(), task.string.TaskNumber)
  @Index(IndexKind.FullText)
  @Hidden()
    number!: number

  // OPTIONAL - Assignee reference
  @Prop(TypeRef(contact.mixin.Employee), task.string.TaskAssignee)
    assignee!: Ref<Person> | null

  // OPTIONAL - Due date
  @Prop(TypeDate(), task.string.DueDate)
    dueDate!: Timestamp | null

  // REQUIRED - Ranking for ordering (auto-generated)
  @Prop(TypeString(), task.string.Rank)
  @Index(IndexKind.IndexedDsc)
  @Hidden()
    rank!: Rank

  // AUTO-INITIALIZED - Collection counters
  @Prop(Collection(tags.class.TagReference), task.string.TaskLabels)
    labels?: number

  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments?: number

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments)
    attachments?: number

  // AUTO-GENERATED - Completion status
  @Prop(TypeBoolean(), getEmbeddedLabel('isDone'))
  @Hidden()
    isDone?: boolean

  // AUTO-GENERATED - Task identifier (PROJECT-123)
  @Prop(TypeString(), task.string.Identifier)
  @ReadOnly()
  @Index(IndexKind.Indexed)
    identifier!: string
}
```

## 1. tracker.class.Issue Complete Schema

```typescript
@Model(tracker.class.Issue, task.class.Task)
export class TIssue extends TTask implements Issue {
  // REQUIRED - Issue title
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
    title!: string

  // OPTIONAL - Issue description (collaborative document)
  @Prop(TypeCollaborativeDoc(), tracker.string.Description)
  @Index(IndexKind.FullText)
    description!: MarkupBlobRef | null

  // INHERITED REQUIRED - Issue status (from Task.status)
  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.Status)
  @Index(IndexKind.Indexed)
  declare status: Ref<IssueStatus>

  // REQUIRED - Issue priority
  @Prop(TypeIssuePriority(), tracker.string.Priority)
  @Index(IndexKind.Indexed)
    priority!: IssuePriority

  // AUTO-GENERATED - Issue number (from Task.number)
  @Prop(TypeNumber(), tracker.string.Number)
  @Index(IndexKind.FullText)
  @ReadOnly()
  declare number: number

  // INHERITED OPTIONAL - Assignee (from Task.assignee)
  @Prop(TypeRef(contact.class.Person), tracker.string.Assignee)
  @Index(IndexKind.Indexed)
  declare assignee: Ref<Person> | null

  // OPTIONAL - Component reference
  @Prop(TypeRef(tracker.class.Component), tracker.string.Component)
  @Index(IndexKind.Indexed)
    component!: Ref<Component> | null

  // AUTO-INITIALIZED - Sub-issues collection counter
  @Prop(Collection(tracker.class.Issue), tracker.string.SubIssues)
    subIssues!: number

  // AUTO-GENERATED - Parent issue information
  parents!: IssueParentInfo[]

  // INHERITED AUTO-INITIALIZED - Labels collection counter
  @Prop(Collection(tags.class.TagReference), tracker.string.Labels)
  declare labels: number

  // INHERITED REQUIRED - Project space (from Doc.space)
  @Prop(TypeRef(tracker.class.Project), tracker.string.Project)
  @Index(IndexKind.Indexed)
  @ReadOnly()
  declare space: Ref<Project>

  // INHERITED OPTIONAL - Due date (from Task.dueDate)
  @Prop(TypeDate(DateRangeMode.DATETIME), tracker.string.DueDate)
  declare dueDate: Timestamp | null

  // OPTIONAL - Milestone reference
  @Prop(TypeRef(tracker.class.Milestone), tracker.string.Milestone)
  @Index(IndexKind.Indexed)
    milestone!: Ref<Milestone> | null

  // DEFAULT 0 - Time estimation in hours
  @Prop(TypeEstimation(), tracker.string.Estimation)
    estimation!: number

  // AUTO-CALCULATED - Reported time (sum of time reports)
  @Prop(TypeReportedTime(), tracker.string.ReportedTime)
    reportedTime!: number

  // AUTO-CALCULATED - Remaining time (estimation - reportedTime)
  @Prop(TypeRemainingTime(), tracker.string.RemainingTime)
  @ReadOnly()
    remainingTime!: number

  // AUTO-INITIALIZED - Time reports collection counter
  @Prop(Collection(tracker.class.TimeSpendReport), tracker.string.TimeSpendReports)
    reports!: number

  // AUTO-GENERATED - Child issue information
  declare childInfo: IssueChildInfo[]

  // AUTO-INITIALIZED - Todo items collection counter
  @Prop(Collection(time.class.ToDo), getEmbeddedLabel('Action Items'))
    todos?: CollectionSize<ToDo>
}
```

### Issue Creation Requirements

```typescript
// MINIMUM REQUIRED FIELDS for Issue creation
interface IssueCreateData {
  // Required fields
  title: string                    // Issue title
  status: Ref<IssueStatus>        // Must reference valid status
  priority: IssuePriority         // Enum value (0-4)
  kind: Ref<TaskType>             // Must reference valid task type
  space: Ref<Project>             // Project reference

  // Optional fields with defaults
  description?: MarkupBlobRef | null     // Default: null
  assignee?: Ref<Person> | null          // Default: null
  component?: Ref<Component> | null      // Default: null
  milestone?: Ref<Milestone> | null      // Default: null
  dueDate?: Timestamp | null             // Default: null
  estimation?: number                    // Default: 0

  // Auto-generated fields (don't provide)
  // _id, number, identifier, rank, createdOn, modifiedOn, etc.
}
```

## 2. tracker.class.Component Complete Schema

```typescript
@Model(tracker.class.Component, core.class.Doc)
export class TComponent extends TDoc implements Component {
  // REQUIRED - Component name
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
    label!: string

  // OPTIONAL - Component description
  @Prop(TypeMarkup(), tracker.string.Description)
    description?: Markup

  // OPTIONAL - Component lead/owner
  @Prop(TypeRef(contact.mixin.Employee), tracker.string.ComponentLead)
    lead!: Ref<Employee> | null

  // AUTO-INITIALIZED - Comments collection counter
  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments!: number

  // AUTO-INITIALIZED - Attachments collection counter
  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments)
    attachments?: number

  // INHERITED REQUIRED - Project space
  declare space: Ref<Project>
}
```

### Component Creation Requirements

```typescript
// MINIMUM REQUIRED FIELDS for Component creation
interface ComponentCreateData {
  // Required fields
  label: string               // Component name
  space: Ref<Project>        // Project reference

  // Optional fields
  description?: Markup       // Default: undefined
  lead?: Ref<Employee> | null // Default: null

  // Auto-initialized fields (don't provide)
  // comments: 0, attachments: 0
}
```

## 3. tracker.class.Milestone Complete Schema

```typescript
@Model(tracker.class.Milestone, core.class.Doc)
export class TMilestone extends TDoc implements Milestone {
  // REQUIRED - Milestone name
  @Prop(TypeString(), tracker.string.Title)
    label!: string

  // OPTIONAL - Milestone description
  @Prop(TypeMarkup(), tracker.string.Description)
    description?: Markup

  // REQUIRED - Milestone status
  @Prop(TypeMilestoneStatus(), tracker.string.Status)
  @Index(IndexKind.Indexed)
    status!: MilestoneStatus

  // AUTO-INITIALIZED - Comments collection counter
  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments!: number

  // AUTO-INITIALIZED - Attachments collection counter
  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments)
    attachments?: number

  // INHERITED REQUIRED - Project space
  declare space: Ref<Project>
}
```

### Milestone Creation Requirements

```typescript
// MINIMUM REQUIRED FIELDS for Milestone creation
interface MilestoneCreateData {
  // Required fields
  label: string                    // Milestone name
  status: MilestoneStatus         // Enum: Planned, InProgress, Completed, Canceled
  space: Ref<Project>             // Project reference

  // Optional fields
  description?: Markup            // Default: undefined

  // Auto-initialized fields (don't provide)
  // comments: 0, attachments: 0
}

// MilestoneStatus enum values
enum MilestoneStatus {
  Planned = 0,
  InProgress = 1,
  Completed = 2,
  Canceled = 3
}
```

## 4. tracker.class.Project Complete Schema

```typescript
@Model(tracker.class.Project, task.class.Project)
export class TProject extends TTaskProject implements Project {
  // REQUIRED - Project identifier (e.g., "PROJ", "ALPHA")
  @Prop(TypeString(), tracker.string.ProjectIdentifier)
  @Index(IndexKind.FullText)
    identifier!: IntlString

  // AUTO-INITIALIZED - Issue numbering sequence
  @Prop(TypeNumber(), tracker.string.Number)
  @Hidden()
    sequence!: number

  // REQUIRED - Default status for new issues
  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.DefaultIssueStatus)
    defaultIssueStatus!: Ref<IssueStatus>

  // OPTIONAL - Default assignee for new issues
  @Prop(TypeRef(contact.mixin.Employee), tracker.string.DefaultAssignee)
    defaultAssignee!: Ref<Employee>

  // REQUIRED - Default time report day type
  declare defaultTimeReportDay: TimeReportDayType

  // AUTO-INITIALIZED - Related issues collection counter
  @Prop(Collection(tracker.class.RelatedIssueTarget), tracker.string.RelatedIssues)
    relatedIssueTargets!: number

  // INHERITED FROM TaskProject - Project type, members, etc.
}
```

### Project Creation Requirements

```typescript
// MINIMUM REQUIRED FIELDS for Project creation
interface ProjectCreateData {
  // Required fields
  name: string                           // Project name
  identifier: string                     // Project identifier (e.g., "PROJ")
  defaultIssueStatus: Ref<IssueStatus>  // Default status for issues
  type: Ref<ProjectType>                // Project type reference

  // Optional fields with defaults
  description?: string                   // Default: ""
  private?: boolean                     // Default: false
  archived?: boolean                    // Default: false
  autoJoin?: boolean                    // Default: false
  members?: PersonId[]                  // Default: []
  defaultAssignee?: Ref<Employee>       // Default: undefined
  defaultTimeReportDay?: TimeReportDayType // Default: PreviousWorkDay

  // Auto-initialized fields (don't provide)
  // sequence: 0, relatedIssueTargets: 0
}
```

## 5. tracker.class.IssueTemplate Complete Schema

```typescript
@Model(tracker.class.IssueTemplate, core.class.Doc)
export class TIssueTemplate extends TDoc implements IssueTemplate {
  // REQUIRED - Template title
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
    title!: string

  // REQUIRED - Template description (direct markup)
  @Prop(TypeMarkup(), tracker.string.Description)
  @Index(IndexKind.FullText)
    description!: Markup

  // REQUIRED - Default priority
  @Prop(TypeIssuePriority(), tracker.string.Priority)
    priority!: IssuePriority

  // OPTIONAL - Default assignee
  @Prop(TypeRef(contact.class.Person), tracker.string.Assignee)
    assignee!: Ref<Person> | null

  // OPTIONAL - Default component
  @Prop(TypeRef(tracker.class.Component), tracker.string.Component)
    component!: Ref<Component> | null

  // OPTIONAL - Default labels
  @Prop(ArrOf(TypeRef(tags.class.TagElement)), tracker.string.Labels)
    labels?: Ref<TagElement>[]

  // OPTIONAL - Task type
  @Prop(TypeRef(task.class.TaskType), task.string.TaskType)
    kind?: Ref<TaskType>

  // OPTIONAL - Default due date
  @Prop(TypeDate(DateRangeMode.DATETIME), tracker.string.DueDate)
    dueDate!: Timestamp | null

  // OPTIONAL - Default milestone
  @Prop(TypeRef(tracker.class.Milestone), tracker.string.Milestone)
    milestone!: Ref<Milestone> | null

  // DEFAULT 0 - Default estimation
  @Prop(TypeEstimation(), tracker.string.Estimation)
    estimation!: number

  // OPTIONAL - Child templates
  @Prop(ArrOf(TypeRef(tracker.class.IssueTemplate)), tracker.string.IssueTemplate)
    children!: IssueTemplateChild[]

  // AUTO-INITIALIZED - Collection counters
  @Prop(Collection(chunter.class.ChatMessage), tracker.string.Comments)
    comments!: number

  @Prop(Collection(attachment.class.Attachment), tracker.string.Attachments)
    attachments!: number

  // OPTIONAL - Related documents
  @Prop(ArrOf(TypeRef(core.class.TypeRelatedDocument)), tracker.string.RelatedTo)
    relations!: RelatedDocument[]

  // INHERITED REQUIRED - Project space
  declare space: Ref<Project>
}
```

### Template Creation Requirements

```typescript
// MINIMUM REQUIRED FIELDS for IssueTemplate creation
interface TemplateCreateData {
  // Required fields
  title: string                    // Template title
  description: Markup             // Template description (direct markup)
  priority: IssuePriority         // Default priority (0-4)
  space: Ref<Project>             // Project reference

  // Optional fields with defaults
  assignee?: Ref<Person> | null          // Default: null
  component?: Ref<Component> | null      // Default: null
  milestone?: Ref<Milestone> | null      // Default: null
  dueDate?: Timestamp | null             // Default: null
  estimation?: number                    // Default: 0
  labels?: Ref<TagElement>[]             // Default: []
  kind?: Ref<TaskType>                   // Default: undefined
  children?: IssueTemplateChild[]        // Default: []
  relations?: RelatedDocument[]          // Default: []

  // Auto-initialized fields (don't provide)
  // comments: 0, attachments: 0
}
```

## 6. chunter.class.ChatMessage Complete Schema

```typescript
@Model(chunter.class.ChatMessage, activity.class.ActivityMessage)
export class TChatMessage extends TActivityMessage implements ChatMessage {
  // REQUIRED - Message content
  @Prop(TypeMarkup(), chunter.string.Message)
  @Index(IndexKind.FullText)
    message!: string

  // AUTO-INITIALIZED - Attachments collection counter
  @Prop(PropCollection(attachment.class.Attachment), attachment.string.Attachments)
    attachments?: number

  // OPTIONAL - Channel provider reference
  @Prop(TypeRef(contact.class.ChannelProvider), core.string.Object)
    provider?: Ref<SocialChannelProvider>

  // INHERITED FROM ActivityMessage - attachedTo, attachedToClass, etc.
}
```

### ChatMessage Creation Requirements

```typescript
// MINIMUM REQUIRED FIELDS for ChatMessage creation
interface ChatMessageCreateData {
  // Required fields
  message: string                    // Message content (markup)
  attachedTo: Ref<Doc>              // Document being commented on
  attachedToClass: Ref<Class<Doc>>  // Class of document
  collection: string                // Collection name (usually "comments")
  space: Ref<Space>                 // Space reference

  // Optional fields
  provider?: Ref<SocialChannelProvider> // Default: undefined

  // Auto-initialized fields (don't provide)
  // attachments: 0
}
```

## Field Validation Rules and Constraints

### 1. Reference Field Constraints

```typescript
// All reference fields must point to existing documents
status: Ref<IssueStatus>        // Must exist in tracker.class.IssueStatus
assignee: Ref<Person>           // Must exist in contact.class.Person
component: Ref<Component>       // Must exist in tracker.class.Component
space: Ref<Project>             // Must exist in tracker.class.Project
kind: Ref<TaskType>             // Must exist in task.class.TaskType
```

### 2. Enum Value Constraints

```typescript
// IssuePriority enum (0-4)
enum IssuePriority {
  NoPriority = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4
}

// MilestoneStatus enum (0-3)
enum MilestoneStatus {
  Planned = 0,
  InProgress = 1,
  Completed = 2,
  Canceled = 3
}
```

### 3. Rank Field Format

```typescript
// Rank is a special string format for ordering
// Generated using makeRank() function
// Format: base64-encoded fractional positioning
const rank = makeRank(previousRank, nextRank)
```

### 4. Collection Counter Initialization

```typescript
// Collection counters must be initialized to 0
const issueData = {
  // ... other fields
  subIssues: 0,      // Collection counters
  comments: 0,
  attachments: 0,
  reports: 0,
  labels: 0
}
```

## Hidden Requirements and Best Practices

### 1. Always Provide 'kind' Field for Issues

```typescript
// The 'kind' field is critical for proper issue functionality
// It determines available statuses and workflow
const issueData = {
  title: "New Issue",
  kind: tracker.taskTypes.Issue,  // CRITICAL - don't omit this
  status: defaultStatus,
  priority: IssuePriority.Medium,
  space: projectId
}
```

### 2. Use Project's Default Status

```typescript
// Always use project's defaultIssueStatus for new issues
const project = await client.findOne(tracker.class.Project, { _id: projectId })
const defaultStatus = project?.defaultIssueStatus || tracker.status.Backlog
```

### 3. Generate Proper Rank for Ordering

```typescript
// Use makeRank for proper ordering
import { makeRank } from '@hcengineering/task'

const lastIssue = await client.findOne(tracker.class.Issue, 
  { space: projectId }, 
  { sort: { rank: SortingOrder.Descending } }
)
const rank = makeRank(lastIssue?.rank, undefined)
```

### 4. Handle Collaborative Documents

```typescript
// For Issue descriptions, use collaborative documents
const descriptionRef = await client.uploadMarkup(
  tracker.class.Issue,
  issueId,
  'description',
  markupContent,
  'markdown'
)

// For Templates, use direct markup
const templateData = {
  description: markupContent  // Direct markup, not MarkupBlobRef
}
```

## Summary of Critical Requirements

### Must-Have Fields for Each Document Type

**Issue (tracker.class.Issue)**:
- `title` (string) - Issue title
- `status` (Ref<IssueStatus>) - Must reference valid status
- `priority` (IssuePriority) - Enum value 0-4
- `kind` (Ref<TaskType>) - CRITICAL for workflow
- `space` (Ref<Project>) - Project reference

**Component (tracker.class.Component)**:
- `label` (string) - Component name
- `space` (Ref<Project>) - Project reference

**Milestone (tracker.class.Milestone)**:
- `label` (string) - Milestone name
- `status` (MilestoneStatus) - Enum value 0-3
- `space` (Ref<Project>) - Project reference

**Project (tracker.class.Project)**:
- `name` (string) - Project name
- `identifier` (string) - Project identifier
- `defaultIssueStatus` (Ref<IssueStatus>) - Default status
- `type` (Ref<ProjectType>) - Project type

**IssueTemplate (tracker.class.IssueTemplate)**:
- `title` (string) - Template title
- `description` (Markup) - Template description
- `priority` (IssuePriority) - Default priority
- `space` (Ref<Project>) - Project reference

**ChatMessage (chunter.class.ChatMessage)**:
- `message` (string) - Message content
- `attachedTo` (Ref<Doc>) - Target document
- `attachedToClass` (Ref<Class<Doc>>) - Target class
- `collection` (string) - Collection name
- `space` (Ref<Space>) - Space reference

### Auto-Generated Fields (Never Provide)
- `_id` - Document ID (use generateId() or let system generate)
- `number` - Issue/task number (auto-incremented)
- `identifier` - Issue identifier (PROJECT-123 format)
- `rank` - Ordering rank (use makeRank())
- `createdOn`, `modifiedOn` - Timestamps
- `createdBy`, `modifiedBy` - User references
- Collection counters (`comments`, `attachments`, etc.) - Initialize to 0

### Common Pitfalls to Avoid
1. **Missing 'kind' field** - Issues without TaskType reference won't work properly
2. **Invalid status references** - Status must be valid for the project's TaskTypes
3. **Wrong description type** - Issues use MarkupBlobRef, Templates use direct Markup
4. **Uninitialized counters** - Collection counters must be set to 0
5. **Invalid enum values** - Priority and status enums have specific numeric ranges

This comprehensive guide covers all field requirements, inheritance chains, and validation rules needed for creating Huly documents successfully.
