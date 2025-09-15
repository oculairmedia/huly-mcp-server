# Wizard Loading System Documentation

## Overview

The Huly MCP Server has a sophisticated wizard loading system that automatically discovers and registers wizard prompts. This document provides comprehensive information about how wizards are loaded, registered, and executed.

## System Architecture

### 1. Entry Point Flow

```
index.js → initializePrompts() → PromptRegistry.initialize() → Auto-discovery
```

**Main Entry Point**: `index.js`
- Calls `initializePrompts()` during server startup
- Located at line 104: `await initializePrompts();`

**Prompts System Entry**: `src/prompts/index.js`
- Exports `initializePrompts()` function (line 39)
- Initializes the prompt registry and loads all wizards
- Provides MCP integration functions

### 2. Auto-Discovery Mechanism

**Registry Location**: `src/prompts/base/PromptRegistry.js`

**Auto-Discovery Process** (lines 339-353):
```javascript
async initialize() {
  if (this.initialized) {
    logger.warn('Prompt registry already initialized');
    return;
  }

  logger.info('Initializing prompt registry...');

  const promptsDir = join(__dirname, '..', 'wizards');
  const loadedCount = await this.loadFromDirectory(promptsDir, 'wizards');

  this.initialized = true;

  logger.info(`Prompt registry initialized with ${loadedCount} prompts loaded`);
}
```

**Directory Loading** (lines 291-333):
- Scans `src/prompts/wizards/` directory
- Loads all `.js` files (excluding test files)
- Looks for `registerPrompts` export function
- Calls `registerPrompts(registry)` for each valid module

## Wizard File Structure

### Required Exports

Each wizard file must export:

1. **Wizard Class**: Extends `WizardPrompt`
2. **Wizard Instance**: Instantiated class
3. **Registration Function**: `registerPrompts(registry)`

### Example Structure

```javascript
// Import required base classes
import { WizardPrompt } from '../base/PromptInterface.js';

// Define wizard class
export class MyWizard extends WizardPrompt {
  constructor() {
    super({
      name: 'my-wizard',
      description: 'Description of wizard functionality',
      annotations: {
        wizard: true,  // REQUIRED for wizard prompts
        maxSteps: 5,
        estimatedTime: '10-15 minutes'
      },
      arguments: [
        // Define wizard arguments
      ],
      handler: async (...args) => this.execute(...args)
    });
  }

  async execute(args, context) {
    // Wizard implementation
  }
}

// Export wizard instance
export const myWizard = new MyWizard();

// REQUIRED: Registration function for auto-loading
export async function registerPrompts(registry) {
  registry.register(myWizard);
}
```

## Current Wizard Inventory

### Existing Wizards in `src/prompts/wizards/`:

1. **ProjectSetupWizard.js** (886 lines)
   - Status: ✅ Fully implemented
   - Purpose: Interactive project creation and configuration

2. **SprintPlanningWizard.js**
   - Status: ✅ Implemented
   - Purpose: Sprint planning and issue organization

3. **IssueWorkflowWizard.js**
   - Status: ✅ Implemented
   - Purpose: Issue creation and workflow management

4. **ReleaseManagerWizard.js** (802 lines)
   - Status: ⚠️ Partially implemented
   - Purpose: Release management and coordination

## Registration Process Details

### Registry Class: `PromptRegistry`

**Key Methods**:
- `register(prompt, category)` - Register a wizard instance
- `loadFromDirectory(directory, category)` - Auto-load from directory
- `initialize()` - Main initialization entry point

**Validation Requirements**:
- Prompt must be instance of `BasePrompt` or `WizardPrompt`
- Name must be valid kebab-case format
- No name conflicts allowed
- Wizard prompts must have `annotations.wizard: true`

### Loading Sequence

1. **Server Startup** (`index.js:104`)
   ```javascript
   await this.initializePromptSystem();
   ```

2. **Prompt System Init** (`src/prompts/index.js:39-53`)
   ```javascript
   export async function initializePrompts() {
     _initLogger();
     await promptRegistry.initialize();
     const stats = promptRegistry.getStatistics();
     logger.info('Prompt system initialized successfully', stats);
   }
   ```

3. **Registry Initialization** (`src/prompts/base/PromptRegistry.js:339`)
   ```javascript
   const promptsDir = join(__dirname, '..', 'wizards');
   const loadedCount = await this.loadFromDirectory(promptsDir, 'wizards');
   ```

4. **File Processing** (lines 305-327)
   - Skip non-JS files and test files
   - Dynamic import: `await import(\`file://\${filePath}\`)`
   - Call `registerPrompts(registry)` if exported

## Integration Points

### MCP Protocol Integration

**Handler Registration** (`src/protocol/MCPHandler.js`):
- `ListPromptsRequestSchema` - Lists available prompts
- `GetPromptRequestSchema` - Executes specific prompts

**Export Functions** (`src/prompts/index.js`):
- `getAllPromptDefinitions()` - MCP-compatible prompt list
- `executePrompt(name, args, context)` - Execute wizard by name
- `hasPrompt(name)` - Check wizard existence

### Service Integration

Wizards have access to:
- **Logger**: `getLogger()` from utils
- **Huly Client**: Via execution context
- **Services**: ProjectService, IssueService, etc.
- **State Management**: WizardStateManager for multi-step flows

## Debugging and Troubleshooting

### Common Issues

1. **Missing `annotations.wizard: true`**
   - Error: "Invalid value for annotations.wizard"
   - Fix: Add to wizard definition

2. **Missing `registerPrompts` export**
   - Warning: "Prompt file missing registerPrompts export"
   - Fix: Add registration function

3. **Invalid wizard name format**
   - Error: "Invalid value for prompt.name"
   - Fix: Use kebab-case naming

### Logging

**Log Locations**:
- Registry: `prompt-registry` logger
- System: `prompts-system` logger
- Individual wizards: Custom loggers

**Key Log Messages**:
- "Initializing prompt registry..."
- "Registered prompt: {name} in category: {category}"
- "Prompt registry initialized with {count} prompts loaded"

## File Locations Summary

```
src/prompts/
├── index.js                    # Main entry point
├── base/
│   ├── PromptRegistry.js      # Auto-discovery and registration
│   ├── PromptInterface.js     # Base classes (WizardPrompt)
│   └── WizardState.js         # State management
└── wizards/                   # Auto-loaded wizard directory
    ├── ProjectSetupWizard.js  # ✅ Complete
    ├── SprintPlanningWizard.js # ✅ Complete  
    ├── IssueWorkflowWizard.js # ✅ Complete
    ├── ReleaseManagerWizard.js # ⚠️ Partial
    └── __tests__/             # Test files (ignored by loader)
```

## Technical Implementation Details

### Base Classes and Interfaces

**WizardPrompt Class** (`src/prompts/base/PromptInterface.js`):
```javascript
export class WizardPrompt extends BasePrompt {
  constructor(definition) {
    super(definition);

    // Validates annotations.wizard === true
    if (!this.annotations.wizard) {
      throw HulyError.invalidValue(
        'annotations.wizard', this.annotations.wizard, 'true for wizard prompts'
      );
    }
  }
}
```

**Required Constructor Parameters**:
- `name`: Kebab-case wizard identifier
- `description`: Human-readable description
- `annotations.wizard`: Must be `true`
- `handler`: Function reference (usually `async (...args) => this.execute(...args)`)

### State Management

**WizardStateManager** (`src/prompts/base/WizardState.js`):
- Manages multi-step wizard sessions
- Tracks progress and user input
- Handles session persistence
- Provides step validation

### Service Dependencies

**Available Services** (via execution context):
- `ProjectService`: Project CRUD operations
- `IssueService`: Issue management
- `MilestoneService`: Milestone operations
- `ComponentService`: Component management
- `TemplateService`: Template operations

**Service Access Pattern**:
```javascript
async execute(args, context) {
  const { services } = context;
  const projectService = services.project;
  // Use service methods
}
```

### Error Handling

**HulyError Class** (`src/core/HulyError.js`):
- Standardized error handling
- Validation error types
- User-friendly error messages

**Common Error Patterns**:
```javascript
// Validation errors
throw HulyError.invalidValue('field', value, 'expected type');

// Not found errors
throw HulyError.notFound('entity', identifier);

// Business logic errors
throw new HulyError('BUSINESS_RULE', 'Custom error message');
```

## Testing Framework

### Test Structure

**Test Location**: `src/prompts/wizards/__tests__/`

**Example Test Pattern**:
```javascript
import { ProjectSetupWizard } from '../ProjectSetupWizard.js';

describe('ProjectSetupWizard', () => {
  let wizard;

  beforeEach(() => {
    wizard = new ProjectSetupWizard();
  });

  test('should register correctly', () => {
    expect(wizard.name).toBe('project-setup-wizard');
    expect(wizard.annotations.wizard).toBe(true);
  });
});
```

### Mock Context

**Test Context Setup**:
```javascript
const mockContext = {
  logger: mockLogger,
  services: {
    project: mockProjectService,
    issue: mockIssueService
  },
  registry: mockRegistry
};
```

## Performance Considerations

### Loading Optimization

**Lazy Loading**: Wizards are loaded once during server startup
**Memory Usage**: Registry maintains wizard instances in memory
**Execution**: Each wizard execution creates new session state

### Scalability

**Concurrent Sessions**: Multiple wizard sessions can run simultaneously
**Session Cleanup**: Automatic cleanup of expired sessions
**Resource Management**: Services are shared across wizard instances

## Security Considerations

### Input Validation

**Argument Sanitization** (`PromptUtils.sanitizeArguments`):
- Removes dangerous properties
- Validates input types
- Prevents injection attacks

### Access Control

**Context-Based Security**:
- User permissions passed via execution context
- Service-level authorization
- Project-specific access controls

## Next Steps for ReleaseManagerWizard

The ReleaseManagerWizard exists but needs completion:

### Implementation Tasks
1. **Complete Step Implementation**
   - Finish all 6 wizard steps
   - Add proper form validation
   - Implement step transitions

2. **Service Integration**
   - Connect to MilestoneService
   - Integrate with IssueService
   - Add ComponentService usage

3. **Error Handling**
   - Add comprehensive error handling
   - Implement rollback mechanisms
   - Add user-friendly error messages

4. **Testing**
   - Create unit tests
   - Add integration tests
   - Test MCP protocol compatibility

5. **Documentation**
   - Add inline code documentation
   - Create user guide
   - Document API integration points

### Verification Checklist
- [ ] Wizard loads without errors
- [ ] All steps execute correctly
- [ ] State management works properly
- [ ] Services integrate successfully
- [ ] MCP protocol responds correctly
- [ ] Error handling is comprehensive
- [ ] Tests pass completely
