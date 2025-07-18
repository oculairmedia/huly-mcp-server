#!/bin/bash

# Huly MCP Server Worktree Removal Script
# Usage: ./scripts/worktree-remove.sh <issue-number>
# Example: ./scripts/worktree-remove.sh 8

# Check if required arguments are provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <issue-number>"
    echo "Example: $0 8"
    exit 1
fi

ISSUE_NUMBER=$1

# Find worktree containing the issue number
WORKTREE_PATH=$(git worktree list --porcelain | grep -B1 "HULLY-${ISSUE_NUMBER}" | grep "^worktree" | head -1 | cut -d' ' -f2)

if [ -z "$WORKTREE_PATH" ]; then
    echo "❌ No worktree found for HULLY-${ISSUE_NUMBER}"
    echo ""
    echo "Available worktrees:"
    ./scripts/worktree-list.sh
    exit 1
fi

# Get branch name
BRANCH_NAME=$(git worktree list --porcelain | grep -A1 "^worktree $WORKTREE_PATH" | grep "^branch" | cut -d' ' -f2 | sed 's|refs/heads/||')

echo "Found worktree:"
echo "  Path: $WORKTREE_PATH"
echo "  Branch: $BRANCH_NAME"
echo ""

# Check if branch has been merged
MERGED=$(git branch -r --merged origin/main | grep "$BRANCH_NAME" || true)

if [ -z "$MERGED" ]; then
    echo "⚠️  WARNING: Branch '$BRANCH_NAME' has not been merged to main!"
    echo "Are you sure you want to remove this worktree? (y/N)"
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Remove worktree
echo "Removing worktree..."
git worktree remove "$WORKTREE_PATH" --force

# Delete branch if merged
if [ -n "$MERGED" ]; then
    echo "Deleting merged branch..."
    git branch -d "$BRANCH_NAME" 2>/dev/null || true
    git push origin --delete "$BRANCH_NAME" 2>/dev/null || true
fi

echo "✅ Worktree removed successfully!"
echo ""
echo "Remember to:"
echo "- Update HULLY-${ISSUE_NUMBER} status in Huly if needed"