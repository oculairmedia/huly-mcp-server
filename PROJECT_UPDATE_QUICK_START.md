# Quick Start: Update Project Names & Descriptions

## ✅ Feature is Ready!

You can now update project names and descriptions after creation.

## Quick Usage Examples

### Using the MCP Tool

```json
{
  "entity_type": "project",
  "operation": "update",
  "project_identifier": "MYPROJ",
  "data": {
    "name": "New Name",
    "description": "New Description"
  }
}
```

### Using REST API

```bash
curl -X POST http://localhost:3457/api/tools/huly_entity \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "entity_type": "project",
      "operation": "update",
      "project_identifier": "MYPROJ",
      "data": {
        "name": "My Updated Project",
        "description": "This is the new description"
      }
    }
  }'
```

### Using Claude Code

```
Please update the project MYPROJ to have the name "New Project Name"
and description "This is the updated description"
```

## What You Can Update

✅ **Project Name** - Change the display name
✅ **Project Description** - Update the description text
✅ **Both Together** - Update name and description at once
✅ **One at a Time** - Update just name OR just description

## What You Cannot Update (Yet)

❌ Project Identifier (the short code like "MYPROJ")
❌ Project Owners
❌ Private/Public status

## Requirements

- Project identifier must exist
- At least one field (name or description) must be provided
- Empty values are not allowed

## After Docker Rebuild

Once the Docker container rebuild completes:

```bash
# Restart the service
cd /opt/stacks/huly-selfhost
docker-compose up -d

# Verify it's working
curl http://localhost:3457/api/health
```

## Example Workflow

1. **List your projects** to get the identifier:
   ```bash
   # Via MCP tool: huly_query with entity_type=project, mode=list
   ```

2. **Update the project**:
   ```bash
   curl -X POST http://localhost:3457/api/tools/huly_entity \
     -H "Content-Type: application/json" \
     -d '{"arguments": {"entity_type": "project", "operation": "update", "project_identifier": "PROJ", "data": {"name": "Updated Name"}}}'
   ```

3. **Verify the change**:
   ```bash
   # Via MCP tool: huly_entity with entity_type=project, operation=read, project_identifier=PROJ
   ```

## Documentation

Full documentation: `docs/PROJECT_UPDATE_FEATURE.md`
