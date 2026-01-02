# Huly MCP Server Connection Issue Analysis

**Date**: 2025-09-30  
**Status**: 🔴 Root Cause Identified  
**Issue**: Connection to Huly platform failing with JSON parse error

---

## 🐛 Problem Summary

The Huly MCP server is failing to connect to the Huly platform with the following error:

```
❌ Error [CONNECTION_ERROR]: Failed to connect to Huly platform
Context: Unexpected token 'I', "Internal S"... is not valid JSON
```

### Symptoms

1. **No connection logs appearing** - The `_attemptConnection()` method's console.log statements are not executing
2. **Error occurs inside `@hcengineering/api-client`** - Before control returns to our code
3. **JSON parse error** - Receiving HTML error page instead of JSON response
4. **Error from undici** - HTTP client library, indicating HTTP request failure

---

## 🔍 Root Cause Analysis

### The Problem: Incorrect URL Configuration

**Current Configuration** (WRONG ❌):
```yaml
# docker-compose.yml
huly-mcp:
  environment:
    - HULY_URL=http://account:3000  # ❌ This is the account service URL
```

**What Happens**:
1. `@hcengineering/api-client` receives `http://account:3000` as the base URL
2. It tries to load server configuration from `http://account:3000/config.json`
3. The account service doesn't serve `/config.json` - it returns an HTML error page
4. JSON parser fails with "Unexpected token 'I', "Internal S"..." (from "Internal Server Error")
5. Error is thrown before our `_attemptConnection()` code executes

### How @hcengineering/api-client Works

Based on the source code analysis:

```typescript
// From hully source/packages/api-client/src/client.ts
export async function connect (url: string, options: ConnectOptions): Promise<PlatformClient> {
  // Step 1: Load server configuration from /config.json
  const config = await loadServerConfig(url)  // ← FAILS HERE
  
  // Step 2: Get workspace token using ACCOUNTS_URL from config
  const { endpoint, token } = await getWorkspaceToken(url, options, config)
  
  // Step 3: Create account client
  const accountClient = getAccountClient(config.ACCOUNTS_URL, token)
  
  // Step 4: Select workspace
  const wsLoginInfo = await accountClient.selectWorkspace(options.workspace)
  
  // Step 5: Create platform client with WebSocket connection
  return await createClient(url, endpoint, token, wsLoginInfo.workspace, account, config, options)
}
```

```typescript
// From hully source/packages/api-client/src/config.ts
export async function loadServerConfig (url: string): Promise<ServerConfig> {
  const configUrl = concatLink(url, '/config.json')  // ← Constructs http://account:3000/config.json
  const res = await fetch(configUrl, { keepalive: true })
  if (res.ok) {
    return (await res.json()) as ServerConfig  // ← JSON parse fails here
  }
  throw new Error('Failed to fetch config')
}
```

### Expected Server Configuration

The `/config.json` endpoint should return:

```json
{
  "ACCOUNTS_URL": "http://account:3000",
  "COLLABORATOR_URL": "http://collaborator:3078",
  "FILES_URL": "/files",
  "UPLOAD_URL": "/upload"
}
```

This is typically served by the **front** service or **nginx** proxy, not the account service.

---

## ✅ Solution

### Option 1: Use Nginx Proxy URL (RECOMMENDED)

The nginx proxy serves the entire Huly application and should have `/config.json` available.

**Correct Configuration**:
```yaml
# docker-compose.yml
huly-mcp:
  environment:
    - HULY_URL=http://nginx  # ✅ Use nginx proxy (internal)
    # OR
    - HULY_URL=http://localhost:8101  # ✅ Use external URL
    # OR  
    - HULY_URL=https://pm.oculair.ca  # ✅ Use public URL
```

**Pros**:
- Matches how the official Huly client works
- Nginx handles routing to all services
- `/config.json` is available
- Works with external access

**Cons**:
- Requires nginx to be running
- Slightly more network hops

### Option 2: Use Front Service URL

The front service typically serves `/config.json`:

```yaml
huly-mcp:
  environment:
    - HULY_URL=http://front:8080  # ✅ Use front service
```

**Pros**:
- Direct connection to front service
- Fewer network hops than nginx

**Cons**:
- Front service must be running
- May not match production setup

### Option 3: Provide Custom Config (ADVANCED)

If you need to bypass the config loading:

```javascript
// Custom connection logic
import { loadServerConfig } from '@hcengineering/api-client/src/config.js';

// Manually provide config
const config = {
  ACCOUNTS_URL: 'http://account:3000',
  COLLABORATOR_URL: 'http://collaborator:3078',
  FILES_URL: '/files',
  UPLOAD_URL: '/upload'
};

// Then use connectRest or custom connection logic
```

**Pros**:
- Full control over configuration
- No dependency on `/config.json` endpoint

**Cons**:
- More complex code
- Harder to maintain
- May break with Huly updates

---

## 🔧 Recommended Fix

### Step 1: Update docker-compose.yml

```yaml
huly-mcp:
  environment:
    - NODE_ENV=production
    - PORT=3000
    - HULY_URL=http://nginx  # ✅ CHANGED: Use nginx proxy
    - HULY_PUBLIC_URL=${HULY_PUBLIC_URL:-https://pm.oculair.ca}
    - HULY_EMAIL=${HULY_MCP_EMAIL:-emanuvaderland@gmail.com}
    - HULY_PASSWORD=${HULY_MCP_PASSWORD:-k2a8yy7sFWVZ6eL}
    - HULY_WORKSPACE=${HULY_MCP_WORKSPACE:-agentspace}
```

### Step 2: Verify nginx serves /config.json

Check that nginx is configured to serve `/config.json`:

```bash
# Test from within the huly-mcp container
curl http://nginx/config.json

# Expected response:
# {
#   "ACCOUNTS_URL": "...",
#   "COLLABORATOR_URL": "...",
#   "FILES_URL": "...",
#   "UPLOAD_URL": "..."
# }
```

### Step 3: Restart the MCP server

```bash
docker-compose restart huly-mcp
docker-compose logs -f huly-mcp
```

### Step 4: Verify connection

You should now see the connection logs:

```
[HULY-CLIENT] ========================================
[HULY-CLIENT] _attemptConnection START
[HULY-CLIENT] Config URL: http://nginx
[HULY-CLIENT] Config email: emanuvaderland@gmail.com
[HULY-CLIENT] Config workspace: agentspace
[HULY-CLIENT] ========================================
[HULY-CLIENT] About to call connect() from @hcengineering/api-client
[HULY-CLIENT] WebSocket connecting to: ws://transactor:3333
```

---

## 📚 Reference: Official Examples

### From @hcengineering/api-client README

```typescript
import { connect } from '@hcengineering/api-client'

// Connect to Huly Cloud
const client = await connect('https://huly.app', {
  email: 'johndoe@example.com',
  password: 'password',
  workspace: 'my-workspace',
})

// Connect to self-hosted instance
const client = await connect('http://localhost:8080', {
  email: 'admin@example.com',
  password: 'password',
  workspace: 'default',
})
```

**Key Point**: The URL is always the **base URL** of the Huly instance, not a specific service URL.

### From Huly Comprehensive MCP Guide

```typescript
// WebSocket Connection
const client = await connect('https://huly.app', {
  email: 'user@example.com',
  password: 'password',
  workspace: 'my-workspace'
})
```

---

## 🧪 Testing the Fix

### Test 1: Verify /config.json is accessible

```bash
# From host machine
curl http://localhost:8101/config.json

# From within huly-mcp container
docker-compose exec huly-mcp curl http://nginx/config.json
```

### Test 2: Check MCP server logs

```bash
docker-compose logs -f huly-mcp | grep "HULY-CLIENT"
```

Expected output:
```
[HULY-CLIENT] ========================================
[HULY-CLIENT] _attemptConnection START
[HULY-CLIENT] Config URL: http://nginx
...
```

### Test 3: Test MCP tool execution

```bash
# Test list projects tool
curl -X POST http://localhost:3457/api/tools/huly_list_projects \
  -H "Content-Type: application/json" \
  -d '{"arguments": {}}'
```

---

## 🎯 Summary

**Problem**: Using `HULY_URL=http://account:3000` (account service URL)  
**Solution**: Use `HULY_URL=http://nginx` (base URL with /config.json)  
**Reason**: `@hcengineering/api-client` expects a base URL that serves `/config.json`

This is a configuration issue, not a code issue. The MCP server code is correct; it just needs the right URL.

---

## 📝 Additional Notes

### Why the logs weren't showing

The error occurred in `loadServerConfig()` which is called **before** our `_attemptConnection()` method's code executes:

```javascript
// Our code in HulyClient.js
async _attemptConnection() {
  console.log('[HULY-CLIENT] _attemptConnection START');  // ← Never reached
  
  const client = await connect(this.config.url, {  // ← Error thrown here
    email: this.config.email,
    password: this.config.password,
    workspace: this.config.workspace,
  });
}
```

The `connect()` function throws an error during `loadServerConfig()` before returning control to our code.

### Alternative: Check if front serves /config.json

If nginx doesn't serve `/config.json`, check the front service:

```bash
docker-compose exec huly-mcp curl http://front:8080/config.json
```

If front serves it, use `HULY_URL=http://front:8080` instead.

