# Huly MCP Server - Action Plan & Next Steps

**Date**: 2025-09-30  
**Status**: 🟢 Ready to Proceed  
**Current Phase**: Post-Validation  

---

## 🎯 Current Status

### What We've Accomplished ✅

1. **Connection Issues Resolved**
   - Fixed URL configuration (account service → nginx proxy)
   - Resolved authentication flow
   - Created new account with proper credentials
   - Validated workspace access

2. **Comprehensive Testing Completed**
   - Tested all 8 MCP tool categories
   - Validated core CRUD operations
   - Identified and documented issues
   - Created test data for validation

3. **Documentation Created**
   - Connection issue analysis
   - Login failure analysis
   - Validation report
   - Schema refactoring plan

### Current State

- **Operational**: 7/8 tools fully functional (87.5% pass rate)
- **Known Issues**: 2 non-blocking issues identified
- **Production Ready**: Core functionality available
- **Next Priority**: Schema refactoring + parameter parsing fixes

---

## 🚀 Immediate Next Steps (This Week)

### Priority 1: Fix Parameter Parsing Issues

**Issue**: Update operations and sub-issue creation fail due to nested parameter handling

**Tasks**:

1. **Investigate MCP Client Behavior** (2 hours)
   ```bash
   # Test with REST API to confirm backend works
   curl -X POST http://localhost:3457/api/tools/huly_issue_ops \
     -H "Content-Type: application/json" \
     -d '{
       "arguments": {
         "operation": "update",
         "issue_identifier": "TSK-1",
         "update": {"field": "status", "value": "in-progress"}
       }
     }'
   ```
   - Confirm backend handles nested objects correctly
   - Document how MCP client serializes parameters
   - Identify where the flattening occurs

2. **Review Input Schemas** (3 hours)
   - Check `huly_issue_ops` input schema
   - Look for nested object definitions
   - Compare with working tools (bulk_create works!)
   - Identify schema differences

3. **Implement Fix** (4 hours)
   - Option A: Flatten schema (change `update.field` to `update_field`)
   - Option B: Fix MCP client parameter handling
   - Option C: Add parameter transformation layer
   - Test all affected operations

**Deliverables**:
- ✅ Update operations working
- ✅ Sub-issue creation working
- ✅ Documentation updated

### Priority 2: Schema Refactoring (API Compatibility)

**Issue**: API rejects schemas with top-level oneOf/allOf/anyOf

**Tasks**:

1. **Review Refactoring Plan** (1 hour)
   - Read `docs/SCHEMA_REFACTORING_PLAN.md`
   - Understand discriminator pattern approach
   - Identify affected tools (8 files)

2. **Refactor First Tool** (4 hours)
   - Start with `hulyAccountOps.js` (simplest)
   - Convert oneOf to discriminator pattern
   - Update tests
   - Validate functionality

3. **Refactor Remaining Tools** (16 hours)
   - `hulyEntity.js` (most complex - dual discriminators)
   - `hulyIntegration.js`
   - `hulyIssueOps.js` (also fix allOf in definitions)
   - `hulyQuery.js` (also fix allOf in definitions)
   - `hulyTemplateOps.js`
   - `hulyValidate.js`
   - `hulyWorkflow.js` (also fix nested oneOf)

4. **Update Tests** (4 hours)
   - Modify schema validation tests
   - Update integration tests
   - Run full test suite
   - Verify 100% pass rate

**Deliverables**:
- ✅ All 8 tools refactored
- ✅ No oneOf/allOf/anyOf at top level
- ✅ All tests passing
- ✅ API compatibility confirmed

### Priority 3: Fix Account Operations

**Issue**: `get_current` operation fails with "No current account found in session"

**Tasks**:

1. **Investigate Account Service** (2 hours)
   - Review account service API endpoints
   - Check how current account is retrieved
   - Look at session management
   - Find correct approach

2. **Implement Fix** (2 hours)
   - Update account service integration
   - Test with authenticated session
   - Verify account info returned

3. **Test Employee Operations** (1 hour)
   - Create employee
   - Update employee
   - List employees
   - Delete employee

**Deliverables**:
- ✅ `get_current` working
- ✅ All account operations functional
- ✅ 100% pass rate for `huly_account_ops`

---

## 📅 Weekly Breakdown

### Week 1: Critical Fixes

**Monday-Tuesday**: Parameter Parsing
- Investigate and fix update operations
- Test sub-issue creation
- Validate all issue operations

**Wednesday-Friday**: Schema Refactoring (Part 1)
- Refactor 4 tools (AccountOps, Integration, TemplateOps, Validate)
- Update tests
- Validate functionality

**Deliverables**:
- ✅ Update operations working
- ✅ 4 tools refactored
- ✅ Tests updated

### Week 2: Complete Refactoring

**Monday-Wednesday**: Schema Refactoring (Part 2)
- Refactor remaining 4 tools (Entity, IssueOps, Query, Workflow)
- Handle complex cases (dual discriminators, nested oneOf)
- Update all tests

**Thursday**: Account Operations
- Fix `get_current` operation
- Test all account operations
- Validate employee management

**Friday**: Testing & Validation
- Run full test suite
- Validate all 8 tools at 100%
- Update documentation

**Deliverables**:
- ✅ All 8 tools refactored
- ✅ Account operations fixed
- ✅ 100% tool pass rate

### Week 3: Production Readiness

**Monday-Tuesday**: Workflow Testing
- Test project setup workflow
- Test sprint planning workflow
- Test issue triage workflow
- Document workflow usage

**Wednesday**: Integration Testing
- Configure GitHub integration
- Test repository operations
- Validate webhook handling
- Document integration setup

**Thursday**: Documentation & Monitoring
- Update API documentation
- Create user guides
- Set up logging and monitoring
- Configure health checks

**Friday**: Deployment & Review
- Deploy to production
- Monitor for issues
- Review metrics
- Plan next iteration

**Deliverables**:
- ✅ All workflows tested
- ✅ GitHub integration working
- ✅ Production deployment complete
- ✅ Monitoring in place

---

## 🎯 Success Metrics

### Week 1 Goals
- [ ] Update operations: 100% working
- [ ] Schema refactoring: 50% complete (4/8 tools)
- [ ] Test pass rate: >90%

### Week 2 Goals
- [ ] Schema refactoring: 100% complete (8/8 tools)
- [ ] Account operations: 100% working
- [ ] Test pass rate: 100%
- [ ] API compatibility: Confirmed

### Week 3 Goals
- [ ] Workflow testing: 100% complete
- [ ] GitHub integration: Configured and tested
- [ ] Documentation: Complete and up-to-date
- [ ] Production: Deployed and monitored

---

## 🔧 Technical Approach

### Parameter Parsing Fix

**Option A: Flatten Schema** (Recommended)
```javascript
// Before (nested)
{
  operation: 'update',
  update: {
    field: 'status',
    value: 'in-progress'
  }
}

// After (flattened)
{
  operation: 'update',
  update_field: 'status',
  update_value: 'in-progress'
}
```

**Pros**: Simple, works with current MCP client  
**Cons**: Less elegant schema structure

**Option B: Fix MCP Client**
- Modify parameter serialization
- Handle nested objects correctly
- More complex, may affect other tools

**Option C: Transformation Layer**
- Add middleware to transform parameters
- Keep schema as-is
- More flexible but adds complexity

**Recommendation**: Start with Option A (flatten schema) for quick fix, then consider Option C for long-term solution.

### Schema Refactoring Approach

**Pattern**: Discriminator with enum

```javascript
// Before (oneOf - not supported)
inputSchema: {
  type: 'object',
  properties: {},
  oneOf: [
    { properties: { operation: { const: 'create' }, ... } },
    { properties: { operation: { const: 'update' }, ... } }
  ]
}

// After (discriminator - supported)
inputSchema: {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: ['create', 'update', 'delete'],
      description: 'Operation to perform. Required fields:\n' +
                   '- create: data\n' +
                   '- update: entity_id, updates\n' +
                   '- delete: entity_id'
    },
    data: { type: 'object', description: 'For create operations' },
    entity_id: { type: 'string', description: 'For update/delete' },
    updates: { type: 'object', description: 'For update operations' }
  },
  required: ['operation']
}
```

**Key Changes**:
1. Remove oneOf/allOf/anyOf from top level
2. Use enum for discriminator fields
3. Include all possible properties
4. Document conditional requirements in descriptions
5. Move validation to runtime code

---

## 📋 Task Checklist

### Immediate (This Week)

- [ ] Investigate parameter parsing issue
- [ ] Test update operations via REST API
- [ ] Implement parameter parsing fix
- [ ] Validate update operations working
- [ ] Refactor hulyAccountOps.js schema
- [ ] Refactor hulyIntegration.js schema
- [ ] Refactor hulyTemplateOps.js schema
- [ ] Refactor hulyValidate.js schema
- [ ] Update tests for refactored tools
- [ ] Run test suite and verify >90% pass rate

### Short-Term (Next Week)

- [ ] Refactor hulyEntity.js schema
- [ ] Refactor hulyIssueOps.js schema
- [ ] Refactor hulyQuery.js schema
- [ ] Refactor hulyWorkflow.js schema
- [ ] Fix account operations get_current
- [ ] Test all account operations
- [ ] Run full test suite
- [ ] Achieve 100% tool pass rate
- [ ] Update all documentation

### Medium-Term (Week 3)

- [ ] Test project setup workflow
- [ ] Test sprint planning workflow
- [ ] Test issue triage workflow
- [ ] Configure GitHub App integration
- [ ] Test repository assignment
- [ ] Validate webhook functionality
- [ ] Set up production monitoring
- [ ] Deploy to production
- [ ] Create user guides

---

## 🚨 Risk Mitigation

### Risk 1: Schema Refactoring Breaks Functionality

**Mitigation**:
- Refactor one tool at a time
- Test after each refactoring
- Keep git commits small and focused
- Easy to rollback if issues arise

### Risk 2: Parameter Parsing Fix Affects Other Tools

**Mitigation**:
- Test all tools after implementing fix
- Use feature flag if needed
- Gradual rollout approach

### Risk 3: Timeline Slippage

**Mitigation**:
- Focus on critical path items first
- Defer nice-to-have features
- Regular progress reviews
- Adjust scope if needed

---

## 📞 Support & Resources

### Documentation
- `docs/MCP_TOOLS_VALIDATION_REPORT.md` - Current status
- `docs/SCHEMA_REFACTORING_PLAN.md` - Refactoring guide
- `docs/CONNECTION_ISSUE_ANALYSIS.md` - Connection troubleshooting
- `docs/LOGIN_FAILURE_ANALYSIS.md` - Authentication guide

### Testing
- `test-login-debug.js` - Login flow testing
- `npm test` - Full test suite
- `npm run test:integration` - Integration tests

### Monitoring
- Docker logs: `docker-compose logs -f huly-mcp`
- MCP server logs: `huly-mcp-server/mcp-server.log`
- Health check: `curl http://localhost:3457/health`

---

## ✅ Definition of Done

### For Parameter Parsing Fix
- [ ] Update operations work via MCP client
- [ ] Sub-issue creation works via MCP client
- [ ] All issue operations pass tests
- [ ] Documentation updated

### For Schema Refactoring
- [ ] All 8 tools refactored
- [ ] No oneOf/allOf/anyOf at top level
- [ ] All tests passing (100%)
- [ ] API compatibility confirmed
- [ ] Documentation updated

### For Production Deployment
- [ ] All tools at 100% pass rate
- [ ] Workflows tested and documented
- [ ] GitHub integration configured
- [ ] Monitoring and logging in place
- [ ] User guides created
- [ ] Production deployment successful

---

**Next Review**: End of Week 1  
**Status Updates**: Daily standup  
**Escalation**: If blocked >4 hours

