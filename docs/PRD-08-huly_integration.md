# PRD: `huly_integration` - External Integration Tool

## Document Information
- **Tool Name:** `huly_integration`
- **Version:** 2.0
- **Status:** Design Phase
- **Owner:** Engineering Team
- **Last Updated:** 2025-01-23

---

## 1. Executive Summary

### Purpose
Manage external integrations with GitHub, webhooks, and other third-party systems.

### Goals
- Consolidate GitHub integration management
- Support webhook configuration
- Enable API integrations
- Provide sync capabilities

### Success Metrics
- **GitHub sync:** < 10s for 100 issues
- **Integration setup:** < 1 call for complete setup
- **Reliability:** > 99.9% sync success rate

---

## 2. Technical Specification

```javascript
{
  name: 'huly_integration',
  description: 'Manage external integrations (GitHub, webhooks, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      integration_type: {
        type: 'string',
        enum: ['github', 'webhook', 'api'],
        description: 'Type of integration'
      },

      operation: {
        type: 'string',
        enum: ['list', 'connect', 'disconnect', 'sync', 'configure'],
        description: 'Operation to perform'
      },

      // GitHub operations
      github: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'list_repos',
              'assign_repo',
              'unassign_repo',
              'sync_issues',
              'sync_prs',
              'configure_webhooks'
            ]
          },
          repository: { type: 'string', description: 'Repository name (org/repo)' },
          project_identifier: { type: 'string' },
          sync_direction: {
            type: 'string',
            enum: ['github_to_huly', 'huly_to_github', 'bidirectional'],
            default: 'github_to_huly'
          },
          sync_options: {
            type: 'object',
            properties: {
              include_closed: { type: 'boolean', default: false },
              sync_comments: { type: 'boolean', default: true },
              sync_labels: { type: 'boolean', default: true },
              auto_link_prs: { type: 'boolean', default: true }
            }
          }
        }
      },

      // Webhook operations
      webhook: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'issue.created',
                'issue.updated',
                'issue.deleted',
                'comment.created',
                'status.changed'
              ]
            }
          },
          secret: { type: 'string' },
          enabled: { type: 'boolean', default: true }
        }
      }
    },
    required: ['integration_type', 'operation']
  }
}
```

---

## 3. Usage Examples

### Example 1: Complete GitHub Setup

```javascript
{
  integration_type: 'github',
  operation: 'connect',
  github: {
    operation: 'assign_repo',
    repository: 'company/product',
    project_identifier: 'PROJ',
    sync_direction: 'bidirectional',
    sync_options: {
      include_closed: false,
      sync_comments: true,
      sync_labels: true,
      auto_link_prs: true
    }
  }
}
```

### Example 2: Sync GitHub Issues

```javascript
{
  integration_type: 'github',
  operation: 'sync',
  github: {
    operation: 'sync_issues',
    repository: 'company/product',
    project_identifier: 'PROJ',
    sync_direction: 'github_to_huly',
    sync_options: {
      include_closed: false
    }
  }
}
```

### Example 3: Configure Webhook

```javascript
{
  integration_type: 'webhook',
  operation: 'configure',
  webhook: {
    url: 'https://example.com/huly/webhook',
    events: [
      'issue.created',
      'issue.updated',
      'status.changed'
    ],
    secret: 'webhook-secret-key',
    enabled: true
  }
}
```

---

## 4. Success Criteria

- [ ] GitHub repository assignment in 1 call
- [ ] Issue sync < 10s for 100 issues
- [ ] Webhook configuration working
- [ ] > 99.9% sync reliability

---

## Appendix: GitHub Sync Workflow

1. List GitHub issues
2. Create corresponding Huly issues
3. Link GitHub PRs to Huly issues
4. Sync comments bidirectionally
5. Map GitHub labels to Huly components/milestones
