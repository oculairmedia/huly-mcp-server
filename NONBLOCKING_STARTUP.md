# Non-Blocking MCP Server Startup

## Problem
The Huly MCP server was causing opencode to hang when added as an MCP server. This was due to blocking initialization during startup:

1. Config validation happened immediately on module load
2. Huly client connection was attempted during construction
3. Tool/resource/prompt loading blocked the stdio transport from starting

## Solution

### 1. Lazy Configuration Validation
- **File**: `src/config/ConfigManager.js`
- Changed from eager to lazy validation
- Validation now happens when `getHulyConfig()` is called (when actually needed)
- Allows server to start even if credentials aren't configured

### 2. Deferred Client Initialization  
- **File**: `index.js`
- Moved `createHulyClient()` from constructor to `initializeClientAndServices()`
- Client and services are initialized in background using `setImmediate()`
- **Handlers now register synchronously** so stdio/HTTP transports respond immediately
- MCP handler pulls services via lazy accessors; tool execution waits for client when needed
- Transport starts immediately, then initialization continues asynchronously

### 3. Lazy URL Generator
- **File**: `src/utils/urlGenerator.js`
- Changed URLGenerator to lazy-load config
- Uses getters to defer config access until actually needed
- Prevents module-load-time config validation

### 4. Background Initialization
The startup sequence is now:
1. Create server instance (no Huly connection)
2. Start transport (stdio/http) - **non-blocking**
3. Background: Initialize client and services
4. Background: Load tools, resources, prompts

## Testing

```bash
# Without credentials - should start transport successfully
node index.js --transport=stdio

# With credentials - should complete full initialization
HULY_EMAIL=user@example.com \
HULY_PASSWORD=password \
HULY_WORKSPACE=WORKSPACE \
node index.js --transport=stdio
```

## Benefits

1. **No Hanging**: MCP server starts immediately without blocking
2. **Works with opencode**: Can be added to opencode without causing hangs
3. **Graceful Degradation**: Server starts even if credentials are missing
4. **Background Loading**: Expensive initialization happens after transport is ready
5. **Lazy Validation**: Config is only validated when actually needed

## Related Files

- `index.js` - Main server startup logic
- `src/config/ConfigManager.js` - Lazy validation
- `src/utils/urlGenerator.js` - Lazy config loading
- `src/core/HulyClient.js` - Already had lazy connection (unchanged)
- `src/protocol/MCPHandler.js` - Already had lazy initialization (unchanged)
