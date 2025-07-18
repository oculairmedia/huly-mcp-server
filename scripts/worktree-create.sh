#!/bin/bash

# Huly MCP Server Worktree Creation Script
# Usage: ./scripts/worktree-create.sh <issue-number> <type> [description]
# Example: ./scripts/worktree-create.sh 8 feature "search-filter"

# Check if required arguments are provided
if [ $# -lt 2 ]; then
    echo "Usage: $0 <issue-number> <type> [description]"
    echo "Types: feature, bugfix, hotfix, docs, refactor"
    echo "Example: $0 8 feature \"search-filter\""
    exit 1
fi

ISSUE_NUMBER=$1
TYPE=$2
DESCRIPTION=${3:-""}

# Validate type
case $TYPE in
    feature|bugfix|hotfix|docs|refactor)
        ;;
    *)
        echo "Invalid type: $TYPE"
        echo "Valid types: feature, bugfix, hotfix, docs, refactor"
        exit 1
        ;;
esac

# Construct branch name
if [ -n "$DESCRIPTION" ]; then
    BRANCH_NAME="${TYPE}/HULLY-${ISSUE_NUMBER}-${DESCRIPTION}"
    WORKTREE_NAME="${TYPE}-HULLY-${ISSUE_NUMBER}-${DESCRIPTION}"
else
    BRANCH_NAME="${TYPE}/HULLY-${ISSUE_NUMBER}"
    WORKTREE_NAME="${TYPE}-HULLY-${ISSUE_NUMBER}"
fi

# Ensure we're in the main repository
if [ ! -d ".git" ]; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Fetch latest changes
echo "Fetching latest changes..."
git fetch origin

# Create worktree
WORKTREE_PATH="../worktrees/$WORKTREE_NAME"
echo "Creating worktree at: $WORKTREE_PATH"
echo "Branch name: $BRANCH_NAME"

# Create new branch based on main
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" origin/main

if [ $? -eq 0 ]; then
    echo "✅ Worktree created successfully!"
    echo ""
    echo "Next steps:"
    echo "1. cd $WORKTREE_PATH"
    echo "2. Update Huly issue HULLY-${ISSUE_NUMBER} to 'In Progress'"
    echo "3. Start developing!"
    echo ""
    echo "Remember to:"
    echo "- Use meaningful commit messages with 'Progresses HULLY-${ISSUE_NUMBER}'"
    echo "- Update Huly issue status throughout development"
    echo "- Test thoroughly before creating PR"
else
    echo "❌ Failed to create worktree"
    exit 1
fi