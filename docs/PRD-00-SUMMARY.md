# MCP Server 2.0 - PRD Summary

## Overview
This document provides a summary of all Product Requirement Documents (PRDs) for the Huly MCP Server 2.0 redesign, consolidating 37 granular tools into 8 powerful composite tools.

**Last Updated:** 2025-01-23

---

## Goals

### Primary Objectives
1. **Reduce tool count:** 37 → 8 tools (78% reduction)
2. **Reduce API calls:** Average 4.5 → 1.3 calls per workflow (71% reduction)
3. **Improve token efficiency:** ~15k → ~3.5k tokens per workflow (77% reduction)
4. **Enhance usability:** Fewer tools = easier LLM decision-making

### Success Metrics
- **Call reduction:** 70%+ for typical workflows
- **Token reduction:** 75%+ for typical operations
- **Performance:** All operations < 500ms p95
- **Developer satisfaction:** 9/10 rating

---

## The 8 Tools

### 1. `huly_query` - Universal Query Tool
**Purpose:** All read/list/search operations

**PRD:** [PRD-01-huly_query.md](PRD-01-huly_query.md)

**Consolidates:** 7 tools
- huly_list_issues
- huly_search_issues
- huly_list_projects
- huly_list_components
- huly_list_milestones
- huly_list_comments
- huly_list_templates
- huly_search_templates

**Key Features:**
- Field selection (control output size)
- Multiple output formats (JSON, compact, detailed, summary)
- Pagination support (offset + limit)
- Include related entities (reduce separate calls)
- Universal filtering across all entity types

**Impact:** Reduces typical query workflows from 3-5 calls → 1 call

---

### 2. `huly_issue_ops` - Issue Operations
**Purpose:** All issue mutations (create, update, delete)

**PRD:** [PRD-02-huly_issue_ops.md](PRD-02-huly_issue_ops.md)

**Consolidates:** 9 tools
- huly_create_issue
- huly_update_issue
- huly_delete_issue
- huly_create_subissue
- huly_get_issue_details
- huly_bulk_create_issues
- huly_bulk_update_issues
- huly_bulk_delete_issues

**Key Features:**
- **Multi-field updates** (update 5 fields in 1 call vs 5 calls)
- Batch operations with defaults
- Post-actions (add comment, notify, link)
- Single + bulk modes
- Subissue support

**Impact:** Reduces multi-field updates from 4-5 calls → 1 call

---

### 3. `huly_template_ops` - Template Management
**Purpose:** Template operations and instantiation

**PRD:** [PRD-03-huly_template_ops.md](PRD-03-huly_template_ops.md)

**Consolidates:** 8 tools
- huly_create_template
- huly_update_template
- huly_delete_template
- huly_get_template_details
- huly_add_child_template
- huly_remove_child_template
- huly_create_issue_from_template

**Key Features:**
- **Batch instantiation** (create N issues from 1 template)
- **Naming patterns** (Sprint ${n}: ${title})
- Automatic linking of created issues
- Assignee distribution
- Hierarchy creation

**Impact:** Reduces template workflows from N+2 calls → 1 call

---

### 4. `huly_workflow` - Workflow Automation
**Purpose:** Complex multi-step workflows

**PRD:** [PRD-04-huly_workflow.md](PRD-04-huly_workflow.md)

**New Tool** (no consolidation - net new capability)

**Key Features:**
- **Pipeline execution** (chain multiple tools)
- **Transform workflow** (search → update pattern)
- **Transition workflow** (state migrations)
- **Clone workflow** (duplicate with modifications)
- **Cascade updates** (update issue + related)
- Parameter references (${step.result})
- Conditional execution

**Impact:** Reduces complex workflows from 5-10 calls → 1 call

---

### 5. `huly_entity` - Entity Management
**Purpose:** Project, component, milestone operations

**PRD:** [PRD-05-huly_entity.md](PRD-05-huly_entity.md)

**Consolidates:** 7 tools
- huly_create_project
- huly_delete_project
- huly_archive_project
- huly_create_component
- huly_delete_component
- huly_create_milestone
- huly_delete_milestone

**Key Features:**
- **Atomic project setup** (create project + components + milestones + issues in 1 call)
- Batch component/milestone creation
- GitHub repository assignment
- Team member management

**Impact:** Reduces project setup from 10-15 calls → 1 call

---

### 6. `huly_account_ops` - Account Operations
**Purpose:** User management and assignment

**PRD:** [PRD-06-huly_account_ops.md](PRD-06-huly_account_ops.md)

**New Tool** (no consolidation - net new capability)

**Key Features:**
- Workload calculation and analysis
- Bulk assignment
- **Auto-assignment** (least loaded, round robin, by component)
- **Delegation** (transfer all work from user A to B)
- **Workload balancing** (redistribute to achieve fair distribution)

**Impact:** Enables intelligent assignment workflows

---

### 7. `huly_validate` - Validation & Impact
**Purpose:** Validation and impact analysis

**PRD:** [PRD-07-huly_validate.md](PRD-07-huly_validate.md)

**Consolidates:** 2 tools
- huly_validate_deletion
- huly_deletion_impact_preview

**Key Features:**
- Deletion impact analysis
- Dry-run for any operation
- Data consistency checks
- Permission validation
- Workflow validation

**Impact:** Prevents accidental data loss

---

### 8. `huly_integration` - External Integrations
**Purpose:** GitHub and external system integrations

**PRD:** [PRD-08-huly_integration.md](PRD-08-huly_integration.md)

**Consolidates:** 2 tools
- huly_list_github_repositories
- huly_assign_repository_to_project

**Key Features:**
- GitHub repository management
- Issue/PR synchronization
- Webhook configuration
- Bidirectional sync

**Impact:** Complete GitHub integration in 1 call

---

## Comparative Analysis

### Before: 37 Granular Tools
- **Decision complexity:** High (37 choices)
- **Calls per workflow:** 4.5 average
- **Token usage:** ~15,000 per workflow
- **Multi-field updates:** 4-5 calls required
- **Project setup:** 10-15 calls required
- **Template instantiation:** N+2 calls for N issues

### After: 8 Composite Tools
- **Decision complexity:** Low (8 choices)
- **Calls per workflow:** 1.3 average
- **Token usage:** ~3,500 per workflow
- **Multi-field updates:** 1 call
- **Project setup:** 1 call
- **Template instantiation:** 1 call

### Improvements
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Tool count | 37 | 8 | **78%** ↓ |
| Calls/workflow | 4.5 | 1.3 | **71%** ↓ |
| Tokens/workflow | 15k | 3.5k | **77%** ↓ |
| Project setup calls | 10-15 | 1 | **90-93%** ↓ |
| Multi-field update calls | 4-5 | 1 | **75-80%** ↓ |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Priority 1 Tools:**
1. `huly_query` - Core read operations
2. `huly_issue_ops` - Core mutations with multi-field updates

**Deliverables:**
- Field selection working
- Multi-field updates working
- Output format control
- Pagination support

---

### Phase 2: Advanced Tools (Week 3-4)
**Priority 2 Tools:**
3. `huly_template_ops` - Template management
4. `huly_entity` - Project setup

**Deliverables:**
- Batch template instantiation
- Naming patterns
- Atomic project setup

---

### Phase 3: Automation (Week 5-6)
**Priority 3 Tools:**
5. `huly_workflow` - Workflow automation
6. `huly_account_ops` - Account operations

**Deliverables:**
- Pipeline execution
- Transform workflows
- Auto-assignment
- Workload balancing

---

### Phase 4: Safety & Integration (Week 7)
**Priority 4 Tools:**
7. `huly_validate` - Validation
8. `huly_integration` - External integrations

**Deliverables:**
- Impact analysis
- Dry-run support
- GitHub sync

---

## Quick Reference

### Common Workflows

#### 1. Get Issue with Comments
**Before (2 calls):**
```javascript
huly_get_issue_details('PROJ-123')
huly_list_comments('PROJ-123')
```

**After (1 call):**
```javascript
huly_query({
  entity_type: 'issue',
  identifier: 'PROJ-123',
  output: {
    include_related: { comments: true }
  }
})
```

---

#### 2. Update Multiple Fields
**Before (4 calls):**
```javascript
huly_update_issue('PROJ-123', 'status', 'In Progress')
huly_update_issue('PROJ-123', 'priority', 'high')
huly_update_issue('PROJ-123', 'assignee', 'dev@email.com')
huly_update_issue('PROJ-123', 'component', 'Backend')
```

**After (1 call):**
```javascript
huly_issue_ops({
  operation: 'update',
  issue_identifier: 'PROJ-123',
  data: {
    updates: {
      status: 'In Progress',
      priority: 'high',
      assignee: 'dev@email.com',
      component: 'Backend'
    }
  }
})
```

---

#### 3. Setup New Project
**Before (11+ calls):**
```javascript
huly_create_project(...)  // 1
huly_create_component(...) × 3  // 2-4
huly_create_milestone(...) × 3  // 5-7
huly_create_issue(...) × 3  // 8-10
huly_assign_repository(...)  // 11
```

**After (1 call):**
```javascript
huly_entity({
  entity_type: 'project',
  operation: 'create',
  project_setup: {
    project: {...},
    components: [...],
    milestones: [...],
    initial_issues: [...],
    github_repository: 'org/repo'
  }
})
```

---

#### 4. Batch Create from Template
**Before (N+2 calls):**
```javascript
huly_list_templates(project)  // 1
huly_get_template_details(id)  // 2
huly_create_issue_from_template(id) × N  // 3 to N+2
```

**After (1 call):**
```javascript
huly_template_ops({
  operation: 'instantiate',
  template_id: 'template-123',
  instantiate: {
    count: 10,
    naming_pattern: 'Sprint ${n}: ${title}',
    link_created: true
  }
})
```

---

## Migration Strategy

### Backward Compatibility
All old tools will remain functional for 6 months with automatic mapping to new tools:

```javascript
// Old call
huly_update_issue('PROJ-123', 'status', 'Done')

// Automatically mapped to
huly_issue_ops({
  operation: 'update',
  issue_identifier: 'PROJ-123',
  data: { updates: { status: 'Done' } }
})
```

### Migration Timeline
- **Month 1-2:** New tools deployed, old tools still available
- **Month 3:** Deprecation warnings added to old tools
- **Month 4-6:** Migration support and documentation
- **Month 7:** Old tools removed (breaking change)

---

## Testing Requirements

### Coverage Targets
- **Unit tests:** 90%+ coverage
- **Integration tests:** 100+ test scenarios
- **Performance tests:** All operations meet targets
- **Stress tests:** 1000+ concurrent operations

### Test Scenarios
Each tool requires:
1. Basic operation tests
2. Error handling tests
3. Edge case tests
4. Performance benchmarks
5. Integration tests with other tools

---

## Documentation Requirements

For each tool:
1. **API Reference** - Complete schema documentation
2. **Usage Examples** - 20+ real-world examples
3. **Migration Guide** - How to migrate from old tools
4. **Performance Guide** - Optimization tips
5. **Troubleshooting** - Common issues and solutions

---

## Success Criteria

### Must Have
- [ ] All 8 tools implemented and tested
- [ ] 70%+ reduction in API calls
- [ ] 75%+ reduction in token usage
- [ ] All performance targets met
- [ ] Backward compatibility maintained
- [ ] Complete documentation

### Nice to Have
- [ ] 80%+ call reduction
- [ ] 85%+ token reduction
- [ ] Sub-200ms p50 latency
- [ ] Auto-migration tools for users
- [ ] Interactive tool selector

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking changes | High | Medium | Maintain old tools for 6 months |
| Performance regression | High | Low | Extensive performance testing |
| Complexity too high | Medium | Medium | Comprehensive documentation + examples |
| Adoption resistance | Medium | Low | Clear migration guide + benefits |
| Field mapping errors | Low | Medium | Extensive validation + testing |

---

## Next Steps

1. **Review PRDs** - Team review and sign-off
2. **Finalize Schemas** - Lock down tool definitions
3. **Begin Phase 1** - Implement `huly_query` and `huly_issue_ops`
4. **Create Tests** - Build comprehensive test suite
5. **Documentation** - Start API documentation
6. **User Testing** - Beta testing with select users
7. **Launch** - Phased rollout

---

## Conclusion

The consolidation from 37 granular tools to 8 composite tools represents a fundamental improvement in the MCP server architecture:

✅ **78% fewer tools** = easier LLM decision-making
✅ **71% fewer calls** = faster workflows
✅ **77% less tokens** = lower costs
✅ **Better UX** = higher satisfaction

This redesign positions the Huly MCP Server as a best-in-class tool consolidation pattern that other MCP servers can learn from.
