#!/bin/bash

# Huly MCP Server Worktree List Script
# Lists all active worktrees with their associated branches and Huly issues

echo "Active Worktrees:"
echo "================="
echo ""

# List worktrees with formatting
git worktree list --porcelain | while IFS= read -r line; do
    if [[ $line == worktree* ]]; then
        WORKTREE_PATH=${line#worktree }
        echo "📁 Worktree: $WORKTREE_PATH"
    elif [[ $line == branch* ]]; then
        BRANCH=${line#branch refs/heads/}
        echo "   🌿 Branch: $BRANCH"
        
        # Extract Huly issue number if present
        if [[ $BRANCH =~ HULLY-([0-9]+) ]]; then
            ISSUE_NUMBER=${BASH_REMATCH[1]}
            echo "   📋 Huly Issue: HULLY-$ISSUE_NUMBER"
        fi
        echo ""
    fi
done

# Show summary
WORKTREE_COUNT=$(git worktree list | wc -l)
echo "Total worktrees: $WORKTREE_COUNT"