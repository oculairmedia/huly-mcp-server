#!/bin/bash

# Huly MCP Server Worktree Creation Script
# Usage: ./scripts/worktree-create.sh <issue-number> <type> [description]
# Example: ./scripts/worktree-create.sh 8 feature "search-filter"

# Configuration
MCP_SERVER_URL="http://localhost:3457"
PROJECT="HULLY"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
ISSUE_IDENTIFIER="${PROJECT}-${ISSUE_NUMBER}"

# Validate type
case $TYPE in
    feature|bugfix|hotfix|docs|refactor)
        ;;
    *)
        echo -e "${RED}Invalid type: $TYPE${NC}"
        echo "Valid types: feature, bugfix, hotfix, docs, refactor"
        exit 1
        ;;
esac

# Verify issue exists by checking with MCP server
echo -e "${YELLOW}Verifying issue ${ISSUE_IDENTIFIER} exists...${NC}"
ISSUE_CHECK=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
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

# Check if issue exists in the response
if ! echo "$ISSUE_CHECK" | grep -q "${ISSUE_IDENTIFIER}"; then
    echo -e "${RED}❌ Error: Issue ${ISSUE_IDENTIFIER} not found in Huly${NC}"
    echo "Please create the issue first or check the issue number"
    exit 1
fi

echo -e "${GREEN}✅ Issue ${ISSUE_IDENTIFIER} found${NC}"

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
WORKTREE_PATH="./worktrees/$WORKTREE_NAME"
echo -e "${YELLOW}Creating worktree at: $WORKTREE_PATH${NC}"
echo -e "${YELLOW}Branch name: $BRANCH_NAME${NC}"

# Create new branch based on main
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" origin/main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Worktree created successfully!${NC}"
    
    # Copy .env file if it exists for MCP credentials
    if [ -f ".env" ]; then
        cp .env "$WORKTREE_PATH/.env"
        echo -e "${GREEN}✅ Copied .env file for MCP credentials${NC}"
    fi
    
    # Set up GitHub token in the worktree
    # First check if token is in .env file
    if [ -f ".env" ]; then
        GITHUB_TOKEN_FROM_ENV=$(grep -E "^GITHUB_TOKEN=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    fi
    
    # Function to safely append to .env file
    append_to_env() {
        local file="$1"
        local content="$2"
        
        # Ensure file ends with newline
        if [ -f "$file" ] && [ -s "$file" ]; then
            # Check if file ends with newline
            if [ "$(tail -c1 "$file" | wc -l)" -eq 0 ]; then
                echo "" >> "$file"
            fi
        fi
        echo "$content" >> "$file"
    }
    
    # Check if .env already has GITHUB_TOKEN
    if grep -q "^GITHUB_TOKEN=" "$WORKTREE_PATH/.env" 2>/dev/null; then
        echo -e "${GREEN}✅ GitHub token already in worktree .env${NC}"
        # Validate it's not corrupted (e.g., missing newline causing concatenation)
        TOKEN_COUNT=$(grep -c "^GITHUB_TOKEN=" "$WORKTREE_PATH/.env")
        if [ "$TOKEN_COUNT" -gt 1 ]; then
            echo -e "${YELLOW}⚠️  Multiple GITHUB_TOKEN entries detected. Cleaning up...${NC}"
            # Keep only the first valid entry
            FIRST_TOKEN=$(grep "^GITHUB_TOKEN=" "$WORKTREE_PATH/.env" | head -1)
            # Remove all GITHUB_TOKEN lines
            grep -v "^GITHUB_TOKEN=" "$WORKTREE_PATH/.env" > "$WORKTREE_PATH/.env.tmp"
            mv "$WORKTREE_PATH/.env.tmp" "$WORKTREE_PATH/.env"
            # Add back the first token
            append_to_env "$WORKTREE_PATH/.env" ""
            append_to_env "$WORKTREE_PATH/.env" "# GitHub token for PR creation"
            append_to_env "$WORKTREE_PATH/.env" "$FIRST_TOKEN"
            echo -e "${GREEN}✅ Cleaned up duplicate entries${NC}"
        fi
    else
        # Use token from .env, environment, or global git config
        if [ -n "$GITHUB_TOKEN_FROM_ENV" ]; then
            echo -e "${GREEN}✅ Found GitHub token in .env file${NC}"
            # Append to .env properly
            append_to_env "$WORKTREE_PATH/.env" ""
            append_to_env "$WORKTREE_PATH/.env" "# GitHub token for PR creation"
            append_to_env "$WORKTREE_PATH/.env" "GITHUB_TOKEN=$GITHUB_TOKEN_FROM_ENV"
        elif [ -n "$GITHUB_TOKEN" ]; then
            echo -e "${GREEN}✅ Using GitHub token from environment${NC}"
            # Save it to worktree .env for persistence
            append_to_env "$WORKTREE_PATH/.env" ""
            append_to_env "$WORKTREE_PATH/.env" "# GitHub token for PR creation"
            append_to_env "$WORKTREE_PATH/.env" "GITHUB_TOKEN=$GITHUB_TOKEN"
        else
            # Try to get from git config
            GIT_TOKEN=$(git config --global github.token || true)
            if [ -n "$GIT_TOKEN" ]; then
                echo -e "${GREEN}✅ Found GitHub token in git config${NC}"
                append_to_env "$WORKTREE_PATH/.env" ""
                append_to_env "$WORKTREE_PATH/.env" "# GitHub token for PR creation"
                append_to_env "$WORKTREE_PATH/.env" "GITHUB_TOKEN=$GIT_TOKEN"
            else
                echo -e "${YELLOW}⚠️  No GitHub token found. You may need to set it for PR creation:${NC}"
                echo -e "${YELLOW}   export GITHUB_TOKEN=your_github_token${NC}"
                echo -e "${YELLOW}   Or add it to your .env file as GITHUB_TOKEN=your_token${NC}"
            fi
        fi
    fi
    
    # Validate .env file integrity
    if [ -f "$WORKTREE_PATH/.env" ]; then
        # Check for basic syntax errors
        if ! bash -c "set -a; source '$WORKTREE_PATH/.env' 2>/dev/null; set +a"; then
            echo -e "${YELLOW}⚠️  Warning: .env file may have syntax errors${NC}"
        else
            # Verify GitHub token is accessible
            if bash -c "set -a; source '$WORKTREE_PATH/.env' 2>/dev/null; set +a; [ -n \"\$GITHUB_TOKEN\" ]"; then
                echo -e "${GREEN}✅ .env file validated successfully${NC}"
            else
                echo -e "${YELLOW}⚠️  GitHub token not accessible from .env${NC}"
            fi
        fi
    fi
    
    # Automatically update issue status to In Progress
    echo -e "${YELLOW}Updating ${ISSUE_IDENTIFIER} to 'In Progress'...${NC}"
    UPDATE_RESPONSE=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"huly_update_issue\",
                \"arguments\": {
                    \"issue_identifier\": \"${ISSUE_IDENTIFIER}\",
                    \"field\": \"status\",
                    \"value\": \"in-progress\"
                }
            },
            \"id\": 1
        }")
    
    if echo "$UPDATE_RESPONSE" | grep -q "\"result\""; then
        echo -e "${GREEN}✅ Updated ${ISSUE_IDENTIFIER} to 'In Progress'${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to update status automatically${NC}"
        echo -e "${YELLOW}   Please update ${ISSUE_IDENTIFIER} to 'In Progress' manually${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. cd $WORKTREE_PATH"
    echo "2. Start developing!"
    echo ""
    echo "Workflow reminders:"
    echo "- Commit messages: Use 'Progresses HULLY-${ISSUE_NUMBER}' or 'Fixes HULLY-${ISSUE_NUMBER}'"
    echo "- Create PR: Run ./scripts/create-pr.sh (auto-updates to 'In Review')"
    echo "- After merge: Status auto-updates to 'Done' via git hook"
    echo ""
    echo "Useful commands:"
    echo "- Check conflicts: ./scripts/check-conflicts.sh"
    echo "- Validate before PR: ./scripts/validate-merge.sh"
    echo "- Test locally: npm test or ./scripts/test-stdio.sh"
else
    echo -e "${RED}❌ Failed to create worktree${NC}"
    exit 1
fi