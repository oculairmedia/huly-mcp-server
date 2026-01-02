# MCP Best Practices Summary for Tool Consolidation

## 🎯 Key Insights from Model Context Protocol Documentation

This document summarizes the critical best practices from the official MCP specification and SDK documentation that inform our aggressive tool consolidation strategy.

## 📋 Schema Design Best Practices

### 1. Use `oneOf` for Polymorphic Tools

**Why**: MCP clients rely on JSON Schema to surface form fields. A polymorphic tool must expose proper schema structure to avoid falling back to an untyped "bag of params" experience.

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

### 2. Clear Parameter Descriptions

Every parameter should include:
- **`description`**: Detailed explanation of the parameter
- **`title`**: Human-readable display name for UI
- **Format hints**: `email`, `uri`, `date`, `date-time`
- **Validation constraints**: `minimum`, `maximum`, `enum`, `pattern`

```typescript
{
  query: { 
    type: "string", 
    description: "Search query text. Use precise keywords for better results." 
  },
  limit: { 
    type: "integer", 
    description: "Maximum number of results to return (1-50)",
    minimum: 1,
    maximum: 50,
    default: 10
  }
}
```

### 3. Tool Annotations

Use annotations to provide hints to MCP clients:

```typescript
{
  annotations: {
    destructiveHint: true,      // Indicates potentially destructive operations
    idempotentHint: true,        // Safe to retry without side effects
    readOnlyHint: false,         // Performs write operations
    openWorldHint: false,        // Operates in controlled environment
    title: "Display Name"        // UI display name (fallback to name)
  }
}
```

**Important**: Shared handlers must respect per-entity security constraints (e.g., project deletion requires stronger gating than component creation).

## 🔄 Workflow Patterns

### 1. Chain of Tools Pattern

Execute tools sequentially, passing results between them:

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

### 2. Composite Workflow Pattern

Build complex workflows from simpler ones:

```typescript
class CompositeWorkflow {
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

### 3. Graceful Fallbacks

Implement resilient workflows with fallback mechanisms:

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

### 4. Parallel Processing

Execute independent operations concurrently:

```typescript
const [stats, correlations, outliers] = await Promise.all([
  client.execute_tool("statisticalAnalysis", params),
  client.execute_tool("correlationAnalysis", params),
  client.execute_tool("outlierDetection", params)
]);
```

## 🎨 Tool Design Patterns

### 1. Dispatcher Pattern

Single entry point that routes to specialized handlers:

```typescript
class ContentDispatcherTool {
  async execute(request) {
    const { entity_type, operation } = request.parameters;
    const handler = this.getHandler(entity_type, operation);
    return await handler.execute(request);
  }
}
```

### 2. Composable Tools

Design tools that can work independently or be chained:

```typescript
class DataFetchTool { }
class DataAnalysisTool { }  // Can use DataFetchTool results
class DataVisualizationTool { }  // Can use DataAnalysisTool results
```

### 3. Dependency Injection

Enhance testability and configurability:

```typescript
class CurrencyConversionTool {
  constructor(exchangeService, cacheService, logger) {
    this.exchangeService = exchangeService;
    this.cacheService = cacheService;
    this.logger = logger;
  }
}
```

### 4. Dynamic Tool Management

Enable/disable tools based on runtime conditions:

```typescript
// Disable tool
putMessageTool.disable();  // Won't show up in listTools

// Enable tool
putMessageTool.enable();   // Shows in listTools

// Update tool schema
putMessageTool.update({ paramsSchema: {...} });

// Remove tool completely
putMessageTool.remove();
```

## 📊 Response Patterns

### 1. Consistent Response Structure

Always return predictable structures:

```typescript
try {
  const results = await this._process(request);
  return {
    content: [{ type: "text", text: JSON.stringify(results) }],
    structuredContent: results,
    isError: false
  };
} catch (e) {
  return {
    content: [{ type: "text", text: `Error: ${e.message}` }],
    isError: true
  };
}
```

### 2. Resource Links vs. Embedded Content

For large datasets, return resource links instead of full content:

```typescript
// ❌ Bad: Embedding large content
{
  content: [{
    type: "text",
    text: JSON.stringify(largeDataset)  // Huge payload
  }]
}

// ✅ Good: Using resource links
{
  content: [
    { type: "text", text: `Found ${results.length} items` },
    ...results.map(item => ({
      type: "resource_link",
      uri: `huly://issue/${item.id}`,
      name: item.title,
      mimeType: "application/json",
      description: item.summary
    }))
  ]
}
```

### 3. Structured Content

Use `structuredContent` for machine-readable output:

```typescript
{
  content: [{
    type: "text",
    text: "Temperature: 22.5°C, Conditions: Partly cloudy"
  }],
  structuredContent: {
    temperature: 22.5,
    conditions: "Partly cloudy",
    humidity: 65
  }
}
```

## 🔐 Security Best Practices

### 1. OAuth and Token Management

- Implement secure token storage
- Follow OAuth best practices
- Prevent token theft and unauthorized access
- Proper session management with cleanup

### 2. DNS Rebinding Protection

```typescript
new StreamableHTTPServerTransport({
  enableDnsRebindingProtection: true,
  allowedHosts: ['127.0.0.1', 'localhost']
})
```

### 3. Permission Annotations

Carry security annotations through facade layer:

```typescript
{
  annotations: {
    destructiveHint: true  // Warns about dangerous operations
  }
}
```

## 🎭 User Interaction Patterns

### Elicitation for Dynamic Parameters

Request additional input from users when needed:

```typescript
const result = await server.elicitInput({
  message: "No tables available. Check alternative dates?",
  requestedSchema: {
    type: "object",
    properties: {
      checkAlternatives: {
        type: "boolean",
        title: "Check alternative dates"
      },
      flexibleDates: {
        type: "string",
        enum: ["next_day", "same_week", "next_week"],
        enumNames: ["Next day", "Same week", "Next week"]
      }
    }
  }
});

if (result.action === "accept") {
  // Use result.content
}
```

## ⚡ Performance Optimization

### 1. Pagination Support

```typescript
{
  tools: [...],
  nextCursor: "page-2-token"  // For pagination
}
```

### 2. List Changed Notifications

Notify clients when tool lists change:

```typescript
{
  capabilities: {
    tools: {
      listChanged: true  // Will send notifications
    }
  }
}
```

### 3. Caching Strategies

- Cache frequently accessed resources
- Implement cache invalidation
- Use ETags for conditional requests
- Support `listChanged` notifications

## 🚨 Critical Caveats for Consolidation

### 1. Transaction Management

**Caveat**: True all-or-nothing semantics require either:
- Backend transactions across services (tracker, templates, GitHub)
- Compensating rollbacks when services commit independently

**Solution**: Workflows must degrade gracefully when later steps fail.

### 2. Progress Tracking

**Caveat**: Long-running operations (e.g., repository assignment) can silently time out.

**Solution**: Emit intermediate progress/status events.

### 3. Schema Complexity

**Caveat**: Polymorphic tools need `oneOf` schemas or separate discovery endpoints.

**Solution**: Provide comprehensive schema definitions with proper `oneOf` structures.

## 📚 Key Takeaways

1. **Use `oneOf` for polymorphic tools** - Essential for proper UI rendering
2. **Provide clear descriptions** - Every parameter needs documentation
3. **Use annotations** - Hint at tool behavior (destructive, idempotent, etc.)
4. **Return resource links** - Better performance for large datasets
5. **Implement elicitation** - Interactive parameter gathering
6. **Support workflows** - Chain, composite, and parallel patterns
7. **Handle errors gracefully** - Consistent error structures
8. **Enable dynamic management** - Tools can be enabled/disabled at runtime
9. **Implement proper security** - OAuth, permissions, DNS protection
10. **Track progress** - Long operations need status updates

These best practices ensure our consolidated tools are MCP-compliant, performant, secure, and user-friendly.
