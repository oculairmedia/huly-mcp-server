#!/bin/bash

# Huly Issue Status Update Script
# Updates Huly issue status via MCP server
# Usage: ./scripts/huly-update-issue.sh <issue-number> <status> [project]

# Configuration
MCP_SERVER_URL="http://localhost:3457"
DEFAULT_PROJECT="HULLY"

# Check if required arguments are provided
if [ $# -lt 2 ]; then
    echo "Usage: $0 <issue-number> <status> [project]"
    echo "Statuses: backlog, active, in-progress, in-review, done"
    echo "Example: $0 8 in-progress"
    exit 1
fi

ISSUE_NUMBER=$1
STATUS=$2
PROJECT=${3:-$DEFAULT_PROJECT}

# Map friendly status names to Huly status IDs
case $STATUS in
    "backlog")
        HULY_STATUS="tracker:status:Backlog"
        ;;
    "todo")
        HULY_STATUS="tracker:status:Todo"
        ;;
    "active"|"in-progress"|"progress"|"in-review"|"review")
        HULY_STATUS="tracker:status:InProgress"
        ;;
    "done"|"completed")
        HULY_STATUS="tracker:status:Done"
        ;;
    "canceled"|"cancelled")
        HULY_STATUS="tracker:status:Canceled"
        ;;
    *)
        echo "Invalid status: $STATUS"
        echo "Valid statuses: backlog, todo, in-progress, in-review, done, canceled"
        exit 1
        ;;
esac

ISSUE_IDENTIFIER="${PROJECT}-${ISSUE_NUMBER}"

echo "Updating ${ISSUE_IDENTIFIER} status to: ${STATUS}"

# Update issue status via MCP server
RESPONSE=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"huly_update_issue\",
            \"arguments\": {
                \"issue_identifier\": \"${ISSUE_IDENTIFIER}\",
                \"field\": \"status\",
                \"value\": \"${HULY_STATUS}\"
            }
        },
        \"id\": 1
    }")

# Check if request was successful
if echo "$RESPONSE" | grep -q "\"result\""; then
    echo "✅ Successfully updated ${ISSUE_IDENTIFIER} to ${STATUS}"
else
    echo "❌ Failed to update ${ISSUE_IDENTIFIER}"
    echo "Response: $RESPONSE"
    exit 1
fi