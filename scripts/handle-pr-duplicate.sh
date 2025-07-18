#!/bin/bash

# Handle PR Duplicate Script
# When GitHub creates a duplicate issue from PR, this script:
# 1. Transfers metadata from original to duplicate
# 2. Closes the original issue
# 3. Updates duplicate with proper description

# Usage: ./scripts/handle-pr-duplicate.sh <original-issue-number>

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: $0 <original-issue-number>${NC}"
    echo "   Example: $0 59"
    exit 1
fi

ORIGINAL_ISSUE="HULLY-$1"
MCP_SERVER_URL="http://localhost:3457"

echo -e "${YELLOW}Handling duplicate issue for ${ORIGINAL_ISSUE}...${NC}"

# Step 1: Find the duplicate issue (should be the next number or have the PR title)
echo -e "${YELLOW}Finding duplicate issue...${NC}"

# Get list of recent issues to find the duplicate
RECENT_ISSUES=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "huly_list_issues",
            "arguments": {
                "project_identifier": "HULLY",
                "limit": 10
            }
        },
        "id": 1
    }' | jq -r '.result.content[0].text')

# Look for issue with [HULLY-XX] in title
DUPLICATE_PATTERN="\[${ORIGINAL_ISSUE}\]"
DUPLICATE_INFO=$(echo "$RECENT_ISSUES" | grep -B2 -A2 "$DUPLICATE_PATTERN" | head -5)

if [ -z "$DUPLICATE_INFO" ]; then
    echo -e "${RED}❌ No duplicate issue found with pattern ${DUPLICATE_PATTERN}${NC}"
    exit 1
fi

# Extract duplicate issue number
DUPLICATE_ISSUE=$(echo "$DUPLICATE_INFO" | grep -oE "HULLY-[0-9]+" | head -1)

if [ -z "$DUPLICATE_ISSUE" ]; then
    echo -e "${RED}❌ Could not extract duplicate issue number${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found duplicate issue: ${DUPLICATE_ISSUE}${NC}"

# Step 2: Get original issue details
echo -e "${YELLOW}Getting original issue details...${NC}"

ORIGINAL_DETAILS=$(curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"huly_search_issues\",
            \"arguments\": {
                \"query\": \"${ORIGINAL_ISSUE}\",
                \"project_identifier\": \"HULLY\"
            }
        },
        \"id\": 1
    }")

# Extract component and milestone (this is simplified - in reality would need proper parsing)
echo "$ORIGINAL_DETAILS" > /tmp/original_issue.json

# Step 3: Update duplicate with original's metadata
echo -e "${YELLOW}Transferring metadata to duplicate...${NC}"

# Update description
ORIGINAL_DESC="Originally tracked as ${ORIGINAL_ISSUE}. This issue was auto-created by GitHub PR integration."

curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"huly_update_issue\",
            \"arguments\": {
                \"issue_identifier\": \"${DUPLICATE_ISSUE}\",
                \"field\": \"description\",
                \"value\": \"${ORIGINAL_DESC}\"
            }
        },
        \"id\": 1
    }" > /dev/null

# Transfer component if exists
COMPONENT=$(echo "$ORIGINAL_DETAILS" | grep -oE "Component: [^,\n]+" | cut -d' ' -f2-)
if [ -n "$COMPONENT" ]; then
    echo -e "${YELLOW}Transferring component: ${COMPONENT}${NC}"
    curl -s -X POST "${MCP_SERVER_URL}/mcp" \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"huly_update_issue\",
                \"arguments\": {
                    \"issue_identifier\": \"${DUPLICATE_ISSUE}\",
                    \"field\": \"component\",
                    \"value\": \"${COMPONENT}\"
                }
            },
            \"id\": 1
        }" > /dev/null
fi

# Step 4: Close original issue
echo -e "${YELLOW}Closing original issue ${ORIGINAL_ISSUE}...${NC}"

curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"huly_update_issue\",
            \"arguments\": {
                \"issue_identifier\": \"${ORIGINAL_ISSUE}\",
                \"field\": \"status\",
                \"value\": \"canceled\"
            }
        },
        \"id\": 1
    }" > /dev/null

# Step 5: Update duplicate status to in-progress
echo -e "${YELLOW}Setting duplicate to in-progress...${NC}"

curl -s -X POST "${MCP_SERVER_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"tools/call\",
        \"params\": {
            \"name\": \"huly_update_issue\",
            \"arguments\": {
                \"issue_identifier\": \"${DUPLICATE_ISSUE}\",
                \"field\": \"status\",
                \"value\": \"in-progress\"
            }
        },
        \"id\": 1
    }" > /dev/null

echo -e "${GREEN}✅ Successfully handled duplicate issue!${NC}"
echo ""
echo "Summary:"
echo "- Original issue ${ORIGINAL_ISSUE}: Canceled"
echo "- Duplicate issue ${DUPLICATE_ISSUE}: Now active with metadata"
echo ""
echo "The PR will now track ${DUPLICATE_ISSUE} instead of ${ORIGINAL_ISSUE}"