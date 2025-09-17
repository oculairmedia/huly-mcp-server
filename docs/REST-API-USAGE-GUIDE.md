# REST API Usage Guide

This guide provides comprehensive examples and best practices for using the Huly MCP Server REST API. The REST API provides stateless HTTP access to all Huly tools without requiring MCP protocol knowledge or session management.

## Quick Start

### Base URL

```
http://localhost:3457/api
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | API health check |
| `/tools` | GET | List all available tools |
| `/tools/{tool_name}` | POST | Execute tool with JSON body |
| `/tools/{tool_name}` | GET | Execute tool with query parameters |

## Authentication

The REST API uses the same Huly authentication as the MCP protocol. Configure these environment variables:

```bash
export HULY_URL=https://your-huly-instance.com
export HULY_EMAIL=your-email@example.com
export HULY_PASSWORD=your-password
export HULY_WORKSPACE=your-workspace-name
```

## Basic Usage Examples

### 1. Health Check

```bash
# Check API health
curl http://localhost:3457/api/health
```

**Response:**
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

### 2. List Available Tools

```bash
# List all tools
curl http://localhost:3457/api/tools

# Filter by category
curl "http://localhost:3457/api/tools?category=projects"

# Search tools
curl "http://localhost:3457/api/tools?search=issue"
```

**Response:**
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
    "categories": ["projects", "issues", "components", "milestones"],
    "filters": {
      "category": null,
      "search": null
    }
  }
}
```

### 3. Execute Tools with GET Requests

GET requests are perfect for simple tools with no parameters or basic filtering:

```bash
# List all projects
curl http://localhost:3457/api/tools/huly_list_projects

# List issues with filters
curl "http://localhost:3457/api/tools/huly_list_issues?project_identifier=PROJ&limit=10"

# Search issues
curl "http://localhost:3457/api/tools/huly_search_issues?query=bug&status=Backlog&limit=5"
```

### 4. Execute Tools with POST Requests

POST requests are ideal for complex operations and tools that modify data:

```bash
# Create a new project
curl -X POST http://localhost:3457/api/tools/huly_create_project \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "name": "New Project",
      "description": "A project created via REST API",
      "identifier": "NEW"
    }
  }'

# Create an issue
curl -X POST http://localhost:3457/api/tools/huly_create_issue \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "project_identifier": "PROJ",
      "title": "REST API Integration",
      "description": "Implement REST API endpoints",
      "priority": "high",
      "component": "Backend",
      "milestone": "v2.0"
    }
  }'

# Update issue status
curl -X POST http://localhost:3457/api/tools/huly_update_issue \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "issue_identifier": "PROJ-123",
      "field": "status",
      "value": "In Progress"
    }
  }'
```

## Project Management Workflows

### Creating a Complete Project Setup

```bash
#!/bin/bash
# Complete project setup script

API_BASE="http://localhost:3457/api/tools"

# 1. Create the project
echo "Creating project..."
curl -X POST "$API_BASE/huly_create_project" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "name": "E-commerce Platform",
      "description": "Online shopping platform with payment integration",
      "identifier": "ECOM"
    }
  }'

# 2. Create components
echo "Creating components..."
for component in "Frontend" "Backend" "Database" "Payment" "Authentication"; do
  curl -X POST "$API_BASE/huly_create_component" \
    -H "Content-Type: application/json" \
    -d "{
      \"arguments\": {
        \"project_identifier\": \"ECOM\",
        \"label\": \"$component\",
        \"description\": \"$component component for the e-commerce platform\"
      }
    }"
done

# 3. Create milestones
echo "Creating milestones..."
curl -X POST "$API_BASE/huly_create_milestone" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "project_identifier": "ECOM",
      "label": "MVP Release",
      "description": "Minimum viable product release",
      "target_date": "2024-03-31",
      "status": "planned"
    }
  }'

curl -X POST "$API_BASE/huly_create_milestone" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "project_identifier": "ECOM",
      "label": "Beta Release",
      "description": "Beta version with core features",
      "target_date": "2024-06-30",
      "status": "planned"
    }
  }'

echo "Project setup complete!"
```

### Bulk Issue Creation

```bash
#!/bin/bash
# Bulk issue creation using the dedicated bulk endpoint

API_BASE="http://localhost:3457/api/tools"

curl -X POST "$API_BASE/huly_bulk_create_issues" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "project_identifier": "ECOM",
      "defaults": {
        "priority": "medium",
        "milestone": "MVP Release"
      },
      "issues": [
        {
          "title": "User Authentication System",
          "description": "Implement login, registration, and password reset",
          "priority": "high",
          "component": "Authentication"
        },
        {
          "title": "Product Catalog",
          "description": "Display products with search and filtering",
          "component": "Frontend"
        },
        {
          "title": "Shopping Cart",
          "description": "Add/remove items, quantity updates",
          "component": "Frontend"
        },
        {
          "title": "Payment Integration",
          "description": "Stripe/PayPal payment processing",
          "priority": "high",
          "component": "Payment"
        },
        {
          "title": "Order Management",
          "description": "Order tracking and fulfillment",
          "component": "Backend"
        }
      ],
      "options": {
        "batch_size": 3,
        "continue_on_error": true,
        "dry_run": false
      }
    }
  }'
```

## Advanced Usage Patterns

### Error Handling

```javascript
async function callHulyTool(toolName, args = {}) {
  try {
    const response = await fetch(`http://localhost:3457/api/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ arguments: args })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(`${result.error.code}: ${result.error.message}`);
    }

    return result.data.result;
  } catch (error) {
    console.error(`Error calling ${toolName}:`, error.message);
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

### Batch Operations with Promise.all

```javascript
// Create multiple issues in parallel
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
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Created ${successful.length} issues successfully`);
  if (failed.length > 0) {
    console.log(`Failed to create ${failed.length} issues:`, failed);
  }

  return { successful, failed };
}

// Usage
const issues = [
  { title: 'Setup CI/CD pipeline', priority: 'high' },
  { title: 'Add unit tests', priority: 'medium' },
  { title: 'Documentation updates', priority: 'low' }
];

createMultipleIssues('PROJ', issues);
```

### Polling for Issue Updates

```javascript
// Poll for issue status changes
async function waitForIssueStatus(issueId, targetStatus, maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `http://localhost:3457/api/tools/huly_get_issue_details?issue_identifier=${issueId}`
      );
      const result = await response.json();

      if (result.success) {
        const content = result.data.result.content[0].text;
        if (content.includes(`Status: ${targetStatus}`)) {
          console.log(`Issue ${issueId} reached status ${targetStatus}`);
          return true;
        }
      }

      console.log(`Attempt ${attempt}: Issue status not yet ${targetStatus}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    } catch (error) {
      console.error(`Error checking issue status:`, error.message);
    }
  }

  console.log(`Timeout: Issue ${issueId} did not reach ${targetStatus}`);
  return false;
}

// Usage
waitForIssueStatus('PROJ-123', 'Done');
```

## Integration Examples

### Node.js Express Middleware

```javascript
const express = require('express');
const app = express();

// Middleware to proxy Huly operations
const hulyProxy = (toolName) => async (req, res, next) => {
  try {
    const response = await fetch(`http://localhost:3457/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: req.body })
    });

    const result = await response.json();

    if (result.success) {
      req.hulyResult = result.data.result;
      next();
    } else {
      res.status(400).json({ error: result.error.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Huly API error' });
  }
};

// Routes using the middleware
app.post('/projects', hulyProxy('huly_create_project'), (req, res) => {
  res.json({ message: 'Project created', result: req.hulyResult });
});

app.get('/projects', hulyProxy('huly_list_projects'), (req, res) => {
  res.json(req.hulyResult);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Python Integration

```python
import requests
import json

class HulyRestClient:
    def __init__(self, base_url="http://localhost:3457/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def call_tool(self, tool_name, **kwargs):
        url = f"{self.base_url}/tools/{tool_name}"
        data = {"arguments": kwargs}

        response = self.session.post(url, json=data)
        result = response.json()

        if not result.get('success', False):
            raise Exception(f"Tool call failed: {result.get('error', {}).get('message')}")

        return result['data']['result']

    def list_projects(self):
        return self.call_tool('huly_list_projects')

    def create_issue(self, project_identifier, title, **kwargs):
        return self.call_tool('huly_create_issue',
                            project_identifier=project_identifier,
                            title=title,
                            **kwargs)

    def list_issues(self, project_identifier, limit=50):
        return self.call_tool('huly_list_issues',
                            project_identifier=project_identifier,
                            limit=limit)

# Usage
client = HulyRestClient()

try:
    # List projects
    projects = client.list_projects()
    print("Projects:", projects)

    # Create an issue
    issue = client.create_issue(
        project_identifier="PROJ",
        title="Python integration test",
        description="Testing the Python client",
        priority="medium"
    )
    print("Created issue:", issue)

except Exception as e:
    print(f"Error: {e}")
```

### React/JavaScript Frontend

```javascript
// Huly API client for React applications
class HulyApiClient {
  constructor(baseUrl = 'http://localhost:3457/api') {
    this.baseUrl = baseUrl;
  }

  async callTool(toolName, args = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arguments: args })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data.result;
    } catch (error) {
      console.error(`API Error (${toolName}):`, error.message);
      throw error;
    }
  }

  async listProjects() {
    return this.callTool('huly_list_projects');
  }

  async listIssues(projectId, limit = 50) {
    return this.callTool('huly_list_issues', {
      project_identifier: projectId,
      limit
    });
  }

  async createIssue(projectId, title, options = {}) {
    return this.callTool('huly_create_issue', {
      project_identifier: projectId,
      title,
      ...options
    });
  }

  async searchIssues(query, filters = {}) {
    return this.callTool('huly_search_issues', {
      query,
      ...filters
    });
  }
}

// React component using the API client
import React, { useState, useEffect } from 'react';

const ProjectDashboard = () => {
  const [client] = useState(() => new HulyApiClient());
  const [projects, setProjects] = useState([]);
  const [issues, setIssues] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const result = await client.listProjects();
      // Parse the text response to extract project data
      setProjects(parseProjectsFromText(result.content[0].text));
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIssues = async (projectId) => {
    try {
      setLoading(true);
      const result = await client.listIssues(projectId);
      setIssues(parseIssuesFromText(result.content[0].text));
      setSelectedProject(projectId);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewIssue = async (title, description) => {
    if (!selectedProject) return;

    try {
      await client.createIssue(selectedProject, title, { description });
      // Reload issues
      loadIssues(selectedProject);
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  return (
    <div>
      <h1>Project Dashboard</h1>
      {loading && <p>Loading...</p>}

      <div>
        <h2>Projects</h2>
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => loadIssues(project.id)}
          >
            {project.name}
          </button>
        ))}
      </div>

      {selectedProject && (
        <div>
          <h2>Issues in {selectedProject}</h2>
          {issues.map(issue => (
            <div key={issue.id}>
              <h3>{issue.title}</h3>
              <p>Status: {issue.status}, Priority: {issue.priority}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
```

## Performance Best Practices

### 1. Use GET Endpoints for Read Operations

```bash
# Efficient for simple queries
curl "http://localhost:3457/api/tools/huly_list_projects"
curl "http://localhost:3457/api/tools/huly_list_issues?project_identifier=PROJ&limit=10"
```

### 2. Batch Operations for Multiple Items

```bash
# Instead of multiple single creates, use bulk create
curl -X POST http://localhost:3457/api/tools/huly_bulk_create_issues \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "project_identifier": "PROJ",
      "issues": [
        {"title": "Issue 1"},
        {"title": "Issue 2"},
        {"title": "Issue 3"}
      ]
    }
  }'
```

### 3. Implement Proper Error Handling

```javascript
// Retry logic for transient errors
async function callWithRetry(toolName, args, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`http://localhost:3457/api/tools/${toolName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arguments: args })
      });

      const result = await response.json();

      if (result.success) {
        return result.data.result;
      }

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(result.error.message);
      }

      // Retry server errors (5xx)
      if (attempt === maxRetries) {
        throw new Error(result.error.message);
      }

      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Attempt ${attempt} failed with error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### 4. Connection Pooling and Keep-Alive

```javascript
// Use HTTP agent for connection pooling
const http = require('http');
const https = require('https');

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 30000
});

const client = {
  async callTool(toolName, args) {
    const response = await fetch(`http://localhost:3457/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: args }),
      agent: agent  // Reuse connections
    });

    return response.json();
  }
};
```

## Security Considerations

### 1. Environment Variables

Never hardcode credentials in your application:

```javascript
// ❌ Bad
const HULY_PASSWORD = 'hardcoded-password';

// ✅ Good
const HULY_PASSWORD = process.env.HULY_PASSWORD;
```

### 2. Rate Limiting

Respect the API rate limits (100 requests per 15 minutes by default):

```javascript
class RateLimitedClient {
  constructor() {
    this.requests = [];
    this.maxRequests = 100;
    this.windowMs = 15 * 60 * 1000; // 15 minutes
  }

  async callTool(toolName, args) {
    // Check rate limit
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }

    this.requests.push(now);

    // Make the actual request
    const response = await fetch(`http://localhost:3457/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: args })
    });

    return response.json();
  }
}
```

### 3. Input Validation

Always validate inputs before sending to the API:

```javascript
function validateIssueData(data) {
  const errors = [];

  if (!data.project_identifier || typeof data.project_identifier !== 'string') {
    errors.push('project_identifier is required and must be a string');
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  if (data.priority && !['low', 'medium', 'high', 'urgent'].includes(data.priority)) {
    errors.push('priority must be one of: low, medium, high, urgent');
  }

  if (errors.length > 0) {
    throw new Error('Validation errors: ' + errors.join(', '));
  }

  return true;
}

// Usage
try {
  validateIssueData({
    project_identifier: 'PROJ',
    title: 'New Issue',
    priority: 'high'
  });

  // Proceed with API call
} catch (error) {
  console.error('Invalid data:', error.message);
}
```

## Common Error Codes and Solutions

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `TOOL_NOT_FOUND` | 404 | Tool name doesn't exist | Check tool name spelling, use `/api/tools` to list available tools |
| `VALIDATION_ERROR` | 400 | Missing or invalid parameters | Check required parameters in tool schema |
| `HULY_API_ERROR` | 502 | Huly backend error | Check Huly credentials and connectivity |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait before making more requests |
| `REQUEST_TOO_LARGE` | 413 | Request body too large | Reduce request size or use batch operations |
| `INTERNAL_ERROR` | 500 | Server error | Check server logs, retry if transient |

## Monitoring and Logging

### Health Check Monitoring

```bash
#!/bin/bash
# Health check script for monitoring

API_URL="http://localhost:3457/api/health"
LOG_FILE="/var/log/huly-api-health.log"

check_health() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local response=$(curl -s -w "%{http_code}" "$API_URL")
  local http_code="${response: -3}"
  local body="${response%???}"

  if [ "$http_code" = "200" ]; then
    echo "$timestamp [OK] API is healthy: $body" >> "$LOG_FILE"
    return 0
  else
    echo "$timestamp [ERROR] API health check failed (HTTP $http_code): $body" >> "$LOG_FILE"
    return 1
  fi
}

# Run health check
if check_health; then
  exit 0
else
  # Send alert (email, Slack, etc.)
  echo "Huly REST API health check failed" | mail -s "API Alert" admin@example.com
  exit 1
fi
```

### Request Logging

The API automatically logs all requests with unique request IDs. Monitor the logs:

```bash
# Follow API logs
docker-compose logs -f huly-mcp

# Search for specific errors
docker-compose logs huly-mcp | grep "ERROR"

# Filter by request ID
docker-compose logs huly-mcp | grep "request-id-12345"
```

## Conclusion

The Huly MCP Server REST API provides a powerful, stateless interface for integrating Huly project management into any application. Key advantages:

- **Simple HTTP interface** - no MCP protocol knowledge required
- **Flexible execution** - both GET and POST methods supported
- **Comprehensive error handling** - detailed error codes and messages
- **High performance** - stateless design with connection pooling
- **Easy integration** - standard HTTP/JSON works with any programming language

For more detailed information, see the [complete API documentation](../API.md).