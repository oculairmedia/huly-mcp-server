# Huly MCP Server API Documentation

## Overview

The Huly MCP Server provides a comprehensive API for interacting with the Huly project management platform through the Model Context Protocol (MCP). This server supports both HTTP and stdio transport methods, making it compatible with various MCP clients including Claude Code.

## Authentication

All API calls require authentication through environment variables or connection parameters:

- **HULY_URL**: The Huly instance URL (e.g., `https://pm.oculair.ca`)
- **HULY_EMAIL**: User email for authentication
- **HULY_PASSWORD**: User password for authentication  
- **HULY_WORKSPACE**: Target workspace name

## Transport Methods

### HTTP Transport

The server runs on port 3457 by default and provides both MCP protocol and REST API endpoints:

- **Base URL**: `http://localhost:3457`
- **Health Check**: `GET /health`
- **MCP Protocol**: `POST /mcp` (JSON-RPC 2.0)
- **MCP Sessions**: `GET /mcp` (SSE streaming), `DELETE /mcp` (session termination)

### REST API Endpoints

The server provides a comprehensive REST API for direct tool access without MCP protocol overhead:

- **List Tools**: `GET /api/tools`
- **Execute Tool (POST)**: `POST /api/tools/{tool_name}`
- **Execute Tool (GET)**: `GET /api/tools/{tool_name}?param=value`
- **API Health**: `GET /api/health`

### Stdio Transport

For direct MCP client integration (e.g., Claude Code):

```bash
npm run start:stdio
```

## API Endpoints

### Health Check

Check server health and status.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "service": "huly-mcp-server",
  "transport": "streamable_http",
  "protocol_version": "2025-06-18",
  "sessions": 0,
  "uptime": 123.45,
  "timestamp": "2024-12-17T10:30:00.000Z",
  "security": {
    "origin_validation": true,
    "localhost_binding": true
  }
}
```

### REST API Health

Check REST API specific health and configuration.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "huly-rest-api",
    "transport": "http",
    "uptime": 123.45,
    "toolCount": 42
  },
  "metadata": {
    "timestamp": "2024-12-17T10:30:00.000Z",
    "version": "1.0"
  }
}
```

### List Available Tools (REST API)

Get a list of all available tools with filtering capabilities.

**Endpoint**: `GET /api/tools`

**Query Parameters**:
- `category` (optional): Filter by category (e.g., "projects", "issues", "components")
- `search` (optional): Search in tool names and descriptions

**Response**:
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "huly_list_projects",
        "description": "List all projects in Huly workspace",
        "category": "projects",
        "inputSchema": {
          "type": "object",
          "properties": {},
          "required": []
        },
        "outputFormat": "object"
      }
    ],
    "count": 42,
    "categories": ["projects", "issues", "components", "milestones", "templates", "accounts"],
    "filters": {
      "category": null,
      "search": null
    }
  },
  "metadata": {
    "timestamp": "2024-12-17T10:30:00.000Z",
    "version": "1.0"
  }
}
```

### Execute Tool (REST API - POST)

Execute a tool with JSON body parameters.

**Endpoint**: `POST /api/tools/{tool_name}`

**Request Body**:
```json
{
  "arguments": {
    "project_identifier": "PROJ",
    "title": "New Issue"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "toolName": "huly_create_issue",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "✅ Created issue PROJ-123: New Issue"
        }
      ]
    },
    "executionTime": 245
  },
  "metadata": {
    "timestamp": "2024-12-17T10:30:00.000Z",
    "version": "1.0"
  }
}
```

### Execute Tool (REST API - GET)

Execute a tool with query parameters (convenient for simple tools).

**Endpoint**: `GET /api/tools/{tool_name}?param1=value1&param2=value2`

**Example**: `GET /api/tools/huly_list_projects`

**Response**:
```json
{
  "success": true,
  "data": {
    "toolName": "huly_list_projects",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "Found 3 projects:\n\n📁 **Marketing Campaign** (MKT)..."
        }
      ]
    },
    "executionTime": 156
  },
  "metadata": {
    "timestamp": "2024-12-17T10:30:00.000Z",
    "version": "1.0"
  }
}
```

### MCP Protocol Endpoints

Standard JSON-RPC 2.0 endpoints for MCP communication with session management.

#### Initialize MCP Session

**Endpoint**: `POST /mcp`

**Headers**:
- `Content-Type: application/json`
- `MCP-Protocol-Version: 2025-06-18` (optional, validated)

**Initial Request (Session Initialization)**:
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": {
        "listChanged": true
      },
      "sampling": {}
    },
    "clientInfo": {
      "name": "your-client",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

**Initialization Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "logging": {},
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "huly-mcp-server",
      "version": "1.0.0"
    },
    "instructions": "Huly MCP Server - AI integration for project management"
  },
  "id": 1
}
```

**Important**: The response will include an `MCP-Session-ID` header that must be included in all subsequent requests.

#### Subsequent MCP Requests

**Endpoint**: `POST /mcp`

**Headers**:
- `Content-Type: application/json`
- `MCP-Session-ID: {session_id}` (required after initialization)

**Tool Execution Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_list_projects",
    "arguments": {}
  },
  "id": 2
}
```

**Tool Execution Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 projects:\n\n📁 **Marketing Campaign** (MKT)..."
      }
    ]
  },
  "id": 2
}
```

#### List Tools (MCP)

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 3
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "huly_list_projects",
        "description": "List all projects in Huly workspace",
        "inputSchema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    ]
  },
  "id": 3
}
```

#### SSE Streaming (GET)

For real-time updates and server-sent events.

**Endpoint**: `GET /mcp`

**Headers**:
- `MCP-Session-ID: {session_id}` (required)
- `Accept: text/event-stream`

#### Session Termination

**Endpoint**: `DELETE /mcp`

**Headers**:
- `MCP-Session-ID: {session_id}` (required)

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "terminated": true
  }
}
```

## MCP Tools Reference

### Project Management Tools

#### huly_list_projects

List all projects in the Huly workspace with descriptions and issue counts.

**Parameters**: None

**HTTP Example**:
```bash
POST /tools/huly_list_projects
Content-Type: application/json

{}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_list_projects",
    "arguments": {}
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 projects:\n\n📁 **Marketing Campaign** (MKT)\n   Description: Q4 Marketing initiatives\n   Issues: 12\n   Created: 1/15/2024\n\n📁 **Product Development** (PROD)\n   Description: Core product features\n   Issues: 45\n   Created: 2/1/2024"
    }
  ]
}
```

#### huly_create_project

Create a new project in the Huly workspace.

**Parameters**:
- `name` (required): Project name
- `description` (optional): Project description  
- `identifier` (optional): Project identifier (max 5 chars, uppercase). If not provided, auto-generated from name.

**HTTP Example**:
```bash
POST /tools/huly_create_project
Content-Type: application/json

{
  "name": "New Project",
  "description": "A new project for testing",
  "identifier": "NEW"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_project",
    "arguments": {
      "name": "New Project",
      "description": "A new project for testing",
      "identifier": "NEW"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Created project New Project (NEW)\n\nDescription: A new project for testing"
    }
  ]
}
```

**Error Responses**:
- `Project with identifier 'NEW' already exists` - Identifier is not unique

### Issue Management Tools

#### huly_list_issues

List issues in a specific project with full metadata including components, milestones, assignees, and due dates.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "LMP")
- `limit` (optional): Maximum number of issues to return (default: 50)

**HTTP Example**:
```bash
POST /tools/huly_list_issues
Content-Type: application/json

{
  "project_identifier": "PROJ",
  "limit": 10
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_list_issues",
    "arguments": {
      "project_identifier": "PROJ",
      "limit": 10
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 5 issues in Project Name:\n\n📋 **PROJ-1**: Fix login bug\n   Status: In Progress\n   Priority: High\n   Component: Authentication\n   Milestone: Sprint 1\n   Assignee: user123\n   Due Date: 12/31/2024\n   Created: 12/1/2024\n\n📋 **PROJ-2**: Add search feature\n   Status: Backlog\n   Priority: Medium\n   Created: 12/2/2024"
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist

#### huly_create_issue

Create a new issue in a project with title, description, and priority.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "LMP")
- `title` (required): Issue title
- `description` (optional): Issue description
- `priority` (optional): Issue priority - one of: `low`, `medium`, `high`, `urgent` (default: `medium`)

**HTTP Example**:
```bash
POST /tools/huly_create_issue
Content-Type: application/json

{
  "project_identifier": "PROJ",
  "title": "New Feature Request",
  "description": "Add user dashboard functionality",
  "priority": "high"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_issue",
    "arguments": {
      "project_identifier": "PROJ",
      "title": "New Feature Request",
      "description": "Add user dashboard functionality",
      "priority": "high"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Created issue PROJ-123: New Feature Request\n\nStatus: tracker:status:Backlog\nPriority: high"
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist

#### huly_update_issue

Update an existing issue's fields including title, description, status, priority, component, and milestone.

**Parameters**:
- `issue_identifier` (required): Issue identifier (e.g., "LMP-1")
- `field` (required): Field to update - one of: `title`, `description`, `status`, `priority`, `component`, `milestone`
- `value` (required): New value for the field

**HTTP Example**:
```bash
POST /tools/huly_update_issue
Content-Type: application/json

{
  "issue_identifier": "PROJ-123",
  "field": "status",
  "value": "In Progress"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_update_issue",
    "arguments": {
      "issue_identifier": "PROJ-123",
      "field": "status",
      "value": "In Progress"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Updated issue PROJ-123\n\nstatus: In Progress"
    }
  ]
}
```

**Field-Specific Behavior**:
- `priority`: Maps string values to enum (`low`=4, `medium`=3, `high`=2, `urgent`=1)
- `component`: Looks up component by label in the same project
- `milestone`: Looks up milestone by label in the same project

**Error Responses**:
- `Issue {identifier} not found` - Issue doesn't exist
- `Component "{name}" not found in project` - Component doesn't exist
- `Milestone "{name}" not found in project` - Milestone doesn't exist

#### huly_create_subissue

Create a subissue under an existing parent issue with proper parent-child relationships.

**Parameters**:
- `parent_issue_identifier` (required): Parent issue identifier (e.g., "LMP-1")
- `title` (required): Subissue title
- `description` (optional): Subissue description
- `priority` (optional): Issue priority - one of: `low`, `medium`, `high`, `urgent` (default: `medium`)

**HTTP Example**:
```bash
POST /tools/huly_create_subissue
Content-Type: application/json

{
  "parent_issue_identifier": "PROJ-123",
  "title": "Implement user authentication",
  "description": "Add login and registration forms",
  "priority": "high"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_subissue",
    "arguments": {
      "parent_issue_identifier": "PROJ-123",
      "title": "Implement user authentication",
      "description": "Add login and registration forms",
      "priority": "high"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Created subissue PROJ-124: Implement user authentication\n\nParent: PROJ-123\nStatus: tracker:status:Backlog\nPriority: high"
    }
  ]
}
```

**Error Responses**:
- `Parent issue {identifier} not found` - Parent issue doesn't exist
- `Project for parent issue {identifier} not found` - Parent issue's project not found

### Component Management Tools

#### huly_create_component

Create a new component in a project for organizing issues.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "WEBHOOK")
- `label` (required): Component name
- `description` (optional): Component description

**HTTP Example**:
```bash
POST /tools/huly_create_component
Content-Type: application/json

{
  "project_identifier": "PROJ",
  "label": "Authentication",
  "description": "User authentication and authorization"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_component",
    "arguments": {
      "project_identifier": "PROJ",
      "label": "Authentication",
      "description": "User authentication and authorization"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Created component \"Authentication\" in project Project Name"
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist

#### huly_list_components

List all components in a project.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "WEBHOOK")

**HTTP Example**:
```bash
POST /tools/huly_list_components
Content-Type: application/json

{
  "project_identifier": "PROJ"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_list_components",
    "arguments": {
      "project_identifier": "PROJ"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 components in Project Name:\n\n🏷️  **Authentication**\n   Description: User authentication and authorization\n   Lead: Not assigned\n\n🏷️  **Frontend**\n   Description: User interface components\n   Lead: Not assigned"
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist

### Milestone Management Tools

#### huly_create_milestone

Create a new milestone in a project with target dates and status tracking.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "WEBHOOK")
- `label` (required): Milestone name
- `target_date` (required): Target date in ISO 8601 format (e.g., "2024-12-31")
- `description` (optional): Milestone description
- `status` (optional): Milestone status - one of: `planned`, `in_progress`, `completed`, `canceled` (default: `planned`)

**HTTP Example**:
```bash
POST /tools/huly_create_milestone
Content-Type: application/json

{
  "project_identifier": "PROJ",
  "label": "Sprint 1",
  "description": "First development sprint",
  "target_date": "2024-12-31",
  "status": "planned"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_milestone",
    "arguments": {
      "project_identifier": "PROJ",
      "label": "Sprint 1",
      "description": "First development sprint",
      "target_date": "2024-12-31",
      "status": "planned"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Created milestone \"Sprint 1\" in project Project Name\n\nTarget Date: 12/31/2024\nStatus: planned"
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist
- `Invalid target date format. Use ISO 8601 format (e.g., 2024-12-31)` - Invalid date format

#### huly_list_milestones

List all milestones in a project with their status and target dates.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "WEBHOOK")

**HTTP Example**:
```bash
POST /tools/huly_list_milestones
Content-Type: application/json

{
  "project_identifier": "PROJ"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_list_milestones",
    "arguments": {
      "project_identifier": "PROJ"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 2 milestones in Project Name:\n\n🎯 **Sprint 1**\n   Description: First development sprint\n   Status: Planned\n   Target Date: 12/31/2024\n\n🎯 **Release 1.0**\n   Status: In Progress\n   Target Date: 3/15/2025"
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist

### GitHub Integration Tools

#### huly_list_github_repositories

List all GitHub repositories available in the Huly integrations.

**Parameters**: None

**HTTP Example**:
```bash
POST /tools/huly_list_github_repositories
Content-Type: application/json

{}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_list_github_repositories",
    "arguments": {}
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 2 GitHub repositories available:\n\n📁 **my-org/frontend-app**\n   Description: Frontend application\n   Owner: my-org\n   Language: TypeScript\n   Stars: 45 | Forks: 12\n   Private: No\n   Has Issues: Yes\n   ✅ Available for assignment\n   URL: https://github.com/my-org/frontend-app\n\n📁 **my-org/backend-api**\n   Description: Backend API service\n   Owner: my-org\n   Language: Node.js\n   Stars: 23 | Forks: 8\n   Private: Yes\n   Has Issues: Yes\n   🔗 Already assigned to project\n   URL: https://github.com/my-org/backend-api"
    }
  ]
}
```

**Error Responses**:
- `Failed to list GitHub repositories: {error}` - GitHub integration error

#### huly_assign_repository_to_project

Assign a GitHub repository to a Huly project, enabling GitHub integration features.

**Parameters**:
- `project_identifier` (required): Project identifier (e.g., "WEBHOOK")
- `repository_name` (required): GitHub repository name in format "owner/repo" (e.g., "my-org/my-repo")

**HTTP Example**:
```bash
POST /tools/huly_assign_repository_to_project
Content-Type: application/json

{
  "project_identifier": "PROJ",
  "repository_name": "my-org/frontend-app"
}
```

**MCP Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_assign_repository_to_project",
    "arguments": {
      "project_identifier": "PROJ",
      "repository_name": "my-org/frontend-app"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Successfully assigned GitHub repository \"my-org/frontend-app\" to project Project Name (PROJ)\n\nThe project now has GitHub integration enabled and can sync issues, pull requests, and other GitHub data."
    }
  ]
}
```

**Error Responses**:
- `Project {identifier} not found` - Project doesn't exist
- `GitHub repository "{name}" not found. Use huly_list_github_repositories to see available repositories.` - Repository not found
- `Repository "{name}" is already assigned to another project` - Repository already assigned

## Error Handling

### REST API Error Handling

The REST API provides standardized error responses with detailed error information.

#### HTTP Status Codes

- **400 Bad Request**: Invalid request parameters or validation errors
- **404 Not Found**: Tool not found or resource not found
- **413 Request Too Large**: Request size exceeds limits
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error or tool execution failure
- **502 Bad Gateway**: Huly API error or upstream service failure

#### REST Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required field 'project_identifier' is missing",
    "details": {
      "field": "project_identifier",
      "required": ["project_identifier", "title"],
      "provided": ["title"]
    }
  },
  "metadata": {
    "timestamp": "2024-12-17T10:30:00.000Z",
    "requestId": "uuid-request-id"
  }
}
```

#### REST Error Codes

- **TOOL_NOT_FOUND**: Requested tool does not exist
- **VALIDATION_ERROR**: Invalid input parameters or missing required fields
- **HULY_API_ERROR**: Error from Huly backend service
- **INTERNAL_ERROR**: Generic server error
- **REQUEST_TOO_LARGE**: Request size exceeds configured limits
- **RATE_LIMIT_EXCEEDED**: Too many requests from client

### MCP Protocol Error Handling

#### JSON-RPC Error Codes

- **-32600**: Invalid Request
- **-32601**: Method not found
- **-32000**: Internal error (includes custom error messages)
- **-32001**: Server error (e.g., forbidden access, session not found)
- **-32603**: Internal server error

#### MCP Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Project INVALID not found"
  },
  "id": 1
}
```

### Common Error Scenarios

1. **Authentication Failures**:
   - Invalid credentials
   - Workspace not found
   - Network connectivity issues

2. **Resource Not Found**:
   - Project identifier doesn't exist
   - Issue identifier doesn't exist
   - Component/milestone not found

3. **Validation Errors**:
   - Missing required parameters
   - Invalid parameter values
   - Invalid date formats

4. **Permission Errors**:
   - Insufficient permissions for operation
   - Workspace access denied

## Common Usage Patterns

### Project Setup Workflow

1. **Create Project**: Use `huly_create_project` to establish a new project
2. **Add Components**: Use `huly_create_component` to organize work areas
3. **Set Milestones**: Use `huly_create_milestone` to define delivery targets
4. **GitHub Integration**: Use `huly_assign_repository_to_project` for code sync

### Issue Management Workflow

1. **List Issues**: Use `huly_list_issues` to review current work
2. **Create Issues**: Use `huly_create_issue` for new work items
3. **Create Subissues**: Use `huly_create_subissue` to break down complex work
4. **Update Progress**: Use `huly_update_issue` to track status changes

### Reporting and Monitoring

1. **Project Overview**: Use `huly_list_projects` for high-level status
2. **Issue Tracking**: Use `huly_list_issues` with different limits for focused views
3. **Component Analysis**: Use `huly_list_components` to understand project structure
4. **Milestone Progress**: Use `huly_list_milestones` to track delivery timelines

## Integration Examples

### Claude Code Integration

```bash
# Add to MCP configuration
claude mcp add --transport http huly-mcp "http://localhost:3457/mcp" -s user

# Use in Claude Code
Ask Claude to "List all projects in Huly" and it will call huly_list_projects
```

### REST API Integration

#### Simple GET Requests

```javascript
// List all tools
const toolsResponse = await fetch('http://localhost:3457/api/tools');
const tools = await toolsResponse.json();

// List projects (GET with no parameters)
const projectsResponse = await fetch('http://localhost:3457/api/tools/huly_list_projects');
const projects = await projectsResponse.json();

// List issues with parameters
const issuesResponse = await fetch('http://localhost:3457/api/tools/huly_list_issues?project_identifier=PROJ&limit=10');
const issues = await issuesResponse.json();
```

#### POST Requests with JSON Body

```javascript
// Create issue
const createIssueResponse = await fetch('http://localhost:3457/api/tools/huly_create_issue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      project_identifier: 'PROJ',
      title: 'New Issue',
      description: 'Issue description',
      priority: 'high'
    }
  })
});

// Update issue
const updateResponse = await fetch('http://localhost:3457/api/tools/huly_update_issue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      issue_identifier: 'PROJ-123',
      field: 'status',
      value: 'In Progress'
    }
  })
});
```

#### Error Handling

```javascript
async function callHulyTool(toolName, args = {}) {
  try {
    const response = await fetch(`http://localhost:3457/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: args })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(`${result.error.code}: ${result.error.message}`);
    }

    return result.data.result;
  } catch (error) {
    console.error('Huly API Error:', error.message);
    throw error;
  }
}

// Usage
try {
  const projects = await callHulyTool('huly_list_projects');
  console.log('Projects:', projects);
} catch (error) {
  console.error('Failed to fetch projects:', error.message);
}
```

### MCP Protocol Integration

#### Session Management

```javascript
class HulyMCPClient {
  constructor(baseUrl = 'http://localhost:3457') {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async initialize() {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: { roots: { listChanged: true }, sampling: {} },
          clientInfo: { name: 'my-client', version: '1.0.0' }
        },
        id: 1
      })
    });

    const result = await response.json();
    this.sessionId = response.headers.get('MCP-Session-ID');
    return result;
  }

  async callTool(toolName, arguments = {}) {
    if (!this.sessionId) {
      throw new Error('Session not initialized. Call initialize() first.');
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MCP-Session-ID': this.sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments },
        id: Date.now()
      })
    });

    return await response.json();
  }

  async terminate() {
    if (this.sessionId) {
      await fetch(`${this.baseUrl}/mcp`, {
        method: 'DELETE',
        headers: { 'MCP-Session-ID': this.sessionId }
      });
      this.sessionId = null;
    }
  }
}

// Usage
const client = new HulyMCPClient();
await client.initialize();

const projects = await client.callTool('huly_list_projects');
console.log(projects);

await client.terminate();
```

### Batch Operations

```javascript
// Create multiple issues in parallel using REST API
async function createMultipleIssues(projectId, issues) {
  const promises = issues.map(issue =>
    fetch(`http://localhost:3457/api/tools/huly_create_issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          project_identifier: projectId,
          ...issue
        }
      })
    }).then(r => r.json())
  );

  const results = await Promise.all(promises);
  return results.filter(r => r.success);
}

// Usage
const newIssues = [
  { title: 'Setup authentication', priority: 'high' },
  { title: 'Create user dashboard', priority: 'medium' },
  { title: 'Add search functionality', priority: 'low' }
];

const created = await createMultipleIssues('PROJ', newIssues);
console.log(`Created ${created.length} issues`);
```

## Choosing Between REST and MCP

### When to Use REST API

**Best for:**
- Simple HTTP integrations
- Web applications and dashboards
- Batch operations and automation scripts
- Direct tool execution without session management
- GET requests for quick data retrieval

**Advantages:**
- No session management required
- Standard HTTP status codes and error handling
- Easy to test with curl or browser
- Direct tool execution with query parameters
- Detailed error responses with request IDs

**Example Use Cases:**
- Building a web dashboard that lists projects and issues
- Creating automation scripts for bulk issue creation
- Integrating with existing HTTP-based systems
- Quick data queries without complex protocol handling

### When to Use MCP Protocol

**Best for:**
- AI assistant integrations (Claude Code, etc.)
- Long-running sessions with state management
- Real-time communication needs
- Full MCP feature compatibility
- Claude Code or other MCP clients

**Advantages:**
- Session persistence and state management
- Real-time updates via SSE streaming
- Full MCP protocol compliance
- Optimized for AI assistant workflows
- Standardized JSON-RPC 2.0 interface

**Example Use Cases:**
- Claude Code integration for AI-powered project management
- Building custom MCP clients
- Applications requiring session state
- Real-time collaboration tools

### Performance Comparison

| Feature | REST API | MCP Protocol |
|---------|----------|--------------|
| Session Overhead | None | Initial handshake required |
| Request Latency | Low (direct HTTP) | Low (after session setup) |
| Batch Operations | Excellent (parallel HTTP) | Good (sequential JSON-RPC) |
| Memory Usage | Minimal | Session state maintained |
| Scalability | High (stateless) | Moderate (session-based) |
| Error Handling | Rich HTTP codes | JSON-RPC error codes |

## Performance Considerations

### Connection Management

**REST API:**
- Stateless connections (no session overhead)
- HTTP connection pooling for performance
- Automatic connection cleanup

**MCP Protocol:**
- Session-based connections with automatic cleanup
- WebSocket connections for real-time updates
- Connection failures trigger automatic reconnection

### Rate Limiting

**REST API:**
- Built-in rate limiting middleware (configurable)
- Default: 100 requests per 15-minute window per client
- Request size limits (10MB default)
- Custom rate limiting headers in responses

**MCP Protocol:**
- No explicit rate limiting implemented
- Huly server may have its own rate limits
- Use reasonable delays between bulk operations

### Memory Usage

**REST API:**
- Minimal memory footprint (stateless)
- Request-scoped resource allocation
- Automatic garbage collection

**MCP Protocol:**
- Session state maintained in memory
- Client connections tracked and cleaned up automatically
- Large result sets are handled efficiently

### Optimization Tips

1. **Use GET endpoints for simple queries** (REST API)
2. **Batch operations using Promise.all()** for parallel execution
3. **Implement proper error handling** with retry logic
4. **Use appropriate request timeouts** for your use case
5. **Monitor memory usage** for long-running sessions (MCP)

## Security Considerations

### Authentication

- Credentials are handled securely through environment variables
- No credentials are logged or exposed in responses
- WebSocket connections use secure protocols when available

### Data Privacy

- All data access is subject to Huly's permission system
- Users can only access workspaces they have permission for
- No data is cached or stored locally

### Network Security

- HTTPS is used for external Huly instances
- Internal Docker networking is used for containerized deployments
- CORS is configured appropriately for HTTP transport

## Troubleshooting Guide

### Connection Issues

1. **Check Credentials**:
   ```bash
   # Verify environment variables
   echo $HULY_URL
   echo $HULY_EMAIL
   echo $HULY_WORKSPACE
   ```

2. **Test Network Connectivity**:
   ```bash
   # Test main health endpoint
   curl -I http://localhost:3457/health

   # Test REST API health
   curl http://localhost:3457/api/health

   # Test upstream Huly service
   curl -I $HULY_URL
   ```

3. **Check Server Logs**:
   ```bash
   docker-compose logs huly-mcp
   ```

### REST API Troubleshooting

1. **Tool Not Found (404)**:
   ```bash
   # List available tools first
   curl http://localhost:3457/api/tools

   # Check tool name spelling
   curl http://localhost:3457/api/tools/huly_list_projects  # ✓ Correct
   curl http://localhost:3457/api/tools/list_projects       # ✗ Wrong
   ```

2. **Validation Errors (400)**:
   ```bash
   # Missing required fields
   curl -X POST http://localhost:3457/api/tools/huly_create_issue \
     -H "Content-Type: application/json" \
     -d '{"arguments": {"title": "Test"}}'  # Missing project_identifier

   # Check error response for required fields
   ```

3. **Rate Limiting (429)**:
   ```bash
   # Check rate limit headers in response
   curl -I http://localhost:3457/api/tools/huly_list_projects

   # X-RateLimit-Remaining: 99
   # X-RateLimit-Reset: 1703680800
   ```

4. **Service Errors (500/502)**:
   ```bash
   # Check if Huly credentials work
   curl -X POST http://localhost:3457/api/tools/huly_list_projects \
     -H "Content-Type: application/json" \
     -d '{"arguments": {}}'

   # Look for "services" undefined errors - indicates missing Huly auth
   ```

### MCP Protocol Troubleshooting

1. **Session Issues**:
   ```bash
   # Test session initialization
   curl -X POST http://localhost:3457/mcp \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "method": "initialize",
       "params": {
         "protocolVersion": "2025-06-18",
         "capabilities": {},
         "clientInfo": {"name": "test", "version": "1.0"}
       },
       "id": 1
     }'

   # Check for MCP-Session-ID header in response
   ```

2. **Protocol Version Errors**:
   ```bash
   # Use correct protocol version
   curl -X POST http://localhost:3457/mcp \
     -H "MCP-Protocol-Version: 2025-06-18" \
     -H "Content-Type: application/json"
   ```

### Tool Execution Errors

1. **Verify Project Identifiers**:
   - Use `huly_list_projects` to get valid identifiers
   - Ensure identifiers are exact matches (case-sensitive)

2. **Check Parameter Formats**:
   - Dates must be ISO 8601 format
   - Priority values must be exact enum matches
   - Required parameters must be provided

3. **Validate Permissions**:
   - Ensure user has appropriate workspace permissions
   - Check project-specific access rights

### Performance Issues

1. **Reduce Result Set Size**:
   - Use `limit` parameter in `huly_list_issues`
   - Filter by specific projects or criteria

2. **Monitor Connection Health**:
   - Check `/health` endpoint regularly
   - Monitor WebSocket connection status

3. **Optimize Batch Operations**:
   - Group related operations together
   - Use appropriate delays between bulk operations

## Version Compatibility

- **MCP Protocol**: 2025-06-18
- **Huly SDK**: 0.6.500
- **Huly Server**: 0.6.501
- **Node.js**: 18+

Version alignment between SDK and server is critical for proper operation.