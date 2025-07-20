# Comprehensive Huly MCP Server Development Guide

## Overview

This guide provides complete information for building a comprehensive MCP (Model Context Protocol) server that can interact with all aspects of the Huly platform, including user management, project management, document handling, and more.

## Core Architecture

### Class Hierarchy

```typescript
// Base Classes
core.class.Obj                    // Root object
├── core.class.Doc               // Base document with metadata
    ├── core.class.AttachedDoc   // Documents attached to other docs
    ├── core.class.Space         // Workspaces and containers
    └── core.class.Blob          // File storage

// Key Inheritance Chains
tracker.class.Issue extends task.class.Task extends core.class.AttachedDoc
contact.class.Person extends contact.class.Contact extends core.class.Doc
chunter.class.ChatMessage extends activity.class.ActivityMessage extends core.class.AttachedDoc
```

### Account & User Management

#### Account Types
```typescript
interface Account {
  uuid: AccountUuid
  automatic?: boolean
  timezone?: string
  locale?: string
  maxWorkspaces?: number
}

interface Person extends BasePerson {
  uuid: PersonUuid
  firstName: string
  lastName: string
  country?: string
  city?: string
  migratedTo?: PersonUuid
}

enum AccountRole {
  ReadOnlyGuest = 'ReadOnlyGuest',
  DocGuest = 'DocGuest', 
  Guest = 'Guest',
  User = 'User',
  Maintainer = 'Maintainer',
  Owner = 'Owner',
  Admin = 'Admin'
}
```

#### Employee & Contact System
```typescript
interface Contact extends Doc, AvatarInfo {
  name: string
  attachments?: number
  comments?: number
  channels?: number
  city?: string
  avatarType: AvatarType
  avatar?: Ref<Blob> | null
  avatarProps?: { color?: string, url?: string }
}

interface Person extends Contact {
  birthday?: Timestamp | null
  socialIds?: Collection<SocialIdentity>
  profile?: Ref<Card>
}

// Employee mixin adds work-related fields
interface Employee extends Person {
  active: boolean
  role?: 'USER' | 'GUEST'
  statuses?: number
  position?: string | null
  personUuid?: AccountUuid
}

interface Organization extends Contact {
  description: MarkupBlobRef | null
  members: number
}
```

### Workspace & Project Management

#### Workspace Structure
```typescript
interface Workspace {
  uuid: WorkspaceUuid
  name: string
  url: string
  allowReadOnlyGuest: boolean
  allowGuestSignUp: boolean
  branding?: string
  location?: Location
  region?: string
  createdBy?: PersonUuid
  billingAccount?: PersonUuid
  createdOn?: Timestamp
}

interface WorkspaceStatus extends WorkspaceVersion {
  workspaceUuid: WorkspaceUuid
  mode: WorkspaceMode
  processingProgress?: number
  lastProcessingTime?: Timestamp
  lastVisit?: Timestamp
  isDisabled: boolean
}
```

#### Project Management
```typescript
interface Project extends TaskProject {
  identifier: string              // Project identifier (e.g., "PROJ")
  sequence: number               // Issue numbering sequence
  defaultIssueStatus: Ref<IssueStatus>
  defaultAssignee?: Ref<Employee>
  defaultTimeReportDay: TimeReportDayType
  
  // Inherited from Space
  name: string
  description: string
  private: boolean
  archived: boolean
  members: AccountUuid[]
  owners?: AccountUuid[]
  autoJoin?: boolean
}
```

### Issue & Task Management

#### Issue Structure
```typescript
interface Issue extends Task {
  attachedTo: Ref<Issue>         // Parent issue for sub-issues
  title: string
  description: MarkupBlobRef | null
  status: Ref<IssueStatus>
  priority: IssuePriority
  component: Ref<Component> | null
  
  // Collections
  subIssues: CollectionSize<Issue>
  comments?: number              // Auto-maintained counter
  attachments?: number
  labels: number
  reports: number
  
  // Time tracking
  estimation: number             // Hours
  remainingTime: number         // Hours  
  reportedTime: number          // Auto-calculated
  
  // Relationships
  blockedBy?: RelatedDocument[]
  relations?: RelatedDocument[]
  parents: IssueParentInfo[]
  childInfo: IssueChildInfo[]
  
  // Project context
  space: Ref<Project>
  milestone?: Ref<Milestone> | null
  dueDate: Timestamp | null
}

enum IssuePriority {
  NoPriority = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4
}
```

### Document & Content Management

#### Markup Storage System
```typescript
// Two storage patterns:
// 1. Direct storage (for short content)
interface ChatMessage extends ActivityMessage {
  message: string  // Direct markup storage
}

// 2. Reference storage (for large/collaborative content)
interface Issue extends Task {
  description: MarkupBlobRef | null  // Reference to blob storage
}

// Blob storage
interface Blob extends Doc {
  provider: string
  contentType: string
  storageId: string
  etag: string
  version: string
  size: number
}
```

#### Attachment System
```typescript
interface Attachment extends AttachedDoc {
  name: string
  file: Ref<Blob>
  size: number
  type: string
  lastModified: number
  description: string
  pinned: boolean
  metadata?: AttachmentMetadata
}
```

## API Client Interface

### Core Operations
```typescript
interface PlatformClient {
  // Connection & Auth
  getHierarchy(): Hierarchy
  getModel(): ModelDb
  getAccount(): Promise<Account>
  close(): Promise<void>
  
  // Document Operations
  createDoc<T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    attributes: WithMarkup<Data<T>>,
    id?: Ref<T>
  ): Promise<Ref<T>>
  
  updateDoc<T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    objectId: Ref<T>,
    operations: WithMarkup<DocumentUpdate<T>>,
    retrieve?: boolean
  ): Promise<TxResult>
  
  removeDoc<T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    objectId: Ref<T>
  ): Promise<TxResult>
  
  // Query Operations
  findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>>
  
  findOne<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<WithLookup<T> | undefined>
  
  // Collection Operations
  addCollection<T extends Doc, P extends AttachedDoc>(
    _class: Ref<Class<P>>,
    space: Ref<Space>,
    attachedTo: Ref<T>,
    attachedToClass: Ref<Class<T>>,
    collection: string,
    attributes: WithMarkup<AttachedData<P>>,
    id?: Ref<P>
  ): Promise<Ref<P>>
  
  updateCollection<T extends Doc, P extends AttachedDoc>(
    _class: Ref<Class<P>>,
    space: Ref<Space>,
    objectId: Ref<P>,
    attachedTo: Ref<T>,
    attachedToClass: Ref<Class<T>>,
    collection: string,
    operations: WithMarkup<DocumentUpdate<P>>,
    retrieve?: boolean
  ): Promise<Ref<T>>
  
  removeCollection<T extends Doc, P extends AttachedDoc>(
    _class: Ref<Class<P>>,
    space: Ref<Space>,
    objectId: Ref<P>,
    attachedTo: Ref<T>,
    attachedToClass: Ref<Class<T>>,
    collection: string
  ): Promise<Ref<T>>
  
  // Markup Operations
  uploadMarkup(
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    markup: string,
    format: MarkupFormat  // 'markup' | 'html' | 'markdown'
  ): Promise<MarkupRef>
  
  fetchMarkup(
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    id: MarkupRef,
    format: MarkupFormat
  ): Promise<string>
  
  // Mixin Operations
  createMixin<T extends Doc, M extends T>(
    objectId: Ref<T>,
    objectClass: Ref<Class<T>>,
    objectSpace: Ref<Space>,
    mixin: Ref<Mixin<M>>,
    attributes: MixinData<T, M>
  ): Promise<TxResult>
  
  updateMixin<T extends Doc, M extends T>(
    objectId: Ref<T>,
    objectClass: Ref<Class<T>>,
    objectSpace: Ref<Space>,
    mixin: Ref<Mixin<M>>,
    operations: MixinUpdate<T, M>
  ): Promise<TxResult>
}
```

### Query System

#### Query Operators
```typescript
interface DocumentQuery<T extends Doc> {
  // Equality
  field?: T[field]
  field?: { $eq: T[field] }
  field?: { $ne: T[field] }
  
  // Arrays
  field?: { $in: T[field][] }
  field?: { $nin: T[field][] }
  
  // Comparison (for numbers, dates)
  field?: { $gt: T[field] }
  field?: { $gte: T[field] }
  field?: { $lt: T[field] }
  field?: { $lte: T[field] }
  
  // Existence
  field?: { $exists: boolean }
  
  // Text search
  $search?: string
  
  // Logical operators
  $and?: DocumentQuery<T>[]
  $or?: DocumentQuery<T>[]
  $not?: DocumentQuery<T>
}

interface FindOptions<T extends Doc> {
  limit?: number
  sort?: SortingQuery<T>
  lookup?: Lookup<T>          // Join related documents
  projection?: Projection<T>   // Select specific fields
  total?: boolean             // Return total count
  showArchived?: boolean
}
```

### Real-time Subscriptions
```typescript
// Live query with callback
const unsubscribe = client.query(
  tracker.class.Issue,
  { space: projectId },
  (result: FindResult<Issue>) => {
    console.log('Issues updated:', result)
  },
  { sort: { modifiedOn: SortingOrder.Descending } }
)

// Clean up subscription
unsubscribe()
```

## Key Class References

### Essential Classes
```typescript
// Core
core.class.Doc
core.class.AttachedDoc
core.class.Space
core.class.Blob

// Contact & HR
contact.class.Contact
contact.class.Person
contact.mixin.Employee
hr.class.Department

// Tracker
tracker.class.Project
tracker.class.Issue
tracker.class.IssueStatus
tracker.class.Component
tracker.class.Milestone

// Activity & Communication
activity.class.ActivityMessage
chunter.class.ChatMessage
chunter.class.ThreadMessage

// Documents
documents.class.Document
documents.class.DocumentComment
attachment.class.Attachment

// Task Management
task.class.Task
task.class.TaskType
```

### Important Namespaces
```typescript
// Import patterns
import core from '@hcengineering/core'
import contact from '@hcengineering/contact'
import tracker from '@hcengineering/tracker'
import chunter from '@hcengineering/chunter'
import activity from '@hcengineering/activity'
import attachment from '@hcengineering/attachment'
import documents from '@hcengineering/controlled-documents'
import hr from '@hcengineering/hr'
import task from '@hcengineering/task'
```

## Connection & Authentication

### WebSocket Connection
```typescript
import { connect } from '@hcengineering/api-client'

const client = await connect('https://huly.app', {
  email: 'user@example.com',
  password: 'password',
  workspace: 'my-workspace'
})
```

### REST Connection
```typescript
import { connectRest } from '@hcengineering/api-client'

const client = await connectRest('https://huly.app', {
  email: 'user@example.com', 
  password: 'password',
  workspace: 'my-workspace'
})
```

### Token-based Authentication
```typescript
const client = await connect('https://huly.app', {
  token: 'your-auth-token',
  workspace: 'my-workspace'
})
```

## Status Management System

### Issue Status Workflow
```typescript
interface IssueStatus extends Status {
  category?: Ref<StatusCategory>
  name: string
  color: number
  description: string
  rank: Rank  // For ordering
}

// Status categories define workflow stages
enum StatusCategory {
  UnStarted = 'UnStarted',
  Active = 'Active',
  Won = 'Won',
  Lost = 'Lost'
}
```

### Status Operations
```typescript
// Get all statuses for a project
const statuses = await client.findAll(tracker.class.IssueStatus, {
  space: projectId
}, {
  sort: { rank: SortingOrder.Ascending }
})

// Update issue status
await client.updateDoc(tracker.class.Issue, projectSpace, issueId, {
  status: newStatusId
})
```

## Advanced Query Patterns

### Complex Queries
```typescript
// Find issues with multiple conditions
const issues = await client.findAll(tracker.class.Issue, {
  space: projectId,
  status: { $in: activeStatusIds },
  assignee: { $ne: null },
  priority: { $gte: IssuePriority.Medium },
  dueDate: { $lt: Date.now() + 7 * 24 * 60 * 60 * 1000 } // Due within 7 days
}, {
  sort: { priority: SortingOrder.Descending, dueDate: SortingOrder.Ascending },
  lookup: {
    assignee: contact.mixin.Employee,
    status: tracker.class.IssueStatus,
    component: tracker.class.Component
  }
})

// Text search across multiple fields
const searchResults = await client.findAll(tracker.class.Issue, {
  $search: 'bug critical',
  space: projectId
})

// Aggregation-style queries
const issuesByStatus = await client.findAll(tracker.class.Issue, {
  space: projectId
}, {
  projection: { status: 1, _id: 1 }
})
```

### Lookup and Joins
```typescript
// Lookup related documents
const issuesWithDetails = await client.findAll(tracker.class.Issue, {
  space: projectId
}, {
  lookup: {
    assignee: contact.mixin.Employee,      // Join employee details
    status: tracker.class.IssueStatus,    // Join status details
    space: tracker.class.Project,         // Join project details
    attachedTo: tracker.class.Issue       // Join parent issue
  }
})

// Access looked up data
issuesWithDetails.forEach(issue => {
  const assigneeName = issue.$lookup?.assignee?.name
  const statusName = issue.$lookup?.status?.name
  const projectName = issue.$lookup?.space?.name
})
```

## Time Tracking & Reporting

### Time Tracking Structure
```typescript
interface TimeSpendReport extends AttachedDoc {
  employee: Ref<Employee>
  date: Timestamp
  value: number        // Hours spent
  description: string
  attachedTo: Ref<Issue>
}

// Add time report to issue
const timeReportId = await client.addCollection(
  tracker.class.TimeSpendReport,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'reports',
  {
    employee: employeeId,
    date: Date.now(),
    value: 2.5,  // 2.5 hours
    description: 'Fixed critical bug'
  }
)
```

### Estimation and Time Calculations
```typescript
// Update issue estimation and remaining time
await client.updateDoc(tracker.class.Issue, projectSpace, issueId, {
  estimation: 8,      // 8 hours estimated
  remainingTime: 3    // 3 hours remaining
})

// The reportedTime field is automatically calculated from TimeSpendReport collection
```

## Notification & Activity System

### Activity Messages
```typescript
// Activity messages are automatically created for most operations
// But you can create custom activity messages

const activityId = await client.addCollection(
  activity.class.ActivityInfoMessage,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'docUpdateMessages',
  {
    message: activity.string.CustomUpdate,
    props: { action: 'custom_action', details: 'Custom operation performed' }
  }
)
```

### Comment System (Comprehensive)
```typescript
// Regular comment
const commentId = await client.addCollection(
  chunter.class.ChatMessage,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'comments',
  {
    message: 'This is a regular comment with **markdown** support'
  }
)

// Thread reply (comment on a comment)
const replyId = await client.addCollection(
  chunter.class.ThreadMessage,
  projectSpace,
  commentId,
  chunter.class.ChatMessage,
  'replies',
  {
    message: 'This is a reply to the comment',
    objectId: issueId,
    objectClass: tracker.class.Issue
  }
)

// Get all comments including threads
const allComments = await client.findAll(activity.class.ActivityMessage, {
  attachedTo: issueId,
  attachedToClass: tracker.class.Issue
}, {
  sort: { createdOn: SortingOrder.Ascending }
})
```

## File & Attachment Management

### Upload Process
```typescript
// 1. Upload file as blob
const blobId = await client.uploadBlob(file)

// 2. Create attachment record
const attachmentId = await client.addCollection(
  attachment.class.Attachment,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'attachments',
  {
    name: file.name,
    file: blobId,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    description: 'Screenshot of the bug',
    pinned: false
  }
)
```

### Download Process
```typescript
// Get attachment details
const attachment = await client.findOne(attachment.class.Attachment, {
  _id: attachmentId
})

// Download blob
const blobData = await client.downloadBlob(attachment.file)
```

## Workspace & Permission Management

### Workspace Operations
```typescript
// Get current workspace info
const account = await client.getAccount()
const workspaceId = account.workspace

// Get workspace members
const members = await client.findAll(contact.class.Member, {
  space: workspaceId
}, {
  lookup: { contact: contact.class.Contact }
})

// Check user permissions
const hierarchy = client.getHierarchy()
const canCreate = hierarchy.hasPermission(account, core.permission.CreateDoc, projectSpace)
```

### Role Management
```typescript
// Assign role to user in project
await client.createMixin(
  employeeId,
  contact.mixin.Employee,
  contact.space.Employee,
  core.mixin.UserRole,
  {
    role: tracker.role.ProjectMember
  }
)
```

## Error Handling & Best Practices

### Robust Error Handling
```typescript
try {
  const issueId = await client.createDoc(
    tracker.class.Issue,
    projectSpace,
    issueData
  )
  return issueId
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    throw new Error('Insufficient permissions to create issue')
  } else if (error.code === 'VALIDATION_ERROR') {
    throw new Error(`Invalid issue data: ${error.message}`)
  } else {
    throw new Error(`Failed to create issue: ${error.message}`)
  }
}
```

### Batch Operations
```typescript
// Use transactions for multiple related operations
const tx = client.apply()

try {
  // Create issue
  const issueId = await tx.createDoc(tracker.class.Issue, projectSpace, issueData)

  // Add initial comment
  await tx.addCollection(
    chunter.class.ChatMessage,
    projectSpace,
    issueId,
    tracker.class.Issue,
    'comments',
    { message: 'Issue created automatically' }
  )

  // Commit all operations
  await tx.commit()
} catch (error) {
  // All operations are rolled back automatically
  throw error
}
```

### Performance Optimization
```typescript
// Use projections to limit data transfer
const lightweightIssues = await client.findAll(tracker.class.Issue, {
  space: projectId
}, {
  projection: {
    _id: 1,
    title: 1,
    status: 1,
    assignee: 1,
    priority: 1
  },
  limit: 100
})

// Use pagination for large datasets
const page1 = await client.findAll(tracker.class.Issue, query, {
  limit: 50,
  sort: { modifiedOn: SortingOrder.Descending }
})

const page2 = await client.findAll(tracker.class.Issue, {
  ...query,
  modifiedOn: { $lt: page1[page1.length - 1].modifiedOn }
}, {
  limit: 50,
  sort: { modifiedOn: SortingOrder.Descending }
})
```

## MCP Implementation Roadmap

### Phase 1: Core Foundation
1. **Authentication & Connection**: Implement secure connection handling
2. **Basic CRUD**: Issues, Projects, Comments with proper error handling
3. **Query System**: Support for filtering, sorting, and pagination
4. **Status Management**: Issue status workflows and transitions

### Phase 2: Advanced Features
1. **User Management**: Employee/Person creation, role assignments
2. **Rich Content**: Markup handling for descriptions and comments
3. **File Attachments**: Upload/download with proper metadata
4. **Time Tracking**: Estimation, reporting, and calculations

### Phase 3: Full Platform Integration
1. **Real-time Updates**: Live query subscriptions and notifications
2. **Advanced Queries**: Complex filtering, aggregations, and joins
3. **Batch Operations**: Transaction support for complex workflows
4. **Performance**: Caching, pagination, and optimization

### Phase 4: Enterprise Features
1. **Workspace Management**: Multi-workspace support and switching
2. **Permission System**: Role-based access control
3. **Integration APIs**: GitHub, email, and external tool integration
4. **Analytics**: Reporting and dashboard data

This comprehensive guide provides everything needed to build a production-ready MCP server that can fully interact with Huly's platform capabilities.
