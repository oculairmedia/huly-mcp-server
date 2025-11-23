# PRD: `huly_query` - Universal Query Tool

## Document Information
- **Tool Name:** `huly_query`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Consolidate all read/list/search operations across all Huly entity types into a single, powerful query tool with advanced filtering, field selection, and output formatting capabilities.

### Goals
- Reduce 7+ granular list/search tools into one unified interface
- Improve token efficiency by 70-80% through field selection
- Enable pagination for large datasets
- Support multiple output formats (JSON, compact, detailed)
- Provide consistent query interface across all entity types

### Success Metrics
- **Calls per workflow:** Reduce from 3-5 → 1
- **Token usage:** Reduce from ~10k → ~2-3k per query
- **Response time:** < 500ms for standard queries
- **Developer satisfaction:** 9/10 for query usability

---

## 2. Current State Analysis

### Existing Tools Being Consolidated
1. `huly_list_issues` - List issues in a project
2. `huly_search_issues` - Search issues with filters
3. `huly_list_projects` - List all projects
4. `huly_list_components` - List components in project
5. `huly_list_milestones` - List milestones in project
6. `huly_list_comments` - List comments on issue
7. `huly_list_templates` - List templates in project
8. `huly_search_templates` - Search templates

### Current Pain Points
1. **No field selection** - Always returns all fields (token waste)
2. **No pagination** - Can only get first N items
3. **No output format control** - Verbose markdown format only
4. **Inconsistent interfaces** - Each tool has different parameters
5. **Multiple calls required** - Need separate calls for list + details

### Current Workflow Example
```javascript
// To get issue details with comments requires 2 calls:
1. huly_get_issue_details('PROJ-123')  // ~1500 tokens
2. huly_list_comments('PROJ-123')      // ~1000 tokens
// Total: 2 calls, ~2500 tokens
```

---

## 3. Proposed Solution

### Overview
A single `huly_query` tool that supports:
- Query any entity type (issues, projects, components, milestones, templates, comments)
- Advanced filtering and search
- Field selection to control output size
- Multiple output formats (JSON, compact, detailed, summary)
- Pagination for large result sets
- Related entity inclusion (reduce separate calls)

### Key Capabilities

#### 3.1 Entity Type Support
- `issue` - Issues and subissues
- `project` - Projects
- `component` - Components
- `milestone` - Milestones
- `template` - Issue templates
- `comment` - Comments on issues

#### 3.2 Query Types
- `list` - List all entities (with filters)
- `search` - Full-text search
- `get` - Get single entity by identifier
- `count` - Count matching entities

#### 3.3 Filtering
Support comprehensive filtering across all entity types with appropriate field mappings.

#### 3.4 Output Control (NEW!)
- **Field selection** - Specify which fields to return
- **Output format** - JSON, compact text, detailed markdown, or summary
- **Include related** - Fetch related entities in same call
- **Pagination** - Offset and limit support

---

## 4. Technical Specification

### 4.1 Tool Definition

```javascript
{
  name: 'huly_query',
  description: 'Query any entity type with advanced filtering, field selection, and output formatting',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        enum: ['issue', 'project', 'component', 'milestone', 'template', 'comment'],
        description: 'Type of entity to query'
      },
      query_type: {
        type: 'string',
        enum: ['list', 'search', 'get', 'count'],
        default: 'list',
        description: 'Type of query operation'
      },
      identifier: {
        type: 'string',
        description: 'Specific identifier for "get" query type (e.g., "PROJ-123")'
      },
      filters: {
        type: 'object',
        description: 'Filter criteria (fields vary by entity type)',
        properties: {
          // Common filters
          project_identifier: {
            type: 'string',
            description: 'Filter by project'
          },

          // Issue-specific filters
          status: {
            type: 'string',
            description: 'Filter by status (for issues)'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent', 'NoPriority'],
            description: 'Filter by priority (for issues)'
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee email (for issues)'
          },
          component: {
            type: 'string',
            description: 'Filter by component name (for issues)'
          },
          milestone: {
            type: 'string',
            description: 'Filter by milestone name (for issues)'
          },
          parent_issue: {
            type: 'string',
            description: 'Filter by parent issue identifier (for subissues)'
          },

          // Template-specific filters
          template_id: {
            type: 'string',
            description: 'Filter by template ID (for issues from templates)'
          },

          // Date filters
          created_after: {
            type: 'string',
            description: 'Filter entities created after this date (ISO 8601)'
          },
          created_before: {
            type: 'string',
            description: 'Filter entities created before this date (ISO 8601)'
          },
          modified_after: {
            type: 'string',
            description: 'Filter entities modified after this date (ISO 8601)'
          },
          modified_before: {
            type: 'string',
            description: 'Filter entities modified before this date (ISO 8601)'
          },

          // Text search
          query: {
            type: 'string',
            description: 'Text search query (searches in title, description, etc.)'
          },

          // Status filters
          archived: {
            type: 'boolean',
            description: 'Filter archived entities (for projects)'
          }
        }
      },
      output: {
        type: 'object',
        description: 'Control output format and content',
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Specific fields to include in response. Omit for defaults.',
            examples: [
              ['identifier', 'title', 'status'],
              ['identifier', 'title', 'description', 'priority', 'assignee']
            ]
          },
          format: {
            type: 'string',
            enum: ['json', 'compact', 'detailed', 'summary'],
            default: 'compact',
            description: 'Output format: json=structured data, compact=minimal text, detailed=verbose markdown, summary=counts only'
          },
          include_related: {
            type: 'object',
            description: 'Include related entities in response',
            properties: {
              comments: {
                type: 'boolean',
                default: false,
                description: 'Include comments (for issues)'
              },
              comment_limit: {
                type: 'number',
                default: 5,
                description: 'Max comments to include'
              },
              subissues: {
                type: 'boolean',
                default: false,
                description: 'Include subissues (for issues)'
              },
              parent: {
                type: 'boolean',
                default: false,
                description: 'Include parent issue (for subissues)'
              },
              attachments: {
                type: 'boolean',
                default: false,
                description: 'Include attachments'
              },
              project_details: {
                type: 'boolean',
                default: false,
                description: 'Include full project details (for components/milestones/issues)'
              }
            }
          },
          limit: {
            type: 'number',
            default: 50,
            minimum: 1,
            maximum: 1000,
            description: 'Maximum number of results to return'
          },
          offset: {
            type: 'number',
            default: 0,
            minimum: 0,
            description: 'Number of results to skip (for pagination)'
          },
          sort_by: {
            type: 'string',
            enum: ['created', 'modified', 'title', 'priority', 'status'],
            default: 'modified',
            description: 'Field to sort by'
          },
          sort_order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order'
          }
        }
      }
    },
    required: ['entity_type']
  }
}
```

### 4.2 Default Field Mappings

#### Issue Fields (default when fields not specified)
```javascript
default: ['identifier', 'title', 'status', 'priority']
available: [
  'identifier', 'title', 'description', 'status', 'priority',
  'assignee', 'component', 'milestone', 'estimation', 'reported_time',
  'created_on', 'modified_on', 'due_date', 'parent_issue',
  'subissue_count', 'comment_count'
]
```

#### Project Fields
```javascript
default: ['identifier', 'name', 'description']
available: [
  'identifier', 'name', 'description', 'archived', 'private',
  'issue_count', 'created_on', 'modified_on', 'owners'
]
```

#### Component/Milestone Fields
```javascript
default: ['label', 'description']
available: [
  'label', 'description', 'created_on', 'modified_on',
  'issue_count', 'target_date' (milestones only)
]
```

#### Template Fields
```javascript
default: ['id', 'title', 'priority']
available: [
  'id', 'title', 'description', 'priority', 'estimation',
  'component', 'milestone', 'child_count', 'created_on', 'modified_on'
]
```

#### Comment Fields
```javascript
default: ['author', 'created_on', 'message']
available: [
  'id', 'author', 'created_on', 'modified_on', 'message', 'issue_identifier'
]
```

### 4.3 Output Formats

#### JSON Format
```json
{
  "entity_type": "issue",
  "count": 2,
  "total": 15,
  "offset": 0,
  "limit": 50,
  "results": [
    {
      "identifier": "PROJ-123",
      "title": "Fix login bug",
      "status": "In Progress",
      "priority": "high"
    },
    {
      "identifier": "PROJ-124",
      "title": "Add dark mode",
      "status": "Backlog",
      "priority": "medium"
    }
  ]
}
```

#### Compact Format (Text)
```
Found 2 issues (showing 1-2 of 15):

PROJ-123: Fix login bug [In Progress] (high)
PROJ-124: Add dark mode [Backlog] (medium)
```

#### Detailed Format (Markdown)
```markdown
# Query Results: Issues

Found 2 issues (showing 1-2 of 15)

## PROJ-123: Fix login bug

- **Status:** In Progress
- **Priority:** High
- **Assignee:** user@example.com
- **Component:** Backend
- **Description:** Users cannot login after recent update...

## PROJ-124: Add dark mode

- **Status:** Backlog
- **Priority:** Medium
- **Component:** Frontend
- **Description:** Implement dark mode theme...
```

#### Summary Format
```
Query Results:
- Entity Type: issue
- Filters: status=Backlog, priority=high
- Total Matches: 15
- Returned: 2 (offset: 0, limit: 50)
- Projects: PROJ (15)
- Statuses: Backlog (15)
- Priorities: High (15)
```

---

## 5. Implementation Details

### 5.1 Service Layer Changes

**File:** `src/services/QueryService.js` (NEW)

```javascript
class QueryService {
  /**
   * Execute unified query across entity types
   */
  async executeQuery(client, params) {
    const { entity_type, query_type, filters, output } = params;

    // Route to appropriate entity handler
    switch (entity_type) {
      case 'issue':
        return this.queryIssues(client, query_type, filters, output);
      case 'project':
        return this.queryProjects(client, query_type, filters, output);
      case 'component':
        return this.queryComponents(client, query_type, filters, output);
      case 'milestone':
        return this.queryMilestones(client, query_type, filters, output);
      case 'template':
        return this.queryTemplates(client, query_type, filters, output);
      case 'comment':
        return this.queryComments(client, query_type, filters, output);
      default:
        throw new Error(`Unknown entity type: ${entity_type}`);
    }
  }

  /**
   * Query issues with field selection and formatting
   */
  async queryIssues(client, query_type, filters, output) {
    const {
      fields = ['identifier', 'title', 'status', 'priority'],
      format = 'compact',
      include_related = {},
      limit = 50,
      offset = 0,
      sort_by = 'modified',
      sort_order = 'desc'
    } = output || {};

    // Build query based on filters
    const query = this.buildIssueQuery(filters);

    // Execute query with pagination
    const issues = await client.findAll(
      tracker.class.Issue,
      query,
      {
        limit,
        skip: offset,
        sort: { [this.mapSortField(sort_by)]: sort_order === 'desc' ? -1 : 1 }
      }
    );

    // Get total count for pagination
    const total = await client.count(tracker.class.Issue, query);

    // Transform results based on field selection
    const results = await this.transformIssueResults(
      client,
      issues,
      fields,
      include_related
    );

    // Format output
    return this.formatOutput(
      'issue',
      results,
      format,
      { count: results.length, total, offset, limit }
    );
  }

  /**
   * Transform issues to include only selected fields
   */
  async transformIssueResults(client, issues, fields, include_related) {
    const results = [];

    for (const issue of issues) {
      const result = {};

      // Only include requested fields
      for (const field of fields) {
        switch (field) {
          case 'identifier':
            result.identifier = issue.identifier;
            break;
          case 'title':
            result.title = issue.title;
            break;
          case 'status':
            result.status = await this.resolveStatus(client, issue.status);
            break;
          case 'priority':
            result.priority = this.resolvePriority(issue.priority);
            break;
          case 'assignee':
            if (issue.assignee) {
              result.assignee = await this.resolveAssignee(client, issue.assignee);
            }
            break;
          case 'component':
            if (issue.component) {
              result.component = await this.resolveComponent(client, issue.component);
            }
            break;
          case 'milestone':
            if (issue.milestone) {
              result.milestone = await this.resolveMilestone(client, issue.milestone);
            }
            break;
          case 'description':
            result.description = await this.extractDescription(client, issue);
            break;
          // ... other fields
        }
      }

      // Include related entities if requested
      if (include_related.comments) {
        result.comments = await this.fetchComments(
          client,
          issue._id,
          include_related.comment_limit || 5
        );
      }

      if (include_related.subissues) {
        result.subissues = await this.fetchSubissues(client, issue._id);
      }

      if (include_related.parent && issue.attachedTo) {
        result.parent = await this.fetchParentIssue(client, issue.attachedTo);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Format output based on requested format
   */
  formatOutput(entity_type, results, format, metadata) {
    switch (format) {
      case 'json':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entity_type,
              ...metadata,
              results
            }, null, 2)
          }]
        };

      case 'compact':
        return this.formatCompact(entity_type, results, metadata);

      case 'detailed':
        return this.formatDetailed(entity_type, results, metadata);

      case 'summary':
        return this.formatSummary(entity_type, results, metadata);

      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Format compact text output
   */
  formatCompact(entity_type, results, metadata) {
    let text = `Found ${metadata.count} ${entity_type}(s)`;

    if (metadata.total > metadata.count) {
      text += ` (showing ${metadata.offset + 1}-${metadata.offset + metadata.count} of ${metadata.total})`;
    }

    text += ':\n\n';

    for (const result of results) {
      if (entity_type === 'issue') {
        text += `${result.identifier}: ${result.title}`;
        if (result.status) text += ` [${result.status}]`;
        if (result.priority) text += ` (${result.priority})`;
        text += '\n';
      } else if (entity_type === 'project') {
        text += `${result.identifier}: ${result.name}`;
        if (result.description) text += ` - ${result.description}`;
        text += '\n';
      }
      // ... other entity types
    }

    return {
      content: [{
        type: 'text',
        text
      }]
    };
  }
}
```

### 5.2 Tool Handler

**File:** `src/tools/query/query.js` (NEW)

```javascript
import { createErrorResponse } from '../base/ToolInterface.js';
import { QueryService } from '../../services/QueryService.js';

export const definition = {
  name: 'huly_query',
  description: 'Query any entity type with advanced filtering, field selection, and output formatting',
  inputSchema: {
    // ... (full schema from 4.1 above)
  },
  annotations: {
    title: 'Universal Query Tool',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function handler(args, context) {
  const { client, logger } = context;

  try {
    logger.debug('Executing query', {
      entity_type: args.entity_type,
      query_type: args.query_type,
      filters: args.filters
    });

    const queryService = new QueryService();
    const result = await queryService.executeQuery(client, args);

    return result;
  } catch (error) {
    logger.error('Query failed:', error);
    return createErrorResponse(error);
  }
}

export function validate(args) {
  const errors = {};

  // Validate entity_type
  if (!args.entity_type) {
    errors.entity_type = 'Entity type is required';
  }

  // Validate query_type
  const validQueryTypes = ['list', 'search', 'get', 'count'];
  if (args.query_type && !validQueryTypes.includes(args.query_type)) {
    errors.query_type = `Query type must be one of: ${validQueryTypes.join(', ')}`;
  }

  // Validate identifier for 'get' query_type
  if (args.query_type === 'get' && !args.identifier) {
    errors.identifier = 'Identifier is required for "get" query type';
  }

  // Validate output.limit
  if (args.output?.limit !== undefined) {
    if (typeof args.output.limit !== 'number' || args.output.limit < 1 || args.output.limit > 1000) {
      errors.limit = 'Limit must be between 1 and 1000';
    }
  }

  // Validate output.offset
  if (args.output?.offset !== undefined) {
    if (typeof args.output.offset !== 'number' || args.output.offset < 0) {
      errors.offset = 'Offset must be a non-negative number';
    }
  }

  // Validate date filters
  const dateFields = ['created_after', 'created_before', 'modified_after', 'modified_before'];
  for (const field of dateFields) {
    if (args.filters?.[field]) {
      const date = new Date(args.filters[field]);
      if (isNaN(date.getTime())) {
        errors[field] = 'Invalid date format. Use ISO 8601 format.';
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
```

---

## 6. Usage Examples

### Example 1: Simple Issue List
```javascript
// Get compact list of issues
{
  entity_type: 'issue',
  query_type: 'list',
  filters: {
    project_identifier: 'PROJ',
    status: 'Backlog'
  },
  output: {
    format: 'compact',
    limit: 10
  }
}

// Response:
// Found 10 issues (showing 1-10 of 45):
//
// PROJ-1: Fix login bug [Backlog] (high)
// PROJ-2: Add dark mode [Backlog] (medium)
// ...
```

### Example 2: Detailed Issue with Comments
```javascript
// Get single issue with full details and comments
{
  entity_type: 'issue',
  query_type: 'get',
  identifier: 'PROJ-123',
  output: {
    fields: ['identifier', 'title', 'description', 'status', 'priority', 'assignee', 'component'],
    format: 'json',
    include_related: {
      comments: true,
      comment_limit: 5,
      subissues: true
    }
  }
}

// Response (JSON):
{
  "entity_type": "issue",
  "count": 1,
  "total": 1,
  "results": [{
    "identifier": "PROJ-123",
    "title": "Fix login bug",
    "description": "Users cannot login after...",
    "status": "In Progress",
    "priority": "high",
    "assignee": "dev@example.com",
    "component": "Backend",
    "comments": [
      {
        "author": "dev@example.com",
        "created_on": "2025-01-20T10:00:00Z",
        "message": "Working on this now"
      }
    ],
    "subissues": []
  }]
}
```

### Example 3: Minimal Token Usage
```javascript
// Get only identifiers and titles for token efficiency
{
  entity_type: 'issue',
  filters: {
    project_identifier: 'PROJ',
    priority: 'high'
  },
  output: {
    fields: ['identifier', 'title'],
    format: 'json',
    limit: 100
  }
}

// Response is minimal - ~500 tokens instead of ~5000 tokens!
```

### Example 4: Paginated Search
```javascript
// Search with pagination
{
  entity_type: 'issue',
  query_type: 'search',
  filters: {
    query: 'authentication',
    status: 'Backlog',
    created_after: '2025-01-01'
  },
  output: {
    limit: 20,
    offset: 40,  // Get items 41-60
    sort_by: 'created',
    sort_order: 'desc'
  }
}
```

### Example 5: Count Only
```javascript
// Just get count without fetching data
{
  entity_type: 'issue',
  query_type: 'count',
  filters: {
    project_identifier: 'PROJ',
    status: 'Backlog',
    priority: 'high'
  }
}

// Response:
// Found 15 issues matching criteria
```

### Example 6: Multi-Project Query
```javascript
// List all projects with issue counts
{
  entity_type: 'project',
  query_type: 'list',
  output: {
    fields: ['identifier', 'name', 'issue_count'],
    format: 'json'
  }
}
```

---

## 7. Migration Plan

### Phase 1: Implementation (Week 1)
1. Create `QueryService.js`
2. Implement entity-specific query handlers
3. Implement field selection logic
4. Implement output formatters

### Phase 2: Tool Integration (Week 1)
1. Create `huly_query` tool definition
2. Wire up to QueryService
3. Add validation
4. Add tests

### Phase 3: Deprecation (Week 2)
1. Mark old list/search tools as deprecated
2. Update documentation
3. Add migration guide
4. Keep old tools for backward compatibility

### Phase 4: Cleanup (Week 3)
1. Monitor usage metrics
2. Remove old tools once migration complete
3. Update all examples and documentation

---

## 8. Testing Requirements

### 8.1 Unit Tests

```javascript
describe('huly_query', () => {
  describe('Field Selection', () => {
    test('should return only requested fields', async () => {
      const result = await executeQuery({
        entity_type: 'issue',
        filters: { project_identifier: 'TEST' },
        output: {
          fields: ['identifier', 'title'],
          format: 'json'
        }
      });

      expect(result.results[0]).toHaveProperty('identifier');
      expect(result.results[0]).toHaveProperty('title');
      expect(result.results[0]).not.toHaveProperty('description');
      expect(result.results[0]).not.toHaveProperty('assignee');
    });
  });

  describe('Output Formats', () => {
    test('should format as JSON', async () => {
      const result = await executeQuery({
        entity_type: 'issue',
        output: { format: 'json' }
      });

      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    test('should format as compact text', async () => {
      const result = await executeQuery({
        entity_type: 'issue',
        output: { format: 'compact' }
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text.length).toBeLessThan(1000);
    });
  });

  describe('Pagination', () => {
    test('should support offset and limit', async () => {
      const result = await executeQuery({
        entity_type: 'issue',
        output: { limit: 10, offset: 20 }
      });

      expect(result.count).toBeLessThanOrEqual(10);
      expect(result.offset).toBe(20);
    });
  });

  describe('Include Related', () => {
    test('should include comments when requested', async () => {
      const result = await executeQuery({
        entity_type: 'issue',
        identifier: 'TEST-1',
        output: {
          include_related: { comments: true },
          format: 'json'
        }
      });

      expect(result.results[0]).toHaveProperty('comments');
      expect(Array.isArray(result.results[0].comments)).toBe(true);
    });

    test('should not include comments by default', async () => {
      const result = await executeQuery({
        entity_type: 'issue',
        identifier: 'TEST-1',
        output: { format: 'json' }
      });

      expect(result.results[0]).not.toHaveProperty('comments');
    });
  });
});
```

### 8.2 Integration Tests

```javascript
describe('huly_query integration', () => {
  test('should reduce token count vs old tools', async () => {
    // Old way: list + details
    const oldResult1 = await huly_list_issues('PROJ');
    const oldResult2 = await huly_get_issue_details('PROJ-1');
    const oldTokens = estimateTokens(oldResult1) + estimateTokens(oldResult2);

    // New way: single query
    const newResult = await huly_query({
      entity_type: 'issue',
      identifier: 'PROJ-1',
      output: {
        fields: ['identifier', 'title', 'description'],
        format: 'json'
      }
    });
    const newTokens = estimateTokens(newResult);

    expect(newTokens).toBeLessThan(oldTokens * 0.5); // 50%+ reduction
  });
});
```

---

## 9. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response time (simple query) | < 200ms | p95 |
| Response time (complex query) | < 500ms | p95 |
| Token reduction | > 70% | vs old tools |
| Field selection overhead | < 10ms | per field |
| Pagination overhead | < 5ms | per page |

---

## 10. Documentation Requirements

1. **API Reference** - Complete schema documentation
2. **Migration Guide** - How to migrate from old tools
3. **Examples** - 20+ real-world examples
4. **Performance Guide** - How to optimize queries
5. **Field Reference** - All available fields per entity type

---

## 11. Success Criteria

- [ ] All 7 old list/search tools consolidated
- [ ] Field selection working for all entity types
- [ ] All 4 output formats implemented
- [ ] Pagination working correctly
- [ ] Include related entities working
- [ ] Token usage reduced by 70%+
- [ ] Response times meet targets
- [ ] All tests passing (100+ tests)
- [ ] Documentation complete
- [ ] Migration guide published

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes | High | Keep old tools during transition |
| Performance regression | Medium | Add caching, optimize queries |
| Complexity too high | Medium | Provide presets for common queries |
| Field mapping errors | Low | Comprehensive validation & tests |

---

## Appendix A: Complete Field Reference

See separate document: `Field-Reference-huly_query.md`

## Appendix B: Performance Optimization Guide

See separate document: `Performance-Guide-huly_query.md`
