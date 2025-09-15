# Wizard System API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [Wizard Definitions](#wizard-definitions)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Performance Considerations](#performance-considerations)

## Overview

The Huly MCP Server Wizard System provides an interactive, multi-step workflow framework for complex operations. It implements the MCP (Model Context Protocol) prompt specification to enable AI-guided workflows.

### Key Features
- **Multi-step Workflows**: Break complex operations into manageable steps
- **Session Management**: Persistent sessions with state preservation
- **Validation**: Built-in validation for each step
- **Navigation**: Forward/backward navigation with state retention
- **Performance Optimization**: Caching, pooling, and memory management
- **Resource Integration**: MCP resources for real-time state monitoring

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│                   MCP Protocol Layer                 │
├─────────────────────────────────────────────────────┤
│                 Prompt Registry System               │
├──────────────────┬──────────────────────────────────┤
│  Wizard Manager  │        Session Manager           │
├──────────────────┼──────────────────────────────────┤
│     Wizards      │     State & Performance          │
│  - ProjectSetup  │  - WizardState                   │
│  - SprintPlan    │  - WizardPerformance             │
│  - IssueWorkflow │  - LRU Cache                     │
└──────────────────┴──────────────────────────────────┘
```

### Core Components

1. **PromptInterface.js**: Base classes for prompts and wizards
2. **PromptRegistry.js**: Registration and discovery system
3. **WizardState.js**: Session and state management
4. **WizardPerformance.js**: Performance optimization layer
5. **WizardResources.js**: MCP resource definitions

## API Reference

### BasePrompt Class

```javascript
class BasePrompt {
  constructor(definition) {
    // definition: {
    //   name: string,
    //   description: string,
    //   arguments: Array<Argument>,
    //   handler: Function
    // }
  }

  async execute(args, context) {
    // Execute prompt logic
    // Returns: { success: boolean, data?: any, error?: string }
  }

  toMCPDefinition() {
    // Convert to MCP-compatible format
  }
}
```

### WizardPrompt Class

```javascript
class WizardPrompt extends BasePrompt {
  constructor(definition) {
    // definition extends BasePrompt definition with:
    // {
    //   steps: Array<WizardStep>,
    //   annotations: {
    //     wizard: true,
    //     maxSteps: number,
    //     estimatedTime: string
    //   }
    // }
  }

  async handleStart(session) { }
  async handleNext(session, stepData) { }
  async handlePrevious(session) { }
  async handleCancel(session) { }
  async handleFinish(session) { }
}
```

### WizardSession Class

```javascript
class WizardSession {
  constructor(id, wizardDefinition, initialState) { }

  // Navigation
  async nextStep(stepData) { }
  async previousStep() { }
  getCurrentStep() { }

  // State management
  setState(key, value) { }
  getState(key) { }
  getAllState() { }

  // Status
  getProgress() { }
  canGoBack() { }
  hasCompletedStep(stepId) { }
  complete() { }
  abort() { }
}
```

### WizardStateManager

```javascript
class WizardStateManager {
  createSession(wizardDefinition, initialState) { }
  getSession(sessionId) { }
  removeSession(sessionId) { }
  getAllSessions() { }
  cleanupExpiredSessions() { }
}
```

## Wizard Definitions

### Project Setup Wizard

```javascript
{
  name: 'project-setup-wizard',
  description: 'Interactive wizard for creating new projects',
  category: 'project-management',
  steps: [
    {
      id: 'project-basic-info',
      name: 'Project Basic Information',
      form: {
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'identifier', type: 'string', required: true },
          { name: 'description', type: 'text' }
        ]
      }
    },
    // ... more steps
  ]
}
```

### Sprint Planning Wizard

```javascript
{
  name: 'sprint-planning-wizard',
  description: 'Plan sprints with goals and issue prioritization',
  category: 'project-management',
  steps: [
    {
      id: 'sprint-details',
      name: 'Sprint Details',
      form: {
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'goal', type: 'string', required: true },
          { name: 'startDate', type: 'date', required: true },
          { name: 'endDate', type: 'date', required: true }
        ]
      }
    },
    // ... more steps
  ]
}
```

### Issue Workflow Wizard

```javascript
{
  name: 'issue-workflow-wizard',
  description: 'Guided issue creation with multiple methods',
  category: 'issue-management',
  arguments: [
    {
      name: 'mode',
      description: 'Wizard mode: create, bulk, template, or workflow',
      required: false,
      defaultValue: 'create'
    }
  ],
  steps: [
    {
      id: 'workflow-type',
      name: 'Select Workflow Type',
      form: {
        fields: [
          {
            name: 'workflowType',
            type: 'select',
            options: [
              { value: 'single', label: 'Create single issue' },
              { value: 'bulk', label: 'Bulk create issues' },
              { value: 'template', label: 'Create from template' }
            ]
          }
        ]
      }
    },
    // ... more steps
  ]
}
```

## Usage Examples

### Starting a Wizard

```javascript
// Via MCP prompt protocol
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "project-setup-wizard",
    "arguments": {
      "action": "start"
    }
  },
  "id": 1
}
```

### JavaScript API Usage

```javascript
import { promptRegistry } from './prompts/index.js';

// Start a wizard
const result = await promptRegistry.execute('project-setup-wizard', {
  action: 'start'
}, {
  sessionId: null // New session
});

// Continue with session
const nextResult = await promptRegistry.execute('project-setup-wizard', {
  action: 'next',
  stepData: {
    name: 'My Project',
    identifier: 'PROJ1',
    description: 'Project description'
  }
}, {
  sessionId: result.data.sessionId
});
```

### Complete Workflow Example

```javascript
// 1. Start wizard
let context = { sessionId: null };
let result = await wizard.execute({ action: 'start' }, context);

// 2. Complete first step
result = await wizard.execute({
  action: 'next',
  stepData: {
    name: 'Q1 Sprint',
    goal: 'Complete authentication',
    startDate: '2024-01-01',
    endDate: '2024-01-14'
  }
}, { sessionId: result.data.sessionId });

// 3. Navigate back if needed
result = await wizard.execute({
  action: 'previous'
}, { sessionId: result.data.sessionId });

// 4. Complete wizard
result = await wizard.execute({
  action: 'finish'
}, { sessionId: result.data.sessionId });
```

### Accessing Wizard Resources

```javascript
// Get active sessions
GET /resources/huly://wizards/sessions

// Get wizard catalog
GET /resources/huly://wizards/catalog

// Get specific session state
GET /resources/huly://wizards/session/{sessionId}

// Get performance metrics
GET /resources/huly://wizards/statistics
```

## Best Practices

### 1. Session Management

- **Always check session validity** before operations
- **Handle session timeouts** gracefully (30 minutes default)
- **Clean up completed sessions** to free resources

```javascript
const session = stateManager.getSession(sessionId);
if (!session) {
  // Create new session or handle error
}
```

### 2. State Validation

- **Validate at each step** before proceeding
- **Provide clear error messages** for validation failures
- **Use type-appropriate validators** for form fields

```javascript
async validateStepData(stepId, data, session) {
  switch(stepId) {
    case 'project-info':
      if (!data.name?.trim()) {
        throw new Error('Project name is required');
      }
      // More validation...
      break;
  }
}
```

### 3. Error Handling

- **Wrap operations in try-catch** blocks
- **Log errors appropriately** for debugging
- **Return user-friendly error messages**

```javascript
try {
  const result = await wizard.execute(args, context);
  return result;
} catch (error) {
  logger.error('Wizard execution failed', { error });
  return {
    success: false,
    error: error.message
  };
}
```

### 4. Performance Optimization

- **Use caching** for frequently accessed data
- **Implement lazy loading** for heavy resources
- **Monitor memory usage** in production

```javascript
// Enable performance optimization
const optimizedManager = createOptimizedStateManager(baseManager);

// Use memoization for expensive operations
const memoizedLoader = memoize(loadProjects, {
  maxSize: 50,
  ttl: 300000 // 5 minutes
});
```

## Performance Considerations

### Configuration Options

```javascript
const PERFORMANCE_CONFIG = {
  maxConcurrentSessions: 100,
  sessionTimeoutMs: 30 * 60 * 1000,
  cleanupIntervalMs: 5 * 60 * 1000,
  cacheMaxSize: 50,
  cacheTTLMs: 10 * 60 * 1000,
  maxStateSize: 1024 * 1024, // 1MB
  enableCompression: true,
  enableMetrics: true
};
```

### Monitoring Metrics

```javascript
const metrics = optimizedManager.getPerformanceMetrics();
// {
//   sessions: { created, completed, aborted, timedOut },
//   cache: { hits, misses, hitRate },
//   performance: { averageStepTimeMs, memoryUsageMB },
//   errors: count
// }
```

### Memory Management

- **Session pooling** reduces object creation overhead
- **LRU cache** prevents unbounded memory growth
- **Automatic cleanup** removes expired sessions
- **State compression** for large session data

### Scaling Considerations

1. **Horizontal Scaling**: Sessions can be distributed across instances
2. **Database Persistence**: Store session state in database for durability
3. **Load Balancing**: Use sticky sessions for wizard continuity
4. **Rate Limiting**: Prevent abuse with per-user limits

## Testing

### Unit Testing

```javascript
import { jest } from '@jest/globals';
import { ProjectSetupWizard } from './wizards/ProjectSetupWizard.js';

describe('ProjectSetupWizard', () => {
  test('should create session and start at first step', async () => {
    const wizard = new ProjectSetupWizard();
    const result = await wizard.execute({}, { sessionId: null });

    expect(result.success).toBe(true);
    expect(result.data.currentStep.id).toBe('project-basic-info');
  });
});
```

### Integration Testing

```javascript
describe('Wizard Integration', () => {
  test('complete project creation workflow', async () => {
    // Test full wizard flow
    const wizard = new ProjectSetupWizard();
    let context = { sessionId: null };

    // Start wizard
    let result = await wizard.execute({}, context);
    const sessionId = result.data.sessionId;

    // Complete all steps...
    // Verify project creation
  });
});
```

### Load Testing

```javascript
async function loadTest() {
  const promises = [];

  // Create 50 concurrent sessions
  for (let i = 0; i < 50; i++) {
    promises.push(
      wizard.execute({}, { sessionId: null })
    );
  }

  const results = await Promise.all(promises);

  // Verify all succeeded
  const succeeded = results.filter(r => r.success).length;
  console.log(`Success rate: ${succeeded}/50`);
}
```

## Troubleshooting

### Common Issues

1. **Session Not Found**
   - Session may have expired (30 minute timeout)
   - Session ID may be invalid
   - Solution: Create new session

2. **Validation Errors**
   - Required fields missing
   - Invalid data format
   - Solution: Check field requirements and formats

3. **Performance Issues**
   - Too many concurrent sessions
   - Memory leaks from unclosed sessions
   - Solution: Enable performance optimization, monitor metrics

4. **State Inconsistency**
   - Navigation without saving state
   - Concurrent modifications
   - Solution: Implement proper state management

## Migration Guide

### From Direct API Calls to Wizards

```javascript
// Before: Direct API calls
const project = await projectService.createProject({
  name: 'My Project',
  // ... many fields
});

// After: Wizard-guided creation
const wizard = new ProjectSetupWizard();
const result = await wizard.execute({}, {});
// Follow wizard steps...
```

### Custom Wizard Creation

```javascript
import { WizardPrompt } from './base/PromptInterface.js';

export class CustomWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'custom-wizard',
      description: 'Custom workflow wizard',
      steps: [
        // Define your steps
      ],
      handler: this.execute.bind(this)
    });
  }

  async execute(args, context) {
    // Implement wizard logic
  }
}
```

## Support and Resources

- **GitHub Repository**: [huly-mcp-server](https://github.com/oculairmedia/huly-mcp-server)
- **Issue Tracker**: Report bugs and request features
- **Documentation**: This document and inline code documentation
- **Examples**: See `/examples` directory for usage examples

## License

This wizard system is part of the Huly MCP Server project and follows the same licensing terms.