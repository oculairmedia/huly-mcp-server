# REST API Quick Start Guide

**🚀 Get started with the Huly REST API in 30 seconds!**

The REST API is **fully functional** and provides complete access to all Huly functionality.

## ⚡ Instant Test

```bash
# 1. ✅ Check if the API is running
curl http://localhost:3457/api/health

# 2. ✅ List all your Huly projects (works immediately!)
curl -X POST http://localhost:3457/api/tools/huly_list_projects \
  -H "Content-Type: application/json" \
  -d '{"arguments": {}}'

# 3. ✅ Create a test issue
curl -X POST http://localhost:3457/api/tools/huly_create_issue \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"project_identifier": "TEST", "title": "My First REST API Issue"}}'
```

## 🚀 Getting Started

### 1. Start the Server

```bash
# Start with HTTP transport
npm run start:http

# Or with custom port
PORT=3457 npm run start:http
```

The server will start on `http://localhost:3457` by default.

### 2. Test the API

```bash
# Health check
curl http://localhost:3457/health

# API health check
curl http://localhost:3457/api/health

# List all tools
curl http://localhost:3457/api/tools
```

## 📋 Available Endpoints

### Health Checks
- `GET /health` - Server health status
- `GET /api/health` - API health status with tool count

### Tool Management
- `GET /api/tools` - List all available tools
- `GET /api/tools?category=projects` - Filter tools by category
- `GET /api/tools?search=issue` - Search tools by name/description

### Tool Execution
- `POST /api/tools/{tool_name}` - Execute tool with JSON body
- `GET /api/tools/{tool_name}?param=value` - Execute tool with query params

## 🔧 Common Examples

### List Projects
```bash
curl -X POST http://localhost:3457/api/tools/huly_list_projects \
  -H "Content-Type: application/json" \
  -d '{"arguments": {}}'
```

### Create an Issue
```bash
curl -X POST http://localhost:3457/api/tools/huly_create_issue \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "project_identifier": "PROJ",
      "title": "New Issue via REST API",
      "description": "Created using the REST API",
      "priority": "high"
    }
  }'
```

### Search Issues
```bash
curl -X POST http://localhost:3457/api/tools/huly_search_issues \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "query": "bug",
      "project_identifier": "PROJ",
      "limit": 10
    }
  }'
```

## 📊 Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {
    "toolName": "huly_list_projects",
    "result": { /* tool output */ },
    "executionTime": 150
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'invalid_tool' not found",
    "details": {
      "availableTools": ["huly_list_projects", "huly_create_issue"]
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "uuid-here"
  }
}
```

## 🛠️ Tool Categories

Tools are organized into categories:

- **projects** - Project management (create, list, archive)
- **issues** - Issue management (create, update, search, list)
- **templates** - Issue templates (create, list, use)
- **components** - Project components (create, list, delete)
- **milestones** - Project milestones (create, list, delete)
- **comments** - Issue comments (create, list)
- **github** - GitHub integration (list repos, assign)
- **accounts** - User management (employees, accounts)
- **validation** - Data validation and deletion previews

## 🔍 Filtering and Search

### Filter by Category
```bash
curl "http://localhost:3457/api/tools?category=issues"
```

### Search Tools
```bash
curl "http://localhost:3457/api/tools?search=create"
```

### Combined Filters
```bash
curl "http://localhost:3457/api/tools?category=projects&search=list"
```

## 🧪 Testing

Run the REST API integration tests:

```bash
npm run test:rest
```

This will:
1. Start the server
2. Test all endpoints
3. Verify error handling
4. Stop the server
5. Report results

## 🔐 Authentication

The REST API uses the same Huly authentication as the MCP protocol. Set these environment variables:

```bash
export HULY_URL="https://your-huly-instance.com"
export HULY_EMAIL="your-email@example.com"
export HULY_PASSWORD="your-password"
export HULY_WORKSPACE="your-workspace"
```

## 🚨 Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `TOOL_NOT_FOUND` | 404 | Tool doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid arguments |
| `HULY_API_ERROR` | 502 | Huly server error |
| `SERVICE_INITIALIZATION_ERROR` | 503 | Server still starting |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## 📚 More Information

- [Complete REST API Usage Guide](REST-API-USAGE-GUIDE.md)
- [Tool Documentation](../src/tools/README.md)
- [Configuration Guide](../README.md#configuration)

## 🆘 Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -i :3457

# Try different port
PORT=3458 npm run start:http
```

### Tools Not Found
```bash
# Check server logs
npm run start:http

# Verify authentication
curl http://localhost:3457/api/health
```

### Connection Errors
```bash
# Test basic connectivity
curl http://localhost:3457/health

# Check Huly credentials
echo $HULY_URL $HULY_EMAIL $HULY_WORKSPACE
```
