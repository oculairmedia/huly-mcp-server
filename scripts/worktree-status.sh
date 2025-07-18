#!/bin/bash

# Huly MCP Server Worktree Status Script
# Shows status of all worktrees including uncommitted changes

echo "Worktree Status Report"
echo "====================="
echo ""

# Save current directory
ORIGINAL_DIR=$(pwd)

# Iterate through all worktrees
git worktree list --porcelain | while IFS= read -r line; do
    if [[ $line == worktree* ]]; then
        WORKTREE_PATH=${line#worktree }
        
        # Skip if it's the main worktree
        if [ "$WORKTREE_PATH" = "$ORIGINAL_DIR" ]; then
            continue
        fi
        
        echo "📁 $WORKTREE_PATH"
        
        # Change to worktree directory
        cd "$WORKTREE_PATH" 2>/dev/null || continue
        
        # Get branch name
        BRANCH=$(git branch --show-current)
        echo "   🌿 Branch: $BRANCH"
        
        # Extract Huly issue number if present
        if [[ $BRANCH =~ HULLY-([0-9]+) ]]; then
            ISSUE_NUMBER=${BASH_REMATCH[1]}
            echo "   📋 Issue: HULLY-$ISSUE_NUMBER"
        fi
        
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo "   ⚠️  Has uncommitted changes"
            CHANGED_FILES=$(git diff --name-only | wc -l)
            echo "   📝 Modified files: $CHANGED_FILES"
        else
            echo "   ✅ Clean working tree"
        fi
        
        # Check if ahead/behind
        UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
        if [ -n "$UPSTREAM" ]; then
            AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
            BEHIND=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")
            
            if [ "$AHEAD" -gt 0 ] || [ "$BEHIND" -gt 0 ]; then
                echo "   📊 Ahead: $AHEAD, Behind: $BEHIND"
            fi
        fi
        
        echo ""
    fi
done

# Return to original directory
cd "$ORIGINAL_DIR"

# Summary
echo "Summary:"
TOTAL=$(git worktree list | grep -v "$(pwd)" | wc -l)
echo "  Total worktrees: $TOTAL"
echo "  Main repository: $(pwd)"