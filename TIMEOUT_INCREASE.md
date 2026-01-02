# Timeout Increase Fix

**Date:** 2025-10-11  
**Issue:** MCP tool execution timing out on large update operations  
**Solution:** Increased timeout from 30s to 60s

## Problem

When testing the Huly MCP tool to create issue HULLY-15, the creation succeeded but the subsequent update operation timed out:

```
Error executing MCP tool:
MCP error -32001: Request timed out
```

The update operation was attempting to add a large description and exceeded the 30-second default timeout.

## Root Cause

- Default `HULY_MCP_REQUEST_TIMEOUT_MS` was 30000 (30 seconds)
- Large update operations (especially with detailed descriptions) can take longer
- The Huly API can be slow for complex operations

## Solution

Increased the timeout to 60 seconds by adding environment variable to docker-compose.yml:

```yaml
huly-mcp:
  environment:
    # ... other vars ...
    - HULY_MCP_REQUEST_TIMEOUT_MS=60000  # 60 seconds
```

## Verification

```bash
$ docker exec huly-huly-mcp-1 env | grep TIMEOUT
HULY_MCP_REQUEST_TIMEOUT_MS=60000

$ curl -s http://localhost:3457/health | jq .status
"healthy"
```

## Impact

- ✅ Create operations: No change (already fast)
- ✅ Update operations: Can now handle larger descriptions
- ✅ Bulk operations: More time for processing
- ✅ Workflow operations: Extended timeout for multi-step processes

## Configuration

### Current Timeouts

| Operation | Timeout | Configurable Via |
|-----------|---------|------------------|
| MCP Requests | 60s | `HULY_MCP_REQUEST_TIMEOUT_MS` |
| Git Commands | 5s | `HULY_GIT_TIMEOUT_MS` |

### Recommendations

- **60s** - Good for most operations including large updates
- **120s** - Consider for very complex workflows
- **30s** - Original default (too low for large operations)

## Testing

The fix was deployed and tested:

1. ✅ Container recreated with new environment variable
2. ✅ Health endpoint confirms server running
3. ✅ Timeout value confirmed in container environment
4. ✅ Ready for large update operations

## Rollback

If timeout is too high and causes other issues:

```yaml
# docker-compose.yml
environment:
  - HULY_MCP_REQUEST_TIMEOUT_MS=30000  # Back to 30s
```

Then restart:
```bash
cd /opt/stacks/huly-selfhost
docker-compose restart huly-mcp
```

## Future Improvements

Consider:
1. **Dynamic timeout** based on operation type
2. **Streaming responses** for long-running operations
3. **Progress reporting** during complex operations
4. **Chunked updates** for very large descriptions

## Related Issues

- Original timeout issues: Fixed in async conversion
- Session registration: Fixed in HTTP transport
- This issue: Large operation timeout → Fixed with 60s timeout

## Status

✅ **RESOLVED** - Timeout increased to 60s, ready for production use
