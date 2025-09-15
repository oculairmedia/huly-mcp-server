# HULLY-316: Issue Workflow Wizard - Logger Import Issues Report

## Executive Summary

The Issue Workflow Wizard (`issue-workflow-wizard`) is blocked by identical issues to the Sprint Planning Wizard: missing logger import causing ReferenceError and improper step configuration. Additionally, it has extensive runtime service dependencies that prevent execution.

## Technical Analysis

### Current Implementation
- **File**: `src/prompts/wizards/IssueWorkflowWizard.js`
- **Status**: ❌ Blocked - Import errors, step configuration failures, service dependencies
- **Root Causes**: 
  1. Missing `getLogger` import
  2. Steps not properly bound to instance
  3. Heavy runtime service dependencies

### Critical Issues Identified

#### Issue 1: Missing Logger Import
```javascript
// Line 186: getLogger called but not imported
this.logger = getLogger('issue-workflow-wizard');
// Throws: ReferenceError: getLogger is not defined
```

#### Issue 2: Steps Configuration Problem
```javascript
// Lines 37-173: Steps defined in super() call
super({
  // ...
  steps: [ /* extensive step definitions */ ]
});

// Line 179: Steps not preserved
this.steps = this.annotations.steps || []; // Results in []

// Line 202: Empty array passed to setSteps
session.setSteps(this.steps); // Throws: "Steps must be a non-empty array"
```

#### Issue 3: Extensive Runtime Dependencies
The wizard references multiple unimported services throughout:
- `createHulyClient` (lines 361, 581, 604, 693)
- `ProjectService` (line 362)
- `IssueService` (lines 582, 628, 696)
- `TemplateService` (lines 534, 727)
- `tracker` (lines 608, 618)

### Wizard Complexity Analysis
This wizard is the most complex of the three, supporting 5 different workflow types:
1. **Single Issue Creation** - Standard issue creation
2. **Bulk Issue Creation** - Multiple issues at once
3. **Template-based Creation** - Using predefined templates
4. **Import from CSV/JSON** - Data import functionality
5. **Clone Existing Issues** - Duplicate with modifications

Each workflow type requires different service integrations and data processing.

## Root Cause Analysis

### Primary Issues
1. **Logger Import Missing**: Same pattern as Sprint Planning Wizard
2. **Step Configuration Failure**: BasePrompt doesn't preserve custom `steps` property
3. **Service Architecture**: Heavy coupling to runtime services without proper imports

### Secondary Issues
1. **Complex Dynamic Forms**: Steps change based on workflow type selection
2. **Data Processing Logic**: CSV/JSON parsing, issue cloning logic
3. **Advanced Options**: Sprint assignment, automation rules, linking

## Recommended Solutions

### Solution 1: Fix Logger Import (Critical)
```javascript
// Add missing import
import { getLogger } from '../../utils/index.js';
```

### Solution 2: Fix Steps Configuration (Critical)
Same pattern as Sprint Planning Wizard - move steps out of super():

```javascript
// Current problematic pattern
super({
  name: 'issue-workflow-wizard',
  // ... other props
  steps: [ /* complex step definitions */ ], // This gets lost
  handler: async (...args) => this.execute(...args)
});

// Fixed pattern
super({
  name: 'issue-workflow-wizard',
  // ... other props (no steps here)
  handler: async (...args) => this.execute(...args)
});

// Assign steps to instance after super
this.steps = [
  {
    id: 'workflow-type',
    name: 'Select Workflow Type',
    // ... step definition
  },
  // ... other steps
];
```

### Solution 3: Service Dependency Strategy
Given the complexity, recommend **Context Injection** pattern:

```javascript
// Update service usage throughout
async loadProjects(step, session, context) {
  try {
    const { services } = context;
    if (!services?.project) {
      throw new Error('Project service not available');
    }
    
    const projects = await services.project.listProjects();
    // ... rest of method
  } catch (error) {
    this.getLogger().error('Failed to load projects', { error });
    step.form.fields[1].options = [];
  }
}
```

## Implementation Plan

### Phase 1: Critical Fixes (Immediate)
1. **Add Logger Import**
2. **Fix Steps Configuration** 
3. **Test Basic Loading**

### Phase 2: Service Integration (Next)
1. **Define Context Service Interface**
2. **Update All Service Usage Methods**
3. **Add Error Handling for Missing Services**

### Phase 3: Advanced Features (Later)
1. **CSV/JSON Import Logic**
2. **Issue Cloning Functionality**
3. **Automation Rules Setup**

### Code Changes Required

#### File: `src/prompts/wizards/IssueWorkflowWizard.js`

**Add Import** (line 8):
```javascript
import { getLogger } from '../../utils/index.js';
```

**Fix Constructor** (lines 13-182):
```javascript
export class IssueWorkflowWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'issue-workflow-wizard',
      description: 'Interactive wizard for guided issue creation, bulk operations, and template management',
      category: 'issue-management',
      annotations: {
        wizard: true,
        maxSteps: 5,
        estimatedTime: '5-10 minutes',
        tags: ['issue', 'workflow', 'template', 'bulk']
      },
      arguments: [
        {
          name: 'mode',
          description: 'Wizard mode: create, bulk, template, or workflow',
          required: false,
          defaultValue: 'create'
        },
        {
          name: 'projectId',
          description: 'Project ID for issue creation',
          required: false
        }
      ],
      // Use arrow function to delegate to execute method
      handler: async (...args) => this.execute(...args)
    });

    // Store steps on the instance (moved from super call)
    this.steps = [
      {
        id: 'workflow-type',
        name: 'Select Workflow Type',
        description: 'Choose the type of issue operation',
        form: {
          fields: [
            // ... field definitions
          ]
        }
      },
      // ... other steps
    ];

    this.logger = null;
  }
```

**Remove Line 179**:
```javascript
// DELETE THIS LINE:
// this.steps = this.annotations.steps || [];
```

**Update Service Methods** (example for loadProjects):
```javascript
async loadProjects(step, session, context) {
  try {
    const { services } = context;
    if (!services?.project) {
      this.getLogger().warn('Project service not available');
      step.form.fields[1].options = [];
      return;
    }

    const projects = await services.project.listProjects();
    step.form.fields[1].options = projects.map(p => ({
      value: p._id,
      label: `${p.identifier} - ${p.name}`
    }));

    if (session.getState('projectId')) {
      step.form.fields[1].defaultValue = session.getState('projectId');
    }
  } catch (error) {
    this.getLogger().error('Failed to load projects', { error });
    step.form.fields[1].options = [];
  }
}
```

## Service Integration Requirements

### Context Service Interface
The wizard expects these services in context:
```javascript
context.services = {
  project: {
    listProjects: () => Promise<Project[]>
  },
  issue: {
    listIssues: (options) => Promise<Issue[]>,
    createIssue: (data) => Promise<Issue>,
    bulkCreateIssues: (issues) => Promise<Issue[]>,
    getIssueDetails: (id) => Promise<Issue>,
    updateIssue: (id, data) => Promise<Issue>,
    createSubissue: (parentId, data) => Promise<Issue>
  },
  template: {
    listTemplates: () => Promise<Template[]>,
    createIssueFromTemplate: (templateId, data) => Promise<Issue>
  }
};
```

### Methods Requiring Service Updates
1. `loadProjects()` - Project service
2. `configureIssueDetailsStep()` - Multiple services based on workflow type
3. `loadTemplateFields()` - Template service
4. `loadIssuesForCloning()` - Issue service
5. `loadAdvancedOptions()` - Issue service for labels/milestones
6. `createIssues()` - All services based on workflow type

## Testing Strategy

### Test Cases
1. **Module Loading**: Verify no ReferenceError on import
2. **Basic Wizard Flow**: Test workflow type selection
3. **Service Integration**: Test with mock services
4. **Error Handling**: Test with missing services
5. **Workflow Types**: Test each of the 5 workflow types

### Mock Context for Testing
```javascript
const mockContext = {
  services: {
    project: {
      listProjects: () => Promise.resolve([
        { _id: 'proj1', identifier: 'TEST', name: 'Test Project' }
      ])
    },
    issue: {
      listIssues: () => Promise.resolve([]),
      createIssue: (data) => Promise.resolve({ _id: 'issue1', ...data })
    },
    template: {
      listTemplates: () => Promise.resolve([])
    }
  }
};
```

## Risk Assessment

### High Risk Areas
- Complex workflow type switching logic
- Data import/export functionality
- Service dependency changes

### Mitigation Strategies
- Implement comprehensive error handling
- Add fallback options for missing services
- Test each workflow type independently

## Success Criteria

✅ **Module Loads**: No ReferenceError on import
✅ **Logger Works**: getLogger() calls succeed  
✅ **Steps Initialize**: setSteps() accepts non-empty array
✅ **Workflow Selection**: Can select and configure workflow types
✅ **Service Integration**: All service calls work with context injection
✅ **Error Handling**: Graceful degradation for missing services
✅ **Workflow Types**: All 5 workflow types function correctly

## Timeline

- **Critical Fixes**: 1 hour
- **Service Integration**: 4 hours
- **Workflow Type Testing**: 3 hours
- **Advanced Features**: 4 hours
- **Total**: 12 hours

## Dependencies

### Required Imports
- `../../utils/index.js` - getLogger

### Service Dependencies
- Project service for project listing
- Issue service for CRUD operations
- Template service for template-based creation
- Milestone/Label services for advanced options

## Follow-up Actions

1. Establish service injection patterns for all wizards
2. Create comprehensive wizard testing framework
3. Document workflow type extension patterns
4. Implement wizard performance monitoring
