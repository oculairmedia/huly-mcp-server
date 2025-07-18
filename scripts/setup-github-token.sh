#!/bin/bash

# Setup GitHub Token Script
# Helps configure GitHub token for workflow tools
# Usage: ./scripts/setup-github-token.sh [token]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "GitHub Token Setup for Huly Workflow Tools"
echo "=========================================="
echo ""

# Check if token was provided as argument
if [ -n "$1" ]; then
    TOKEN="$1"
else
    # Check current token sources
    echo "Checking for existing GitHub token..."
    
    # Check environment
    if [ -n "$GITHUB_TOKEN" ]; then
        echo -e "${GREEN}✓ Found token in environment variable${NC}"
        echo "  Current token: ${GITHUB_TOKEN:0:20}...${GITHUB_TOKEN: -4}"
    fi
    
    # Check .env file
    if [ -f ".env" ]; then
        ENV_TOKEN=$(grep -E "^GITHUB_TOKEN=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
        if [ -n "$ENV_TOKEN" ]; then
            echo -e "${GREEN}✓ Found token in .env file${NC}"
            echo "  Current token: ${ENV_TOKEN:0:20}...${ENV_TOKEN: -4}"
        fi
    fi
    
    # Check git config
    GIT_TOKEN=$(git config --global github.token 2>/dev/null || true)
    if [ -n "$GIT_TOKEN" ]; then
        echo -e "${GREEN}✓ Found token in git config${NC}"
        echo "  Current token: ${GIT_TOKEN:0:20}...${GIT_TOKEN: -4}"
    fi
    
    echo ""
    echo "Enter your GitHub Personal Access Token"
    echo "(Create one at: https://github.com/settings/tokens)"
    echo "Required scopes: repo, workflow"
    echo ""
    read -p "GitHub Token: " -s TOKEN
    echo ""
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ No token provided${NC}"
    exit 1
fi

# Validate token format
if [[ ! $TOKEN =~ ^gh[ps]_[a-zA-Z0-9]{36,}$ ]]; then
    echo -e "${YELLOW}⚠️  Warning: Token doesn't match expected GitHub format${NC}"
    echo "   Expected format: ghp_... or ghs_..."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Where would you like to store the token?"
echo "1) .env file (recommended for this project)"
echo "2) Git config (global for all projects)"
echo "3) Both .env and git config"
echo "4) Show manual setup instructions"
echo ""
read -p "Choice (1-4): " CHOICE

case $CHOICE in
    1)
        # Add to .env file
        if [ -f ".env" ]; then
            # Remove existing token if present
            grep -v "^GITHUB_TOKEN=" .env > .env.tmp || true
            mv .env.tmp .env
        fi
        echo "" >> .env
        echo "# GitHub token for PR creation and npm packages" >> .env
        echo "GITHUB_TOKEN=$TOKEN" >> .env
        echo -e "${GREEN}✅ Token saved to .env file${NC}"
        ;;
    2)
        # Add to git config
        git config --global github.token "$TOKEN"
        echo -e "${GREEN}✅ Token saved to global git config${NC}"
        ;;
    3)
        # Add to both
        if [ -f ".env" ]; then
            grep -v "^GITHUB_TOKEN=" .env > .env.tmp || true
            mv .env.tmp .env
        fi
        echo "" >> .env
        echo "# GitHub token for PR creation and npm packages" >> .env
        echo "GITHUB_TOKEN=$TOKEN" >> .env
        git config --global github.token "$TOKEN"
        echo -e "${GREEN}✅ Token saved to both .env file and git config${NC}"
        ;;
    4)
        echo ""
        echo "Manual Setup Instructions:"
        echo "========================="
        echo ""
        echo "Option 1: Add to .env file"
        echo "  echo 'GITHUB_TOKEN=$TOKEN' >> .env"
        echo ""
        echo "Option 2: Add to git config"
        echo "  git config --global github.token $TOKEN"
        echo ""
        echo "Option 3: Export in shell (temporary)"
        echo "  export GITHUB_TOKEN=$TOKEN"
        echo ""
        echo "Option 4: Add to shell profile (permanent)"
        echo "  echo 'export GITHUB_TOKEN=$TOKEN' >> ~/.bashrc"
        echo ""
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ GitHub token setup complete!${NC}"
echo ""
echo "The token will be automatically used by:"
echo "- worktree-create.sh (copied to each worktree)"
echo "- create-pr.sh (for creating pull requests)"
echo "- npm install (for @hcengineering packages)"
echo ""
echo "Test your setup with:"
echo "  gh auth status"