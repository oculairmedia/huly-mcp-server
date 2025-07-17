#!/bin/bash
# Huly MCP Server startup script for stdio transport
# Configure environment variables before running

cd /opt/stacks/huly-selfhost/huly-mcp-server

# Set default values if not already set
export HULY_URL=${HULY_URL:-"https://your-huly-instance.com"}
export HULY_EMAIL=${HULY_EMAIL:-"your-email@example.com"}
export HULY_PASSWORD=${HULY_PASSWORD:-"your-password"}
export HULY_WORKSPACE=${HULY_WORKSPACE:-"your-workspace"}
export GITHUB_TOKEN=${GITHUB_TOKEN:-"your-github-token"}

# Check if environment variables are set
if [[ "$HULY_EMAIL" == "your-email@example.com" ]] || [[ "$HULY_PASSWORD" == "your-password" ]]; then
    echo "Error: Please set HULY_EMAIL and HULY_PASSWORD environment variables"
    echo "You can also copy .env.example to .env and configure your values"
    exit 1
fi

if [[ "$GITHUB_TOKEN" == "your-github-token" ]]; then
    echo "Warning: GITHUB_TOKEN not set. This may cause npm install failures"
fi

exec node index.js --transport=stdio