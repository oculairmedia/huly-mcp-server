#!/bin/bash

# Status Synchronization Script
# Verifies and fixes mismatches between Git worktrees and Huly issue statuses
# Usage: ./scripts/status-sync.sh [--fix]

# Configuration
MCP_SERVER_URL="http://localhost:3457"
PROJECT="HULLY"
FIX_MODE=false

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for --fix flag
if [ "$1" == "--fix" ]; then
    FIX_MODE=true
    echo -e "${YELLOW}Running in FIX mode - will update mismatched statuses${NC}"
fi

echo -e "${BLUE}=== Huly Status Synchronization Check ===${NC}"
echo ""

# Get all worktrees
WORKTREES=$(git worktree list --porcelain | grep "worktree" | awk '{print $2}')

# Get all issues from Huly
echo -e "${YELLOW}Fetching issues from Huly...${NC}"
ISSUES_RESPONSE=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"huly_list_issues\",
            \"arguments\": {
                \"project_identifier\": \"${PROJECT}\"
            }
        },
        \"id\": 1
    }")

# Track mismatches
MISMATCH_COUNT=0
FIXED_COUNT=0

# Function to extract issue number from branch/path
extract_issue_number() {
    echo "$1" | grep -oE "HULLY-[0-9]+" | sed 's/HULLY-//'
}

# Function to get Huly status for an issue
get_huly_status() {
    local issue_number=$1
    echo "$ISSUES_RESPONSE" | grep -A5 "HULLY-${issue_number}:" | grep "Status:" | sed 's/.*Status: //' | awk '{print $1}'
}

# Function to determine expected status based on branch existence
get_expected_status() {
    local worktree_path=$1
    local branch=$2
    
    # Check if PR exists
    if git ls-remote origin | grep -q "refs/pull/.*/${branch}"; then
        echo "in-progress"  # Has PR, should be in review
    else
        echo "in-progress"  # Active development
    fi
}

echo -e "${BLUE}Checking active worktrees:${NC}"
echo ""

# Check each worktree
for worktree in $WORKTREES; do
    if [[ "$worktree" == *"/main" ]] || [[ "$worktree" == *"/.git" ]]; then
        continue
    fi
    
    # Get branch name
    cd "$worktree" 2>/dev/null || continue
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    if [[ ! $BRANCH =~ HULLY-[0-9]+ ]]; then
        continue
    fi
    
    ISSUE_NUMBER=$(extract_issue_number "$BRANCH")
    ISSUE_ID="HULLY-${ISSUE_NUMBER}"
    
    # Get current Huly status
    HULY_STATUS=$(get_huly_status "$ISSUE_NUMBER")
    EXPECTED_STATUS=$(get_expected_status "$worktree" "$BRANCH")
    
    echo -e "📋 ${ISSUE_ID}:"
    echo -e "   Branch: $BRANCH"
    echo -e "   Worktree: $worktree"
    echo -e "   Huly Status: ${HULY_STATUS:-unknown}"
    echo -e "   Expected: ${EXPECTED_STATUS}"
    
    # Check for mismatch
    if [ "$HULY_STATUS" == "done" ] || [ "$HULY_STATUS" == "canceled" ]; then
        echo -e "   ${YELLOW}⚠️  Issue is closed but worktree still exists${NC}"
        echo -e "      Consider running: ./scripts/worktree-remove.sh ${ISSUE_NUMBER}"
        ((MISMATCH_COUNT++))
    elif [ "$HULY_STATUS" == "backlog" ] || [ "$HULY_STATUS" == "todo" ]; then
        echo -e "   ${YELLOW}⚠️  Issue not started but worktree exists${NC}"
        
        if [ "$FIX_MODE" == true ]; then
            echo -e "   ${YELLOW}Fixing: Updating to 'in-progress'...${NC}"
            cd /opt/stacks/huly-selfhost/huly-mcp-server
            if ./scripts/huly-update-issue.sh "$ISSUE_NUMBER" "in-progress" >/dev/null 2>&1; then
                echo -e "   ${GREEN}✅ Fixed!${NC}"
                ((FIXED_COUNT++))
            else
                echo -e "   ${RED}❌ Failed to fix${NC}"
            fi
        fi
        ((MISMATCH_COUNT++))
    else
        echo -e "   ${GREEN}✅ Status synchronized${NC}"
    fi
    
    echo ""
done

# Check for issues marked as in-progress without worktrees
echo -e "${BLUE}Checking for orphaned in-progress issues:${NC}"
echo ""

# Parse issues that are in-progress
IN_PROGRESS_ISSUES=$(echo "$ISSUES_RESPONSE" | grep -B1 "Status: in-progress" | grep "HULLY-" | grep -oE "HULLY-[0-9]+" | sed 's/HULLY-//')

for issue_num in $IN_PROGRESS_ISSUES; do
    # Check if worktree exists for this issue
    WORKTREE_EXISTS=false
    for worktree in $WORKTREES; do
        if [[ "$worktree" =~ HULLY-${issue_num} ]]; then
            WORKTREE_EXISTS=true
            break
        fi
    done
    
    if [ "$WORKTREE_EXISTS" == false ]; then
        echo -e "📋 HULLY-${issue_num}:"
        echo -e "   ${YELLOW}⚠️  Marked as in-progress but no worktree found${NC}"
        
        if [ "$FIX_MODE" == true ]; then
            echo -e "   ${YELLOW}Fixing: Updating to 'todo'...${NC}"
            if ./scripts/huly-update-issue.sh "$issue_num" "todo" >/dev/null 2>&1; then
                echo -e "   ${GREEN}✅ Fixed!${NC}"
                ((FIXED_COUNT++))
            else
                echo -e "   ${RED}❌ Failed to fix${NC}"
            fi
        else
            echo -e "      Consider updating status or creating worktree"
        fi
        ((MISMATCH_COUNT++))
        echo ""
    fi
done

# Summary
echo -e "${BLUE}=== Synchronization Summary ===${NC}"
echo -e "Total mismatches found: ${MISMATCH_COUNT}"

if [ "$FIX_MODE" == true ]; then
    echo -e "Issues fixed: ${FIXED_COUNT}"
fi

if [ $MISMATCH_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All worktrees and issues are synchronized!${NC}"
else
    if [ "$FIX_MODE" == false ]; then
        echo -e "${YELLOW}Run with --fix flag to automatically fix mismatches${NC}"
    fi
fi

# Return to original directory
cd /opt/stacks/huly-selfhost/huly-mcp-server 2>/dev/null