# Docker Build Authentication Fix

## Problem Summary
The Docker build fails when trying to install @hcengineering packages because:
1. The packages are hosted on GitHub's npm registry (not public npm)
2. They require authentication with a GitHub token that has `read:packages` scope
3. The token must have access to the hcengineering organization packages

## Root Cause
When credentials were moved from being hardcoded to using .env files for security, the Docker build process lost access to the required GitHub token during the `npm install` step.

## Current Status
- Our GitHub token (oculairmedia) doesn't have access to @hcengineering packages
- The packages are private to the hcengineering organization
- Even with `read:packages` scope, we need explicit access from hcengineering

## Solutions

### 1. Request Access (Recommended)
Contact the hcengineering team to:
- Request read access to their npm packages
- Or get added as a collaborator to the organization
- Join their Slack community: https://huly.link/slack

### 2. Use Pre-built Images
Since the original image was built successfully:
```bash
# Use the existing working image
docker pull hardcoreeng/huly-mcp:v0.6.500
```

### 3. Development Workaround
For development, use bind mounts to avoid rebuilds:
```yaml
volumes:
  - ./huly-mcp-server/index.js:/app/index.js:ro
```

### 4. Build from Cache
If you have a working container, extract node_modules:
```bash
docker cp huly-huly-mcp-1:/app/node_modules ./node_modules-backup
```

## Required Token Scopes
According to GitHub documentation, you need:
- `read:packages` - To read packages from GitHub Packages
- Organization access - Must be granted by hcengineering

## How to Fix When Access is Granted

1. Create a GitHub token with `read:packages` scope
2. Add to .env file:
   ```
   GITHUB_TOKEN=your_token_with_package_read_access
   ```
3. The docker-compose.yml already passes it as build arg
4. The Dockerfile is already configured to use it

## References
- [GitHub Packages npm registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token)
- [Huly Examples Repository](https://github.com/hcengineering/huly-examples)
- [Huly Community Slack](https://huly.link/slack)