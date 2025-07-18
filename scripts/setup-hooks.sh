#!/bin/bash

# Git Hooks Setup Script
# Sets up Git hooks for automatic Huly issue status updates

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts"

# Ensure we're in the repository root
if [ ! -d ".git" ]; then
    echo "Error: Not in a git repository"
    exit 1
fi

echo "Setting up Git hooks for Huly integration..."

# Create post-checkout hook
cat > "$HOOKS_DIR/post-checkout" << 'EOF'
#!/bin/bash

# Post-checkout hook - Updates Huly issue status when switching to feature branch

# Get the new branch name
NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if it's a feature branch with Huly issue
if [[ $NEW_BRANCH =~ ^(feature|bugfix|hotfix)\/HULLY-([0-9]+) ]]; then
    ISSUE_NUMBER=${BASH_REMATCH[2]}
    
    # Only update if this is a new branch (not switching between existing branches)
    if [ "$3" = "1" ]; then  # $3 is 1 for branch checkout, 0 for file checkout
        echo "📋 Detected work on HULLY-${ISSUE_NUMBER}"
        echo "⏳ Updating issue status to 'In Progress'..."
        
        # Update Huly issue status
        if [ -f "scripts/huly-update-issue.sh" ]; then
            ./scripts/huly-update-issue.sh "$ISSUE_NUMBER" "in-progress"
        fi
    fi
fi
EOF

# Create prepare-commit-msg hook
cat > "$HOOKS_DIR/prepare-commit-msg" << 'EOF'
#!/bin/bash

# Prepare commit message hook - Adds Huly issue reference to commit messages

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Get current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if it's a feature branch with Huly issue
if [[ $BRANCH =~ ^(feature|bugfix|hotfix)\/HULLY-([0-9]+) ]]; then
    ISSUE_NUMBER=${BASH_REMATCH[2]}
    
    # Only add reference if commit message doesn't already contain it
    if ! grep -q "HULLY-${ISSUE_NUMBER}" "$COMMIT_MSG_FILE"; then
        # Add issue reference to commit message
        echo "" >> "$COMMIT_MSG_FILE"
        echo "Progresses HULLY-${ISSUE_NUMBER}" >> "$COMMIT_MSG_FILE"
    fi
fi
EOF

# Create post-merge hook
cat > "$HOOKS_DIR/post-merge" << 'EOF'
#!/bin/bash

# Post-merge hook - Updates Huly issue status when PR is merged

# Get the merged branch name from the merge commit
MERGE_COMMIT=$(git log --merges -1 --pretty=format:"%s")

# Check if it's a merge of a feature branch
if [[ $MERGE_COMMIT =~ HULLY-([0-9]+) ]]; then
    ISSUE_NUMBER=${BASH_REMATCH[1]}
    
    echo "📋 Detected merge of HULLY-${ISSUE_NUMBER}"
    echo "✅ Updating issue status to 'Done'..."
    
    # Update Huly issue status
    if [ -f "scripts/huly-update-issue.sh" ]; then
        ./scripts/huly-update-issue.sh "$ISSUE_NUMBER" "done"
    fi
fi
EOF

# Make hooks executable
chmod +x "$HOOKS_DIR/post-checkout"
chmod +x "$HOOKS_DIR/prepare-commit-msg"
chmod +x "$HOOKS_DIR/post-merge"

echo "✅ Git hooks installed successfully!"
echo ""
echo "Installed hooks:"
echo "- post-checkout: Updates issue to 'In Progress' when switching to feature branch"
echo "- prepare-commit-msg: Adds 'Progresses HULLY-XX' to commit messages"
echo "- post-merge: Updates issue to 'Done' when feature branch is merged"
echo ""
echo "These hooks will automatically:"
echo "1. Update Huly issue status when you start working (checkout feature branch)"
echo "2. Add issue references to your commit messages"
echo "3. Mark issues as done when PRs are merged"