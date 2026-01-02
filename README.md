# Huly MCP Server

A comprehensive Model Context Protocol (MCP) server and REST API for interacting with Huly project management platform. This server provides both MCP protocol support for AI assistants like Claude Code and a full REST API for web applications and automation scripts.

## 🚀 Recent Updates

### New: Complete REST API Implementation
- **Full REST API**: Access all Huly tools via HTTP endpoints (`/api/tools`)
- **Dual Protocol Support**: Both MCP protocol and REST API on same port
- **GET & POST Support**: Direct tool execution with query parameters or JSON body
- **Comprehensive Error Handling**: Standardized error responses with detailed codes
- **Performance Optimized**: Stateless REST vs session-based MCP

### Enhanced Features
- Component and milestone support in all issue operations
- Improved bulk operations with progress tracking
- Atomic operations for reliable concurrent usage
- Standardized response format across both protocols
- Advanced filtering and search capabilities

### New: v0.7 Consolidated Entity Architecture
- **8 Consolidated Tools**: Reduced from 40+ individual tools to 8 entity-based operations
- **Unified Entity Handler**: Single `huly_entity` tool handles project, component, milestone, and comment operations
- **Discriminated Union Pattern**: Uses `entity_type` + `operation` for clean API design
- **Component Updates**: Full support for updating component labels and descriptions
- **Backward Compatible**: v0.6 tools still available but deprecated

[Complete API Documentation](API.md)

## Features

### Protocol Support
- **REST API**: Full HTTP REST API for web applications and automation
- **MCP Protocol**: JSON-RPC 2.0 support for AI assistants (Claude Code, etc.)
- **Dual Endpoints**: Both protocols available on same port (3457)
- **Session Management**: Stateless REST vs session-based MCP

### Core Functionality
- **Project Management**: List, create, and manage Huly projects
- **Issue Tracking**: Create, list, and update issues across projects with full metadata
- **Atomic Operations**: Guaranteed unique issue numbers even under high concurrency
- **Bulk Operations**: Efficiently handle multiple issues at once with atomic guarantees
- **Advanced Search**: Filter issues by status, priority, component, assignee, and dates

### Integration & Workflow
- **Git Worktree Integration**: Parallel development workflow with automatic issue tracking
- **Docker Integration**: Fully containerized with Docker Compose
- **Authentication**: Secure connection to Huly instances
- **Git Hooks**: Automatic Huly issue status updates
- **Modular Tool Architecture**: Each tool in its own file for better maintainability

## Available Tools

| Tool | Description |
|------|-------------|
| `huly_list_projects` | List all projects with descriptions and issue counts |
| `huly_list_issues` | List issues with full metadata (component, milestone, assignee, due date) |
| `huly_create_issue` | Create new issues with title, description, priority, component, and milestone |
| `huly_update_issue` | Update existing issue fields (title, description, status, priority, component, milestone) |
| `huly_create_project` | Create new projects with custom identifiers |
| `huly_create_subissue` | Create subissues under existing parent issues with component/milestone support |
| `huly_create_component` | Create new components in projects |
| `huly_list_components` | List all components in a project |
| `huly_update_component` | Update component label and description |
| `huly_create_milestone` | Create new milestones with target dates |
| `huly_list_milestones` | List all milestones in a project |
| `huly_list_github_repositories` | List available GitHub repositories |
| `huly_assign_repository_to_project` | Assign GitHub repositories to projects |
| `huly_search_issues` | Search and filter issues with advanced capabilities (includes `modified_after`/`modified_before` for 400x+ faster incremental syncs) |
| `huly_get_issue_details` | Get comprehensive details about a specific issue |
| `huly_list_comments` | List comments on an issue |
| `huly_create_comment` | Create a comment on an issue |
| `huly_bulk_create_issues` | Create multiple issues atomically with component/milestone support |
| `huly_bulk_update_issues` | Update multiple issues with different values |
| `huly_bulk_delete_issues` | Delete multiple issues and their sub-issues |
| `huly_delete_issue` | Delete a single issue with cascade options |
| `huly_delete_project` | Delete an entire project and all its contents |
| `huly_archive_project` | Archive a project (soft delete) |
| `huly_delete_component` | Delete a component and update affected issues |
| `huly_delete_milestone` | Delete a milestone and update affected issues |
| `huly_create_template` | Create reusable issue templates |
| `huly_list_templates` | List all templates in a project |
| `huly_create_issue_from_template` | Create issues from templates |
| `huly_validate_deletion` | Check if an entity can be safely deleted |
| `huly_deletion_impact_preview` | Preview the full impact of a deletion |

## v0.7 Entity Operations

The v0.7 architecture consolidates operations into entity-based tools for cleaner API design and better maintainability.

### Unified Entity Tool: `huly_entity`

The `huly_entity` tool handles all CRUD operations for projects, components, milestones, and comments using a discriminated union pattern:

```bash
POST /api/tools/huly_entity
{
  "arguments": {
    "entity_type": "<entity_type>",  # project | component | milestone | comment
    "operation": "<operation>",       # create | read | update | delete
    "project_identifier": "<proj>",   # Required for most operations
    ...additional parameters
  }
}
```

### Component Operations

#### Create Component
```bash
POST /api/tools/huly_entity
{
  "arguments": {
    "entity_type": "component",
    "operation": "create",
    "project_identifier": "PROJ",
    "data": {
      "label": "Frontend",
      "description": "Frontend components and UI"
    }
  }
}
```

#### Update Component (NEW in v0.7)
Update component label, description, or both:

```bash
# Update label only
POST /api/tools/huly_entity
{
  "arguments": {
    "entity_type": "component",
    "operation": "update",
    "project_identifier": "PROJ",
    "entity_identifier": "Frontend",
    "data": {
      "label": "UI Layer"
    }
  }
}

# Update description only
POST /api/tools/huly_entity
{
  "arguments": {
    "entity_type": "component",
    "operation": "update",
    "project_identifier": "PROJ",
    "entity_identifier": "Frontend",
    "data": {
      "description": "Complete UI layer including React components"
    }
  }
}

# Update both label and description
POST /api/tools/huly_entity
{
  "arguments": {
    "entity_type": "component",
    "operation": "update",
    "project_identifier": "PROJ",
    "entity_identifier": "Frontend",
    "data": {
      "label": "UI Layer",
      "description": "Complete UI layer including React components"
    }
  }
}
```

**Validation Rules:**
- At least one of `label` or `description` must be provided
- Component must exist in the project
- New label must not conflict with existing components
- Response time: 150-250ms average

#### Delete Component
```bash
POST /api/tools/huly_entity
{
  "arguments": {
    "entity_type": "component",
    "operation": "delete",
    "project_identifier": "PROJ",
    "entity_identifier": "Frontend"
  }
}
```

### Migration from v0.6 to v0.7

**v0.6 Approach** (Deprecated):
```bash
# Multiple individual tools
POST /api/tools/huly_create_component {...}
POST /api/tools/huly_update_component {...}
POST /api/tools/huly_delete_component {...}
POST /api/tools/huly_list_components {...}
```

**v0.7 Approach** (Recommended):
```bash
# Single unified entity tool
POST /api/tools/huly_entity {
  "entity_type": "component",
  "operation": "create|update|delete",
  ...
}

# Query tool for listing
POST /api/tools/huly_query {
  "entity_type": "component",
  "mode": "all",
  "project_identifier": "PROJ"
}
```

**Benefits of v0.7:**
- **Fewer Tools**: 8 tools instead of 40+ for cleaner integration
- **Consistent API**: Same pattern across all entity types
- **Better Validation**: Centralized validation logic
- **Type Safety**: Discriminated unions for compile-time safety
- **Easier Maintenance**: Single handler for similar operations

### v0.7 Tool Categories

1. **`huly_query`** - List and search operations for all entities
2. **`huly_entity`** - CRUD operations for projects, components, milestones, comments
3. **`huly_issue_ops`** - Issue-specific operations (create, update, delete)
4. **`huly_template_ops`** - Template management operations
5. **`huly_workflow`** - Workflow and automation operations
6. **`huly_account_ops`** - User and account management
7. **`huly_validate`** - Validation and impact analysis
8. **`huly_integration`** - External integrations (GitHub, etc.)

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
# Copy the example environment file
cp .env.example .env

# Edit .env with your values
# Or export directly:
export HULY_URL=https://your-huly-instance.com
export HULY_EMAIL=your-email@example.com
export HULY_PASSWORD=your-password
export HULY_WORKSPACE=your-workspace-name
export GITHUB_TOKEN=your-github-token  # Required for @hcengineering packages
```

### Usage

#### Stdio Transport (Claude Code)
```bash
npm run start:stdio
```

#### HTTP Transport (Web/API + MCP)
```bash
npm run start:http
```

Server will be available at `http://localhost:3457` with both protocols:
- **REST API**: `http://localhost:3457/api/tools`
- **MCP Protocol**: `http://localhost:3457/mcp`
- **Health Check**: `http://localhost:3457/health`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HULY_URL` | Huly instance URL | `https://pm.oculair.ca` |
| `HULY_EMAIL` | User email for authentication | Required |
| `HULY_PASSWORD` | User password for authentication | Required |
| `HULY_WORKSPACE` | Workspace name | `agentspace` |
| `PORT` | HTTP server port | `3457` |
| `NODE_ENV` | Environment mode | `development` |
| `GITHUB_TOKEN` | GitHub token for @hcengineering packages | Required for npm install |

### Claude Code Integration

Add to your Claude Code MCP configuration:

**HTTP Transport (Recommended)**:
```bash
claude mcp add --transport http huly-mcp "http://localhost:3457/mcp" -s user
```

**Stdio Transport (Alternative)**:
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
  -e GITHUB_TOKEN=your-github-token \
  -p 3457:3457 \
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
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    ports:
      - "3457:3457"
    depends_on:
      - nginx
      - account
      - transactor
    restart: unless-stopped
```

## API Reference

For complete API documentation including all tools, parameters, examples, and error handling, see **[API.md](API.md)**.

### Quick Reference

The server provides 42+ tools via both REST API and MCP protocol:

#### Core Endpoints

**REST API** (Stateless HTTP):
- **Health Check**: `GET /api/health`
- **List Tools**: `GET /api/tools`
- **Execute Tool (POST)**: `POST /api/tools/{tool_name}`
- **Execute Tool (GET)**: `GET /api/tools/{tool_name}?param=value`

**MCP Protocol** (Session-based):
- **Health Check**: `GET /health`
- **MCP Initialization**: `POST /mcp` (with initialize method)
- **Tool Execution**: `POST /mcp` (with tools/call method)
- **Session Management**: `DELETE /mcp` (terminate session)

#### REST API Examples

**List Projects (GET)**:
```bash
GET /api/tools/huly_list_projects
```

**Create Issue (POST)**:
```bash
POST /api/tools/huly_create_issue
Content-Type: application/json
{
  "arguments": {
    "project_identifier": "PROJ",
    "title": "New Issue",
    "description": "Issue description",
    "priority": "high",
    "component": "Frontend",
    "milestone": "v2.0"
  }
}
```

**List Issues with Filters (GET)**:
```bash
GET /api/tools/huly_list_issues?project_identifier=PROJ&limit=10
```

**Query Issues with Date Filters (Incremental Sync)**:
```bash
# Get only issues modified since last sync
POST /api/tools/huly_query
Content-Type: application/json
{
  "arguments": {
    "entity_type": "issue",
    "mode": "search",
    "filters": {
      "project_identifier": "PROJ",
      "modified_after": "2026-01-01T00:00:00Z"
    }
  }
}

# Get issues modified within a date range
POST /api/tools/huly_query
Content-Type: application/json
{
  "arguments": {
    "entity_type": "issue",
    "mode": "search",
    "filters": {
      "project_identifier": "PROJ",
      "modified_after": "2025-12-01",
      "modified_before": "2025-12-31"
    }
  }
}
```

**Performance Notes:**
- **Without filter**: Fetching all 884 issues takes ~52 seconds
- **With `modified_after` filter**: Fetching 4 recent issues takes ~0.123 seconds
- **Performance improvement**: 423x speedup for incremental syncs
- **Use case**: Perfect for services that need to sync changes periodically (e.g., Huly-Vibe Sync Service)

#### MCP Protocol Examples

**Initialize Session**:
```bash
POST /mcp
Content-Type: application/json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {"name": "my-client", "version": "1.0"}
  },
  "id": 1
}
```

**Execute Tool**:
```bash
POST /mcp
Content-Type: application/json
MCP-Session-ID: {session_id}
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "huly_create_issue",
    "arguments": {
      "project_identifier": "PROJ",
      "title": "New Issue"
    }
  },
  "id": 2
}
```

### Protocol Comparison

| Feature | REST API | MCP Protocol |
|---------|----------|--------------|
| **Use Case** | Web apps, automation | AI assistants |
| **Setup** | No session required | Session initialization |
| **Request Format** | HTTP + JSON | JSON-RPC 2.0 |
| **Performance** | Lower latency | Session overhead |
| **Error Handling** | HTTP status codes | JSON-RPC error codes |
| **Batch Operations** | Excellent (parallel) | Good (sequential) |

For complete documentation with all 42+ tools, parameters, error handling, and integration examples, see **[API.md](API.md)**.

## Git Worktree Workflow

This project uses Git worktrees for parallel development, allowing simultaneous work on multiple Huly issues without context switching. Each issue is developed in its own isolated worktree with automatic status tracking.

### Branch Naming Convention

All branches follow the format: `<type>/HULLY-<number>-<description>`

**Types:**
- `feature/` - New features or enhancements
- `bugfix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

**Examples:**
- `feature/HULLY-8-search-filter-capabilities`
- `bugfix/HULLY-24-subissue-relationships`
- `docs/HULLY-5-setup-guides`

### Workflow Scripts

The project includes helper scripts for managing worktrees:

```bash
# Create a new worktree for an issue
./scripts/worktree-create.sh <issue-number> <type> [description]
# Example: ./scripts/worktree-create.sh 8 feature "search-filter"

# List all active worktrees
./scripts/worktree-list.sh

# Check status of all worktrees
./scripts/worktree-status.sh

# Remove a worktree after merging
./scripts/worktree-remove.sh <issue-number>

# Update Huly issue status manually
./scripts/huly-update-issue.sh <issue-number> <status>

# Create PR and update issue status
./scripts/create-pr.sh [title] [body]
```

### Complete Development Workflow

1. **Pick an Issue**: Select an issue from Huly backlog
2. **Create Worktree**: 
   ```bash
   ./scripts/worktree-create.sh 8 feature "search-filter"
   cd ./worktrees/feature-HULLY-8-search-filter
   ```
3. **Start Development**: Issue automatically marked as "In Progress"
4. **Commit Changes**: Issue references automatically added to commits
5. **Create PR**: 
   ```bash
   ./scripts/create-pr.sh
   ```
6. **Review**: Issue automatically marked as "In Review"
7. **Merge**: Issue automatically marked as "Done"
8. **Cleanup**: 
   ```bash
   ./scripts/worktree-remove.sh 8
   ```

### Claude Code Slash Commands

This project includes custom slash commands for Claude Code that streamline the worktree workflow:

#### Available Commands

- **`/worktree-create <issue> <type> [description]`** - Create a new worktree for a Huly issue
  - Example: `/worktree-create 38 feature search-functionality`

- **`/worktree-pr`** - Create a pull request for the current branch
  - Automatically updates Huly issue status

- **`/worktree-merge <issue>`** - Complete workflow by merging and cleaning up
  - Example: `/worktree-merge 38`

- **`/huly-status <issue> <status>`** - Quick status update for any Huly issue
  - Example: `/huly-status 42 done`
  - Valid statuses: backlog, todo, in-progress, done, canceled

- **`/worktree-help`** - Show all available worktree commands

These commands are stored in `.claude/commands/` and provide:
- Faster workflow execution
- Dynamic content showing current state
- Automatic GitHub token handling
- Integration with MCP tools

### Git Hooks Integration

The workflow includes automatic Git hooks that:

- **post-checkout**: Updates issue to "In Progress" when switching to feature branch
- **prepare-commit-msg**: Adds "Progresses HULLY-XX" to commit messages
- **post-merge**: Updates issue to "Done" when feature branch is merged

Install hooks with:
```bash
./scripts/setup-hooks.sh
```

### Commit Message Convention

Include Huly issue references in commit messages:
- `Fixes HULLY-XX` - Closes the issue when merged
- `Closes HULLY-XX` - Same as Fixes
- `Progresses HULLY-XX` - Updates progress on the issue
- `References HULLY-XX` - Mentions related issue

### Parallel Development Benefits

- **Multiple Issues**: Work on different issues simultaneously
- **Clean History**: Main branch stays clean for releases
- **Automatic Tracking**: Issue status updates automatically
- **No Context Switching**: Each issue has its own workspace
- **Team Coordination**: Clear visibility of who's working on what

## Development

### Tool Architecture

The MCP server uses a modular tool architecture where each tool is implemented in its own file:

```
src/tools/
├── base/              # Base interfaces and registry
│   ├── ToolInterface.js
│   └── ToolRegistry.js
├── projects/          # Project management tools
│   ├── listProjects.js
│   └── createProject.js
├── issues/            # Issue management tools
│   ├── listIssues.js
│   ├── createIssue.js
│   └── ...
└── ...                # Other tool categories
```

Each tool exports:
- `definition`: Tool metadata and input schema
- `handler`: Function that executes the tool logic
- `validate`: Optional validation function

### Project Structure
```
huly-mcp-server/
├── index.js           # Main server implementation
├── package.json       # Dependencies and scripts
├── Dockerfile         # Container configuration
├── start-mcp.sh      # Startup script for stdio transport
├── README.md         # This file
├── WISHLIST.md       # Feature wishlist and roadmap
└── scripts/          # Workflow automation scripts
    ├── worktree-create.sh    # Create new worktrees
    ├── worktree-list.sh      # List active worktrees
    ├── worktree-status.sh    # Check worktree status
    ├── worktree-remove.sh    # Remove worktrees
    ├── huly-update-issue.sh  # Update Huly issue status
    ├── create-pr.sh          # Create PR and update status
    └── setup-hooks.sh        # Install Git hooks
```

### Code Quality

#### Linting
```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

#### Pre-commit Hooks
The project uses Husky and lint-staged to ensure code quality before commits:

- **ESLint**: Automatically fixes and validates JavaScript files
- **Test Runner**: Runs related tests for modified test files
- **Commit Message**: Enforces conventional commit format

Commit message format:
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
```

Examples:
```bash
git commit -m "feat(api): add new endpoint for user data"
git commit -m "fix: resolve connection timeout issue"
git commit -m "docs: update README with setup instructions"
```

### Running Tests
```bash
# Run all tests
npm test

# Test stdio transport
timeout 5 npm run start:stdio

# Test HTTP transport (both REST and MCP)
npm run start:http &

# Test REST API health
curl http://localhost:3457/api/health

# Test MCP protocol health
curl http://localhost:3457/health

# Test REST API tool execution
curl http://localhost:3457/api/tools/huly_list_projects

# Test REST API with parameters
curl "http://localhost:3457/api/tools/huly_list_issues?project_identifier=PROJ&limit=5"
```

### SDK Compatibility

This server uses Huly SDK version 0.6.500 for compatibility with Huly server v0.6.501. Version alignment is critical for proper operation.

### Architecture Improvements

The codebase now includes:
- **SequenceService**: Atomic sequence generation for issue numbers
- **ServiceRegistry**: Dependency injection container for clean service management
- **Comprehensive Testing**: 80%+ test coverage with integration tests for concurrent operations

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify HULY_URL is correct
   - Check credentials are valid
   - Ensure network connectivity to Huly instance

2. **REST API Issues**
   - **Tool Not Found (404)**: Check tool name spelling in `/api/tools/{tool_name}`
   - **Validation Errors (400)**: Include required parameters in request body `{"arguments": {...}}`
   - **Rate Limiting (429)**: Reduce request frequency (default: 100 req/15min)
   - **Service Errors (502)**: Check Huly credentials and connectivity

3. **MCP Protocol Issues**
   - **Session Required**: Initialize session with `POST /mcp` using `initialize` method
   - **Protocol Version**: Use `MCP-Protocol-Version: 2025-06-18` header
   - **Missing Session ID**: Include `MCP-Session-ID` header in subsequent requests

4. **Module Import Errors**
   - Verify Node.js version (18+)
   - Check package.json type is set to "module"
   - Ensure all dependencies are installed

5. **Docker Issues**
   - Use internal Docker network URLs (e.g., `http://nginx:80`)
   - Check container logs: `docker-compose logs huly-mcp`
   - Verify environment variables are set

### Debug Mode

Enable debug logging:
```bash
DEBUG=huly-mcp* npm run start:stdio
```

### Testing Connectivity

```bash
# Test server health
curl http://localhost:3457/health

# Test REST API
curl http://localhost:3457/api/health

# List available tools
curl http://localhost:3457/api/tools

# Test MCP session initialization
curl -X POST http://localhost:3457/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## API Integration Notes

### Key Learnings from Huly API

During the development of this MCP server, we discovered several important aspects of the Huly API:

#### 1. **Class Imports**
- The Space class is located at `core.class.Space`, not `coreModule.space.Space`
- Always use the pattern: `const module = moduleImport.default || moduleImport`

#### 2. **Markup Storage**
Huly uses two different patterns for storing text content:

**Blob References (MarkupRef)**
- Used for: Issue descriptions, large content
- Format: `<24-hex-chars>-description-<timestamp>` or just `<24-hex-chars>`
- Retrieve with: `client.fetchMarkup(class, id, attr, ref, format)`
- Create with: `client.uploadMarkup(class, id, attr, content, format)`

**Direct Markup Storage**
- Used for: Comments, chat messages
- Stored directly in the message field
- Extract with: `extractTextFromMarkup(content)`

#### 3. **Comment System**
- Comments are `activity.class.ActivityMessage` not `chunter.class.Comment`
- Create comments using `chunter.class.ChatMessage`
- Comments use direct markup storage, not blob references

#### 4. **Status Management**
- Status values can be human-readable (backlog, todo, in-progress, done, canceled)
- Or full format (tracker:status:Backlog, etc.)
- The API accepts both formats

#### 5. **Testing Considerations**
- Mock-based unit tests cannot catch API contract violations
- Integration tests with real API calls are essential
- Test with unique identifiers to avoid conflicts

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[API Updates](./docs/API-UPDATES.md)** - Recent API changes and new features
- **[Bulk Operations Guide](./docs/bulk-operations.md)** - Detailed guide for bulk creation, update, and deletion of issues
- **[Templates Guide](./docs/templates.md)** - Using templates for standardized issue creation
- **[Deletion Operations Guide](./docs/deletion-operations.md)** - Safe deletion practices and validation
- **[API Reference](./docs/api-reference.md)** - Complete API documentation for all tools

### Quick Links

- **Getting Started**: See the [Quick Start](#quick-start) section above
- **Tool Reference**: See [Available Tools](#available-tools) for a complete list
- **Development Workflow**: See [Git Worktree Workflow](#git-worktree-workflow) for development practices
- **Troubleshooting**: Check the guides above or file an issue

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- createProject.test.js

# Run integration tests
npm run test:mcp

# Run unit tests only
npm run test:unit
```

### Writing Tests for New Tools

When developing new tools, comprehensive tests are required. See our [Testing Guidelines](docs/TESTING_TOOLS.md) for detailed instructions.

**Quick Checklist:**
- ✅ Test tool definition structure
- ✅ Test handler success and error cases  
- ✅ Test validation with valid/invalid inputs
- ✅ Achieve minimum 80% code coverage

**Resources:**
- Example test template: `__tests__/examples/exampleTool.test.js`
- Testing guidelines: `docs/TESTING_TOOLS.md`
- Existing tool tests: `src/tools/*/__tests__/`
```

### Test Coverage

The project includes comprehensive test coverage:
- Unit tests for all service methods
- Integration tests for all MCP tools
- Performance tests for API operations
- Edge case scenarios

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
- [ ] Advanced workflows# Test change for HULLY-61
