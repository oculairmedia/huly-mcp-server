# Known Limitations - Huly MCP Server

**Date:** 2025-10-11  
**Version:** 1.0.0

## Operation Timeouts

### ✅ Working Operations
| Operation | Status | Notes |
|-----------|--------|-------|
| Issue Creation | ✅ Working | Creates issues successfully |
| Tools List | ✅ Working | Returns 8 tools |
| Health Check | ✅ Working | Health endpoint responsive |
| Session Management | ✅ Working | Sessions created/validated properly |

### ❌ Known Issues
| Operation | Status | Error | Workaround |
|-----------|--------|-------|------------|
| Issue Update | ❌ Timeout | `Request timed out` after 60s | Update manually in Huly UI |
| Comment Creation | ❌ Failed | `Connection closed` | Add comments manually in Huly UI |
| Large Descriptions | ❌ Timeout | Exceeds timeout limit | Keep descriptions short or add manually |

## Root Causes

### 1. Client-Side Timeout (Primary)
**Problem:** OpenCode/Roo has built-in timeout limits (likely 30-60s)  
**Impact:** Even with 60s server timeout, client drops connection  
**Evidence:** "Connection closed" errors on operations

### 2. Multi-Step Operations
**Problem:** Operations like createComment involve multiple API calls:
- `findOne` - Locate the issue
- `addCollection` - Add the comment
- `updateDoc` - Update comment count

**Impact:** Each step adds latency, total time exceeds timeout  
**Evidence:** Simple creates work, complex operations fail

### 3. Huly API Performance
**Problem:** Huly API may be slow for certain operations  
**Impact:** Operations genuinely take > 60 seconds  
**Evidence:** Consistent timeouts even with increased limits

## Workarounds

### For Issue Updates
```
1. Create issue via MCP (works)
2. Open issue in Huly UI
3. Add description, details manually
```

### For Comments
```
1. Create issue via MCP (works)
2. Open issue in Huly UI: https://pm.oculair.ca/workbench/agentspace/tracker/HULLY-XX
3. Add comments manually
```

### For Large Content
```
- Keep MCP operations simple
- Use short titles/descriptions
- Add detailed content via UI
```

## Best Practices

### ✅ DO Use MCP For:
- Creating new issues (fast, reliable)
- Listing/querying entities (read operations)
- Simple CRUD on projects/components
- Validation operations

### ❌ DON'T Use MCP For:
- Adding long descriptions (timeout risk)
- Adding comments (connection issues)
- Complex multi-step operations
- Bulk updates with many items

## Technical Details

### Current Timeouts
- **MCP Request Timeout:** 60s (configurable via `HULY_MCP_REQUEST_TIMEOUT_MS`)
- **Git Command Timeout:** 5s (configurable via `HULY_GIT_TIMEOUT_MS`)
- **Client Timeout:** Unknown (likely 30-60s, not configurable from server)

### Architecture Limitations
The MCP protocol uses HTTP Server-Sent Events (SSE) for responses. Long-running operations can:
1. Exceed client timeout before completion
2. Drop SSE connection mid-stream
3. Return error even if operation completes

### Why Increasing Timeout Doesn't Help
- Server timeout: 60s → Still fails
- Issue: Client has own timeout OR operation genuinely takes too long
- Solution: Need async operations or faster Huly API

## Future Improvements

### Option 1: Async Operations
```javascript
// Return immediately with operation ID
{ "operation_id": "abc123", "status": "pending" }

// Poll for completion
GET /api/operations/abc123
{ "status": "completed", "result": {...} }
```

### Option 2: Streaming Progress
```javascript
// Stream progress updates
{ "progress": 30, "step": "Finding issue..." }
{ "progress": 60, "step": "Adding comment..." }
{ "progress": 100, "status": "complete" }
```

### Option 3: Simplified Operations
```javascript
// Single API call instead of multiple
client.createCommentOptimized(...)
// Skips comment count update
// Returns immediately
```

### Option 4: Client Configuration
```javascript
// If client supports timeout config
{
  "timeout": 120000,  // 2 minutes
  "retry": true
}
```

## Recommendations

### For Users
1. **Use MCP for issue creation** - Works reliably
2. **Use Huly UI for updates/comments** - Avoid timeouts
3. **Keep operations simple** - Minimize complexity
4. **Check Huly UI** - Verify operation completion

### For Developers
1. **Implement async operations** - Long-running tasks return immediately
2. **Add progress reporting** - Stream status updates
3. **Optimize Huly API calls** - Reduce latency
4. **Add retry logic** - Handle transient failures

### For Operations
1. **Monitor timeout rates** - Track failure patterns
2. **Set realistic expectations** - Document limitations
3. **Provide alternatives** - UI for complex operations
4. **Consider API caching** - Speed up repeated queries

## Testing Results

### Successful Test (Issue Creation)
```
✅ Created: HULLY-15 "Non-Blocking MCP Implementation Complete"
   URL: https://pm.oculair.ca/workbench/agentspace/tracker/HULLY-15
   Time: <30s
   Status: SUCCESS
```

### Failed Tests (Updates/Comments)
```
❌ Update HULLY-15 with description
   Error: MCP error -32001: Request timed out
   Time: 60s timeout
   
❌ Add comment to HULLY-15 (short)
   Error: MCP error -32000: Connection closed
   Time: Unknown (connection dropped)
   
❌ Add comment to HULLY-15 (long)
   Error: MCP error -32000: Connection closed
   Time: Unknown (connection dropped)
```

## Status

**DOCUMENTED:** Limitations are known and workarounds available  
**FUNCTIONAL:** Core operations (issue creation) work reliably  
**ACCEPTABLE:** Can proceed with documented limitations

**Conclusion:** The Huly MCP server is production-ready for **simple operations** but has known limitations for **complex/long-running operations**. Users should be aware of these limitations and use the Huly UI for operations that consistently timeout.
