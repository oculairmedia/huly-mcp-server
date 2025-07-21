# Huly MCP Server

A Model Context Protocol (MCP) server for interacting with Huly project management platform. This server provides tools for managing projects, issues, and other Huly resources through Claude Code and other MCP clients.

## 🚀 Recent Updates

### Enhanced Features
- Component and milestone support in all issue operations
- Improved bulk operations with progress tracking
- Atomic operations for reliable concurrent usage
- Standardized MCP response format across all tools
- Better error handling and validation

[API Documentation](docs/API-UPDATES.md)

## Features

- **Project Management**: List, create, and manage Huly projects
- **Issue Tracking**: Create, list, and update issues across projects with full metadata
- **Atomic Operations**: Guaranteed unique issue numbers even under high concurrency
- **Bulk Operations**: Efficiently handle multiple issues at once with atomic guarantees
- **Git Worktree Integration**: Parallel development workflow with automatic issue tracking
- **Dual Transport Support**: Both HTTP and stdio transports
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
| `huly_create_milestone` | Create new milestones with target dates |
| `huly_list_milestones` | List all milestones in a project |
| `huly_list_github_repositories` | List available GitHub repositories |
| `huly_assign_repository_to_project` | Assign GitHub repositories to projects |
| `huly_search_issues` | Search and filter issues with advanced capabilities |
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
| `GITHUB_TOKEN` | GitHub token for @hcengineering packages | Required for npm install |

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
  -e GITHUB_TOKEN=your-github-token \
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
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    ports:
      - "3457:3000"
    depends_on:
      - nginx
      - account
      - transactor
    restart: unless-stopped
```

## API Reference

For complete API documentation including all tools, parameters, examples, and error handling, see **[API.md](API.md)**.

### Quick Reference

The server provides 13 MCP tools for comprehensive Huly integration:

#### Core Endpoints
- **Health Check**: `GET /health`
- **List Tools**: `GET /tools`  
- **MCP Protocol**: `POST /mcp`
- **Direct Tool Calls**: `POST /tools/{tool_name}`

#### Essential Examples

**List Projects**:
```bash
POST /tools/huly_list_projects
Content-Type: application/json
{}
```

**Create Issue**:
```bash
POST /tools/huly_create_issue
Content-Type: application/json
{
  "project_identifier": "PROJ",
  "title": "New Issue",
  "description": "Issue description",
  "priority": "high",
  "component": "Frontend",
  "milestone": "v2.0"
}
```

**Update Issue**:
```bash
POST /tools/huly_update_issue
Content-Type: application/json
{
  "issue_identifier": "PROJ-123",
  "field": "status",
  "value": "In Progress"
}
```

For complete documentation with all 13 tools, parameters, error handling, and integration examples, see **[API.md](API.md)**.

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

# Test HTTP transport
npm run start:http &
curl http://localhost:3000/health
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
