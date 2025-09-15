# Wizard Prompts Logger Import Issues - Summary Report

## Overview

Three critical wizard prompts in the Huly MCP server are blocked due to logger import issues and related configuration problems. This summary provides a consolidated view of the issues and recommended fixes.

## Affected Wizards

| Wizard | Issue ID | Status | Primary Issues |
|--------|----------|--------|----------------|
| Project Setup Wizard | HULLY-314 | ❌ Blocked | Fragile logger dependency |
| Sprint Planning Wizard | HULLY-319 | ❌ Blocked | Missing logger import, step config |
| Issue Workflow Wizard | HULLY-316 | ❌ Blocked | Missing logger import, step config, service deps |

## Common Issues Across All Wizards

### 1. Logger Dependency Problems
- **Project Setup**: Assumes `context.logger` exists without fallback
- **Sprint Planning**: Missing `getLogger` import, causes ReferenceError
- **Issue Workflow**: Missing `getLogger` import, causes ReferenceError

### 2. Step Configuration Issues (Sprint & Issue Wizards)
Both wizards define steps in `super()` call, but BasePrompt doesn't preserve custom properties:
```javascript
// Problematic pattern
super({
  steps: [...], // Gets lost
  handler: async (...args) => this.execute(...args)
});
this.steps = this.annotations.steps || []; // Results in []
```

### 3. Service Dependencies (Sprint & Issue Wizards)
Multiple unimported services referenced:
- `createHulyClient`
- `ProjectService`, `IssueService`, `TemplateService`, `MilestoneService`
- `tracker` class references

## Root Cause Analysis

### Architectural Issues
1. **Inconsistent Logger Patterns**: Each wizard handles logging differently
2. **BasePrompt Limitations**: Doesn't preserve custom constructor properties
3. **Service Coupling**: Heavy runtime dependencies without proper imports
4. **Context Assumptions**: Assumes MCP context always provides certain objects

### Impact Assessment
- **Severity**: Critical - Complete wizard system unavailability
- **Scope**: All three main wizard prompts
- **User Impact**: No guided workflows available
- **Development Impact**: Blocks wizard-based features

## Recommended Fix Strategy

### Phase 1: Critical Fixes (Immediate - 2 hours)
Apply minimal fixes to unblock all wizards:

#### Project Setup Wizard
```javascript
// Add defensive logger access
import { getLogger } from '../../utils/index.js';

getLoggerSafe(context) {
  return (context && context.logger) ? context.logger : getLogger();
}

// Replace all context.logger calls
this.getLoggerSafe(context).error(...);
```

#### Sprint Planning & Issue Workflow Wizards
```javascript
// 1. Add logger import
import { getLogger } from '../../utils/index.js';

// 2. Move steps out of super() call
super({ /* no steps here */ });
this.steps = [ /* step definitions */ ];

// 3. Remove problematic line
// DELETE: this.steps = this.annotations.steps || [];
```

### Phase 2: Service Integration (Next - 4 hours)
Implement consistent service dependency pattern:

```javascript
// Context injection pattern
const { services } = context;
if (!services?.project) {
  this.getLogger().warn('Project service not available');
  return fallbackBehavior();
}
const projects = await services.project.listProjects();
```

### Phase 3: Standardization (Later - 4 hours)
- Establish wizard development patterns
- Create service injection framework
- Add comprehensive testing

## Implementation Priority

### High Priority (Fix Immediately)
1. **HULLY-314**: Add logger fallback to Project Setup Wizard
2. **HULLY-319**: Fix logger import and steps in Sprint Planning Wizard  
3. **HULLY-316**: Fix logger import and steps in Issue Workflow Wizard

### Medium Priority (Next Sprint)
1. Service dependency injection framework
2. Wizard testing infrastructure
3. Development guidelines

### Low Priority (Future)
1. Advanced workflow features
2. Performance optimization
3. Enhanced error reporting

## Testing Strategy

### Verification Steps
1. **Module Loading**: All wizards import without errors
2. **Basic Execution**: Can start each wizard
3. **Error Handling**: Graceful degradation when services missing
4. **Integration**: Works with full MCP context

### Test Commands
```bash
# Test module loading
npm test -- --grep "wizard.*load"

# Test basic execution
npm test -- --grep "wizard.*execute"

# Test error handling
npm test -- --grep "wizard.*error"
```

## Success Metrics

### Immediate Success (Phase 1)
- ✅ All three wizards load without ReferenceError
- ✅ Basic wizard execution works
- ✅ Logging functions in all environments

### Short-term Success (Phase 2)
- ✅ Service integration works
- ✅ All workflow types functional
- ✅ Comprehensive error handling

### Long-term Success (Phase 3)
- ✅ Consistent wizard development patterns
- ✅ Automated testing coverage
- ✅ Performance benchmarks met

## Risk Mitigation

### Technical Risks
- **Breaking Changes**: Test with existing sessions
- **Service Dependencies**: Implement graceful fallbacks
- **Performance Impact**: Monitor logger overhead

### Mitigation Strategies
- Incremental rollout of fixes
- Comprehensive testing at each phase
- Rollback plan for each change

## Resource Requirements

### Development Time
- **Phase 1**: 2 hours (critical fixes)
- **Phase 2**: 4 hours (service integration)
- **Phase 3**: 4 hours (standardization)
- **Total**: 10 hours

### Testing Time
- **Unit Tests**: 2 hours
- **Integration Tests**: 3 hours
- **Manual Verification**: 1 hour
- **Total**: 6 hours

### Documentation
- **Code Comments**: 1 hour
- **Development Guidelines**: 2 hours
- **User Documentation**: 1 hour
- **Total**: 4 hours

## Next Steps

1. **Immediate**: Apply Phase 1 fixes to all three wizards
2. **This Week**: Implement service injection pattern
3. **Next Sprint**: Establish wizard development standards
4. **Ongoing**: Monitor wizard performance and usage

## Dependencies

### Internal Dependencies
- `src/utils/Logger.js` - Logger utilities
- `src/prompts/base/` - Prompt infrastructure
- Service modules for runtime functionality

### External Dependencies
- MCP context injection
- Huly client libraries
- Configuration management

## Conclusion

The wizard prompt issues are well-understood and have clear solutions. The fixes are low-risk and can be implemented incrementally. Priority should be on Phase 1 critical fixes to immediately unblock the wizard system, followed by systematic improvements in subsequent phases.
