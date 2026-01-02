# Project Update Feature

## Overview

The Huly MCP Server now supports updating project names and descriptions after creation through the `huly_entity` tool.

## Feature Implementation

### Added Components

1. **ProjectUpdateDataSchema** - JSON schema for project update payload
2. **updateProject()** method in ProjectService
3. **update** operation in huly_entity tool
4. Validation logic for update operations
5. Comprehensive unit tests

## Usage

### Via MCP Tool

Use the `huly_entity` tool with the `update` operation:

```json
{
  "entity_type": "project",
  "operation": "update",
  "project_identifier": "PROJ",
  "data": {
    "name": "New Project Name",
    "description": "New project description"
  }
}
```

#### Update Name Only

```json
{
  "entity_type": "project",
  "operation": "update",
  "project_identifier": "PROJ",
  "data": {
    "name": "New Project Name"
  }
}
```

#### Update Description Only

```json
{
  "entity_type": "project",
  "operation": "update",
  "project_identifier": "PROJ",
  "data": {
    "description": "New project description"
  }
}
```

### Via REST API

**Endpoint:** `POST /api/tools/huly_entity`

**Request Body:**

```json
{
  "arguments": {
    "entity_type": "project",
    "operation": "update",
    "project_identifier": "PROJ",
    "data": {
      "name": "Updated Project Name",
      "description": "Updated description"
    }
  }
}
```

**Example with curl:**

```bash
curl -X POST http://localhost:3457/api/tools/huly_entity \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "entity_type": "project",
      "operation": "update",
      "project_identifier": "MYPROJ",
      "data": {
        "name": "My Renamed Project",
        "description": "This project has been updated"
      }
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "toolName": "huly_entity",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "✅ Updated project MYPROJ\n\nUpdated fields: name, description\nNew name: My Renamed Project\nNew description: This project has been updated"
        }
      ]
    },
    "executionTime": 245
  },
  "metadata": {
    "timestamp": "2025-11-02T17:00:00.000Z",
    "version": "1.0"
  }
}
```

## Validation Rules

1. **project_identifier** is required
2. **data** object is required
3. At least one field (name or description) must be provided in data
4. Project must exist (will throw error if not found)

## Error Handling

### Project Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project 'PROJ' not found"
  }
}
```

### Missing Required Fields

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "At least one of name or description must be provided when updating a project"
  }
}
```

### No Valid Updates

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No valid fields to update"
  }
}
```

## Technical Details

### Files Modified

- `src/services/ProjectService.js` - Added `updateProject()` method
- `src/tools/entity/hulyEntity.js` - Added update operation and schema
- `src/tools/entity/__tests__/updateProject.test.js` - Test coverage

### Schema Definition

```javascript
const ProjectUpdateDataSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'New project name',
    },
    description: {
      type: 'string',
      description: 'New project description',
    },
  },
  minProperties: 1,
  additionalProperties: false,
};
```

### Service Method Signature

```javascript
/**
 * Update a project's name and/or description
 * @param {Object} client - Huly client instance
 * @param {string} projectIdentifier - Project identifier
 * @param {Object} updates - Fields to update (name, description)
 * @returns {Promise<Object>} Update response
 */
async updateProject(client, projectIdentifier, updates = {})
```

## Test Coverage

Unit tests cover:
- Validation of required fields
- Validation of at least one update field
- Valid updates with name only
- Valid updates with description only
- Valid updates with both fields
- Service method invocation with correct arguments
- Proper handling of undefined fields

**Test File:** `src/tools/entity/__tests__/updateProject.test.js`

**Run Tests:**

```bash
NODE_OPTIONS='--experimental-vm-modules' npx jest src/tools/entity/__tests__/updateProject.test.js
```

## Backwards Compatibility

This feature is fully backwards compatible:
- Existing `create`, `read`, `archive`, and `delete` operations remain unchanged
- No breaking changes to existing API or tool definitions
- The `update` operation is additive only

## Future Enhancements

Potential improvements for future versions:
- Support updating additional project fields (private, owners, etc.)
- Bulk project update operation
- Project rename with identifier change (more complex due to dependencies)
- Update history/audit trail

## Support

For issues or questions:
- Check Huly MCP Server documentation
- Review test files for usage examples
- Check API.md for complete tool reference
