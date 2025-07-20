# Tool Architecture Refactoring Plan

## Overview

This document outlines the comprehensive plan to refactor the Huly MCP Server tools from a centralized architecture to a modular, file-based structure. This refactoring will improve maintainability, testability, and scalability.

## Milestone: Tool Architecture Refactoring

**Target Date**: February 15, 2025  
**Estimated Effort**: 2-3 days of focused development

## Benefits

1. **Maintainability**: Each tool in its own file makes it easier to find and modify
2. **Testability**: Individual tools can be unit tested in isolation
3. **Scalability**: Adding new tools only requires creating a new file
4. **Team Collaboration**: Reduces merge conflicts when multiple developers work on different tools
5. **Code Organization**: Clear separation by domain (projects, issues, comments, etc.)

## New Architecture

### Directory Structure

```
src/
└── tools/
    ├── index.js              # Tool registry and exports
    ├── base/
    │   ├── ToolInterface.js  # Base interfaces and types
    │   └── ToolRegistry.js   # Registry implementation
    ├── projects/
    │   ├── index.js
    │   ├── listProjects.js
    │   └── createProject.js
    ├── issues/
    │   ├── index.js
    │   ├── listIssues.js
    │   ├── createIssue.js
    │   ├── updateIssue.js
    │   ├── createSubissue.js
    │   ├── searchIssues.js
    │   └── getIssueDetails.js
    ├── components/
    │   ├── index.js
    │   ├── createComponent.js
    │   └── listComponents.js
    ├── milestones/
    │   ├── index.js
    │   ├── createMilestone.js
    │   └── listMilestones.js
    ├── github/
    │   ├── index.js
    │   ├── listRepositories.js
    │   └── assignRepository.js
    └── comments/
        ├── index.js
        ├── listComments.js
        └── createComment.js
```

### Tool File Structure

Each tool file will export:

```javascript
// src/tools/issues/createIssue.js

export const definition = {
  name: 'huly_create_issue',
  description: 'Create a new issue in a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "PROJ")'
      },
      title: {
        type: 'string',
        description: 'Issue title'
      },
      description: {
        type: 'string',
        description: 'Issue description (optional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        description: 'Issue priority (optional, defaults to medium)'
      }
    },
    required: ['project_identifier', 'title']
  }
};

export async function handler(args, context) {
  const { issueService } = context.services;
  const { client } = context;
  
  // Tool-specific validation
  if (args.title.length > 255) {
    throw new Error('Title must be less than 255 characters');
  }
  
  // Call service method
  return await issueService.createIssue(
    client,
    args.project_identifier,
    args.title,
    args.description,
    args.priority
  );
}

// Optional: tool-specific utilities
export function validateTitle(title) {
  return title && title.trim().length > 0 && title.length <= 255;
}
```

## Implementation Plan

### Phase 1: Foundation (HULLY-166)
**Goal**: Set up the new architecture without breaking existing functionality

1. **Create base interfaces** (HULLY-172)
   - Define ToolDefinition interface
   - Define ToolHandler type
   - Define ToolContext interface
   - Create TypeScript types

2. **Implement tool registry** (HULLY-173)
   - Create ToolRegistry class
   - Implement registration mechanism
   - Add tool discovery methods
   - Add validation at registration

3. **Create directory structure** (HULLY-174)
   - Set up new directories
   - Create index files
   - Implement dynamic loader

### Phase 2: Tool Migration (HULLY-167, 168, 169, 170)
**Goal**: Migrate all tools to the new structure

1. **Migrate by category**:
   - Projects (2 tools) - HULLY-167
   - Issues (6 tools) - HULLY-168
   - Components, Milestones, GitHub (6 tools) - HULLY-169
   - Comments (2 tools) - HULLY-170

2. **For each tool**:
   - Create new file in appropriate directory
   - Move definition from toolDefinitions.js
   - Extract handler logic from MCPHandler
   - Add tool-specific validation
   - Create unit tests

### Phase 3: Integration (HULLY-171)
**Goal**: Complete the migration and remove old code

1. **Update MCPHandler** (HULLY-178)
   - Replace switch statement with registry lookup
   - Update error handling
   - Ensure backward compatibility

2. **Update tests** (HULLY-179)
   - Fix all import paths
   - Update mocks
   - Add registry tests
   - Verify integration tests pass

3. **Cleanup** (HULLY-180)
   - Remove toolDefinitions.js
   - Remove old routing code
   - Update documentation
   - Performance testing

## Testing Strategy

### Unit Tests
- Each tool file will have a corresponding test file
- Test tool definition validity
- Test handler logic with mocked services
- Test tool-specific validation

### Integration Tests
- Existing integration tests should continue to pass
- Add tests for tool registry
- Add tests for dynamic loading
- Verify all tools work end-to-end

### Performance Tests
- Compare performance before/after refactoring
- Ensure no regression in tool execution time
- Test memory usage with all tools loaded

## Migration Approach

### Option 1: Big Bang (Recommended)
- Implement all changes in a feature branch
- Migrate all tools at once
- Single PR for review
- **Pros**: Cleaner, faster, consistent
- **Cons**: Larger PR, higher risk

### Option 2: Gradual Migration
- Implement registry alongside existing system
- Migrate tools one category at a time
- Multiple smaller PRs
- **Pros**: Lower risk, easier review
- **Cons**: Temporary dual systems, longer timeline

## Success Criteria

1. ✅ All 17 tools migrated to new structure
2. ✅ All existing tests pass
3. ✅ No breaking changes to MCP API
4. ✅ Performance metrics same or better
5. ✅ Developer documentation updated
6. ✅ New tool can be added by creating single file

## Risk Mitigation

1. **Breaking Changes**: Extensive testing, keep tool names/schemas identical
2. **Performance Impact**: Benchmark before/after, optimize if needed
3. **Test Coverage**: Migrate tests alongside code, add new tests
4. **Team Disruption**: Clear communication, feature branch approach

## Timeline

- **Day 1**: Foundation (Phase 1) - 6-8 hours
- **Day 2**: Tool Migration (Phase 2) - 6-8 hours  
- **Day 3**: Integration & Cleanup (Phase 3) - 4-6 hours

Total estimated effort: 16-22 hours

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/HULLY-166-tool-refactoring`
3. Begin implementation with Phase 1
4. Regular progress updates on each issue
5. Final review and merge