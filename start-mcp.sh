#!/bin/bash
# Huly MCP Server startup script for stdio transport
# Configure environment variables before running

cd /opt/stacks/huly-selfhost/huly-mcp-server

# Load only the MCP-specific environment variables from parent .env file
if [ -f "../.env" ]; then
    export HULY_URL=$(grep "^HOST_ADDRESS=" "../.env" | cut -d'=' -f2 | sed 's/^/https:\/\//')
    export HULY_EMAIL=$(grep "^HULY_MCP_EMAIL=" "../.env" | cut -d'=' -f2)
    export HULY_PASSWORD=$(grep "^HULY_MCP_PASSWORD=" "../.env" | cut -d'=' -f2)
    export HULY_WORKSPACE=$(grep "^HULY_MCP_WORKSPACE=" "../.env" | cut -d'=' -f2)
    export GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=" "../.env" | cut -d'=' -f2)
fi

# Set defaults if not loaded from .env
export HULY_URL=${HULY_URL:-"https://pm.oculair.ca"}
export HULY_EMAIL=${HULY_EMAIL:-"your-email@example.com"}
export HULY_PASSWORD=${HULY_PASSWORD:-"your-password"}
export HULY_WORKSPACE=${HULY_WORKSPACE:-"your-workspace"}
export GITHUB_TOKEN=${GITHUB_TOKEN:-"your-github-token"}

# Check if environment variables are set
if [[ -z "$HULY_EMAIL" ]] || [[ -z "$HULY_PASSWORD" ]]; then
    echo "Error: Please set HULY_EMAIL and HULY_PASSWORD environment variables"
    echo "You can also copy .env.example to .env and configure your values"
    exit 1
fi

if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "Warning: GITHUB_TOKEN not set. This may cause npm install failures"
fi

exec node index.js --transport=stdio