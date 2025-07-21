# Huly MCP Server API Updates

## Version: Post-HULLY-121 Fix

### Breaking Changes

None. All changes are backward compatible.

### New Features

#### 1. Enhanced Issue Creation

**Tools Updated:**
- `huly_create_issue`
- `huly_create_subissue`

**New Parameters:**
```typescript
{
  // ... existing parameters ...
  component?: string;    // Optional: Component name to assign
  milestone?: string;    // Optional: Milestone name to assign
}
```

**Example:**
```javascript
{
  "tool": "huly_create_issue",
  "arguments": {
    "project_identifier": "PROJ",
    "title": "New feature",
    "description": "Implement user dashboard",
    "priority": "high",
    "component": "Frontend",
    "milestone": "v2.0"
  }
}
```

#### 2. Bulk Operations Enhancement

**Tool:** `huly_bulk_create_issues`

**Improvements:**
- Atomic issue number generation prevents duplicates
- Support for component/milestone in bulk operations
- Better error handling and progress reporting

**Example:**
```javascript
{
  "tool": "huly_bulk_create_issues",
  "arguments": {
    "project_identifier": "PROJ",
    "issues": [
      {
        "title": "Task 1",
        "description": "Description 1",
        "priority": "medium",
        "component": "Backend"
      },
      {
        "title": "Task 2", 
        "description": "Description 2",
        "priority": "high",
        "milestone": "v1.5"
      }
    ]
  }
}
```

### Response Format Standardization

All issue-related tools now return consistent MCP-formatted responses:

```typescript
interface MCPResponse {
  content: Array<{
    type: 'text';
    text: string;  // Human-readable message
  }>;
  data?: {
    identifier: string;     // Issue identifier (e.g., "PROJ-123")
    [key: string]: any;     // Additional relevant data
  };
}
```

### Updated Tools Response Examples

#### Create Issue Response
```json
{
  "content": [{
    "type": "text",
    "text": "✅ Created issue PROJ-123: \"New feature\"\n\nPriority: High\nStatus: Todo\nProject: Project Name\nComponent: Frontend\nMilestone: v2.0"
  }],
  "data": {
    "identifier": "PROJ-123",
    "project": "PROJ",
    "status": "Todo",
    "priority": "High",
    "component": "Frontend",
    "milestone": "v2.0"
  }
}
```

#### Bulk Create Response
```json
{
  "content": [{
    "type": "text",
    "text": "✅ Successfully created 10 issues\n\nFirst issue: PROJ-123\nLast issue: PROJ-132\n\nAll issues created successfully!"
  }],
  "data": {
    "count": 10,
    "identifiers": ["PROJ-123", "PROJ-124", "..."],
    "firstIdentifier": "PROJ-123",
    "lastIdentifier": "PROJ-132"
  }
}
```

### Comment System Updates

**Tool:** `huly_create_comment`

**Changes:**
- Now uses `ChatMessage` class instead of `ActivityMessage`
- Supports both string and formatted message content

**Example:**
```javascript
{
  "tool": "huly_create_comment",
  "arguments": {
    "issue_identifier": "PROJ-123",
    "message": "This is a comment on the issue"
  }
}
```

### Error Handling Improvements

All tools now provide more detailed error messages:

```json
{
  "content": [{
    "type": "text",
    "text": "Error: Failed to create issue: Component 'NonExistent' not found in project PROJ"
  }]
}
```

### Performance Optimizations

1. **Atomic Operations**: Issue number generation now uses atomic MongoDB operations
2. **Reduced Retries**: Eliminated race condition retry logic
3. **Batch Processing**: Improved bulk operation performance

### Migration Guide

#### For API Consumers

1. **No Required Changes**: Existing API calls continue to work
2. **Optional Enhancements**: Add component/milestone parameters for better organization
3. **Response Parsing**: Check for `data` field in responses for structured information

#### For Developers

1. **Service Registry**: Use dependency injection for service access
```javascript
const registry = ServiceRegistry.getInstance();
const issueService = await registry.getService('issueService');
```

2. **Sequence Generation**: Use SequenceService for any sequential IDs
```javascript
const sequenceService = await registry.getService('sequenceService');
const nextNumber = await sequenceService.getNextSequence(
  tracker.class.Issue,
  projectId
);
```

### Deprecated Patterns

The following patterns should be avoided:

```javascript
// DON'T: Manual sequence generation
const lastIssue = await findOne(Issue, {}, { sort: { number: -1 } });
const number = (lastIssue?.number ?? 0) + 1;

// DO: Use SequenceService
const number = await sequenceService.getNextSequence(tracker.class.Issue, projectId);
```

### Testing

New test endpoints available for development:

```bash
# Test concurrent issue creation
curl -X POST http://localhost:3457/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "huly_bulk_create_issues",
      "arguments": {
        "project_identifier": "TEST",
        "issues": [{"title": "Test 1"}, {"title": "Test 2"}]
      }
    },
    "id": 1
  }'
```

### Known Limitations

1. Component and milestone names must exist in the project
2. Bulk operations are limited to 1000 items per request
3. Issue identifiers follow the pattern: `PROJECT-NUMBER`

### Future Roadmap

1. **Bulk Update Operations**: Enhanced bulk update with field validation
2. **Template Improvements**: More flexible template system
3. **Performance Monitoring**: Built-in metrics for operation timing
4. **Webhook Support**: Real-time notifications for issue changes

### Support

For issues or questions:
- GitHub Issues: [huly-mcp-server/issues](https://github.com/oculairmedia/huly-mcp-server/issues)
- Documentation: [/docs](https://github.com/oculairmedia/huly-mcp-server/tree/main/docs)