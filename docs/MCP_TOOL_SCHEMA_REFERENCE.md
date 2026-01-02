# Huly MCP Tool Schema Reference

This guide captures the JSON Schema contracts implemented by the Huly MCP tools. Each
tool follows the standard Model Context Protocol (MCP) tool interface exported from
`src/tools/base/ToolInterface.js`, and exposes its callable surface through a
`definition` object that provides a name, description, and JSON Schema describing the
expected input payload.

Every tool definition shares these core fields:

```json
{
  "name": "tool_name",
  "description": "What the tool does",
  "inputSchema": {
    "type": "object",
    "properties": { "...": "..." },
    "required": [ "..." ],
    "additionalProperties": false,
    "definitions": { "...": { /* reusable subschemas */ } }
  },
  "annotations": {
    "title": "Human readable title",
    "destructiveHint": false,
    "idempotentHint": true,
    "readOnlyHint": false,
    "openWorldHint": true
  }
}
```

Handlers receive the JSON that passes schema validation, along with a context object
containing service adapters, configuration, and logging primitives.

## Tool Schemas

Each section below summarises the `inputSchema` contract exposed by the tool module
at the indicated path.

### `huly_entity` — `src/tools/entity/hulyEntity.js`

- **Purpose**: CRUD manager for projects, components, milestones, and issue comments.
- **Base requirements**:
  - `entity_type` (enum: `project`, `component`, `milestone`, `comment`)
  - `operation`
  - No additional properties beyond those described.
- **Operation matrix**:
  - `project.create` → `project_identifier` optional, requires `data` (`ProjectCreateData`)
  - `project.read`, `project.archive`, `project.delete` → require `project_identifier`
  - `component.create` → `project_identifier`, `data` (`ComponentCreateData`)
  - `component.read`, `component.delete` → `project_identifier`, `entity_identifier`
  - `milestone.create` → `project_identifier`, `data` (`MilestoneCreateData`)
  - `milestone.read`, `milestone.delete` → `project_identifier`, `entity_identifier`
  - `comment.create` → `issue_identifier`, `data` (`CommentCreateData`)
- **Reusable definitions**:
  - `ProjectCreateData`: `{ name, description?, identifier? }`
  - `ComponentCreateData`: `{ label, description? }`
  - `MilestoneCreateData`: `{ label, description?, target_date (date), status? }`
  - `CommentCreateData`: `{ message }`
  - `DeletionOptions`: `{ cascade?, dry_run?, force? }`
- **Notes**: `data` and `options` accept either structured JSON or JSON strings that
  coerce into the corresponding objects.

### `huly_query` — `src/tools/query/hulyQuery.js`

- **Purpose**: Unified list/search/get engine across projects, issues, templates,
  components, milestones, and comments.
- **Base requirements**:
  - `entity_type` (enum: `project`, `component`, `milestone`, `issue`, `template`, `comment`)
  - `mode` (enum: `list`, `search`, `get`)
- **Operation matrix**:
  - `project.list` / `project.get` → optional/required `project_identifier`
  - `component.list`, `milestone.list` → require `project_identifier`
  - `issue.list` → optional `project_identifier`
  - `issue.search` → `filters` (`IssueSearchFilters`) or bare string `query`
  - `issue.get` → `issue_identifier`
  - `template.list` → optional `project_identifier`
  - `template.search` → `project_identifier` optional, requires `query`
  - `template.get` → `template_id`
  - `comment.list` → `issue_identifier`
- **Reusable definitions**:
  - `ListOptions`: `{ limit?, offset?, sort?, include_details? }`
  - `IssueSearchFilters`: fields for status, priority, assignee, component, milestone,
    created/modified date ranges, and optional `project_identifier`.
- **Notes**: `filters` and `options` allow JSON strings that coerce into objects; the tool
  is read-only and flagged as idempotent.

### `huly_issue_ops` — `src/tools/issue_ops/hulyIssueOps.js`

- **Purpose**: Issue lifecycle manager for single and bulk mutation flows.
- **Base requirements**:
  - `operation` (enum: `create`, `update`, `delete`, `create_subissue`, `bulk_create`,
    `bulk_update`, `bulk_delete`)
- **Operation matrix**:
  - `create` → `project_identifier`, `data` (`IssueCreateData`)
  - `update` → `issue_identifier`, `update` (`IssueUpdateData`)
  - `delete` → `issue_identifier`, optional `options` (`IssueOptions`)
  - `create_subissue` → `parent_issue_identifier`, `data`
  - `bulk_create` → `project_identifier`, `items` (array of `BulkCreateIssue`), optional
    `defaults` (`IssueDefaults`) and `options`
  - `bulk_update` → `updates` (array of `BulkUpdateItem`), optional `options`
  - `bulk_delete` → `issue_identifiers` (array), optional `options`
- **Reusable definitions**:
  - `IssueCreateData`: `{ title, description?, priority?, component?, milestone? }`
  - `IssueUpdateData`: `{ field (enum issue fields), value }`
  - `BulkCreateIssue`: same shape as create plus optional `parent_issue`
  - `IssueDefaults`: permissible defaults for bulk create
  - `BulkUpdateItem`: `{ issue_identifier, field, value }`
  - `IssueOptions`: `{ cascade?, force?, dry_run?, continue_on_error?, batch_size? }`
- **Notes**: `data`, `items`, `defaults`, `options`, `updates`, and `issue_identifiers`
  can be provided as objects/arrays or JSON strings. The tool is marked as potentially
  destructive.

### `huly_template_ops` — `src/tools/template_ops/hulyTemplateOps.js`

- **Purpose**: Manage template records, child templates, and instantiation.
- **Base requirements**:
  - `operation` (enum: `create`, `update`, `delete`, `add_child`, `remove_child`,
    `instantiate`)
- **Operation matrix**:
  - `create` → `project_identifier`, `data` (`TemplateData`)
  - `update` → `template_id`, `field`, `value`
  - `delete` → `template_id`
  - `add_child` → `template_id`, `data` (`ChildTemplateData`)
  - `remove_child` → `template_id`, `child_index`
  - `instantiate` → `template_id`, optional `overrides` (`TemplateOverrides`)
- **Reusable definitions**:
  - `TemplateData`: `{ title, description?, priority?, assignee?, component?, milestone?, estimation?, children? }`
  - `ChildTemplateData`: child issue definitions mirroring template fields
  - `TemplateOverrides`: optional overrides for instantiation, including
    `include_children`
- **Notes**: `data` and `overrides` accept JSON strings. `child_index` is zero-based and
  must be a non-negative integer.

### `huly_workflow` — `src/tools/workflow/hulyWorkflow.js`

- **Purpose**: High-level orchestration for project setup and sprint planning.
- **Base requirements**:
  - `workflow_type` (enum: `project_setup`, `sprint_planning`)
  - `context` matching the workflow-specific schema
- **Workflow contexts**:
  - `ProjectSetupContext`: requires `project` `{ name, identifier, description? }`, with
    optional `components` (array of labels or `{ label, description }`), `milestones`
    (`MilestoneSchema`), `templates` (`TemplateSeedData`), and `repository`.
  - `SprintPlanningContext`: `{ project_identifier, sprint_name, duration_weeks?,
    team_capacity?, backlog_filter?, backlog_limit? }` using `SprintPlanningBacklogFilter`.
- **Reusable definitions**:
  - `WorkflowOptions`: `{ dry_run? }`
  - `MilestoneSchema`: `{ label, target_date, description?, status? }`
  - `TemplateSeedData`: same fields as template creation plus optional children.
- **Notes**: `context` and `options` can be supplied as JSON strings and are coerced into
  objects. `options.dry_run` triggers a descriptive preview instead of execution.

### `huly_validate` — `src/tools/validate/hulyValidate.js`

- **Purpose**: Validation hub for deletion readiness and impact previews.
- **Base requirements**:
  - `validation_type` (enum: `deletion`, `impact_preview`)
  - `entity_type` (enum: `issue`, `project`, `component`, `milestone`)
  - `entity_identifier`
- **Conditional requirements**:
  - `component` / `milestone` validations require `project_identifier`.
- **Options**:
  - `options.detailed` (boolean) returns full deletion payloads when true.
- **Notes**: The tool is read-only and idempotent. Payloads that fail identifier format
  checks trigger validation errors before the underlying service is called.

### `huly_integration` — `src/tools/integration/hulyIntegration.js`

- **Purpose**: GitHub integration wrapper for listing repositories and assigning them to projects.
- **Base requirements**:
  - `integration_type` (currently must be `github`)
  - `operation` (`list_resources`, `assign`)
- **Conditional requirements** (GitHub):
  - `assign` requires `project_identifier` and `repository_name` in `"owner/repo"` form.
- **Notes**: The schema disallows undeclared properties and ensures unsupported operations
  are rejected early via validation.

### `huly_account_ops` — `src/tools/account_ops/hulyAccountOps.js`

- **Purpose**: Manage account metadata, employees, and persons through a unified tool surface.
- **Base requirements**:
  - `operation` (enum: `get_current`, `create_employee`, `update_employee`, `delete_employee`,
    `list_employees`, `get_employee`, `create_person`)
- **Operation matrix**:
  - `create_employee` → `data` (`EmployeeData`)
  - `update_employee` → `employee_id`, `updates` (`EmployeeUpdateData`)
  - `delete_employee` → `employee_id`, `confirm` must be `true`
  - `list_employees` → optional `filters` (`EmployeeFilters`)
  - `get_employee` → `employee_id`
  - `create_person` → `data` (`PersonData`)
- **Reusable definitions**:
  - `EmployeeData`: `{ firstName, lastName, email?, position?, department?, city?, country?, phone?, active? }`
  - `EmployeeUpdateData`: partial employee fields; requires at least one property.
  - `EmployeeFilters`: `{ limit?, active?, department? }`
  - `PersonData`: `{ firstName, lastName, email?, phone?, city?, country?, birthday? (date) }`
- **Notes**: String fields are trimmed during validation. JSON strings for `data`,
  `updates`, and `filters` are accepted and coerced into objects.

## Validation Behaviour

Beyond JSON Schema enforcement, several tools implement additional runtime validation
via their exported `validate` functions. These functions:

- Coerce JSON string arguments into objects (`coerceJsonFields` utility).
- Ensure discriminator pairs (`operation`, `entity_type`, `mode`, etc.) are in supported sets.
- Enforce cross-field requirements (e.g., `confirm === true` for destructive calls, non-empty
  titles, and project scoping when required).

Tool handlers should only receive well-structured payloads after this schema-driven and
custom validation passes. When a payload violates the schema or validation rules the tool
returns a structured error response (`createErrorResponse`) matching MCP expectations.

## Usage Notes

- All tools set `additionalProperties: false`, so calls must not include undeclared fields.
- Most complex parameters accept either native JSON objects/arrays or a JSON string that
  the tool will parse; malformed JSON strings are surfaced as validation errors.
- `annotations` metadata (idempotency, destructiveness, read-only hints) is provided to
  help MCP clients decide when and how to surface the tool to users.

Refer to `docs/tool-descriptions.detailed.json` for worked example payloads that align
with the schemas summarised above.
