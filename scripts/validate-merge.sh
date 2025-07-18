#!/bin/bash

# Pre-merge Validation Script
# Checks for potential issues before creating a PR or merging
# Usage: ./scripts/validate-merge.sh [branch]

# Configuration
PROJECT_ROOT=$(git rev-parse --show-toplevel)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current branch or use provided branch
BRANCH=${1:-$(git rev-parse --abbrev-ref HEAD)}

echo -e "${BLUE}=== Pre-merge Validation for $BRANCH ===${NC}"
echo ""

# Track validation results
ERRORS=0
WARNINGS=0

# 1. Check if we're on a feature branch
if [[ ! $BRANCH =~ ^(feature|bugfix|hotfix|docs|refactor)\/HULLY-[0-9]+ ]]; then
    echo -e "${RED}❌ Not on a valid feature branch${NC}"
    echo "   Branch should match: <type>/HULLY-<number>-<description>"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ Valid branch name${NC}"
fi

# 2. Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Uncommitted changes detected${NC}"
    echo "   Please commit or stash your changes before validation"
    git status --short
    ((ERRORS++))
else
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
fi

# 3. Update from main and check for conflicts
echo -e "${YELLOW}Fetching latest changes...${NC}"
git fetch origin main --quiet

# Check if branch is up to date with main
BEHIND_COUNT=$(git rev-list --count HEAD..origin/main)
if [ $BEHIND_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Branch is $BEHIND_COUNT commits behind main${NC}"
    echo "   Testing merge compatibility..."
    
    # Test merge without actually merging
    git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main > /tmp/merge-test.txt 2>&1
    
    if grep -q "<<<<<<< " /tmp/merge-test.txt; then
        echo -e "${RED}❌ Merge conflicts detected with main${NC}"
        echo "   Files with conflicts:"
        grep -l "<<<<<<< " /tmp/merge-test.txt | sed 's/^/     - /'
        ((ERRORS++))
    else
        echo -e "${YELLOW}⚠️  No conflicts, but rebase recommended${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${GREEN}✅ Branch is up to date with main${NC}"
fi

# 4. Check for lint errors (if npm is available)
if [ -f "package.json" ] && command -v npm &> /dev/null; then
    echo -e "${YELLOW}Running lint check...${NC}"
    if npm run lint &> /dev/null; then
        echo -e "${GREEN}✅ No lint errors${NC}"
    else
        echo -e "${RED}❌ Lint errors found${NC}"
        echo "   Run 'npm run lint' to see details"
        ((ERRORS++))
    fi
fi

# 5. Check for test failures (if tests exist)
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
    echo -e "${YELLOW}Running tests...${NC}"
    if npm test &> /dev/null; then
        echo -e "${GREEN}✅ All tests passing${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tests failing${NC}"
        echo "   Run 'npm test' to see details"
        ((WARNINGS++))
    fi
fi

# 6. Check for proper StatusManager usage
if grep -q "status.*=" index.js 2>/dev/null; then
    if grep -q "statusManager" index.js 2>/dev/null; then
        echo -e "${GREEN}✅ StatusManager properly integrated${NC}"
    else
        echo -e "${YELLOW}⚠️  Status updates found but not using StatusManager${NC}"
        ((WARNINGS++))
    fi
fi

# 7. Check for console.log statements
CONSOLE_COUNT=$(grep -c "console\.log" index.js 2>/dev/null || echo 0)
if [ $CONSOLE_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $CONSOLE_COUNT console.log statements${NC}"
    echo "   Consider removing debug logs before PR"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ No console.log statements${NC}"
fi

# 8. Check file sizes
LARGE_FILES=$(find . -type f -name "*.js" -size +100k 2>/dev/null | grep -v node_modules)
if [ -n "$LARGE_FILES" ]; then
    echo -e "${YELLOW}⚠️  Large JavaScript files detected:${NC}"
    echo "$LARGE_FILES" | sed 's/^/     /'
    ((WARNINGS++))
fi

# 9. Check for hardcoded values
if grep -E "(localhost|127\.0\.0\.1|hardcoded|TODO|FIXME)" index.js 2>/dev/null | grep -v "MCP_SERVER_URL"; then
    echo -e "${YELLOW}⚠️  Potential hardcoded values or TODOs found${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ No obvious hardcoded values${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}=== Validation Summary ===${NC}"
echo -e "Errors:   ${ERRORS}"
echo -e "Warnings: ${WARNINGS}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ Ready to create PR! No issues found.${NC}"
    else
        echo -e "${YELLOW}⚠️  Ready to create PR with $WARNINGS warnings.${NC}"
        echo "   Consider addressing warnings for a cleaner merge."
    fi
    exit 0
else
    echo -e "${RED}❌ Not ready for PR. Please fix $ERRORS errors.${NC}"
    exit 1
fi