#!/bin/bash

# Conflict Detection Script
# Analyzes active worktrees to identify potential merge conflicts
# Usage: ./scripts/check-conflicts.sh [--detailed]

# Configuration
DETAILED=false
if [ "$1" == "--detailed" ]; then
    DETAILED=true
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Worktree Conflict Analysis ===${NC}"
echo ""

# Get all worktrees
WORKTREES=$(git worktree list --porcelain | grep "worktree" | awk '{print $2}')

# Arrays to store file modifications
declare -A modified_files
declare -A worktree_files
declare -A worktree_branches

# Analyze each worktree
echo -e "${YELLOW}Analyzing worktrees...${NC}"
for worktree in $WORKTREES; do
    if [[ "$worktree" == *"/main" ]] || [[ "$worktree" == *"/.git" ]]; then
        continue
    fi
    
    cd "$worktree" 2>/dev/null || continue
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    if [[ ! $BRANCH =~ HULLY-[0-9]+ ]]; then
        continue
    fi
    
    # Store branch name for this worktree
    worktree_branches["$worktree"]="$BRANCH"
    
    # Get modified files compared to main
    FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null)
    
    # Store files for this worktree
    worktree_files["$worktree"]="$FILES"
    
    # Track each file and which worktrees modify it
    for file in $FILES; do
        if [ -n "$file" ]; then
            if [ -z "${modified_files[$file]}" ]; then
                modified_files["$file"]="$BRANCH"
            else
                modified_files["$file"]="${modified_files[$file]},$BRANCH"
            fi
        fi
    done
done

# Return to original directory
cd /opt/stacks/huly-selfhost/huly-mcp-server 2>/dev/null

# Report conflicts
CONFLICT_COUNT=0
echo ""
echo -e "${BLUE}Potential Conflicts Detected:${NC}"
echo ""

for file in "${!modified_files[@]}"; do
    IFS=',' read -ra branches <<< "${modified_files[$file]}"
    if [ ${#branches[@]} -gt 1 ]; then
        echo -e "${RED}⚠️  $file${NC}"
        echo -e "   Modified in multiple branches:"
        for branch in "${branches[@]}"; do
            echo -e "   ${YELLOW}- $branch${NC}"
        done
        ((CONFLICT_COUNT++))
        
        if [ "$DETAILED" == true ]; then
            echo -e "   ${MAGENTA}Analyzing changes:${NC}"
            # Show diff stats for each branch
            for branch in "${branches[@]}"; do
                STATS=$(git diff --stat origin/main...origin/$branch -- "$file" 2>/dev/null | tail -1)
                if [ -n "$STATS" ]; then
                    echo -e "     $branch: $STATS"
                fi
            done
        fi
        echo ""
    fi
done

if [ $CONFLICT_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ No overlapping file modifications detected!${NC}"
    echo ""
fi

# Show active worktrees summary
echo -e "${BLUE}Active Worktrees Summary:${NC}"
echo ""

for worktree in "${!worktree_branches[@]}"; do
    BRANCH="${worktree_branches[$worktree]}"
    FILE_COUNT=$(echo "${worktree_files[$worktree]}" | wc -w)
    echo -e "📂 ${BRANCH}"
    echo -e "   Path: $worktree"
    echo -e "   Modified files: $FILE_COUNT"
    
    if [ "$DETAILED" == true ] && [ $FILE_COUNT -gt 0 ]; then
        echo -e "   Files:"
        echo "${worktree_files[$worktree]}" | tr ' ' '\n' | sed 's/^/     - /'
    fi
    echo ""
done

# Merge order recommendations
if [ $CONFLICT_COUNT -gt 0 ]; then
    echo -e "${BLUE}Recommended Merge Order:${NC}"
    echo -e "${YELLOW}To minimize conflicts, consider merging in this order:${NC}"
    echo ""
    
    # Sort branches by number of conflicting files (ascending)
    declare -A branch_conflict_count
    for worktree in "${!worktree_branches[@]}"; do
        BRANCH="${worktree_branches[$worktree]}"
        COUNT=0
        for file in ${worktree_files[$worktree]}; do
            IFS=',' read -ra branches <<< "${modified_files[$file]}"
            if [ ${#branches[@]} -gt 1 ]; then
                ((COUNT++))
            fi
        done
        branch_conflict_count["$BRANCH"]=$COUNT
    done
    
    # Sort and display
    ORDER=1
    for branch in $(for b in "${!branch_conflict_count[@]}"; do echo "${branch_conflict_count[$b]} $b"; done | sort -n | awk '{print $2}'); do
        ISSUE=$(echo "$branch" | grep -oE "HULLY-[0-9]+")
        echo -e "   ${ORDER}. $branch (${branch_conflict_count[$branch]} potential conflicts)"
        ((ORDER++))
    done
    echo ""
    echo -e "${YELLOW}Note: Always run ./scripts/validate-merge.sh before creating PRs${NC}"
fi

# Summary statistics
echo ""
echo -e "${BLUE}=== Summary ===${NC}"
echo -e "Active worktrees: ${#worktree_branches[@]}"
echo -e "Files with conflicts: $CONFLICT_COUNT"
echo ""

if [ "$DETAILED" == false ]; then
    echo -e "${YELLOW}Run with --detailed flag for more information${NC}"
fi