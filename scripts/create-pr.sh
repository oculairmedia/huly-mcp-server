#!/bin/bash

# Create Pull Request Script
# Creates a PR and updates Huly issue status to "In Review"
# Usage: ./scripts/create-pr.sh [title] [body]

# Source .env file if it exists and GITHUB_TOKEN is not set
if [ -z "$GITHUB_TOKEN" ] && [ -f ".env" ]; then
    source .env 2>/dev/null || true
fi

# Get current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if we're on a feature branch
if [[ ! $BRANCH =~ ^(feature|bugfix|hotfix)\/HULLY-([0-9]+) ]]; then
    echo "❌ Not on a feature branch. Branch should match: <type>/HULLY-<number>-<description>"
    exit 1
fi

ISSUE_NUMBER=${BASH_REMATCH[2]}
BRANCH_TYPE=${BASH_REMATCH[1]}

# Extract description from branch name
if [[ $BRANCH =~ ^[^/]+\/HULLY-[0-9]+-(.+)$ ]]; then
    DESCRIPTION=${BASH_REMATCH[1]}
    DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/-/ /g' | sed 's/\b\w/\u&/g')
else
    DESCRIPTION="Update"
fi

# Default title and body
DEFAULT_TITLE="[HULLY-${ISSUE_NUMBER}] ${BRANCH_TYPE^}: ${DESCRIPTION}"
DEFAULT_BODY="Implements HULLY-${ISSUE_NUMBER}: ${DESCRIPTION}

## Changes
- TODO: List key changes made

## Testing
- TODO: Describe testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated as needed
- [ ] Documentation updated if needed

Closes HULLY-${ISSUE_NUMBER}"

# Use provided arguments or defaults
TITLE=${1:-$DEFAULT_TITLE}
BODY=${2:-$DEFAULT_BODY}

# Ensure title always has [HULLY-XX] prefix
if [[ ! "$TITLE" =~ ^\[HULLY-[0-9]+\] ]]; then
    TITLE="[HULLY-${ISSUE_NUMBER}] $TITLE"
fi

echo "Creating PR for HULLY-${ISSUE_NUMBER}..."
echo "Title: $TITLE"
echo ""

# Push current branch
echo "📤 Pushing branch to origin..."
git push -u origin "$BRANCH"

# Check if PR already exists for this branch
echo "📋 Checking for existing pull request..."
EXISTING_PR=$(gh pr list --head "$BRANCH" --json number,title --jq '.[0]' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ] && [ "$EXISTING_PR" != "null" ]; then
    PR_NUMBER=$(echo "$EXISTING_PR" | jq -r '.number')
    CURRENT_TITLE=$(echo "$EXISTING_PR" | jq -r '.title')
    
    echo "📋 Found existing PR #$PR_NUMBER: $CURRENT_TITLE"
    
    # Check if title needs [HULLY-XX] prefix
    if [[ ! "$CURRENT_TITLE" =~ ^\[HULLY-[0-9]+\] ]]; then
        echo "🔧 Updating PR title to include [HULLY-${ISSUE_NUMBER}] prefix..."
        gh pr edit "$PR_NUMBER" --title "$TITLE"
        echo "✅ PR title updated to: $TITLE"
    else
        echo "✅ PR already has correct title format"
    fi
else
    # Create new PR
    echo "📋 Creating pull request..."
    gh pr create --title "$TITLE" --body "$BODY"
fi

if [ $? -eq 0 ]; then
    echo "✅ Pull request created successfully!"
    echo ""
    echo "📋 Updating HULY-${ISSUE_NUMBER} status to 'In Review'..."
    
    # Update Huly issue status
    if [ -f "scripts/huly-update-issue.sh" ]; then
        ./scripts/huly-update-issue.sh "$ISSUE_NUMBER" "in-review"
    fi
    
    echo ""
    echo "🎉 Workflow complete!"
    echo "- PR created and ready for review"
    echo "- Huly issue updated to 'In Review'"
    echo "- Issue will be automatically marked 'Done' when PR is merged"
    
    # Check for duplicate issue creation
    echo ""
    echo "📋 Checking for duplicate issue..."
    sleep 3  # Give GitHub webhook time to create duplicate
    
    # Look for duplicate with our PR title pattern
    DUPLICATE_CHECK=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"huly_list_issues\",
                \"arguments\": {
                    \"project_identifier\": \"HULLY\",
                    \"limit\": 5
                }
            },
            \"id\": 1
        }" | jq -r '.result.content[0].text' | grep "\[HULLY-${ISSUE_NUMBER}\]" || true)
    
    if [ -n "$DUPLICATE_CHECK" ]; then
        echo "⚠️  Duplicate issue detected! Running cleanup..."
        # Get the directory of this script
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        "${SCRIPT_DIR}/handle-pr-duplicate.sh" "${ISSUE_NUMBER}"
    else
        echo "⏳ Waiting for potential duplicate creation..."
        sleep 8  # Give more time for webhook
        
        # Check again
        DUPLICATE_CHECK=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
            -H "Content-Type: application/json" \
            -d "{
                \"jsonrpc\": \"2.0\",
                \"method\": \"tools/call\",
                \"params\": {
                    \"name\": \"huly_list_issues\",
                    \"arguments\": {
                        \"project_identifier\": \"HULLY\",
                        \"limit\": 5
                    }
                },
                \"id\": 1
            }" | jq -r '.result.content[0].text' | grep "\[HULLY-${ISSUE_NUMBER}\]" || true)
        
        if [ -n "$DUPLICATE_CHECK" ]; then
            echo "⚠️  Duplicate issue detected on second check! Running cleanup..."
            "${SCRIPT_DIR}/handle-pr-duplicate.sh" "${ISSUE_NUMBER}"
        else
            echo "✅ No duplicate issue created"
        fi
    fi
else
    echo "❌ Failed to create pull request"
    exit 1
fi