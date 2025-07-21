# Huly Issue Status and Template Handling Guide

## Overview

This guide provides comprehensive information about how issue statuses are defined, stored, and handled in Huly's template system, covering status-project relationships, initialization patterns, and template status determination.

## Status Definition and Storage

### Issue Status Model

```typescript
@Model(tracker.class.IssueStatus, core.class.Status)
@UX(tracker.string.IssueStatus, undefined, undefined, 'rank', 'name')
export class TIssueStatus extends TStatus implements IssueStatus {
  // Inherits from core.class.Status:
  
  // Attribute this status applies to
  ofAttribute!: Ref<Attribute<Status>>  // tracker.attribute.IssueStatus
  
  // Status category (workflow stage)
  @Prop(TypeRef(core.class.StatusCategory), core.string.StatusCategory)
    category?: Ref<StatusCategory>
  
  // Status name and description
  @Prop(TypeString(), core.string.Name)
    name!: string
  
  @Prop(TypeString(), core.string.Description)
    description!: string
  
  // Visual properties
  color!: number
  rank!: Rank  // For ordering
}

// Status interface
export interface IssueStatus extends Status {}
```

### Status Categories

```typescript
@Model(core.class.StatusCategory, core.class.Doc, DOMAIN_MODEL)
export class TStatusCategory extends TDoc implements StatusCategory {
  ofAttribute!: Ref<Attribute<Status>>
  icon!: Asset
  label!: IntlString
  color!: number
  defaultStatusName!: string
  order!: number  // Category order in workflow
}

// Standard status categories
enum StatusCategory {
  UnStarted = 'UnStarted',    // Not yet started
  ToDo = 'ToDo',              // Ready to start  
  Active = 'Active',          // In progress
  Won = 'Won',                // Completed successfully
  Lost = 'Lost'               // Cancelled/failed
}
```

### Storage Domain and Organization

```typescript
// Status storage
export const DOMAIN_TRACKER = 'tracker' as Domain

// IssueStatus documents are stored in:
// - Domain: DOMAIN_TRACKER
// - Space: Varies (see below for details)
// - Class: tracker.class.IssueStatus
```

## Status-Project Relationships

### Global vs Per-Project Status Storage

**Key Finding**: Statuses are **globally defined** but **filtered by TaskType** for each project.

```typescript
// Project model includes default status reference
@Model(tracker.class.Project, task.class.Project)
export class TProject extends TTaskProject implements Project {
  // Default status for new issues in this project
  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.DefaultIssueStatus)
    defaultIssueStatus!: Ref<IssueStatus>
  
  // Project inherits task types from ProjectType
  // Each TaskType defines available statuses
}

// TaskType defines available statuses
@Model(task.class.TaskType, core.class.Doc, DOMAIN_MODEL)
export class TTaskType extends TDoc implements TaskType {
  // Array of status references available for this task type
  statuses: Ref<Status>[]
  statusClass: Ref<Class<Status>>  // tracker.class.IssueStatus
  statusCategories: Ref<StatusCategory>[]
}
```

### Status Filtering by Project

```typescript
// Get statuses available for a specific project
async function getProjectStatuses(projectId: Ref<Project>): Promise<IssueStatus[]> {
  // 1. Get project and its task types
  const project = await client.findOne(tracker.class.Project, { _id: projectId }, {
    lookup: { type: task.class.ProjectType }
  })
  
  if (!project) return []
  
  // 2. Get task types for the project
  const taskTypes = await client.findAll(task.class.TaskType, {
    parent: project.type
  })
  
  // 3. Collect all status IDs from task types
  const statusIds = new Set<Ref<IssueStatus>>()
  for (const taskType of taskTypes) {
    taskType.statuses.forEach(statusId => statusIds.add(statusId))
  }
  
  // 4. Get actual status documents
  const statuses = await client.findAll(tracker.class.IssueStatus, {
    _id: { $in: Array.from(statusIds) }
  }, {
    sort: { rank: SortingOrder.Ascending }
  })
  
  return statuses
}

// Alternative: Query statuses by ofAttribute
async function getAllIssueStatuses(): Promise<IssueStatus[]> {
  return await client.findAll(tracker.class.IssueStatus, {
    ofAttribute: tracker.attribute.IssueStatus
  }, {
    sort: { rank: SortingOrder.Ascending }
  })
}
```

## Default Status Initialization

### Classic Issue Status Set

```typescript
// Default statuses created for every tracker installation
export const classicIssueTaskStatuses: TaskStatusFactory[] = [
  {
    category: task.statusCategory.UnStarted,
    statuses: [['Backlog', PaletteColorIndexes.Cloud, pluginState.status.Backlog]]
  },
  { 
    category: task.statusCategory.ToDo, 
    statuses: [['Todo', PaletteColorIndexes.Porpoise, pluginState.status.Todo]] 
  },
  {
    category: task.statusCategory.Active,
    statuses: [['In Progress', PaletteColorIndexes.Cerulean, pluginState.status.InProgress]]
  },
  { 
    category: task.statusCategory.Won, 
    statuses: [['Done', PaletteColorIndexes.Grass, pluginState.status.Done]] 
  },
  {
    category: task.statusCategory.Lost,
    statuses: [['Canceled', PaletteColorIndexes.Coin, pluginState.status.Canceled]]
  }
]
```

### Status Creation in Model

```typescript
// Statuses are created during model initialization
function createModel(builder: Builder): void {
  const classicStatuses: Ref<Status>[] = []
  
  // Create statuses for the default task type
  for (const { category, statuses } of classicIssueTaskStatuses) {
    for (const status of statuses) {
      const [name, color, statusId] = Array.isArray(status) ? status : [status, undefined, undefined]
      
      if (statusId === undefined) {
        throw new Error('Status id is required when creating in static model. Missing for: ' + name)
      }
      
      classicStatuses.push(statusId)
      
      // Create status document in model space
      builder.createDoc(
        tracker.class.IssueStatus,
        core.space.Model,  // Created in model space
        {
          ofAttribute: tracker.attribute.IssueStatus,
          name,
          color,
          category
        },
        statusId
      )
    }
  }
  
  // Statuses are then assigned to default task types
}
```

### Project Creation with Default Status

```typescript
// Project creation includes default status assignment
async function createProject(projectData: ProjectData): Promise<Ref<Project>> {
  const projectId = generateId<Project>()
  
  // Get default status (usually Backlog)
  const defaultIssueStatus = tracker.status.Backlog  // Default status ID
  
  const project = await client.createDoc(
    tracker.class.Project,
    projectSpace,
    {
      ...projectData,
      defaultIssueStatus,  // Assign default status
      sequence: 0          // Initialize issue counter
    },
    projectId
  )
  
  return projectId
}
```

## Template Status Handling

### Template Status Determination

Templates **do not store status references** directly. Instead, they rely on the project's available statuses:

```typescript
// Template model - notice NO status field
@Model(tracker.class.IssueTemplate, core.class.Doc, DOMAIN_TRACKER)
export class TIssueTemplate extends TDoc implements IssueTemplate {
  @Prop(TypeString(), tracker.string.Title)
    title!: string
  
  @Prop(TypeIssuePriority(), tracker.string.Priority)
    priority!: IssuePriority
  
  // NO status field - templates use project's default status
  
  @Prop(TypeRef(contact.class.Person), tracker.string.Assignee)
    assignee!: Ref<Person> | null
  
  // Template belongs to a project space
  space: Ref<Project>
}
```

### Status Assignment in Template Usage

```typescript
// When creating issues from templates
async function createIssueFromTemplate(
  templateId: Ref<IssueTemplate>,
  projectSpace: Ref<Project>
): Promise<Ref<Issue>> {
  const template = await client.findOne(tracker.class.IssueTemplate, { _id: templateId })
  const project = await client.findOne(tracker.class.Project, { _id: projectSpace })
  
  if (!template || !project) {
    throw new Error('Template or project not found')
  }
  
  // Use project's default status for new issues
  const defaultStatus = await getDefaultStatus(projectSpace)
  
  const issueId = await client.addCollection(
    tracker.class.Issue,
    projectSpace,
    tracker.ids.NoParent,
    tracker.class.Issue,
    'subIssues',
    {
      title: template.title,
      description: await convertTemplateDescription(template.description),
      status: defaultStatus,  // Use project's default status
      priority: template.priority,
      assignee: template.assignee,
      component: template.component,
      // ... other template fields
    }
  )
  
  return issueId
}

// Helper function to get project's default status
async function getDefaultStatus(projectSpace: Ref<Project>): Promise<Ref<IssueStatus>> {
  const project = await client.findOne(tracker.class.Project, { _id: projectSpace })
  return project?.defaultIssueStatus || tracker.status.Backlog
}
```

### Template Status Validation

```typescript
// Validate that project has required statuses for template usage
async function validateTemplateForProject(
  templateId: Ref<IssueTemplate>,
  projectId: Ref<Project>
): Promise<{ valid: boolean, missingStatuses: string[] }> {
  const project = await client.findOne(tracker.class.Project, { _id: projectId })
  if (!project) {
    return { valid: false, missingStatuses: ['Project not found'] }
  }
  
  // Get available statuses for project
  const availableStatuses = await getProjectStatuses(projectId)
  const statusNames = new Set(availableStatuses.map(s => s.name))
  
  // Check if project has basic required statuses
  const requiredStatuses = ['Backlog', 'Todo', 'In Progress', 'Done']
  const missingStatuses = requiredStatuses.filter(name => !statusNames.has(name))
  
  return {
    valid: missingStatuses.length === 0,
    missingStatuses
  }
}
```

## Status Store and Live Queries

### Global Status Store

```typescript
// Global status store for UI components
interface StatusStore {
  byId: IdMap<Status>
  array: Status[]
}

export const statusStore = writable<StatusStore>({
  byId: new Map(),
  array: []
})

// Live query for all statuses
const query = createQuery(true)
onClient(() => {
  query.query(
    core.class.Status,  // Query all status types
    {},
    (result) => {
      statusStore.set({
        byId: toIdMap(result),
        array: result
      })
    }
  )
})
```

### Project-Specific Status Filtering

```typescript
// Filter statuses for specific project in UI
function getProjectStatusOptions(
  projectId: Ref<Project>,
  taskTypeId?: Ref<TaskType>
): Ref<Status>[] {
  const $statusStore = get(statusStore)
  
  if (taskTypeId) {
    // Get statuses for specific task type
    const taskType = get(taskTypeStore).get(taskTypeId)
    return taskType?.statuses || []
  } else {
    // Get all statuses for project (from all task types)
    const project = get(projectStore).get(projectId)
    const projectTaskTypes = getProjectTaskTypes(project)
    const allStatuses = new Set<Ref<Status>>()
    
    projectTaskTypes.forEach(taskType => {
      taskType.statuses.forEach(statusId => allStatuses.add(statusId))
    })
    
    return Array.from(allStatuses)
  }
}
```

## Best Practices for MCP Implementation

### 1. Always Use Project's Default Status

```typescript
// When creating issues, always use project's default status
const project = await client.findOne(tracker.class.Project, { _id: projectId })
const defaultStatus = project?.defaultIssueStatus || tracker.status.Backlog

await client.addCollection(tracker.class.Issue, projectSpace, parentId, tracker.class.Issue, 'subIssues', {
  // ... other fields
  status: defaultStatus  // Use project default
})
```

### 2. Query Statuses by ofAttribute

```typescript
// Get all issue statuses
const issueStatuses = await client.findAll(tracker.class.IssueStatus, {
  ofAttribute: tracker.attribute.IssueStatus
})
```

### 3. Respect Task Type Status Constraints

```typescript
// Validate status is allowed for task type
async function validateStatusForTaskType(
  statusId: Ref<IssueStatus>,
  taskTypeId: Ref<TaskType>
): Promise<boolean> {
  const taskType = await client.findOne(task.class.TaskType, { _id: taskTypeId })
  return taskType?.statuses.includes(statusId) || false
}
```

### 4. Handle Status Transitions Properly

```typescript
// Validate status transitions based on categories
function isValidStatusTransition(
  fromStatus: IssueStatus,
  toStatus: IssueStatus
): boolean {
  // Example: Can't go from Won/Lost back to Active without going through ToDo
  if (fromStatus.category === task.statusCategory.Won || fromStatus.category === task.statusCategory.Lost) {
    return toStatus.category !== task.statusCategory.Active
  }
  return true
}
```

## Summary

**Status Organization in Huly**:

1. **Global Definition**: Statuses are defined globally in `core.space.Model`
2. **TaskType Filtering**: Available statuses are determined by project's TaskTypes
3. **Project Defaults**: Each project has a `defaultIssueStatus` for new issues
4. **Template Behavior**: Templates don't store status - they use project defaults
5. **Attribute Binding**: All issue statuses have `ofAttribute: tracker.attribute.IssueStatus`

**Key Relationships**:
- `Project` → `ProjectType` → `TaskType[]` → `Status[]`
- `IssueTemplate` → `Project.defaultIssueStatus` (implicit)
- `Issue.status` → filtered by `TaskType.statuses`

This architecture allows flexible status management while maintaining consistency within projects and supporting template reusability across different project configurations.
