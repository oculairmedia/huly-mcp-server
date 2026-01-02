# Huly MCP Timeout Diagnostic

**Date:** 2025-10-11  
**Issue:** All operations timing out or returning "Connection closed" errors  
**Status:** INVESTIGATING

## Symptoms

1. ✅ **Issue Creation (HULLY-15):** SUCCESS
2. ❌ **Issue Update:** TIMEOUT after 60s
3. ❌ **Comment Creation (short):** Connection closed
4. ❌ **Comment Creation (long):** Connection closed

## Evidence

### Server Status
```json
{
  "status": "healthy",
  "sessions": 16,
  "uptime": 507s
}
```

### Timeout Configuration
- Server timeout: 60s (increased from 30s)
- Git timeout: 5s
- Container: healthy, 6 processes

### Error Patterns

**Error 1: Request timed out**
```
MCP error -32001: Request timed out
```
- Occurs after ~60 seconds
- Suggests operation exceeds timeout

**Error 2: Connection closed**
```
MCP error -32000: Connection closed
```
- Occurs on short operations
- Suggests connection dropping mid-operation

## Root Cause Analysis

### Theory 1: Huly API Slowness ❓
- The Huly API itself may be slow
- Operations like `createComment` involve multiple steps:
  1. `findOne` - find the issue
  2. `addCollection` - add comment
  3. `updateDoc` - update comment count
- Each step may be slow

### Theory 2: Client-Side Timeout ✅ LIKELY
- OpenCode/Roo may have their own timeout
- Even if server timeout is 60s, client may timeout at 30s
- This explains "Connection closed" - client drops connection

### Theory 3: Connection Pool Exhaustion ❓
- 16 active sessions may indicate stale connections
- Connections not being properly cleaned up
- New requests can't get a connection

### Theory 4: MCP Streaming Issue ✅ LIKELY
- MCP uses Server-Sent Events (SSE) for responses
- SSE streams may not be handled properly by client
- Connection appears closed when it's actually waiting

## Investigation Steps

### 1. Check if operation actually completes

The issue creation (HULLY-15) DID succeed. We need to check if:
- The update actually completed (check Huly UI)
- Comments were actually created (check Huly UI)

If they completed, the issue is response streaming, not the operation.

### 2. Check client timeout

OpenCode/Roo likely has a hardcoded timeout. Need to:
- Check Roo's source code for timeout settings
- Look for MCP client timeout configuration
- Consider using a different MCP client for testing

### 3. Test with direct MCP client

Use a simple MCP client with no timeout to test:
```bash
# Direct HTTP test (bypasses MCP SDK)
curl -X POST http://localhost:3457/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",...}'
```

### 4. Check Huly API directly

Test if Huly API is slow:
```bash
# Time a simple query
time curl -s https://pm.oculair.ca/...
```

## Recommendations

### Immediate: Accept Limitations
- ✅ Issue creation works - use for creating issues
- ❌ Updates/comments timeout - do manually in Huly UI
- Document this limitation

### Short-term: Workarounds
1. **Split operations:** Create issue, then manually add details
2. **Use REST API:** If REST endpoint doesn't timeout
3. **Batch operations:** Combine multiple updates into one

### Long-term: Fixes
1. **Increase client timeout:** Configure Roo/OpenCode
2. **Async operations:** Return immediately, poll for completion
3. **Chunked responses:** Stream progress updates
4. **Connection pooling:** Properly manage Huly client connections

## Current Status

**WORKAROUND IN PLACE:**
- Server timeout increased to 60s
- Issue creation confirmed working
- Updates/comments known to timeout

**NEXT STEPS:**
1. Verify if operations actually complete (check Huly UI)
2. If they complete, issue is client timeout, not operation
3. Document limitation and recommend manual operations for updates

## Conclusion

The Huly MCP server is functional for simple operations (create issue) but complex/multi-step operations (update, comment) exceed client timeout limits. This is likely a **client-side timeout issue**, not a server problem.

**Action:** Document this limitation and recommend:
- Use MCP for issue creation
- Use Huly UI for updates and comments
- Consider async operation patterns for future improvements
