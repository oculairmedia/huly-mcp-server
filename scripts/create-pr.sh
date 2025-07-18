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

echo "Creating PR for HULLY-${ISSUE_NUMBER}..."
echo "Title: $TITLE"
echo ""

# Push current branch
echo "📤 Pushing branch to origin..."
git push -u origin "$BRANCH"

# Create PR using GitHub CLI
echo "📋 Creating pull request..."
gh pr create --title "$TITLE" --body "$BODY"

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
else
    echo "❌ Failed to create pull request"
    exit 1
fi