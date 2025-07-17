# Huly MCP Server

A Model Context Protocol (MCP) server for interacting with Huly project management platform. This server provides tools for managing projects, issues, and other Huly resources through Claude Code and other MCP clients.

## Features

- **Project Management**: List, create, and manage Huly projects
- **Issue Tracking**: Create, list, and update issues across projects
- **Dual Transport Support**: Both HTTP and stdio transports
- **Docker Integration**: Fully containerized with Docker Compose
- **Authentication**: Secure connection to Huly instances

## Available Tools

| Tool | Description |
|------|-------------|
| `huly_list_projects` | List all projects with descriptions and issue counts |
| `huly_list_issues` | List issues in a specific project with filtering |
| `huly_create_issue` | Create new issues with title, description, and priority |
| `huly_update_issue` | Update existing issue fields (title, description, status, priority) |
| `huly_create_project` | Create new projects with custom identifiers |

## Quick Start

### Prerequisites

- Node.js 18+
- Access to a Huly instance
- Huly account credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd huly-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
export HULY_URL=https://your-huly-instance.com
export HULY_EMAIL=your-email@example.com
export HULY_PASSWORD=your-password
export HULY_WORKSPACE=your-workspace-name
```

### Usage

#### Stdio Transport (Claude Code)
```bash
npm run start:stdio
```

#### HTTP Transport (Web/API)
```bash
npm run start:http
```

Server will be available at `http://localhost:3000`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HULY_URL` | Huly instance URL | `https://pm.oculair.ca` |
| `HULY_EMAIL` | User email for authentication | Required |
| `HULY_PASSWORD` | User password for authentication | Required |
| `HULY_WORKSPACE` | Workspace name | `agentspace` |
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### Claude Code Integration

Add to your Claude Code MCP configuration:

```bash
claude mcp add --transport stdio huly-mcp "/path/to/huly-mcp-server/start-mcp.sh" -s user
```

## Docker Deployment

### Standalone Container

```bash
# Build the image
docker build -t huly-mcp-server .

# Run with environment variables
docker run -d \
  -e HULY_URL=https://your-huly-instance.com \
  -e HULY_EMAIL=your-email@example.com \
  -e HULY_PASSWORD=your-password \
  -e HULY_WORKSPACE=your-workspace \
  -p 3000:3000 \
  huly-mcp-server
```

### Docker Compose Integration

Add to your existing Huly docker-compose.yml:

```yaml
services:
  huly-mcp:
    build: ./huly-mcp-server
    environment:
      - HULY_URL=http://nginx:80
      - HULY_EMAIL=${HULY_MCP_EMAIL}
      - HULY_PASSWORD=${HULY_MCP_PASSWORD}
      - HULY_WORKSPACE=${HULY_MCP_WORKSPACE}
    ports:
      - "3457:3000"
    depends_on:
      - nginx
      - account
      - transactor
    restart: unless-stopped
```

## API Reference

### HTTP Endpoints

#### Health Check
```bash
GET /health
```

#### List Tools
```bash
GET /tools
```

#### MCP Protocol
```bash
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 1
}
```

#### Direct Tool Calls
```bash
POST /tools/huly_list_projects
Content-Type: application/json

{}
```

### Tool Examples

#### List Projects
```javascript
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

#### Create Issue
```javascript
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_issue",
    "arguments": {
      "project_identifier": "PROJ",
      "title": "New Issue",
      "description": "Issue description",
      "priority": "high"
    }
  },
  "id": 2
}
```

#### Update Issue
```javascript
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
  "id": 3
}
```

## Development

### Project Structure
```
huly-mcp-server/
├── index.js           # Main server implementation
├── package.json       # Dependencies and scripts
├── Dockerfile         # Container configuration
├── start-mcp.sh      # Startup script for stdio transport
├── README.md         # This file
└── WISHLIST.md       # Feature wishlist and roadmap
```

### Running Tests
```bash
# Test stdio transport
timeout 5 npm run start:stdio

# Test HTTP transport
npm run start:http &
curl http://localhost:3000/health
```

### SDK Compatibility

This server uses Huly SDK version 0.6.500 for compatibility with Huly server v0.6.501. Version alignment is critical for proper operation.

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify HULY_URL is correct
   - Check credentials are valid
   - Ensure network connectivity to Huly instance

2. **Module Import Errors**
   - Verify Node.js version (18+)
   - Check package.json type is set to "module"
   - Ensure all dependencies are installed

3. **Docker Issues**
   - Use internal Docker network URLs (e.g., `http://nginx:80`)
   - Check container logs: `docker-compose logs huly-mcp`
   - Verify environment variables are set

### Debug Mode

Enable debug logging:
```bash
DEBUG=huly-mcp* npm run start:stdio
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-org/huly-mcp-server/issues)
- Documentation: See WISHLIST.md for planned features
- Discord: [Join our community](https://discord.gg/your-server)

## Roadmap

See [WISHLIST.md](WISHLIST.md) for detailed feature roadmap and enhancement ideas.

### Immediate Priorities
- [ ] Issue search and filtering
- [ ] Bulk operations
- [ ] User assignments
- [ ] Comments and attachments

### Future Enhancements
- [ ] Analytics and reporting
- [ ] Mobile support
- [ ] Plugin system
- [ ] Advanced workflows