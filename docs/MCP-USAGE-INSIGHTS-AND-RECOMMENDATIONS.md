# MCP Usage Insights and Recommendations

**Document Purpose**: Capture insights from real-world usage of the Huly MCP Server and provide recommendations for improving the user experience, API design, and information exposure.

**Date**: 2025-10-01  
**Based on**: Project setup experience and component documentation creation

---

## Executive Summary

This document outlines key insights from using the Huly MCP Server to rebuild a project structure after a database wipe. It identifies pain points, missing features, and opportunities for improvement based on actual usage patterns.

---

## Key Insights from Usage

### 1. Project Setup & Workflow Orchestration

**What Worked Well:**
- ✅ `huly_workflow` with `project_setup` successfully created projects with components and milestones in one operation
- ✅ Batch creation of multiple projects was efficient
- ✅ Automatic component and milestone creation saved significant time

**Pain Points:**
- ❌ **Duplicate Detection**: No warning when creating duplicate components (resulted in 14 components instead of 7)
- ❌ **Bulk Component Deletion**: Cannot easily remove duplicate components when they share the same label
- ❌ **Component ID Visibility**: Component IDs not exposed in list operations, making it impossible to distinguish duplicates
- ❌ **Partial Failure Recovery**: When one project creation fails, unclear how to resume or clean up

**Recommendations:**

1. **Add Duplicate Detection**
   ```javascript
   // Proposed: Warn or prevent duplicate component creation
   {
     "operation": "create",
     "entity_type": "component",
     "data": {
       "label": "Core",
       "check_duplicates": true  // NEW: Fail if duplicate exists
     }
   }
   ```

2. **Expose Entity IDs in List Operations**
   ```javascript
   // Current response
   {
     "label": "Core",
     "description": "..."
   }
   
   // Proposed response
   {
     "id": "68dc9bf347dbfe8787f60c7e",  // NEW: Include ID
     "label": "Core",
     "description": "...",
     "created_at": "2025-10-01T12:00:00Z",  // NEW: Metadata
     "issue_count": 2  // NEW: Usage stats
   }
   ```

3. **Add Bulk Component Management**
   ```javascript
   // Proposed: Delete multiple components by ID
   {
     "operation": "bulk_delete",
     "entity_type": "component",
     "component_ids": ["id1", "id2", "id3"],
     "options": {
       "force": false,
       "reassign_issues_to": null  // NEW: Reassign before delete
     }
   }
   ```

4. **Improve Workflow Error Handling**
   ```javascript
   // Proposed: Transaction-like behavior with rollback
   {
     "workflow_type": "project_setup",
     "context": {...},
     "options": {
       "atomic": true,  // NEW: All-or-nothing
       "rollback_on_error": true,  // NEW: Clean up on failure
       "continue_on_error": false
     }
   }
   ```

---

### 2. Issue Creation & Documentation

**What Worked Well:**
- ✅ Creating detailed documentation issues with markdown worked perfectly
- ✅ Component assignment during issue creation was seamless
- ✅ Bulk issue creation would be efficient for large documentation sets

**Pain Points:**
- ❌ **Component Assignment Ambiguity**: When duplicates exist, unclear which component the issue is assigned to
- ❌ **No Component Validation**: Can assign to non-existent components without warning
- ❌ **Limited Metadata in Responses**: Issue creation response doesn't show full component/milestone details

**Recommendations:**

1. **Component Validation on Assignment**
   ```javascript
   // Proposed: Validate component exists and is unique
   {
     "operation": "create",
     "data": {
       "title": "Issue title",
       "component": "Core",
       "validate_component": true  // NEW: Fail if ambiguous/missing
     }
   }
   ```

2. **Enhanced Issue Creation Response**
   ```javascript
   // Current response
   {
     "issue_id": "HULLY-1",
     "url": "https://..."
   }
   
   // Proposed response
   {
     "issue_id": "HULLY-1",
     "url": "https://...",
     "component": {  // NEW: Full component details
       "id": "...",
       "label": "Core"
     },
     "milestone": {  // NEW: Full milestone details
       "id": "...",
       "label": "v1.0"
     },
     "created_at": "2025-10-01T12:00:00Z"
   }
   ```

3. **Component Suggestion/Autocomplete**
   ```javascript
   // Proposed: Helper to find valid components
   {
     "operation": "suggest_component",
     "project_identifier": "HULLY",
     "partial_label": "Cor"  // Returns: ["Core", "Collaborator"]
   }
   ```

---

### 3. Session Management & Reliability

**What Worked Well:**
- ✅ Eventually all operations succeeded
- ✅ Retry logic handled transient failures

**Pain Points:**
- ❌ **Session Creation Unreliability**: Multiple attempts sometimes needed (HULLY-1)
- ❌ **No Connection Status Visibility**: Can't check if session is healthy before operations
- ❌ **Silent Reconnection**: Unclear when reconnection happens

**Recommendations:**

1. **Add Connection Health Check Tool**
   ```javascript
   // Proposed: New tool for connection diagnostics
   {
     "tool": "huly_connection_status",
     "operation": "check"
   }
   
   // Response
   {
     "status": "connected",
     "session_age": 3600,
     "last_activity": "2025-10-01T12:00:00Z",
     "workspace": "agentspace",
     "user": "user@example.com"
   }
   ```

2. **Expose Retry Statistics**
   ```javascript
   // Proposed: Include retry info in responses
   {
     "success": true,
     "data": {...},
     "metadata": {
       "attempts": 2,  // NEW: How many retries
       "duration_ms": 1500  // NEW: Total time
     }
   }
   ```

3. **Proactive Session Refresh**
   ```javascript
   // Proposed: Manual session refresh
   {
     "tool": "huly_connection_status",
     "operation": "refresh"
   }
   ```

---

### 4. Information Exposure & Discoverability

**What's Missing:**

1. **Project Statistics**
   - Total issues per project
   - Issues by status/priority breakdown
   - Component usage statistics
   - Milestone progress tracking

2. **Component Metadata**
   - Which issues use each component
   - Component creation date
   - Component owner/lead
   - Component ID (critical for duplicate management)

3. **Milestone Progress**
   - Issues assigned to milestone
   - Completion percentage
   - Due date proximity warnings

4. **Workspace Overview**
   - Total projects
   - Total issues across all projects
   - Recent activity
   - User activity

**Recommendations:**

1. **Add Statistics Tool**
   ```javascript
   // Proposed: New statistics tool
   {
     "tool": "huly_statistics",
     "scope": "project",
     "project_identifier": "HULLY"
   }
   
   // Response
   {
     "project": "HULLY",
     "total_issues": 8,
     "by_status": {
       "backlog": 8,
       "in_progress": 0,
       "done": 0
     },
     "by_priority": {
       "high": 1,
       "medium": 7
     },
     "by_component": {
       "Core": 2,
       "Tools": 1,
       "REST API": 1,
       ...
     }
   }
   ```

2. **Enhanced Component Details**
   ```javascript
   // Proposed: Component detail view
   {
     "operation": "read",
     "entity_type": "component",
     "project_identifier": "HULLY",
     "entity_identifier": "Core"
   }
   
   // Response
   {
     "id": "68dc9bf347dbfe8787f60c7e",
     "label": "Core",
     "description": "...",
     "created_at": "2025-10-01T10:00:00Z",
     "issue_count": 2,
     "issues": [
       {"id": "HULLY-1", "title": "..."},
       {"id": "HULLY-2", "title": "..."}
     ]
   }
   ```

3. **Milestone Progress Tracking**
   ```javascript
   // Proposed: Milestone detail view
   {
     "operation": "read",
     "entity_type": "milestone",
     "project_identifier": "HULLY",
     "entity_identifier": "v1.0 - Core Stability"
   }
   
   // Response
   {
     "id": "...",
     "label": "v1.0 - Core Stability",
     "target_date": "2025-11-01",
     "days_remaining": 31,
     "status": "in-progress",
     "progress": {
       "total_issues": 10,
       "completed": 3,
       "in_progress": 4,
       "not_started": 3,
       "percentage": 30
     }
   }
   ```

---

## Priority Recommendations

### High Priority (Immediate Impact)

1. **Expose Entity IDs** - Critical for duplicate management
2. **Add Duplicate Detection** - Prevent data quality issues
3. **Fix Session Reliability** - Core functionality (HULLY-1)
4. **Component Validation** - Prevent assignment errors

### Medium Priority (Quality of Life)

5. **Statistics Tool** - Better project visibility
6. **Enhanced Responses** - More context in responses
7. **Connection Health Check** - Debugging and monitoring
8. **Bulk Component Operations** - Cleanup and management

### Low Priority (Nice to Have)

9. **Autocomplete/Suggestions** - Improved UX
10. **Workspace Overview** - High-level insights
11. **Progress Tracking** - Milestone management
12. **Activity Feeds** - Recent changes visibility

---

## Conclusion

The Huly MCP Server is highly functional for core operations, but real-world usage reveals opportunities for improvement in:

- **Data Quality**: Duplicate detection and prevention
- **Visibility**: Exposing IDs and metadata
- **Reliability**: Session management improvements
- **Discoverability**: Statistics and overview tools
- **Error Recovery**: Better handling of partial failures

Implementing these recommendations would significantly improve the developer experience and reduce friction in common workflows.

---

**Next Steps:**
1. Create issues for high-priority recommendations
2. Prototype statistics tool
3. Investigate session reliability (HULLY-1)
4. Design enhanced response formats

