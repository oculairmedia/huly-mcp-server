#!/bin/bash

# PR Watcher Script
# Monitors for new PRs and automatically fixes titles and handles duplicates

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Starting PR watcher...${NC}"

# Source environment
if [ -f "$SCRIPT_DIR/../.env" ]; then
    source "$SCRIPT_DIR/../.env"
fi

# Function to check and fix PR
check_and_fix_pr() {
    local branch="$1"
    
    # Extract issue number from branch
    if [[ $branch =~ HULLY-([0-9]+) ]]; then
        local issue_number="${BASH_REMATCH[1]}"
        
        # Check for PR
        local pr_info=$(gh pr list --head "$branch" --json number,title --jq '.[0]' 2>/dev/null || echo "")
        
        if [ -n "$pr_info" ] && [ "$pr_info" != "null" ]; then
            local pr_number=$(echo "$pr_info" | jq -r '.number')
            local current_title=$(echo "$pr_info" | jq -r '.title')
            
            # Check if title needs fixing
            if [[ ! "$current_title" =~ ^\[HULLY-[0-9]+\] ]]; then
                echo -e "${YELLOW}Found PR #$pr_number with incorrect title: $current_title${NC}"
                
                # Fix the title
                cd "$SCRIPT_DIR/.." && ./scripts/create-pr.sh
                
                # Wait for duplicate creation
                sleep 5
                
                # Handle duplicate
                ./scripts/handle-pr-duplicate.sh "$issue_number"
            fi
        fi
    fi
}

# Watch for changes
if [ "$1" == "once" ]; then
    # Run once for current branch
    current_branch=$(git branch --show-current)
    check_and_fix_pr "$current_branch"
else
    # Continuous monitoring
    while true; do
        # Check all worktree branches
        for worktree in $(git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2); do
            if [[ "$worktree" != *"/huly-mcp-server" ]]; then
                cd "$worktree" 2>/dev/null || continue
                branch=$(git branch --show-current)
                check_and_fix_pr "$branch"
            fi
        done
        
        # Wait before next check
        sleep 30
    done
fi