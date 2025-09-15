# HULLY-319: Sprint Planning Wizard - Logger Import Issues Report

## Executive Summary

The Sprint Planning Wizard (`sprint-planning-wizard`) is blocked by two critical issues: missing logger import causing ReferenceError, and improper step configuration leading to empty step arrays. These prevent the wizard from loading and executing.

## Technical Analysis

### Current Implementation
- **File**: `src/prompts/wizards/SprintPlanningWizard.js`
- **Status**: ❌ Blocked - Import errors and step configuration failures
- **Root Causes**: 
  1. Missing `getLogger` import
  2. Steps not properly bound to instance

### Critical Issues Identified

#### Issue 1: Missing Logger Import
```javascript
// Line 218: getLogger called but not imported
this.logger = getLogger('sprint-planning-wizard');
// Throws: ReferenceError: getLogger is not defined
```

#### Issue 2: Steps Configuration Problem
```javascript
// Lines 36-204: Steps defined in super() call
super({
  // ...
  steps: [ /* step definitions */ ]
});

// Line 210: Steps not preserved
this.steps = this.annotations.steps || []; // Results in []

// Line 234: Empty array passed to setSteps
session.setSteps(this.steps); // Throws: "Steps must be a non-empty array"
```

### Additional Runtime Dependencies
The wizard references several unimported services:
- `createHulyClient` (lines 454, 484, 518, 573)
- `ProjectService` (line 455)
- `IssueService` (lines 485, 576, 696)
- `MilestoneService` (line 576)
- `TemplateService` (line 727)
- `tracker` (line 521)

## Root Cause Analysis

### Primary Issue: Import Dependencies
1. **Logger Import Missing**: `getLogger` used but not imported
2. **Service Imports Missing**: Multiple services referenced without imports
3. **Step Binding Failure**: BasePrompt doesn't preserve `steps` property

### Secondary Issue: Architecture Pattern
The wizard attempts to define steps in the super() call, but BasePrompt only preserves:
- name, description, arguments, handler, annotations

Custom properties like `steps` are ignored, leading to empty step arrays.

## Recommended Solutions

### Solution 1: Fix Logger Import (Critical)
```javascript
// Add missing import
import { getLogger } from '../../utils/index.js';
```

### Solution 2: Fix Steps Configuration (Critical)
Move steps out of super() and assign to instance:

```javascript
// Current problematic pattern
super({
  name: 'sprint-planning-wizard',
  // ... other props
  steps: [ /* steps */ ], // This gets lost
  handler: async (...args) => this.execute(...args)
});

// Fixed pattern
super({
  name: 'sprint-planning-wizard',
  // ... other props (no steps here)
  handler: async (...args) => this.execute(...args)
});

// Assign steps to instance after super
this.steps = [
  {
    id: 'sprint-details',
    name: 'Sprint Details',
    // ... step definition
  },
  // ... other steps
];
```

### Solution 3: Handle Runtime Dependencies
**Option A: Context Injection (Recommended)**
```javascript
// Accept services via context
const { services } = context;
const projects = await services.project.listProjects();
```

**Option B: Dynamic Imports**
```javascript
// Import when needed
async loadProjects(step, session) {
  const { createHulyClient } = await import('../../client/index.js');
  const { ProjectService } = await import('../../services/ProjectService.js');
  // ... rest of method
}
```

**Option C: Static Imports**
```javascript
// Add all required imports at top
import { createHulyClient } from '../../client/index.js';
import { ProjectService } from '../../services/ProjectService.js';
// ... etc
```

## Implementation Plan

### Phase 1: Critical Fixes
1. **Add Logger Import**
   ```javascript
   import { getLogger } from '../../utils/index.js';
   ```

2. **Fix Steps Configuration**
   - Remove `steps` from super() call
   - Assign `this.steps = [...]` after super()
   - Remove line 210: `this.steps = this.annotations.steps || [];`

### Phase 2: Service Dependencies
1. **Choose dependency strategy** (recommend Context Injection)
2. **Update service usage** in load methods
3. **Add error handling** for missing services

### Code Changes Required

#### File: `src/prompts/wizards/SprintPlanningWizard.js`

**Add Import** (line 8):
```javascript
import { getLogger } from '../../utils/index.js';
```

**Fix Constructor** (lines 13-213):
```javascript
export class SprintPlanningWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'sprint-planning-wizard',
      description: 'Interactive wizard for planning sprints, setting goals, and prioritizing issues',
      category: 'project-management',
      annotations: {
        wizard: true,
        maxSteps: 6,
        estimatedTime: '10-15 minutes',
        tags: ['sprint', 'planning', 'milestone', 'agile']
      },
      arguments: [
        {
          name: 'projectId',
          description: 'Project ID to create sprint for (optional)',
          required: false
        },
        {
          name: 'sprintName',
          description: 'Suggested sprint name (optional)',
          required: false
        }
      ],
      // Use arrow function to delegate to execute method
      handler: async (...args) => this.execute(...args)
    });

    // Store steps on the instance (moved from super call)
    this.steps = [
      {
        id: 'sprint-details',
        name: 'Sprint Details',
        description: 'Define sprint name, duration, and goals',
        form: {
          fields: [
            // ... field definitions
          ]
        }
      },
      // ... other steps
    ];

    this.logger = null; // Lazy initialization
  }
```

**Remove Line 210**:
```javascript
// DELETE THIS LINE:
// this.steps = this.annotations.steps || [];
```

## Testing Strategy

### Test Cases
1. **Module Loading**: Verify wizard loads without ReferenceError
2. **Session Creation**: Confirm setSteps() works with proper step array
3. **Step Navigation**: Test step transitions and validation
4. **Service Integration**: Verify service calls work (with chosen dependency strategy)

### Verification Commands
```javascript
// Test 1: Module loads
import { sprintPlanningWizard } from './src/prompts/wizards/SprintPlanningWizard.js';

// Test 2: Session creation
await executePrompt('sprint-planning-wizard', { action: 'start' }, {});

// Test 3: Step progression
await executePrompt('sprint-planning-wizard', { 
  action: 'next', 
  stepData: { name: 'Sprint 1', goal: 'Test goal' } 
}, { sessionId: 'test-session' });
```

## Risk Assessment

### High Risk Areas
- Service dependency changes may affect runtime behavior
- Step configuration changes could break existing sessions

### Mitigation Strategies
- Test with existing session data
- Implement graceful fallbacks for missing services
- Validate step definitions match expected schema

## Success Criteria

✅ **Module Loads**: No ReferenceError on import
✅ **Logger Works**: getLogger() calls succeed
✅ **Steps Initialize**: setSteps() accepts non-empty array
✅ **Session Creation**: Can create and navigate wizard sessions
✅ **Service Integration**: Chosen dependency strategy works
✅ **Error Handling**: Graceful degradation when services unavailable

## Timeline

- **Critical Fixes**: 1 hour
- **Service Dependencies**: 2 hours
- **Testing**: 2 hours
- **Total**: 5 hours

## Dependencies

### Required Imports
- `../../utils/index.js` - getLogger
- Service modules (based on chosen strategy)

### External Dependencies
- Huly client and services (for runtime functionality)
- WizardState management (already working)

## Follow-up Actions

1. Apply similar fixes to IssueWorkflowWizard
2. Establish patterns for service dependency injection
3. Create wizard development guidelines
4. Add integration tests for service interactions
