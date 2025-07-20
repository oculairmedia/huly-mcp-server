# Huly Issue Templates Comprehensive Guide

## Overview

This guide provides complete information about issue templates in Huly's tracker module, covering template creation, management, hierarchical structures, and usage for creating standardized issues.

## Template Model Definition

### Complete IssueTemplate Model (TIssueTemplate)

```typescript
@Model(tracker.class.IssueTemplate, core.class.Doc, DOMAIN_TRACKER)
@UX(
  tracker.string.IssueTemplate,
  tracker.icon.IssueTemplates,
  'PROCESS',
  undefined,
  undefined,
  tracker.string.IssueTemplates
)
export class TIssueTemplate extends TDoc implements IssueTemplate {
  // Template title with full-text search
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
    title!: string

  // Template description (direct markup, not collaborative)
  @Prop(TypeMarkup(), tracker.string.Description)
  @Index(IndexKind.FullText)
    description!: Markup

  // Default priority for issues created from this template
  @Prop(TypeIssuePriority(), tracker.string.Priority)
    priority!: IssuePriority

  // Default assignee for issues created from this template
  @Prop(TypeRef(contact.class.Person), tracker.string.Assignee)
    assignee!: Ref<Person> | null

  // Default component assignment
  @Prop(TypeRef(tracker.class.Component), tracker.string.Component)
    component!: Ref<Component> | null

  // Default labels (array of tag element references)
  @Prop(ArrOf(TypeRef(tags.class.TagElement)), tracker.string.Labels)
    labels?: Ref<TagElement>[]

  // Task type for categorization
  @Prop(TypeRef(task.class.TaskType), task.string.TaskType)
    kind?: Ref<TaskType>

  // Project space (inherited from Doc)
  declare space: Ref<Project>

  // Default due date
  @Prop(TypeDate(DateRangeMode.DATETIME), tracker.string.DueDate)
    dueDate!: Timestamp | null

  // Default milestone assignment
  @Prop(TypeRef(tracker.class.Milestone), tracker.string.Milestone)
    milestone!: Ref<Milestone> | null

  // Default time estimation
  @Prop(TypeEstimation(), tracker.string.Estimation)
    estimation!: number

  // Child templates for hierarchical issue creation
  @Prop(ArrOf(TypeRef(tracker.class.IssueTemplate)), tracker.string.IssueTemplate)
    children!: IssueTemplateChild[]

  // Comments collection counter
  @Prop(Collection(chunter.class.ChatMessage), tracker.string.Comments)
    comments!: number

  // Attachments collection counter
  @Prop(Collection(attachment.class.Attachment), tracker.string.Attachments)
    attachments!: number

  // Related documents
  @Prop(ArrOf(TypeRef(core.class.TypeRelatedDocument)), tracker.string.RelatedTo)
    relations!: RelatedDocument[]
}
```

### Template Data Interfaces

```typescript
// Base template data structure
export interface IssueTemplateData {
  title: string
  description: Markup                    // Direct markup (not MarkupBlobRef)
  priority: IssuePriority
  assignee: Ref<Person> | null
  component: Ref<Component> | null
  milestone?: Ref<Milestone> | null
  estimation: number                     // In hours
  labels?: Ref<TagElement>[]
  kind?: Ref<TaskType>                   // Task type classification
}

// Child template with unique ID
export interface IssueTemplateChild extends IssueTemplateData {
  id: Ref<Issue>                         // Unique identifier for child
}

// Complete template interface
export interface IssueTemplate extends Doc, IssueTemplateData {
  space: Ref<Project>
  children: IssueTemplateChild[]         // Hierarchical sub-templates
  comments: number                       // Discussion counter
  attachments?: number                   // Attachment counter
  relations?: RelatedDocument[]          // Related documents
}
```

## Template Operations

### Creating Templates

#### Basic Template Creation

```typescript
// Create a simple issue template
const templateId = await client.createDoc(
  tracker.class.IssueTemplate,
  projectSpace,
  {
    title: 'Bug Report Template',
    description: `# Bug Description
    
Please provide a detailed description of the bug.

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior

## Actual Behavior

## Environment
- OS: 
- Browser: 
- Version: `,
    priority: IssuePriority.Medium,
    assignee: null,                      // No default assignee
    component: bugComponentId,           // Assign to bug component
    milestone: null,
    estimation: 2,                       // Default 2 hours
    labels: [bugLabelId, criticalLabelId], // Default labels
    kind: bugTaskTypeId,
    dueDate: null,
    children: [],                        // No child templates
    comments: 0,
    attachments: 0,
    relations: []
  }
)
```

#### Template with Child Templates (Hierarchical)

```typescript
// Create a complex template with sub-tasks
const featureTemplateId = await client.createDoc(
  tracker.class.IssueTemplate,
  projectSpace,
  {
    title: 'Feature Development Template',
    description: 'Complete feature development process',
    priority: IssuePriority.High,
    assignee: productManagerId,
    component: featureComponentId,
    estimation: 40,                      // Total estimation for main task
    children: [
      {
        id: generateId<Issue>(),
        title: 'Requirements Analysis',
        description: 'Analyze and document feature requirements',
        priority: IssuePriority.High,
        assignee: analystId,
        component: analysisComponentId,
        estimation: 8,
        labels: [requirementsLabelId],
        kind: analysisTaskTypeId,
        milestone: null,
        dueDate: null
      },
      {
        id: generateId<Issue>(),
        title: 'UI/UX Design',
        description: 'Create mockups and user interface design',
        priority: IssuePriority.Medium,
        assignee: designerId,
        component: designComponentId,
        estimation: 16,
        labels: [designLabelId],
        kind: designTaskTypeId,
        milestone: null,
        dueDate: null
      },
      {
        id: generateId<Issue>(),
        title: 'Implementation',
        description: 'Implement the feature according to specifications',
        priority: IssuePriority.High,
        assignee: developerId,
        component: devComponentId,
        estimation: 24,
        labels: [developmentLabelId],
        kind: developmentTaskTypeId,
        milestone: null,
        dueDate: null
      },
      {
        id: generateId<Issue>(),
        title: 'Testing & QA',
        description: 'Test the implemented feature',
        priority: IssuePriority.Medium,
        assignee: testerId,
        component: qaComponentId,
        estimation: 8,
        labels: [testingLabelId],
        kind: testingTaskTypeId,
        milestone: null,
        dueDate: null
      }
    ],
    comments: 0,
    attachments: 0,
    relations: []
  }
)
```

### Querying Templates

#### Get All Templates for a Project

```typescript
// Get all templates in a project
const templates = await client.findAll(
  tracker.class.IssueTemplate,
  { space: projectId },
  {
    sort: { title: SortingOrder.Ascending },
    lookup: {
      assignee: contact.mixin.Employee,
      component: tracker.class.Component,
      milestone: tracker.class.Milestone
    }
  }
)
```

#### Search Templates

```typescript
// Search templates by title or description
const searchResults = await client.findAll(
  tracker.class.IssueTemplate,
  {
    space: projectId,
    $search: 'bug feature'
  }
)

// Filter templates by component
const componentTemplates = await client.findAll(
  tracker.class.IssueTemplate,
  {
    space: projectId,
    component: componentId
  }
)
```

### Updating Templates

#### Update Template Properties

```typescript
// Update template details
await client.update(template, {
  title: 'Updated Bug Report Template',
  description: 'Updated description with new sections',
  priority: IssuePriority.High,
  estimation: 4
})
```

#### Add Child Template

```typescript
// Add a new child template
const newChild: IssueTemplateChild = {
  id: generateId<Issue>(),
  title: 'Code Review',
  description: 'Review the implemented code',
  priority: IssuePriority.Medium,
  assignee: reviewerId,
  component: reviewComponentId,
  estimation: 2,
  labels: [reviewLabelId],
  kind: reviewTaskTypeId,
  milestone: null,
  dueDate: null
}

await client.update(template, {
  $push: { children: newChild }
})
```

#### Remove Child Template

```typescript
// Remove a child template by ID
await client.update(template, {
  $pull: { children: { id: childTemplateId } }
})
```

### Deleting Templates

```typescript
// Delete a template
await client.remove(template)
```

## Using Templates to Create Issues

### Create Issue from Template

```typescript
// Function to create issues from a template
async function createIssueFromTemplate(
  templateId: Ref<IssueTemplate>,
  projectSpace: Ref<Project>,
  overrides?: Partial<IssueTemplateData>
): Promise<Ref<Issue>> {
  // Get the template
  const template = await client.findOne(
    tracker.class.IssueTemplate,
    { _id: templateId }
  )
  
  if (!template) {
    throw new Error('Template not found')
  }

  // Create main issue from template
  const issueId = await client.addCollection(
    tracker.class.Issue,
    projectSpace,
    tracker.ids.NoParent,
    tracker.class.Issue,
    'subIssues',
    {
      title: overrides?.title || template.title,
      description: await convertMarkupToCollaborative(template.description),
      status: await getDefaultStatus(projectSpace),
      priority: overrides?.priority || template.priority,
      assignee: overrides?.assignee || template.assignee,
      component: overrides?.component || template.component,
      milestone: overrides?.milestone || template.milestone,
      estimation: overrides?.estimation || template.estimation,
      remainingTime: overrides?.estimation || template.estimation,
      dueDate: template.dueDate
    }
  )

  // Add labels from template
  if (template.labels) {
    for (const labelId of template.labels) {
      await client.addCollection(
        tags.class.TagReference,
        projectSpace,
        issueId,
        tracker.class.Issue,
        'labels',
        {
          title: '', // Will be filled by system
          color: 0,  // Will be filled by system
          tag: labelId
        }
      )
    }
  }

  // Create child issues from template children
  for (const childTemplate of template.children) {
    await client.addCollection(
      tracker.class.Issue,
      projectSpace,
      issueId,                           // Parent issue
      tracker.class.Issue,
      'subIssues',
      {
        title: childTemplate.title,
        description: await convertMarkupToCollaborative(childTemplate.description),
        status: await getDefaultStatus(projectSpace),
        priority: childTemplate.priority,
        assignee: childTemplate.assignee,
        component: childTemplate.component,
        milestone: childTemplate.milestone,
        estimation: childTemplate.estimation,
        remainingTime: childTemplate.estimation,
        dueDate: childTemplate.dueDate
      }
    )
  }

  return issueId
}

// Helper function to convert template markup to collaborative document
async function convertMarkupToCollaborative(markup: Markup): Promise<MarkupRef> {
  // Convert markup to collaborative document format
  // This would typically involve uploading the markup content
  return await client.uploadMarkup(
    tracker.class.Issue,
    generateId<Issue>(),
    'description',
    markup,
    'markup'
  )
}

// Helper function to get default status for project
async function getDefaultStatus(projectSpace: Ref<Project>): Promise<Ref<IssueStatus>> {
  const project = await client.findOne(tracker.class.Project, { _id: projectSpace })
  return project?.defaultIssueStatus || tracker.ids.DefaultStatus
}
```

### Batch Issue Creation from Template

```typescript
// Create multiple issues from template with different overrides
async function createIssuesFromTemplate(
  templateId: Ref<IssueTemplate>,
  projectSpace: Ref<Project>,
  issueOverrides: Array<Partial<IssueTemplateData> & { title: string }>
): Promise<Ref<Issue>[]> {
  const issueIds: Ref<Issue>[] = []
  
  for (const overrides of issueOverrides) {
    const issueId = await createIssueFromTemplate(
      templateId,
      projectSpace,
      overrides
    )
    issueIds.push(issueId)
  }
  
  return issueIds
}

// Usage example
const bugReportIssues = await createIssuesFromTemplate(
  bugTemplateId,
  projectSpace,
  [
    { title: 'Login page not loading', assignee: dev1Id, priority: IssuePriority.High },
    { title: 'Search function returns no results', assignee: dev2Id, priority: IssuePriority.Medium },
    { title: 'Profile image upload fails', assignee: dev1Id, priority: IssuePriority.Low }
  ]
)
```

## Template Management

### Template Categories and Organization

```typescript
// Templates are organized by:
// 1. Project space - each template belongs to a specific project
// 2. Task type (kind) - categorizes templates by purpose
// 3. Component - groups templates by system component
// 4. Labels - tags for additional categorization

// Get templates by category
const bugTemplates = await client.findAll(
  tracker.class.IssueTemplate,
  {
    space: projectId,
    kind: bugTaskTypeId
  }
)

const featureTemplates = await client.findAll(
  tracker.class.IssueTemplate,
  {
    space: projectId,
    kind: featureTaskTypeId
  }
)
```

### Template Validation

```typescript
// Validate template before creation
function validateTemplate(templateData: Data<IssueTemplate>): string[] {
  const errors: string[] = []
  
  if (!templateData.title.trim()) {
    errors.push('Template title is required')
  }
  
  if (templateData.estimation < 0) {
    errors.push('Estimation cannot be negative')
  }
  
  // Validate child templates
  for (const child of templateData.children) {
    if (!child.title.trim()) {
      errors.push(`Child template "${child.id}" must have a title`)
    }
    if (child.estimation < 0) {
      errors.push(`Child template "${child.title}" estimation cannot be negative`)
    }
  }
  
  return errors
}
```

### Template Import/Export

```typescript
// Export template for sharing
async function exportTemplate(templateId: Ref<IssueTemplate>): Promise<any> {
  const template = await client.findOne(
    tracker.class.IssueTemplate,
    { _id: templateId },
    {
      lookup: {
        assignee: contact.mixin.Employee,
        component: tracker.class.Component,
        milestone: tracker.class.Milestone
      }
    }
  )
  
  return {
    title: template.title,
    description: template.description,
    priority: template.priority,
    estimation: template.estimation,
    children: template.children,
    // Include lookup data for reference
    assigneeName: template.$lookup?.assignee?.name,
    componentName: template.$lookup?.component?.label,
    milestoneName: template.$lookup?.milestone?.label
  }
}

// Import template from exported data
async function importTemplate(
  templateData: any,
  projectSpace: Ref<Project>
): Promise<Ref<IssueTemplate>> {
  return await client.createDoc(
    tracker.class.IssueTemplate,
    projectSpace,
    {
      title: templateData.title,
      description: templateData.description,
      priority: templateData.priority || IssuePriority.Medium,
      assignee: null, // Reset assignee on import
      component: null, // Reset component on import
      milestone: null, // Reset milestone on import
      estimation: templateData.estimation || 0,
      children: templateData.children || [],
      comments: 0,
      attachments: 0,
      relations: []
    }
  )
}
```

## Best Practices

### 1. Template Naming Conventions
```typescript
// Use descriptive, consistent naming
const templateNames = [
  'Bug Report - Critical',
  'Bug Report - Standard',
  'Feature Request - New',
  'Feature Request - Enhancement',
  'Epic - Major Feature',
  'Spike - Research Task'
]
```

### 2. Template Hierarchy Design
```typescript
// Design logical parent-child relationships
// Parent: Epic or Feature
// Children: Analysis, Design, Implementation, Testing, Documentation
```

### 3. Default Values Strategy
```typescript
// Set sensible defaults that can be overridden
// - Priority: Medium (most common)
// - Estimation: Based on template complexity
// - Assignee: null (assign during issue creation)
// - Component: Most relevant component for template type
```

### 4. Template Maintenance
```typescript
// Regularly review and update templates
// - Remove unused templates
// - Update descriptions based on process changes
// - Adjust default estimations based on historical data
// - Update child template structures
```

This comprehensive guide covers all aspects of issue templates in Huly, providing the foundation for implementing template functionality in MCP servers.
