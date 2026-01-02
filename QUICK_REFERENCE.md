# Huly MCP Server - Quick Reference

## Current Status
✅ **HEALTHY** - All non-blocking upgrades complete  
📍 **Port:** 3457  
🚀 **Transport:** HTTP (StreamableHTTPServerTransport)

## Quick Health Check
```bash
curl -s http://localhost:3457/health | jq
```

## Environment Variables

### Essential
```bash
HULY_MCP_REQUEST_TIMEOUT_MS=60000  # Request timeout (default: 30s, current: 60s)
HULY_GIT_TIMEOUT_MS=5000           # Git operations timeout (default: 5s)
```

### Performance Tuning
```bash
HULY_TOOL_CONCURRENCY=4            # Tool loader (default: 4)
HULY_RESOURCE_CONCURRENCY=4        # Resource loader (default: 4)
HULY_PROMPT_CONCURRENCY=4          # Prompt loader (default: 4)
```

### Monitoring
```bash
HULY_MONITOR_LAG=1                 # Enable lag monitor (default: off)
HULY_LAG_THRESHOLD_MS=100          # Lag warning threshold (default: 100ms)
```

## Common Operations

### Restart Container
```bash
cd /opt/stacks/huly-selfhost
docker-compose restart huly-mcp
```

### View Logs
```bash
# All logs
docker logs -f huly-huly-mcp-1

# Just errors
docker logs huly-huly-mcp-1 2>&1 | grep -i error

# Just timeouts
docker logs huly-huly-mcp-1 2>&1 | grep -i timeout

# Session activity
docker logs huly-huly-mcp-1 2>&1 | grep "Session"
```

### Test Endpoints

#### Health Check
```bash
curl -s http://localhost:3457/health
```

#### List Tools (REST)
```bash
curl -s http://localhost:3457/api/tools | jq '.data.count'
```

#### Initialize MCP Session
```bash
curl -s -X POST http://localhost:3457/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"test","version":"1.0"}
    }
  }'
```

## Troubleshooting

### Issue: Container Won't Start
```bash
# Check logs for errors
docker logs huly-huly-mcp-1 --tail 100

# Check if port is in use
lsof -i :3457

# Restart with clean state
docker-compose down huly-mcp
docker-compose up -d huly-mcp
```

### Issue: Requests Timing Out
```bash
# Check if timeout is set too low
docker exec huly-huly-mcp-1 env | grep TIMEOUT

# Increase timeout
# Edit docker-compose.yml:
#   HULY_MCP_REQUEST_TIMEOUT_MS=60000
docker-compose restart huly-mcp

# Check for blocking operations
docker logs huly-huly-mcp-1 | grep -i lag
```

### Issue: Session Not Found Errors
```bash
# Check session activity
docker logs huly-huly-mcp-1 | grep "Session"

# Look for registration timing
docker logs huly-huly-mcp-1 | grep "Session initialized\|Session registered"

# Check for cleanup
docker logs huly-huly-mcp-1 | grep "Transport closed"
```

### Issue: High Memory Usage
```bash
# Check container stats
docker stats huly-huly-mcp-1

# Check event store size (look for warnings)
docker logs huly-huly-mcp-1 | grep -i "event\|store"

# Restart to clear memory
docker-compose restart huly-mcp
```

## Performance Tuning

### For Fast Startup
```yaml
environment:
  - HULY_TOOL_CONCURRENCY=8
  - HULY_RESOURCE_CONCURRENCY=8
  - HULY_PROMPT_CONCURRENCY=8
```

### For Long-Running Operations
```yaml
environment:
  - HULY_MCP_REQUEST_TIMEOUT_MS=60000
  - HULY_GIT_TIMEOUT_MS=15000
```

### For Production Monitoring
```yaml
environment:
  - HULY_MONITOR_LAG=1
  - HULY_LAG_THRESHOLD_MS=50
  - LOG_LEVEL=info
```

## OpenCode Integration

### Add to OpenCode
```bash
# HTTP transport
claude mcp add --transport http huly-mcp http://192.168.50.90:3457/mcp -s user

# Verify
claude mcp list
```

### Remove from OpenCode
```bash
claude mcp remove huly-mcp -s user
```

### Test from OpenCode
```bash
# List tools
claude mcp call huly-mcp tools/list

# Execute tool
claude mcp call huly-mcp tools/call --params '{"name":"huly_validate","arguments":{"credentials":true}}'
```

## Key Metrics

| Metric | Target | Command |
|--------|--------|---------|
| Startup time | <5s | `docker logs huly-huly-mcp-1 --tail 20` |
| Health check | <100ms | `time curl -s http://localhost:3457/health` |
| Tools list | <100ms | `time curl -s http://localhost:3457/api/tools` |
| MCP initialize | <200ms | (via MCP client) |
| Memory usage | <500MB | `docker stats huly-huly-mcp-1` |

## Documentation

- `COMPLETE_NONBLOCKING_UPGRADE.md` - Full upgrade summary
- `HTTP_TRANSPORT_FIX_COMPLETE.md` - HTTP transport fixes
- `ASYNC_CONVERSION_COMPLETE.md` - Async conversion details
- `TIMEOUT_FIX_SUMMARY.md` - Timeout problem analysis

## Support

### Check Container Status
```bash
docker ps -a | grep huly-mcp
```

### Get Container Details
```bash
docker inspect huly-huly-mcp-1 | jq '.[0].State'
```

### Interactive Shell
```bash
docker exec -it huly-huly-mcp-1 sh
```

### File Locations
```bash
# Source code (volume-mounted)
/opt/stacks/huly-selfhost/huly-mcp-server/

# Container paths
docker exec huly-huly-mcp-1 ls -la /app/
docker exec huly-huly-mcp-1 cat /app/package.json
```
