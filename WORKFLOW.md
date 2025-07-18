# Git Worktree Workflow Guide

This guide documents the enhanced Git worktree workflow for parallel development with Huly issue tracking integration.

## Table of Contents
- [Overview](#overview)
- [Workflow Diagram](#workflow-diagram)
- [Getting Started](#getting-started)
- [Complete Development Cycle](#complete-development-cycle)
- [Available Commands](#available-commands)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Common Errors and Solutions](#common-errors-and-solutions)

## Overview

The Git worktree workflow enables parallel development on multiple features while maintaining automatic synchronization with Huly issue tracking. Each feature is developed in an isolated worktree with automatic status updates throughout the development lifecycle.

### Key Benefits
- **Parallel Development**: Work on multiple features simultaneously without context switching
- **Automatic Status Tracking**: Huly issues update automatically as you progress
- **Conflict Prevention**: Early detection of overlapping changes
- **Docker-free Testing**: Test implementations without building containers
- **Streamlined Merging**: Automated merge process with retry logic

## Workflow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Create Issue   │────▶│ Create Worktree  │────▶│   Development   │
│   in Huly       │     │ (Auto→Progress)  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Merge & Done  │◀────│   Create PR      │◀────│  Test & Validate│
│ (Auto→Done)     │     │ (Auto→Review)    │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Getting Started

### Prerequisites
1. Huly MCP Server installed and configured
2. Git worktree support (Git 2.5+)
3. Node.js 18+ for running tests
4. Huly account with project access

### Initial Setup
```bash
# Clone the repository if not already done
git clone https://github.com/oculairmedia/huly-mcp-server.git
cd huly-mcp-server

# Install dependencies
npm install

# Set up Git hooks for automation
./scripts/setup-hooks.sh
```

## Complete Development Cycle

### 1. Create Issue in Huly
First, create an issue in Huly with a clear description. Note the issue number (e.g., HULLY-42).

### 2. Create Worktree
```bash
# Create worktree with automatic status update
./scripts/worktree-create.sh 42 feature "user-authentication"

# This will:
# - Verify issue exists in Huly
# - Create isolated worktree
# - Create feature branch
# - Update issue to "In Progress"
# - Copy .env for MCP credentials
```

### 3. Development
```bash
# Navigate to worktree
cd ../worktrees/feature-HULLY-42-user-authentication

# Check for conflicts before starting
./scripts/check-conflicts.sh

# Develop your feature
# ... make changes ...

# Commit with issue reference
git add .
git commit -m "Add user authentication system

Implements OAuth2 login flow with JWT tokens.

Progresses HULLY-42"
```

### 4. Testing
```bash
# Validate before PR
./scripts/validate-merge.sh

# Test without Docker
./scripts/test-stdio.sh

# Or test with HTTP
PORT=6402 npm start -- --transport http
# In another terminal:
curl -X POST http://localhost:6402/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1}'
```

### 5. Create Pull Request
```bash
# Create PR with automatic status update
./scripts/create-pr.sh
# This updates issue to "In Review"
```

### 6. Merge and Cleanup
```bash
# After PR approval, merge with:
/worktree-merge 42

# This will:
# - Merge to main with proper commit message
# - Trigger hook to update issue to "Done"
# - Clean up worktree
# - Delete remote branch
```

## Available Commands

### Scripts

#### `worktree-create.sh <issue> <type> [description]`
Creates new worktree with automatic Huly status update.
- **Types**: feature, bugfix, hotfix, docs, refactor
- **Example**: `./scripts/worktree-create.sh 42 feature "search-api"`

#### `validate-merge.sh [branch]`
Pre-merge validation checking for:
- Uncommitted changes
- Merge conflicts with main
- Lint errors
- Test failures
- StatusManager usage
- Console.log statements

#### `check-conflicts.sh [--detailed]`
Analyzes active worktrees for potential merge conflicts.
- Shows overlapping file modifications
- Recommends merge order
- Detailed mode shows change statistics

#### `status-sync.sh [--fix]`
Synchronizes Git worktrees with Huly issue statuses.
- Detects mismatches
- `--fix` flag automatically corrects statuses
- Identifies orphaned worktrees and issues

#### `test-all-worktrees.sh [--parallel]`
Tests all active worktrees without Docker.
- Assigns unique ports automatically
- Runs stdio and HTTP tests
- Parallel mode for faster execution

#### `create-pr.sh [title] [body]`
Creates GitHub PR and updates Huly status.
- Auto-generates title from branch name
- Updates issue to "In Review"
- Includes PR template

### Slash Commands (Claude Code)

#### `/worktree-status`
Shows comprehensive status of all worktrees:
- Active worktrees and branches
- Huly issue statuses
- Synchronization state
- Recent commits

#### `/worktree-test <issue> [port]`
Tests specific worktree implementation:
- Runs validation checks
- Tests stdio and HTTP transports
- Uses custom port if specified

#### `/worktree-sync`
Fixes status mismatches:
- Updates Huly statuses
- Cleans orphaned worktrees
- Creates missing worktrees

#### `/worktree-merge <issue>`
Complete merge workflow:
- Pre-merge validation
- Retry logic for status updates
- Comprehensive cleanup

## Best Practices

### 1. Always Start with an Issue
- Create detailed Huly issues before starting work
- Include acceptance criteria
- Assign to yourself

### 2. Use Descriptive Branch Names
```bash
# Good
./scripts/worktree-create.sh 42 feature "oauth-login"

# Bad
./scripts/worktree-create.sh 42 feature "fix"
```

### 3. Check for Conflicts Early
```bash
# Before starting work
./scripts/check-conflicts.sh

# Before creating PR
./scripts/validate-merge.sh
```

### 4. Commit Message Format
```
<Type>: <Subject>

<Body>

<Issue Reference>
```

Example:
```
feat: Add OAuth2 authentication

Implements Google and GitHub OAuth providers with
JWT token generation and refresh logic.

Progresses HULLY-42
```

### 5. Regular Status Checks
```bash
# Check all worktree statuses
/worktree-status

# Fix any mismatches
/worktree-sync
```

### 6. Test Thoroughly
- Run validate-merge.sh before every PR
- Test with both stdio and HTTP transports
- Check for console.log statements

## Troubleshooting

### Issue Not Found Error
```bash
❌ Error: Issue HULLY-42 not found in Huly
```
**Solution**: Create the issue in Huly first or check the issue number.

### Merge Conflicts
```bash
❌ Merge conflicts detected with main
```
**Solution**: 
1. Pull latest main: `git pull origin main`
2. Resolve conflicts manually
3. Run `./scripts/validate-merge.sh` again

### Status Update Failed
```bash
⚠️ Failed to update status automatically
```
**Solution**:
1. Check MCP server is running: `curl http://localhost:3457/health`
2. Manually update: `./scripts/huly-update-issue.sh 42 in-progress`
3. Check credentials in .env

### Post-merge Hook Not Triggering
**Solution**:
1. Ensure hooks are installed: `./scripts/setup-hooks.sh`
2. Check hook permissions: `ls -la .git/hooks/`
3. Manually update status: `/worktree-merge 42`

### Worktree Already Exists
```bash
fatal: '../worktrees/feature-HULLY-42' already exists
```
**Solution**:
1. Remove old worktree: `./scripts/worktree-remove.sh 42`
2. Or use different description: `worktree-create.sh 42 feature "new-approach"`

## Common Errors and Solutions

### 1. Docker Build Failures
**Error**: `403 Forbidden - GET https://npm.pkg.github.com/@hcengineering%2fapi-client`

**Solution**: Use stdio/HTTP testing instead of Docker:
```bash
# Test with stdio
./scripts/test-stdio.sh

# Test with HTTP
PORT=6402 npm start -- --transport http
```

### 2. Line Ending Issues (Windows)
**Error**: `cannot execute: required file not found`

**Solution**: Fix line endings:
```bash
find scripts -name "*.sh" -exec sed -i 's/\r$//' {} \;
```

### 3. Multiple Conflicts
**Prevention**:
1. Check conflicts before starting: `./scripts/check-conflicts.sh`
2. Coordinate with team on shared files
3. Merge in recommended order
4. Keep PRs focused and small

### 4. Status Synchronization Issues
**Solution**: Regular sync checks:
```bash
# Check status
./scripts/status-sync.sh

# Auto-fix mismatches
./scripts/status-sync.sh --fix
```

## Advanced Usage

### Parallel Development Tips
1. Use `check-conflicts.sh --detailed` to see exact changes
2. Coordinate on Slack/Discord for shared files
3. Create smaller, focused PRs
4. Merge frequently to avoid divergence

### Custom Workflow Integration
The scripts can be integrated into CI/CD:
```yaml
# Example GitHub Action
- name: Validate PR
  run: ./scripts/validate-merge.sh ${{ github.head_ref }}
```

### Extending the Workflow
Add custom hooks in `.git/hooks/` for:
- Pre-commit validation
- Commit message formatting
- Automatic testing

## Summary

This workflow provides a robust, automated development process that:
- Reduces manual status updates
- Prevents common errors
- Enables efficient parallel development
- Maintains code quality
- Integrates seamlessly with Huly

For questions or improvements, please create an issue in the repository.