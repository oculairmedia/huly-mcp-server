# Huly MCP Server REST API Implementation Plan

## Executive Summary

The Huly MCP server currently provides comprehensive Huly platform integration through the Model Context Protocol (MCP) over HTTP using JSON-RPC 2.0. However, the documented REST API endpoints (`GET /tools` and `POST /tools/{tool_name}`) are **missing from the actual implementation**, despite being referenced in documentation, tests, and usage examples.

This document provides a complete implementation plan to add full REST API support, enabling traditional HTTP REST interactions alongside the existing MCP protocol functionality.

## Current State Analysis

### ✅ What Currently Works
- **MCP Protocol over HTTP**: Full JSON-RPC 2.0 implementation at `POST /mcp`
- **Health Check**: `GET /health` endpoint with server status
- **Tool System**: 40+ Huly tools via `src/tools/index.js`
- **Service Layer**: Complete integration with `hulyClientWrapper` and services
- **Authentication**: Environment-based Huly platform authentication
- **Error Handling**: Comprehensive `HulyError` system
- **Transport Abstraction**: Clean separation via `TransportFactory`

### ❌ What's Missing
- **REST Tool Listing**: `GET /tools` endpoint implementation
- **REST Tool Execution**: `POST /tools/{tool_name}` endpoint implementation
- **Direct Tool Access**: `executeTool` method in `HttpTransport` class
- **REST Error Handling**: Proper HTTP status codes and error responses

### 🔍 Evidence of Planned Implementation
- **Documentation**: `API.md` and `README.md` describe REST endpoints
- **Tests**: Both test suites expect and validate REST functionality
- **Architecture**: All infrastructure exists to support REST endpoints

## Available Huly Operations

The REST API will provide access to **40+ Huly tools** across these categories:

### Project Management
- `huly_list_projects`, `huly_create_project`, `huly_delete_project`, `huly_archive_project`

### Issue Management  
- `huly_list_issues`, `huly_create_issue`, `huly_update_issue`, `huly_delete_issue`
- `huly_create_subissue`, `huly_search_issues`, `huly_get_issue_details`
- `huly_bulk_create_issues`, `huly_bulk_update_issues`, `huly_bulk_delete_issues`

### Components & Milestones
- `huly_create_component`, `huly_list_components`, `huly_delete_component`
- `huly_create_milestone`, `huly_list_milestones`, `huly_delete_milestone`

### Templates & Workflows
- `huly_create_template`, `huly_list_templates`, `huly_create_issue_from_template`
- `huly_validate_deletion`, `huly_deletion_impact_preview`

### Comments & Collaboration
- `huly_create_comment`, `huly_list_comments`

### GitHub Integration
- `huly_list_github_repositories`, `huly_assign_repository_to_project`

### Employee Management
- `huly_create_employee`, `huly_list_employees`, `huly_get_employee`, `huly_update_employee`

## Implementation Requirements

### Primary Changes: `src/transport/HttpTransport.js`

#### 1. Add Required Imports
```javascript
import { 
  getAllToolDefinitions, 
  executeTool as executeRegisteredTool, 
  hasTool 
} from '../tools/index.js';
import { HulyError } from '../core/HulyError.js';
import { getConfigManager } from '../config/index.js';
```

#### 2. Update Constructor
```javascript
constructor(server, options = {}) {
  super(server);
  this.port = options.port || process.env.PORT || 5439;
  this.app = null;
  this.httpServer = null;
  this.running = false;
  this.transports = {};
  this.logger = options.logger || console;
  
  // NEW: Store dependencies for REST endpoints
  this.toolDefinitions = options.toolDefinitions || [];
  this.hulyClientWrapper = options.hulyClientWrapper;
  this.services = options.services;
}
```

#### 3. Add Tool Execution Method
```javascript
/**
 * Execute a tool directly (for REST endpoints)
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Tool response
 */
async executeTool(name, args) {
  if (!hasTool(name)) {
    throw HulyError.invalidValue('tool', name, 'a valid tool name');
  }

  const context = {
    client: null,
    services: this.services,
    config: getConfigManager().getHulyConfig(),
    logger: this.logger.child(name),
  };

  return await this.hulyClientWrapper.withClient(async (client) => {
    context.client = client;
    return executeRegisteredTool(name, args, context);
  });
}
```

#### 4. Add REST Endpoints to `setupRoutes()`
```javascript
// GET /tools - List available tools
this.app.get('/tools', (req, res) => {
  res.json({
    tools: this.toolDefinitions
  });
});

// POST /tools/:toolName - Direct tool execution
this.app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    const result = await this.executeTool(toolName, args);
    res.json(result);
  } catch (error) {
    this.logger.error(`Error executing tool ${toolName}:`, error);
    
    if (error instanceof HulyError) {
      const mcpResponse = error.toMCPResponse();
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: mcpResponse.content[0].text
        },
        id: null
      });
    }

    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      },
      id: null
    });
  }
});
```

### Documentation Updates

#### `API.md` Changes
- Update base URL from `http://localhost:3000` to `http://localhost:5439`
- Ensure all examples use correct port number

#### `README.md` Changes  
- Update quick reference examples with correct port
- Verify REST endpoint documentation is accurate

## Testing Strategy

### Existing Test Coverage
- **`src/transport/__tests__/HttpTransport.test.js`**: Expects REST endpoints
- **`__tests__/unit/transport/HttpTransport.test.js`**: Validates tool execution
- **All tests currently fail** due to missing implementation
- **Tests will pass** once implementation is complete

### Manual Testing Commands
```bash
# Start the server
npm run start:http

# Test tool listing
curl http://localhost:5439/tools

# Test project listing
curl -X POST http://localhost:5439/tools/huly_list_projects \
  -H "Content-Type: application/json" \
  -d '{}'

# Test issue creation
curl -X POST http://localhost:5439/tools/huly_create_issue \
  -H "Content-Type: application/json" \
  -d '{
    "project_identifier": "PROJ",
    "title": "Test Issue via REST",
    "description": "Created using REST API",
    "priority": "high"
  }'

# Test error handling
curl -X POST http://localhost:5439/tools/invalid_tool \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Architecture Integration

### Current Integration Points
- **`index.js`**: Already passes required options to `HttpTransport`
- **Tool System**: `src/tools/index.js` provides all necessary functions
- **Service Layer**: `ServiceRegistry` provides Huly platform access
- **Error Handling**: `HulyError` class provides structured error responses
- **Configuration**: `ConfigManager` handles all server settings

### No Changes Required
- Tool definitions and handlers
- Service layer implementation  
- MCP protocol functionality
- Authentication system
- Configuration management

## Implementation Complexity

### Low Complexity (✅ Straightforward)
- Constructor parameter additions
- `GET /tools` endpoint implementation
- Documentation updates

### Medium Complexity (⚠️ Requires Care)
- `executeTool` method implementation
- `POST /tools/:toolName` endpoint with error handling
- REST-specific error response formatting

### High Complexity (❌ None)
- All required infrastructure already exists
- No architectural changes needed
- No breaking changes to existing functionality

## Risk Assessment

### Low Risk Factors
- **Existing Infrastructure**: All components already implemented
- **Test Coverage**: Comprehensive test suite validates expected behavior
- **No Breaking Changes**: MCP protocol functionality remains unchanged
- **Clear Requirements**: Tests and documentation define exact expectations

### Potential Challenges
- **Error Handling Edge Cases**: Ensuring consistent error responses
- **Tool Validation**: Maintaining consistency with MCP implementation
- **Response Format**: Ensuring compatibility with existing clients

### Mitigation Strategies
- Follow existing error handling patterns from MCP implementation
- Use same tool validation logic as MCP protocol
- Maintain consistent response formats across both protocols

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| **Implementation** | 2-3 hours | Add methods and endpoints to `HttpTransport.js` |
| **Testing** | 1 hour | Run existing tests and manual validation |
| **Documentation** | 30 minutes | Update port numbers and examples |
| **Review** | 30 minutes | Code review and final validation |
| **Total** | **4-5 hours** | Complete REST API implementation |

## Success Criteria

### Functional Requirements
- ✅ `GET /tools` returns list of available tools
- ✅ `POST /tools/{tool_name}` executes tools with JSON body
- ✅ Proper HTTP status codes (200, 400, 500)
- ✅ Consistent error response format
- ✅ All existing tests pass

### Non-Functional Requirements  
- ✅ No performance impact on MCP protocol
- ✅ Maintains existing security measures
- ✅ Preserves all current functionality
- ✅ Documentation accuracy

## Benefits

### For Developers
- **Simplified Integration**: Standard REST API calls
- **Better Tooling**: Works with any HTTP client
- **Familiar Patterns**: Standard REST conventions
- **Reduced Complexity**: No MCP protocol knowledge required

### For Operations
- **Monitoring**: Standard HTTP metrics and logging
- **Testing**: Simple curl commands for validation
- **Integration**: Works with existing HTTP infrastructure
- **Debugging**: Clear HTTP status codes and error messages

### For the Project
- **Completeness**: Fulfills documented API promises
- **Flexibility**: Multiple integration options (MCP + REST)
- **Adoption**: Lower barrier to entry for new users
- **Consistency**: Aligns implementation with documentation

## Conclusion

The REST API implementation is **low-risk and high-value**, requiring minimal code changes to unlock significant functionality. All infrastructure exists, tests define the requirements, and the implementation follows established patterns within the codebase.

**Recommendation**: Proceed with implementation as outlined in this document.

## Appendix A: Complete Code Changes

### File: `src/transport/HttpTransport.js`

#### Import Additions (Top of file)
```javascript
import {
  getAllToolDefinitions,
  executeTool as executeRegisteredTool,
  hasTool
} from '../tools/index.js';
import { HulyError } from '../core/HulyError.js';
import { getConfigManager } from '../config/index.js';
```

#### Constructor Modifications (Line ~69)
```javascript
export class HttpTransport extends BaseTransport {
  constructor(server, options = {}) {
    super(server);
    this.port = options.port || process.env.PORT || 5439;
    this.app = null;
    this.httpServer = null;
    this.running = false;
    this.transports = {}; // Session ID -> Transport mapping
    this.logger = options.logger || console;

    // NEW: Store dependencies for REST endpoints
    this.toolDefinitions = options.toolDefinitions || [];
    this.hulyClientWrapper = options.hulyClientWrapper;
    this.services = options.services;
  }
```

#### New Method Addition (After line ~195)
```javascript
  /**
   * Execute a tool directly (for REST endpoints)
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool response
   */
  async executeTool(name, args) {
    if (!hasTool(name)) {
      throw HulyError.invalidValue('tool', name, 'a valid tool name');
    }

    const context = {
      client: null,
      services: this.services,
      config: getConfigManager().getHulyConfig(),
      logger: this.logger.child(name),
    };

    return await this.hulyClientWrapper.withClient(async (client) => {
      context.client = client;
      return executeRegisteredTool(name, args, context);
    });
  }
```

#### Route Additions in setupRoutes() (After line ~216)
```javascript
    // GET /tools - List available tools
    this.app.get('/tools', (req, res) => {
      res.json({
        tools: this.toolDefinitions
      });
    });

    // POST /tools/:toolName - Direct tool execution
    this.app.post('/tools/:toolName', async (req, res) => {
      const { toolName } = req.params;
      const args = req.body;

      try {
        const result = await this.executeTool(toolName, args);
        res.json(result);
      } catch (error) {
        this.logger.error(`Error executing tool ${toolName}:`, error);

        if (error instanceof HulyError) {
          const mcpResponse = error.toMCPResponse();
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: mcpResponse.content[0].text
            },
            id: null
          });
        }

        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: error.message
          },
          id: null
        });
      }
    });
```

## Appendix B: API Usage Examples

### Authentication Setup
```bash
export HULY_URL="https://your-huly-instance.com"
export HULY_EMAIL="your-email@example.com"
export HULY_PASSWORD="your-password"
export HULY_WORKSPACE="your-workspace"
```

### Start Server
```bash
npm run start:http
# Server starts on http://localhost:5439
```

### REST API Examples

#### List All Available Tools
```bash
curl -X GET http://localhost:5439/tools \
  -H "Content-Type: application/json" | jq
```

#### Project Operations
```bash
# List projects
curl -X POST http://localhost:5439/tools/huly_list_projects \
  -H "Content-Type: application/json" \
  -d '{}'

# Create project
curl -X POST http://localhost:5439/tools/huly_create_project \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Project",
    "description": "Created via REST API",
    "identifier": "REST"
  }'
```

#### Issue Operations
```bash
# List issues
curl -X POST http://localhost:5439/tools/huly_list_issues \
  -H "Content-Type: application/json" \
  -d '{
    "project_identifier": "REST",
    "limit": 10
  }'

# Create issue
curl -X POST http://localhost:5439/tools/huly_create_issue \
  -H "Content-Type: application/json" \
  -d '{
    "project_identifier": "REST",
    "title": "REST API Test Issue",
    "description": "Testing the new REST endpoints",
    "priority": "high"
  }'

# Update issue
curl -X POST http://localhost:5439/tools/huly_update_issue \
  -H "Content-Type: application/json" \
  -d '{
    "issue_identifier": "REST-1",
    "field": "status",
    "value": "in-progress"
  }'
```

#### Bulk Operations
```bash
# Bulk create issues
curl -X POST http://localhost:5439/tools/huly_bulk_create_issues \
  -H "Content-Type: application/json" \
  -d '{
    "project_identifier": "REST",
    "issues": [
      {
        "title": "First bulk issue",
        "description": "Created in bulk",
        "priority": "medium"
      },
      {
        "title": "Second bulk issue",
        "description": "Also created in bulk",
        "priority": "low"
      }
    ]
  }'
```

## Appendix C: Error Response Examples

### Invalid Tool Name
```bash
curl -X POST http://localhost:5439/tools/invalid_tool \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Invalid value for tool: invalid_tool. Expected a valid tool name"
  },
  "id": null
}
```

### Missing Required Parameters
```bash
curl -X POST http://localhost:5439/tools/huly_create_issue \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Missing required parameter: project_identifier"
  },
  "id": null
}
```

### Server Error
```bash
# If Huly connection fails
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Failed to connect to Huly platform"
  },
  "id": null
}
```

## Appendix D: Comparison with MCP Protocol

### MCP Protocol (JSON-RPC 2.0)
```bash
curl -X POST http://localhost:5439/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: your-session-id" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "huly_list_projects",
      "arguments": {}
    },
    "id": 1
  }'
```

### REST API (Direct)
```bash
curl -X POST http://localhost:5439/tools/huly_list_projects \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Key Differences
- **REST**: Simpler, direct tool calls
- **MCP**: Requires session management and JSON-RPC wrapper
- **REST**: Standard HTTP status codes
- **MCP**: All responses return 200 with error details in JSON
- **REST**: Tool name in URL path
- **MCP**: Tool name in request body parameters

Both protocols provide identical functionality and use the same underlying tool system.
