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

The server runs on port 3000 by default and provides standard HTTP endpoints:

- **Base URL**: `http://localhost:3000`
- **Health Check**: `GET /health`
- **List Tools**: `GET /tools`
- **MCP Protocol**: `POST /mcp`
- **Direct Tool Calls**: `POST /tools/{tool_name}`

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
  "server": "huly-mcp-server"
}
```

### List Available Tools

Get a list of all available MCP tools.

**Endpoint**: `GET /tools`

**Response**:
```json
{
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
    // ... other tools
  ]
}
```

### MCP Protocol Endpoint

Standard JSON-RPC 2.0 endpoint for MCP communication.

**Endpoint**: `POST /mcp`

**Request Format**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {}
  },
  "id": 1
}
```

**Response Format**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Response content"
      }
    ]
  },
  "id": 1
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

### HTTP Error Codes

- **400 Bad Request**: Invalid JSON-RPC request format
- **404 Not Found**: Tool not found
- **500 Internal Server Error**: Server error or tool execution failure

### JSON-RPC Error Codes

- **-32600**: Invalid Request
- **-32601**: Method not found
- **-32000**: Internal error (includes custom error messages)

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Error message describing the issue"
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
claude mcp add --transport stdio huly-mcp "/path/to/start-mcp.sh" -s user

# Use in Claude Code
Ask Claude to "List all projects in Huly" and it will call huly_list_projects
```

### HTTP API Integration

```javascript
// List projects
const response = await fetch('http://localhost:3000/tools/huly_list_projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});

// Create issue
const createResponse = await fetch('http://localhost:3000/tools/huly_create_issue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_identifier: 'PROJ',
    title: 'New Issue',
    description: 'Issue description',
    priority: 'high'
  })
});
```

### JSON-RPC 2.0 Integration

```javascript
// Standard MCP protocol call
const mcpResponse = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'huly_list_projects',
      arguments: {}
    },
    id: 1
  })
});
```

## Performance Considerations

### Connection Management

- Connections to Huly are cached and reused
- WebSocket connections are maintained for real-time updates
- Connection failures trigger automatic reconnection

### Rate Limiting

- No explicit rate limiting implemented
- Huly server may have its own rate limits
- Use reasonable delays between bulk operations

### Memory Usage

- Server maintains minimal state
- Client connections are cleaned up automatically
- Large result sets are handled efficiently

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
   curl -I $HULY_URL
   ```

3. **Check Server Logs**:
   ```bash
   docker-compose logs huly-mcp
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

- **MCP Protocol**: 2024-11-05
- **Huly SDK**: 0.6.500
- **Huly Server**: 0.6.501
- **Node.js**: 18+

Version alignment between SDK and server is critical for proper operation.