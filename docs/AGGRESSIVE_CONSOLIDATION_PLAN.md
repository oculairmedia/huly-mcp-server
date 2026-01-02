# Aggressive Tool Consolidation Plan: 42+ Tools → 8-12 Core Tools

## 🎯 Vision: Maximum Consolidation (70-80% Reduction)

This plan outlines an aggressive consolidation strategy that reduces the Huly MCP Server from **42+ tools to 8-12 core tools**, achieving a **70-80% reduction** while maintaining or enhancing functionality.

## 📊 Current State vs. Target State

### Current State: 42+ Tools
- **Projects**: 4 tools
- **Issues**: 11 tools
- **Components**: 3 tools
- **Milestones**: 3 tools
- **Templates**: 9 tools
- **Comments**: 2 tools
- **GitHub**: 2 tools
- **Accounts**: 7 tools
- **Validation**: 1 tool
- **Preview**: 1 tool

### Target State: 8-12 Core Tools

**Tier 1: Universal Operations (4 tools)**
1. `huly_entity` - Universal entity manager
2. `huly_query` - Universal query engine
3. `huly_workflow` - Workflow orchestrator
4. `huly_validate` - Universal validation engine

**Tier 2: Specialized Operations (4-6 tools)**
5. `huly_issue_ops` - Issue-specific operations
6. `huly_template_ops` - Template system operations
7. `huly_integration` - External integrations (GitHub, etc.)
8. `huly_account_ops` - Account/employee management

**Tier 3: Optional Advanced Tools (0-2 tools)**
9. `huly_batch` - Advanced batch processing (optional)
10. `huly_analytics` - Reporting and analytics (optional)

## 🚀 Consolidation Strategy

### Strategy 1: Universal Entity Manager (`huly_entity`)

**Replaces**: 15+ tools across projects, components, milestones

**Signature**:
```typescript
huly_entity({
  entity_type: "project" | "component" | "milestone" | "issue",
  operation: "create" | "read" | "update" | "delete" | "archive",
  identifier?: string,
  data?: object,
  options?: {
    cascade?: boolean,
    dry_run?: boolean,
    force?: boolean
  }
})
```

**Consolidates**:
- `huly_create_project` → `huly_entity({entity_type: "project", operation: "create"})`
- `huly_delete_project` → `huly_entity({entity_type: "project", operation: "delete"})`
- `huly_archive_project` → `huly_entity({entity_type: "project", operation: "archive"})`
- `huly_create_component` → `huly_entity({entity_type: "component", operation: "create"})`
- `huly_delete_component` → `huly_entity({entity_type: "component", operation: "delete"})`
- `huly_create_milestone` → `huly_entity({entity_type: "milestone", operation: "create"})`
- `huly_delete_milestone` → `huly_entity({entity_type: "milestone", operation: "delete"})`

**Total Reduction**: 15 tools → 1 tool (93% reduction)

**Schema Strategy**:
```json
{
  "oneOf": [
    {
      "properties": {
        "entity_type": {"const": "project"},
        "operation": {"const": "create"},
        "data": {"$ref": "#/definitions/ProjectCreateData"}
      }
    },
    {
      "properties": {
        "entity_type": {"const": "component"},
        "operation": {"const": "create"},
        "data": {"$ref": "#/definitions/ComponentCreateData"}
      }
    }
    // ... more combinations
  ]
}
```

### Strategy 2: Universal Query Engine (`huly_query`)

**Replaces**: 10+ list/search/get tools

**Signature**:
```typescript
huly_query({
  entity_type: "project" | "component" | "milestone" | "issue" | "template" | "comment",
  mode: "list" | "search" | "get",
  identifier?: string,
  filters?: {
    status?: string,
    priority?: string,
    assignee?: string,
    created_after?: string,
    created_before?: string,
    // ... dynamic filters based on entity_type
  },
  options?: {
    limit?: number,
    offset?: number,
    sort?: string,
    include_details?: boolean
  }
})
```

**Consolidates**:
- `huly_list_projects` → `huly_query({entity_type: "project", mode: "list"})`
- `huly_list_components` → `huly_query({entity_type: "component", mode: "list"})`
- `huly_list_milestones` → `huly_query({entity_type: "milestone", mode: "list"})`
- `huly_list_issues` → `huly_query({entity_type: "issue", mode: "list"})`
- `huly_search_issues` → `huly_query({entity_type: "issue", mode: "search"})`
- `huly_get_issue_details` → `huly_query({entity_type: "issue", mode: "get"})`
- `huly_list_templates` → `huly_query({entity_type: "template", mode: "list"})`
- `huly_search_templates` → `huly_query({entity_type: "template", mode: "search"})`
- `huly_get_template_details` → `huly_query({entity_type: "template", mode: "get"})`
- `huly_list_comments` → `huly_query({entity_type: "comment", mode: "list"})`

**Total Reduction**: 10 tools → 1 tool (90% reduction)

### Strategy 3: Issue Operations Hub (`huly_issue_ops`)

**Replaces**: 11 issue-specific tools

**Signature**:
```typescript
huly_issue_ops({
  operation: "create" | "update" | "delete" | "create_subissue" | "bulk_create" | "bulk_update" | "bulk_delete",
  project_identifier?: string,
  issue_identifier?: string,
  parent_issue_identifier?: string,
  data?: object | object[],
  options?: {
    cascade?: boolean,
    dry_run?: boolean,
    batch_size?: number,
    continue_on_error?: boolean,
    defaults?: object
  }
})
```

**Consolidates**:
- `huly_create_issue`
- `huly_update_issue`
- `huly_delete_issue`
- `huly_create_subissue`
- `huly_bulk_create_issues`
- `huly_bulk_update_issues`
- `huly_bulk_delete_issues`

**Total Reduction**: 7 tools → 1 tool (86% reduction)

**Note**: Query operations (`list_issues`, `search_issues`, `get_issue_details`) handled by `huly_query`

### Strategy 4: Template Operations Hub (`huly_template_ops`)

**Replaces**: 9 template tools

**Signature**:
```typescript
huly_template_ops({
  operation: "create" | "update" | "delete" | "add_child" | "remove_child" | "instantiate",
  template_id?: string,
  project_identifier?: string,
  data?: object,
  child_index?: number,
  options?: {
    include_children?: boolean,
    overrides?: object
  }
})
```

**Consolidates**:
- `huly_create_template`
- `huly_update_template`
- `huly_delete_template`
- `huly_add_child_template`
- `huly_remove_child_template`
- `huly_create_issue_from_template`

**Total Reduction**: 6 tools → 1 tool (83% reduction)

**Note**: Query operations (`list_templates`, `search_templates`, `get_template_details`) handled by `huly_query`

### Strategy 5: Workflow Orchestrator (`huly_workflow`)

**Replaces**: 0 existing tools (NEW functionality)

**Signature**:
```typescript
huly_workflow({
  workflow_type: "project_setup" | "sprint_planning" | "release_management" | "team_onboarding" | "workspace_cleanup",
  context: object,
  options?: {
    dry_run?: boolean,
    auto_rollback?: boolean,
    progress_callback?: boolean
  }
})
```

**Examples**:
```javascript
// Project setup wizard
huly_workflow({
  workflow_type: "project_setup",
  context: {
    project: {name: "Mobile App", identifier: "MAPP"},
    components: ["Frontend", "Backend", "Testing"],
    milestones: [{label: "MVP", target_date: "2025-06-01"}],
    repository: "org/mobile-app"
  }
})

// Sprint planning
huly_workflow({
  workflow_type: "sprint_planning",
  context: {
    project_identifier: "MAPP",
    sprint_name: "Sprint 12",
    duration_weeks: 2,
    team_capacity: 80,
    backlog_filter: {priority: "high"}
  }
})
```

**Total Addition**: 1 new tool (replaces 5-10 manual multi-step workflows)

### Strategy 6: Universal Validation Engine (`huly_validate`)

**Replaces**: 2 validation/preview tools

**Signature**:
```typescript
huly_validate({
  validation_type: "deletion" | "creation" | "update" | "workflow",
  entity_type: string,
  entity_identifier?: string,
  operation_data?: object,
  options?: {
    detailed?: boolean,
    include_impact?: boolean,
    check_permissions?: boolean
  }
})
```

**Consolidates**:
- `huly_validate_deletion`
- `huly_deletion_impact_preview`

**Total Reduction**: 2 tools → 1 tool (50% reduction)

### Strategy 7: Integration Hub (`huly_integration`)

**Replaces**: 2 GitHub tools + future integrations

**Signature**:
```typescript
huly_integration({
  integration_type: "github" | "gitlab" | "jira" | "slack",
  operation: "list_resources" | "assign" | "sync" | "configure",
  resource_identifier?: string,
  project_identifier?: string,
  config?: object
})
```

**Consolidates**:
- `huly_list_github_repositories` → `huly_integration({integration_type: "github", operation: "list_resources"})`
- `huly_assign_repository_to_project` → `huly_integration({integration_type: "github", operation: "assign"})`

**Total Reduction**: 2 tools → 1 tool (50% reduction)

### Strategy 8: Account Operations Hub (`huly_account_ops`)

**Replaces**: 7 account/employee tools

**Signature**:
```typescript
huly_account_ops({
  operation: "get_current" | "create_employee" | "update_employee" | "delete_employee" | "list_employees" | "get_employee" | "create_person",
  employee_id?: string,
  data?: object,
  filters?: object,
  options?: {
    limit?: number,
    active?: boolean
  }
})
```

**Consolidates**:
- `huly_get_current_account`
- `huly_create_employee`
- `huly_update_employee`
- `huly_delete_employee`
- `huly_list_employees`
- `huly_get_employee`
- `huly_create_person`

**Total Reduction**: 7 tools → 1 tool (86% reduction)

### Strategy 9: Comment Operations (Absorbed into `huly_entity`)

**Alternative**: Comments can be treated as entities

```typescript
// Create comment
huly_entity({
  entity_type: "comment",
  operation: "create",
  data: {
    issue_identifier: "PROJ-123",
    message: "Great work!"
  }
})

// List comments
huly_query({
  entity_type: "comment",
  mode: "list",
  filters: {issue_identifier: "PROJ-123"}
})
```

**Total Reduction**: 2 tools → 0 tools (absorbed)

## 📈 Consolidation Results

### Tool Count Reduction

| Category | Current | Target | Reduction |
|----------|---------|--------|-----------|
| Projects | 4 | 0 (→ huly_entity) | 100% |
| Issues | 11 | 1 (huly_issue_ops) | 91% |
| Components | 3 | 0 (→ huly_entity) | 100% |
| Milestones | 3 | 0 (→ huly_entity) | 100% |
| Templates | 9 | 1 (huly_template_ops) | 89% |
| Comments | 2 | 0 (→ huly_entity) | 100% |
| GitHub | 2 | 0 (→ huly_integration) | 100% |
| Accounts | 7 | 1 (huly_account_ops) | 86% |
| Validation | 2 | 0 (→ huly_validate) | 100% |
| **TOTAL** | **43** | **8-10** | **77-81%** |

### Final Tool Set (8-10 Core Tools)

**Essential Core (8 tools)**:
1. ✅ `huly_entity` - Universal entity CRUD
2. ✅ `huly_query` - Universal query engine
3. ✅ `huly_issue_ops` - Issue operations hub
4. ✅ `huly_template_ops` - Template operations hub
5. ✅ `huly_workflow` - Workflow orchestrator
6. ✅ `huly_validate` - Validation engine
7. ✅ `huly_integration` - Integration hub
8. ✅ `huly_account_ops` - Account operations

**Optional Advanced (2 tools)**:
9. ⚡ `huly_batch` - Advanced batch processor (if needed)
10. ⚡ `huly_analytics` - Reporting/analytics (if needed)

## 🎯 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Implement `huly_entity` with full schema support
- Implement `huly_query` with dynamic filtering
- Create comprehensive test suites
- Document migration paths

### Phase 2: Specialized Hubs (Weeks 3-4)
- Implement `huly_issue_ops`
- Implement `huly_template_ops`
- Implement `huly_account_ops`
- Implement `huly_integration`

### Phase 3: Advanced Features (Weeks 5-6)
- Implement `huly_workflow` orchestrator
- Implement `huly_validate` engine
- Add transaction support
- Add rollback mechanisms

### Phase 4: Migration & Deprecation (Weeks 7-8)
- Create migration guide
- Implement backward compatibility layer
- Deprecate old tools with warnings
- Update all documentation

### Phase 5: Cleanup (Week 9)
- Remove deprecated tools
- Final testing and validation
- Performance optimization
- Release v2.0

## 🔧 Technical Considerations

### JSON Schema Complexity

**MCP Best Practices from Context7:**

1. **Use `oneOf` for Polymorphic Tools**
   ```typescript
   {
     "oneOf": [
       {
         "properties": {
           "entity_type": {"const": "project"},
           "operation": {"const": "create"},
           "data": {"$ref": "#/definitions/ProjectCreateData"}
         }
       },
       {
         "properties": {
           "entity_type": {"const": "component"},
           "operation": {"const": "create"},
           "data": {"$ref": "#/definitions/ComponentCreateData"}
         }
       }
     ]
   }
   ```

2. **Clear Parameter Descriptions**
   - Every property should have a descriptive `description` field
   - Use `title` for UI display names
   - Include format hints (`email`, `uri`, `date`, `date-time`)
   - Specify validation constraints (`minimum`, `maximum`, `enum`)

3. **Consistent Response Structures**
   ```typescript
   // Always return consistent structure
   return {
     result: {
       data: [...],
       status: "success",
       metadata: {...}
     }
   }
   ```

4. **Tool Annotations for Hints**
   ```typescript
   {
     annotations: {
       destructiveHint: true,      // For delete operations
       idempotentHint: true,        // For safe retries
       readOnlyHint: false,         // For write operations
       openWorldHint: false         // For controlled environments
     }
   }
   ```

### Security & Permissions

**MCP Security Best Practices:**

1. **Per-Entity Security Constraints**
   - Project deletion requires stronger gating than component creation
   - Carry security annotations through facade layer
   - Implement permission checks at handler level
   - Use `destructiveHint` annotation for dangerous operations

2. **OAuth and Token Management**
   - Implement secure token storage
   - Follow OAuth best practices
   - Prevent token theft and unauthorized access
   - Session management with proper cleanup

3. **DNS Rebinding Protection**
   ```typescript
   new StreamableHTTPServerTransport({
     enableDnsRebindingProtection: true,
     allowedHosts: ['127.0.0.1', 'localhost']
   })
   ```

4. **Audit Trail**
   - Log all operations with user context
   - Track permission escalations
   - Monitor destructive operations
   - Maintain compliance records

### Transaction Management

**MCP Workflow Patterns:**

1. **Chain of Tools Pattern**
   ```typescript
   class ChainWorkflow {
     async execute(mcp_client, initial_input) {
       let current_result = initial_input;
       for (const tool_name of this.tools_chain) {
         const response = await mcp_client.execute_tool(tool_name, current_result);
         current_result = response.result;
       }
       return current_result;
     }
   }
   ```

2. **Graceful Fallbacks**
   ```typescript
   async execute_with_fallback(primary_tool, fallback_tool, parameters) {
     try {
       return await this.client.execute_tool(primary_tool, parameters);
     } catch (e) {
       logging.warning(`Primary tool failed: ${e}`);
       return await this.client.execute_tool(fallback_tool, parameters);
     }
   }
   ```

3. **Parallel Processing**
   ```typescript
   // Execute multiple tools in parallel
   const [stats, correlations, outliers] = await Promise.all([
     client.execute_tool("statisticalAnalysis", params),
     client.execute_tool("correlationAnalysis", params),
     client.execute_tool("outlierDetection", params)
   ]);
   ```

4. **Progress Tracking**
   - Emit intermediate progress events
   - Support long-running operations
   - Prevent silent timeouts
   - Enable cancellation

### Performance Optimization

**MCP Performance Best Practices:**

1. **Resource Links vs. Embedded Content**
   ```typescript
   // Return ResourceLinks instead of full content
   {
     type: "resource_link",
     uri: "file:///project/README.md",
     name: "README.md",
     mimeType: "text/markdown"
   }
   ```

2. **Pagination Support**
   - Use cursor-based pagination
   - Support `nextCursor` in responses
   - Limit default result sizes
   - Enable client-controlled page sizes

3. **Caching Strategies**
   - Cache frequently accessed resources
   - Implement cache invalidation
   - Use ETags for conditional requests
   - Support `listChanged` notifications

4. **Connection Management**
   - Connection pooling for database access
   - Reuse HTTP connections
   - Implement proper cleanup on close
   - Handle transport failures gracefully

### Tool Design Patterns

**MCP Tool Design Best Practices:**

1. **Composable Tools**
   ```typescript
   // Tools that can be used independently or chained
   class DataFetchTool { }
   class DataAnalysisTool { }  // Can use DataFetchTool results
   class DataVisualizationTool { }  // Can use DataAnalysisTool results
   ```

2. **Dependency Injection**
   ```typescript
   class CurrencyConversionTool {
     constructor(exchangeService, cacheService, logger) {
       this.exchangeService = exchangeService;
       this.cacheService = cacheService;
       this.logger = logger;
     }
   }
   ```

3. **Consistent Error Handling**
   ```typescript
   try {
     const results = await this._process(request);
     return { result: results, status: "success" };
   } catch (e) {
     return {
       result: null,
       status: "error",
       error: e.message,
       isError: true
     };
   }
   ```

4. **Dynamic Tool Management**
   ```typescript
   // Enable/disable tools based on permissions
   putMessageTool.disable();  // Hide from listTools
   putMessageTool.enable();   // Show in listTools
   putMessageTool.update({ paramsSchema: {...} });  // Update schema
   putMessageTool.remove();   // Completely remove
   ```

## 🎯 MCP-Specific Consolidation Strategies

### Strategy A: Dispatcher Pattern

**Concept**: Single entry point that routes to specialized handlers

```typescript
class ContentDispatcherTool {
  async execute(request) {
    const { entity_type, operation } = request.parameters;

    // Determine target handler
    const handler = this.getHandler(entity_type, operation);

    // Forward to specialized handler
    return await handler.execute(request);
  }

  getHandler(entity_type, operation) {
    return this.handlers.get(`${entity_type}_${operation}`);
  }
}
```

**Benefits**:
- Single tool registration
- Centralized routing logic
- Easy to add new entity types
- Maintains specialized handlers

### Strategy B: Composite Workflow Pattern

**Concept**: Build complex workflows from simpler ones

```typescript
class CompositeWorkflow {
  constructor(workflows) {
    this.workflows = workflows;
  }

  async execute(context) {
    const results = {};
    for (const workflow of this.workflows) {
      const result = await workflow.execute(context);
      results[workflow.name] = result;
      context = context.withResult(workflow.name, result);
    }
    return results;
  }
}
```

**Benefits**:
- Reusable workflow components
- Sequential execution with context passing
- Easy to test individual workflows
- Flexible composition

### Strategy C: Elicitation for Dynamic Parameters

**Concept**: Request additional input from users when needed

```typescript
async function huly_workflow({ workflow_type, context }) {
  // Check if we have all required parameters
  if (!context.team_size) {
    const result = await server.elicitInput({
      message: "How many team members will work on this project?",
      requestedSchema: {
        type: "object",
        properties: {
          team_size: {
            type: "number",
            title: "Team Size",
            description: "Number of team members",
            minimum: 1,
            maximum: 100
          }
        }
      }
    });

    if (result.action === "accept") {
      context.team_size = result.content.team_size;
    }
  }

  // Continue with workflow
  return await executeWorkflow(workflow_type, context);
}
```

**Benefits**:
- Reduces upfront parameter complexity
- Interactive user experience
- Handles optional/conditional parameters
- Better error recovery

### Strategy D: Resource Links for Large Datasets

**Concept**: Return references instead of full content

```typescript
async function huly_query({ entity_type, mode, filters }) {
  const results = await queryDatabase(entity_type, filters);

  // Return resource links instead of full content
  return {
    content: [
      { type: "text", text: `Found ${results.length} ${entity_type}s` },
      ...results.map(item => ({
        type: "resource_link",
        uri: `huly://${entity_type}/${item.id}`,
        name: item.title,
        description: item.summary
      }))
    ]
  };
}
```

**Benefits**:
- Reduced payload sizes
- Faster response times
- Client controls what to fetch
- Better for large result sets

## 🎉 Benefits of Aggressive Consolidation

### Quantitative Benefits
- **77-81% reduction** in tool count (43 → 8-10)
- **90% reduction** in code duplication
- **85% reduction** in test files
- **80% reduction** in documentation pages
- **75% reduction** in API surface area
- **60% reduction** in schema definitions
- **70% reduction** in handler functions

### Qualitative Benefits
- **Simplified mental model**: 8-10 concepts vs. 43
- **Consistent patterns**: All tools follow same structure
- **Better discoverability**: Fewer tools to search through
- **Easier maintenance**: Centralized logic
- **Future-proof**: Easy to add new entity types
- **Workflow support**: High-level orchestration built-in
- **MCP-compliant**: Follows all MCP best practices
- **Better UX**: Elicitation for complex parameters
- **Performance**: Resource links for large datasets

## 🚨 Risks & Mitigation

### Risk 1: Schema Complexity
**Mitigation**: Provide schema discovery API, comprehensive documentation, and code examples

### Risk 2: Breaking Changes
**Mitigation**: Maintain backward compatibility layer during transition period

### Risk 3: Performance Overhead
**Mitigation**: Optimize routing logic, implement caching, benchmark all operations

### Risk 4: User Adoption
**Mitigation**: Gradual migration, clear migration guides, support both old and new tools during transition

## 🎯 Success Metrics

- ✅ Tool count reduced from 43 to 8-10 (77-81%)
- ✅ All existing functionality preserved
- ✅ 90%+ test coverage maintained
- ✅ Performance within 10% of current implementation
- ✅ Migration completed within 9 weeks
- ✅ Zero breaking changes for end users during transition
- ✅ Documentation updated and comprehensive

## 💻 Implementation Examples

### Example 1: Universal Entity Manager

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "huly-consolidated",
  version: "2.0.0"
});

// Universal entity manager with oneOf schema
server.registerTool(
  "huly_entity",
  {
    title: "Entity Manager",
    description: "Universal CRUD operations for all entity types",
    annotations: {
      destructiveHint: true,  // Can perform delete operations
      idempotentHint: false,  // Operations may have side effects
      readOnlyHint: false     // Performs write operations
    },
    inputSchema: {
      oneOf: [
        {
          properties: {
            entity_type: { const: "project" },
            operation: { const: "create" },
            data: {
              type: "object",
              properties: {
                name: { type: "string", description: "Project name" },
                identifier: { type: "string", description: "Project identifier (max 5 chars)" },
                description: { type: "string", description: "Project description" }
              },
              required: ["name", "identifier"]
            }
          }
        },
        {
          properties: {
            entity_type: { const: "project" },
            operation: { const: "delete" },
            identifier: { type: "string", description: "Project identifier" },
            options: {
              type: "object",
              properties: {
                force: { type: "boolean", default: false },
                dry_run: { type: "boolean", default: false }
              }
            }
          }
        }
        // ... more combinations
      ]
    }
  },
  async ({ entity_type, operation, identifier, data, options }) => {
    // Route to appropriate handler
    const handler = getEntityHandler(entity_type);

    try {
      const result = await handler[operation]({ identifier, data, options });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }],
        structuredContent: result
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Example 2: Workflow Orchestrator with Elicitation

```typescript
server.registerTool(
  "huly_workflow",
  {
    title: "Workflow Orchestrator",
    description: "Execute complex multi-step workflows",
    inputSchema: {
      workflow_type: {
        type: "string",
        enum: ["project_setup", "sprint_planning", "release_management"],
        description: "Type of workflow to execute"
      },
      context: {
        type: "object",
        description: "Workflow context and parameters"
      },
      options: {
        type: "object",
        properties: {
          dry_run: { type: "boolean", default: false },
          auto_rollback: { type: "boolean", default: true }
        }
      }
    }
  },
  async ({ workflow_type, context, options }) => {
    // Check if we need additional information
    if (workflow_type === "project_setup" && !context.team_size) {
      const result = await server.server.elicitInput({
        message: "Please provide additional project setup information",
        requestedSchema: {
          type: "object",
          properties: {
            team_size: {
              type: "number",
              title: "Team Size",
              description: "Number of team members",
              minimum: 1,
              maximum: 100
            },
            methodology: {
              type: "string",
              title: "Development Methodology",
              enum: ["agile", "waterfall", "kanban"],
              enumNames: ["Agile/Scrum", "Waterfall", "Kanban"]
            }
          },
          required: ["team_size"]
        }
      });

      if (result.action === "accept") {
        context = { ...context, ...result.content };
      } else {
        return {
          content: [{
            type: "text",
            text: "Workflow cancelled by user"
          }]
        };
      }
    }

    // Execute workflow with progress tracking
    const workflow = new CompositeWorkflow([
      new CreateProjectWorkflow(),
      new SetupComponentsWorkflow(),
      new CreateMilestonesWorkflow(),
      new AssignRepositoryWorkflow()
    ]);

    try {
      const result = await workflow.execute(context);
      return {
        content: [{
          type: "text",
          text: `Workflow completed successfully: ${JSON.stringify(result, null, 2)}`
        }],
        structuredContent: result
      };
    } catch (error) {
      if (options.auto_rollback) {
        await workflow.rollback();
      }
      return {
        content: [{
          type: "text",
          text: `Workflow failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Example 3: Query Engine with Resource Links

```typescript
server.registerTool(
  "huly_query",
  {
    title: "Universal Query Engine",
    description: "Query and search across all entity types",
    annotations: {
      readOnlyHint: true,      // Read-only operation
      idempotentHint: true     // Safe to retry
    },
    inputSchema: {
      entity_type: {
        type: "string",
        enum: ["project", "issue", "component", "milestone", "template"],
        description: "Type of entity to query"
      },
      mode: {
        type: "string",
        enum: ["list", "search", "get"],
        description: "Query mode"
      },
      filters: {
        type: "object",
        description: "Query filters (dynamic based on entity_type)"
      },
      options: {
        type: "object",
        properties: {
          limit: { type: "number", default: 50, maximum: 500 },
          offset: { type: "number", default: 0 },
          include_details: { type: "boolean", default: false }
        }
      }
    }
  },
  async ({ entity_type, mode, filters, options }) => {
    const results = await queryDatabase(entity_type, mode, filters, options);

    if (options.include_details) {
      // Return full content
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }],
        structuredContent: results
      };
    } else {
      // Return resource links for better performance
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} ${entity_type}(s)`
          },
          ...results.map(item => ({
            type: "resource_link",
            uri: `huly://${entity_type}/${item.id}`,
            name: item.title || item.name,
            mimeType: "application/json",
            description: item.description || item.summary
          }))
        ]
      };
    }
  }
);
```

### Example 4: Dynamic Tool Management

```typescript
// Create tools that can be enabled/disabled based on permissions
const issueCreateTool = server.tool(
  "huly_issue_ops",
  {
    operation: z.enum(["create", "update", "delete", "bulk_create"]),
    project_identifier: z.string(),
    data: z.any()
  },
  async ({ operation, project_identifier, data }) => {
    // Check permissions
    const hasPermission = await checkPermission(operation, project_identifier);

    if (!hasPermission) {
      return {
        content: [{
          type: "text",
          text: "Insufficient permissions for this operation"
        }],
        isError: true
      };
    }

    // Execute operation
    const handler = getIssueHandler(operation);
    return await handler.execute({ project_identifier, data });
  }
);

// Disable destructive operations by default
if (!hasDestructivePermissions()) {
  issueCreateTool.update({
    paramsSchema: {
      operation: z.enum(["create", "update"])  // Remove delete and bulk_create
    }
  });
}

// Enable when permissions are upgraded
async function upgradePermissions(level) {
  if (level === "admin") {
    issueCreateTool.update({
      paramsSchema: {
        operation: z.enum(["create", "update", "delete", "bulk_create"])
      }
    });
  }
}
```

## 🔮 Future Vision

With this aggressive consolidation, the Huly MCP Server becomes:
- **Simpler**: 8-10 tools instead of 43
- **More powerful**: Workflow orchestration built-in
- **More maintainable**: Centralized logic and patterns
- **More extensible**: Easy to add new entity types
- **More consistent**: Unified API across all operations
- **Production-ready**: Enterprise-grade transaction support
- **MCP-compliant**: Follows all official MCP best practices
- **User-friendly**: Elicitation for complex workflows
- **Performant**: Resource links and pagination built-in
- **Secure**: Proper annotations and permission handling

This is the path to a world-class MCP server that scales with your organization while maintaining simplicity and ease of use.
