# HULLY-314: Project Setup Wizard - Logger Import Issues Report

## Executive Summary

The Project Setup Wizard (`project-setup-wizard`) is blocked due to fragile logger usage that assumes `context.logger` is always available. When the MCP context doesn't inject a logger, any logging call throws a TypeError, preventing wizard execution.

## Technical Analysis

### Current Implementation
- **File**: `src/prompts/wizards/ProjectSetupWizard.js`
- **Status**: ❌ Blocked - Runtime logger dependency failures
- **Root Cause**: Assumes `context.logger` exists without fallback

### Logger Usage Pattern
The wizard uses `context.logger` throughout without defensive checks:

```javascript
// In execute method (line 117)
context.logger.error('Project setup wizard error:', error);

// In startWizard method (line 138)
context.logger.info(`Started project setup wizard session: ${session.sessionId}`);

// In continueWizard method (line 168)
context.logger.error('Error continuing wizard:', error);
```

### What Works Correctly
✅ **Wizard Structure**: Properly extends WizardPrompt with `annotations.wizard = true`
✅ **Session Management**: Correctly creates sessions via `getWizardStateManager().createSession()`
✅ **Step Registration**: Properly calls `session.setSteps(this.steps)`
✅ **Response Utilities**: Uses existing `PromptUtils.createErrorResponse/createSuccessResponse`

### Failure Scenarios
1. **MCP Context Missing Logger**: When `context.logger` is undefined
2. **Test Environments**: Unit tests without full context setup
3. **Standalone Execution**: Direct prompt execution outside MCP framework

## Root Cause Analysis

### Primary Issue: Fragile Logger Dependency
```javascript
// Current problematic pattern
context.logger.error('Project setup wizard error:', error);
// Throws: TypeError: Cannot read properties of undefined (reading 'error')
```

### Impact Assessment
- **Severity**: High - Prevents wizard initialization and execution
- **Scope**: All logging paths in the wizard
- **User Impact**: Complete wizard unavailability

## Recommended Solutions

### Solution 1: Defensive Logger Access (Minimal Fix)
Add null-safe logging throughout:

```javascript
// Replace all context.logger calls with:
context.logger?.error('Project setup wizard error:', error);
context.logger?.info(`Started project setup wizard session: ${session.sessionId}`);
```

**Pros**: Minimal code changes, immediate fix
**Cons**: Silent logging failures, no fallback logging

### Solution 2: Logger Fallback Pattern (Recommended)
Implement a robust logger accessor:

```javascript
// Add import
import { getLogger } from '../../utils/index.js';

// Add method to class
getLoggerSafe(context) {
  return (context && context.logger) ? context.logger : getLogger();
}

// Replace usage
this.getLoggerSafe(context).error('Project setup wizard error:', error);
this.getLoggerSafe(context).info(`Started project setup wizard session: ${session.sessionId}`);
```

**Pros**: Guaranteed logging, consistent behavior, maintains functionality
**Cons**: Slightly more code changes

### Solution 3: Class-Level Logger (Alternative)
Initialize a dedicated logger for the wizard:

```javascript
// Add to constructor
import { createLoggerWithConfig } from '../../utils/index.js';
import { getConfigManager } from '../../config/index.js';

constructor() {
  super(/* ... */);
  this.logger = createLoggerWithConfig(getConfigManager()).child('project-setup-wizard');
}

// Use throughout
this.logger.error('Project setup wizard error:', error);
```

**Pros**: Clean separation, named logging, no context dependency
**Cons**: More initialization complexity

## Implementation Plan

### Phase 1: Immediate Fix (Recommended Solution 2)
1. Add logger import to ProjectSetupWizard.js
2. Implement `getLoggerSafe(context)` method
3. Replace all `context.logger` calls with `this.getLoggerSafe(context)`
4. Test wizard initialization and execution

### Phase 2: Verification
1. **Unit Tests**: Verify wizard loads without context.logger
2. **Integration Tests**: Test with and without MCP context
3. **Error Path Testing**: Confirm logging works in failure scenarios

### Code Changes Required

#### File: `src/prompts/wizards/ProjectSetupWizard.js`

**Add Import** (after line 10):
```javascript
import { getLogger } from '../../utils/index.js';
```

**Add Method** (after constructor):
```javascript
/**
 * Get logger with fallback to default logger
 * @param {Object} context - Execution context
 * @returns {Object} Logger instance
 */
getLoggerSafe(context) {
  return (context && context.logger) ? context.logger : getLogger();
}
```

**Replace Logger Calls**:
- Line 117: `this.getLoggerSafe(context).error('Project setup wizard error:', error);`
- Line 138: `this.getLoggerSafe(context).info(\`Started project setup wizard session: ${session.sessionId}\`);`
- Line 168: `this.getLoggerSafe(context).error('Error continuing wizard:', error);`

## Testing Strategy

### Test Cases
1. **Normal Operation**: Execute with full MCP context including logger
2. **Missing Logger**: Execute with context but no logger property
3. **No Context**: Execute with empty/undefined context
4. **Error Paths**: Trigger validation errors and confirm logging works

### Verification Commands
```javascript
// Test 1: Normal execution
await executePrompt('project-setup-wizard', { mode: 'start' }, { logger: getLogger() });

// Test 2: Missing logger
await executePrompt('project-setup-wizard', { mode: 'start' }, {});

// Test 3: Error path
await executePrompt('project-setup-wizard', { mode: 'continue', sessionId: 'invalid' }, {});
```

## Risk Assessment

### Low Risk Changes
- Adding logger import and fallback method
- Defensive logger access pattern

### Validation Required
- Ensure getLogger() import works correctly
- Verify logging output in different environments
- Confirm no performance impact from logger checks

## Success Criteria

✅ **Wizard Loads**: `initializePrompts()` completes without errors
✅ **Execution Works**: Can start wizard without context.logger
✅ **Logging Functions**: All log messages appear in appropriate environments
✅ **Error Handling**: Graceful degradation when logging fails
✅ **Backward Compatibility**: Works with existing MCP context patterns

## Timeline

- **Implementation**: 30 minutes
- **Testing**: 1 hour
- **Verification**: 30 minutes
- **Total**: 2 hours

## Dependencies

- `src/utils/index.js` - getLogger export
- `src/prompts/base/PromptInterface.js` - PromptUtils (already working)
- `src/prompts/base/WizardState.js` - getWizardStateManager (already working)

## Follow-up Actions

1. Apply similar fixes to other wizards with logger issues
2. Consider standardizing logger patterns across all prompts
3. Add logging guidelines to development documentation
4. Implement automated tests for context-independent execution
