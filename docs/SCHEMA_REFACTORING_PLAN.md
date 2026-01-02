# Schema Refactoring Plan: Fix Input Schema Validation Errors

**Status**: 🔴 In Progress  
**Created**: 2025-09-30  
**Issue**: API Error 400 - "input_schema does not support oneOf, allOf, or anyOf at the top level"

---

## 📋 Executive Summary

The MCP API rejects tool schemas that use `oneOf`, `allOf`, or `anyOf` at the top level of `inputSchema`. We have **8 consolidated tools** that violate this constraint. This plan outlines the refactoring approach to convert these schemas from JSON Schema polymorphism to a discriminator-based pattern that is API-compliant.

---

## 🎯 Problem Statement

### Current Error
```
API Error: 400 {"type":"error","error":
{"type":"invalid_request_error","message":"tools.50.input_schema: input_schema does not support oneOf, allOf, or anyOf at the top level"},"request_id":"req_011CTfDZKHztkackNuEMUCZB"}
```

### Root Cause
Our consolidated tools were designed following MCP best practices documentation that recommended using `oneOf` for polymorphic tools. However, the actual API implementation does not support these JSON Schema constructs at the top level of `inputSchema`.

### Impact
- **8 tools** cannot be registered with the MCP server
- All consolidated tool functionality is blocked
- Tests pass locally but fail when deployed to production API

---

## 🔍 Affected Files

| File | Tool Name | Operations | Additional Issues |
|------|-----------|------------|-------------------|
| `hulyAccountOps.js` | `huly_account_ops` | 7 operations | None |
| `hulyEntity.js` | `huly_entity` | 12+ operations | None |
| `hulyIntegration.js` | `huly_integration` | 4 operations | None |
| `hulyIssueOps.js` | `huly_issue_ops` | 6 operations | `allOf` in definitions |
| `hulyQuery.js` | `huly_query` | 8 operations | `allOf` in definitions |
| `hulyTemplateOps.js` | `huly_template_ops` | 5 operations | None |
| `hulyValidate.js` | `huly_validate` | 3 operations | None |
| `hulyWorkflow.js` | `huly_workflow` | 3 operations | Nested `oneOf` in definitions |

**Total**: 8 files, 48+ operations affected

---

## 💡 Solution Approach

### Strategy: Discriminator Pattern

Convert from **JSON Schema oneOf polymorphism** to **discriminator-based pattern** with runtime validation.

#### Before (Invalid ❌)
```javascript
inputSchema: {
  type: 'object',
  properties: {},
  oneOf: [
    {
      title: 'Create Operation',
      properties: {
        operation: { const: 'create' },
        data: { $ref: '#/definitions/CreateData' }
      },
      required: ['operation', 'data']
    },
    {
      title: 'Update Operation',
      properties: {
        operation: { const: 'update' },
        entity_id: { type: 'string' },
        updates: { $ref: '#/definitions/UpdateData' }
      },
      required: ['operation', 'entity_id', 'updates']
    }
  ]
}
```

#### After (Valid ✅)
```javascript
inputSchema: {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: ['create', 'update', 'delete', 'read'],
      description: 'Operation to perform. Each operation requires different fields:\n' +
                   '- create: requires "data"\n' +
                   '- update: requires "entity_id" and "updates"\n' +
                   '- delete: requires "entity_id"\n' +
                   '- read: requires "entity_id"'
    },
    data: {
      type: 'object',
      description: 'Data for create operations (required when operation=create)'
    },
    entity_id: {
      type: 'string',
      description: 'Entity identifier (required for update/delete/read operations)'
    },
    updates: {
      type: 'object',
      description: 'Update fields (required when operation=update)'
    }
  },
  required: ['operation'],
  additionalProperties: false
}
```

### Key Changes

1. **Flatten oneOf branches** into a single object schema
2. **Use enum** for discriminator fields (`operation`, `entity_type`, etc.)
3. **Document conditional requirements** in field descriptions
4. **Move validation logic** from JSON Schema to runtime code
5. **Preserve handler logic** - no changes to execution code

---

## 📝 Detailed Task Breakdown

### Phase 1: Analysis & Design
**Task**: Analyze schema refactoring approach  
**Deliverable**: Validated pattern and validation strategy

- [ ] Define standard discriminator pattern template
- [ ] Identify all unique field combinations across operations
- [ ] Design runtime validation helper functions
- [ ] Document migration pattern for each tool type

### Phase 2: Schema Refactoring (8 files)

#### Task 2.1: Refactor hulyAccountOps.js
**Operations**: `get_current`, `create_employee`, `update_employee`, `delete_employee`, `list_employees`, `get_employee`, `create_person`

- [ ] Convert oneOf to discriminator pattern with `operation` enum
- [ ] Flatten all operation-specific properties
- [ ] Add detailed descriptions for conditional requirements
- [ ] Update required fields to only include `operation`

#### Task 2.2: Refactor hulyEntity.js
**Operations**: Project/Component/Milestone/Comment CRUD (12+ operations)

- [ ] Convert oneOf to discriminator pattern with `entity_type` and `operation` enums
- [ ] Flatten all entity-specific and operation-specific properties
- [ ] Handle dual discriminators (`entity_type` + `operation`)
- [ ] Preserve all $ref definitions (move from oneOf branches to top-level definitions)

#### Task 2.3: Refactor hulyIntegration.js
**Operations**: `list_repositories`, `assign_repository`, `unassign_repository`, `get_integration_status`

- [ ] Convert oneOf to discriminator pattern with `operation` enum
- [ ] Flatten GitHub integration-specific properties
- [ ] Document repository assignment requirements

#### Task 2.4: Refactor hulyIssueOps.js
**Operations**: `create`, `update`, `delete`, `create_subissue`, `bulk_create`, `bulk_update`

- [ ] Convert top-level oneOf to discriminator pattern
- [ ] Fix `allOf` in definitions section (BulkCreateIssue definition)
- [ ] Flatten bulk operation properties
- [ ] Handle array-based bulk data structures

#### Task 2.5: Refactor hulyQuery.js
**Operations**: List/search/get for projects, issues, components, milestones, etc.

- [ ] Convert top-level oneOf to discriminator pattern
- [ ] Fix `allOf` in definitions section (IssueListOptions)
- [ ] Flatten query-specific filter properties
- [ ] Preserve pagination and sorting parameters

#### Task 2.6: Refactor hulyTemplateOps.js
**Operations**: `create`, `update`, `delete`, `get`, `search`

- [ ] Convert oneOf to discriminator pattern with `operation` enum
- [ ] Flatten template-specific properties
- [ ] Handle template data structures

#### Task 2.7: Refactor hulyValidate.js
**Operations**: `deletion`, `bulk_operation`, `workflow`

- [ ] Convert oneOf to discriminator pattern with `validation_type` enum
- [ ] Flatten validation-specific properties
- [ ] Document validation result structures

#### Task 2.8: Refactor hulyWorkflow.js
**Operations**: `project_setup`, `issue_triage`, `sprint_planning`

- [ ] Convert top-level oneOf to discriminator pattern
- [ ] Fix nested oneOf in definitions (workflow step definitions)
- [ ] Flatten workflow-specific configuration properties
- [ ] Handle complex workflow data structures

### Phase 3: Testing Updates

#### Task 3.1: Update unit tests
- [ ] Update schema validation tests to expect discriminator pattern
- [ ] Remove oneOf-specific test assertions
- [ ] Add tests for runtime validation logic
- [ ] Verify all tool definition tests pass

#### Task 3.2: Update integration tests
- [ ] Update tool compatibility tests
- [ ] Verify schema structure validation
- [ ] Test tool execution with new schemas
- [ ] Ensure backward compatibility in handler behavior

### Phase 4: Validation & Verification

#### Task 4.1: Local validation
- [ ] Run full test suite (`npm test`)
- [ ] Verify all 8 tools load successfully
- [ ] Check tool registry statistics
- [ ] Validate schema structure programmatically

#### Task 4.2: API compatibility testing
- [ ] Test tool registration with MCP server
- [ ] Verify no 400 errors on schema validation
- [ ] Test actual tool execution through API
- [ ] Validate error handling and edge cases

---

## 🛠️ Implementation Guidelines

### Discriminator Pattern Template

```javascript
export const definition = {
  name: 'huly_tool_name',
  description: 'Tool description',
  inputSchema: {
    type: 'object',
    properties: {
      // Discriminator field(s)
      operation: {
        type: 'string',
        enum: ['op1', 'op2', 'op3'],
        description: 'Operation to perform. Required fields by operation:\n' +
                     '- op1: field_a, field_b\n' +
                     '- op2: field_c\n' +
                     '- op3: field_d, field_e'
      },
      
      // All possible fields from all operations
      field_a: { type: 'string', description: 'Used by op1' },
      field_b: { type: 'object', description: 'Used by op1' },
      field_c: { type: 'string', description: 'Used by op2' },
      field_d: { type: 'string', description: 'Used by op3' },
      field_e: { type: 'number', description: 'Used by op3' }
    },
    required: ['operation'],
    additionalProperties: false
  },
  definitions: {
    // Keep all $ref definitions here
  },
  annotations: {
    title: 'Tool Title',
    destructiveHint: false,
    idempotentHint: true,
    readOnlyHint: false
  }
};
```

### Runtime Validation Pattern

```javascript
export function validate(args) {
  const { operation } = args;
  
  // Operation-specific validation
  switch (operation) {
    case 'create':
      if (!args.data) return ['data is required for create operation'];
      break;
    case 'update':
      if (!args.entity_id) return ['entity_id is required for update operation'];
      if (!args.updates) return ['updates is required for update operation'];
      break;
    case 'delete':
      if (!args.entity_id) return ['entity_id is required for delete operation'];
      break;
    default:
      return [`Unknown operation: ${operation}`];
  }
  
  return null; // No errors
}
```

---

## ⚠️ Risk Mitigation

### Potential Issues

1. **Loss of Schema Precision**: Discriminator pattern is less precise than oneOf
   - **Mitigation**: Comprehensive runtime validation + detailed descriptions

2. **Client UX Degradation**: Clients may not know which fields are required
   - **Mitigation**: Rich descriptions documenting all conditional requirements

3. **Breaking Changes**: Existing tool calls might fail validation
   - **Mitigation**: Preserve handler logic, only change schema structure

4. **Test Failures**: Schema-dependent tests will break
   - **Mitigation**: Update tests in parallel with schema changes

### Rollback Plan

If refactoring causes issues:
1. Revert schema changes (git revert)
2. Keep handler logic unchanged
3. Investigate alternative API-compliant patterns
4. Consider splitting consolidated tools back into individual tools

---

## 📊 Success Criteria

- [ ] All 8 tool files refactored successfully
- [ ] No `oneOf`, `allOf`, or `anyOf` at top level of any inputSchema
- [ ] All tests pass (`npm test` shows 100% pass rate)
- [ ] Tools register successfully with MCP server (no 400 errors)
- [ ] Tool execution works correctly through API
- [ ] Documentation updated to reflect new schema patterns

---

## 📚 References

- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **JSON Schema Spec**: https://json-schema.org/
- **Original Design Doc**: `docs/AGGRESSIVE_CONSOLIDATION_PLAN.md`
- **Best Practices**: `docs/MCP_BEST_PRACTICES_SUMMARY.md`

---

## 🔄 Next Steps

1. Review and approve this plan
2. Begin Phase 1: Analysis & Design
3. Create feature branch: `feature/HULLY-XX-schema-refactoring`
4. Implement changes incrementally (one tool at a time)
5. Run tests after each tool refactoring
6. Create PR when all changes complete
7. Deploy and verify in production environment

