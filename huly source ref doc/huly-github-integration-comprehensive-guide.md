# Huly GitHub Integration Comprehensive Guide

## Overview

This guide provides complete information about Huly's GitHub integration, covering setup, configuration, synchronization mechanisms, webhook handling, and advanced features for comprehensive utilization.

## Architecture Overview

### Core Components

```typescript
// Main integration components
1. GitHub App (Octokit) - GitHub API client and webhook handler
2. Platform Worker - Manages workspace-specific GitHub operations
3. Sync Managers - Handle bidirectional synchronization
4. Webhook Handlers - Process real-time GitHub events
5. Authentication System - OAuth and GitHub App authentication
```

### Integration Configuration

```typescript
interface Config {
  // GitHub App Configuration
  AppID: string                    // GitHub App ID
  ClientID: string                 // OAuth Client ID
  ClientSecret: string             // OAuth Client Secret
  PrivateKey: string              // GitHub App private key
  WebhookSecret: string           // Webhook secret for verification
  
  // Service Configuration
  AccountsURL: string             // Huly accounts service URL
  FrontURL: string               // Frontend URL for redirects
  CollaboratorURL: string        // Collaborative document service
  
  // Operational Settings
  AllowedWorkspaces: string[]    // Workspace access control
  WorkspaceInactivityInterval: number  // Days before stopping sync
  RateLimit: number              // API rate limit (default: 25)
  BotName: string               // GitHub bot name
}
```

## Data Models

### GitHub Integration Model

```typescript
@Model(github.class.GithubIntegration, core.class.Doc, DOMAIN_GITHUB)
export class TGithubIntegration extends TDoc implements GithubIntegration {
  // GitHub App installation details
  installationId!: number         // Unique installation ID
  clientId!: string              // OAuth client ID
  
  // Organization/User information
  @Prop(TypeString(), getEmbeddedLabel('Name'))
  @ReadOnly()
    name!: string                 // Organization or user name
  
  nodeId!: string                // GitHub node ID
  type?: 'User' | 'Organization' | 'Bot'
  
  // Integration status
  @Prop(TypeBoolean(), getEmbeddedLabel('Alive'))
  @ReadOnly()
    alive!: boolean               // Active synchronization status
  
  // Repository collection
  @Prop(Collection(github.class.GithubIntegrationRepository), getEmbeddedLabel('Repositories'))
  @ReadOnly()
    repositories!: number         // Repository count
  
  byUser?: string                // User who set up integration
}
```

### Repository Integration Model

```typescript
@Model(github.class.GithubIntegrationRepository, core.class.AttachedDoc, DOMAIN_GITHUB)
export class TGithubIntegrationRepository extends TAttachedDoc implements GithubIntegrationRepository {
  // Repository identification
  @Prop(TypeString(), getEmbeddedLabel('Name'))
    name!: string                 // Repository name
  
  nodeId!: string                // GitHub node ID
  repositoryId!: number          // GitHub repository ID
  
  // Repository details
  url!: string                   // Repository URL
  private!: boolean              // Private repository flag
  
  // Integration mapping
  githubProject?: Ref<GithubProject> | null  // Linked Huly project
  
  // Synchronization status
  enabled!: boolean              // Sync enabled flag
  synchronized!: Set<string>     // Synchronized entity types
}
```

### Document Synchronization Model

```typescript
@Model(github.class.DocSyncInfo, core.class.Doc, DOMAIN_GITHUB)
export class TDocSyncInfo extends TDoc implements DocSyncInfo {
  // Document mapping
  url!: string                   // GitHub URL
  objectClass!: Ref<Class<Doc>>  // Huly document class
  
  // Synchronization state
  repository!: Ref<GithubIntegrationRepository> | null
  external?: any                 // Raw GitHub data
  externalVersion?: string       // GitHub version identifier
  externalCheckId?: string       // GitHub check ID
  
  // Derived state
  derivedVersion?: string        // Processed version
  current?: any                  // Current Huly document
  needSync!: string             // Sync requirement flag
  
  // GitHub specifics
  githubNumber!: number         // GitHub issue/PR number
  lastGithubUser?: PersonId | null  // Last GitHub user
  lastModified?: number         // Last modification time
}
```

## Authentication System

### GitHub App Authentication

```typescript
// GitHub App setup (server-side)
const octokitApp = new App({
  appId: config.AppID,
  privateKey: config.PrivateKey,
  webhooks: {
    secret: config.WebhookSecret
  }
})

// Installation-specific client
const octokit = await octokitApp.getInstallationOctokit(installationId)
```

### OAuth User Authentication

```typescript
// OAuth flow for user authentication
async function requestGithubAccessToken(payload: {
  workspace: WorkspaceUuid
  code: string
  state: string
  accountId: PersonId
}): Promise<void> {
  const uri = 'https://github.com/login/oauth/access_token?' +
    makeQuery({
      client_id: config.ClientID,
      client_secret: config.ClientSecret,
      code: payload.code,
      state: payload.state
    })
  
  const result = await fetch(uri, {
    method: 'POST',
    headers: { Accept: 'application/json' }
  })
  
  const resultJson = await result.json()
  
  // Store user token for API access
  const userOctokit = new Octokit({
    auth: resultJson.access_token,
    client_id: config.ClientID,
    client_secret: config.ClientSecret
  })
}
```

## Webhook Event Handling

### Supported Webhook Events

```typescript
// Complete webhook event registration
app.webhooks.on('issues', async ({ payload, name, id }) => {
  // Handle issue events: opened, closed, edited, assigned, etc.
  await handleEvent(tracker.class.Issue, payload.installation?.id, payload)
})

app.webhooks.on('issue_comment', async ({ payload, name, id }) => {
  // Handle issue comment events: created, edited, deleted
  await handleEvent(chunter.class.ChatMessage, payload.installation?.id, payload)
})

app.webhooks.on('pull_request', async ({ payload, name, id }) => {
  // Handle PR events: opened, closed, merged, review_requested, etc.
  await handleEvent(github.class.GithubPullRequest, payload.installation?.id, payload)
})

app.webhooks.on('pull_request_review', async ({ payload, name, id }) => {
  // Handle PR review events: submitted, edited, dismissed
  await handleEvent(github.class.GithubReview, payload.installation?.id, payload)
})

app.webhooks.on('projects_v2_item', async ({ payload, name, id }) => {
  // Handle GitHub Projects v2 events: created, edited, moved, deleted
  if (payload.projects_v2_item.content_type === 'Issue') {
    await handleEvent(tracker.class.Issue, payload.installation?.id, payload)
  } else if (payload.projects_v2_item.content_type === 'PullRequest') {
    await handleEvent(github.class.GithubPullRequest, payload.installation?.id, payload)
  }
})

app.webhooks.on('repository', async ({ payload, name, id }) => {
  // Handle repository events: created, deleted, renamed, transferred
  await handleEvent(github.mixin.GithubProject, payload.installation?.id, payload)
})

app.webhooks.on('installation', async ({ payload, name, id }) => {
  // Handle installation events: created, deleted, suspend, unsuspend
  switch (payload.action) {
    case 'created':
    case 'unsuspend':
      await handleInstallationEvent(payload.installation, payload.repositories, true)
      break
    case 'suspend':
      await handleInstallationEvent(payload.installation, payload.repositories, false)
      break
    case 'deleted':
      await handleInstallationEventDelete(payload.installation.id)
      break
  }
})

app.webhooks.on('installation_repositories', async ({ payload, name, id }) => {
  // Handle repository access changes: added, removed
  await reloadRepositories(payload.installation.id)
})
```

### Event Processing Pipeline

```typescript
// Event processing workflow
async function handleEvent(
  _class: Ref<Class<Doc>>,
  installationId: number,
  payload: any
): Promise<void> {
  // 1. Get workspace worker for installation
  const worker = getWorker(installationId)
  if (!worker) return
  
  // 2. Process event based on document class
  switch (_class) {
    case tracker.class.Issue:
      await worker.syncManager.issues.handleWebhookEvent(payload)
      break
    case github.class.GithubPullRequest:
      await worker.syncManager.pullRequests.handleWebhookEvent(payload)
      break
    case chunter.class.ChatMessage:
      await worker.syncManager.comments.handleWebhookEvent(payload)
      break
  }
  
  // 3. Trigger synchronization
  worker.triggerSync()
}
```

## Bidirectional Synchronization

### Issue Synchronization

```typescript
// Huly Issue → GitHub Issue mapping
interface IssueMapping {
  // Basic fields
  title: string                  // Direct mapping
  body: string                   // Description (markdown)
  state: 'open' | 'closed'      // Status mapping
  
  // Assignment
  assignee: string              // GitHub username
  assignees: string[]           // Multiple assignees
  
  // Organization
  labels: string[]              // Label names
  milestone: number             // Milestone number
  
  // GitHub-specific
  number: number                // GitHub issue number
  html_url: string             // GitHub URL
  node_id: string              // GraphQL node ID
}

// Sync process
async function syncIssueToGithub(
  hulyIssue: Issue,
  githubRepo: GithubIntegrationRepository,
  octokit: Octokit
): Promise<void> {
  const syncInfo = await findSyncInfo(hulyIssue._id)
  
  if (syncInfo?.githubNumber) {
    // Update existing GitHub issue
    await octokit.rest.issues.update({
      owner: githubRepo.owner,
      repo: githubRepo.name,
      issue_number: syncInfo.githubNumber,
      title: hulyIssue.title,
      body: await convertDescriptionToMarkdown(hulyIssue.description),
      state: mapStatusToGithubState(hulyIssue.status),
      assignees: await mapAssigneesToGithubUsers(hulyIssue.assignee),
      labels: await mapLabelsToGithubLabels(hulyIssue.labels)
    })
  } else {
    // Create new GitHub issue
    const githubIssue = await octokit.rest.issues.create({
      owner: githubRepo.owner,
      repo: githubRepo.name,
      title: hulyIssue.title,
      body: await convertDescriptionToMarkdown(hulyIssue.description),
      assignees: await mapAssigneesToGithubUsers(hulyIssue.assignee),
      labels: await mapLabelsToGithubLabels(hulyIssue.labels)
    })
    
    // Create sync info
    await createSyncInfo(hulyIssue, githubIssue.data, githubRepo)
  }
}
```

### Pull Request Integration

```typescript
// Pull Request model
@Model(github.class.GithubPullRequest, core.class.AttachedDoc, DOMAIN_GITHUB)
export class TGithubPullRequest extends TAttachedDoc implements GithubPullRequest {
  @Prop(TypeString(), getEmbeddedLabel('Title'))
    title!: string
  
  @Prop(TypeMarkup(), getEmbeddedLabel('Description'))
    description!: Markup
  
  @Prop(TypeString(), getEmbeddedLabel('State'))
    state!: 'open' | 'closed' | 'merged'
  
  @Prop(TypeBoolean(), getEmbeddedLabel('Draft'))
    draft!: boolean
  
  // Branch information
  @Prop(TypeString(), getEmbeddedLabel('Head Branch'))
    headBranch!: string
  
  @Prop(TypeString(), getEmbeddedLabel('Base Branch'))
    baseBranch!: string
  
  // GitHub specifics
  number!: number
  url!: string
  mergeable?: boolean
  
  // Collections
  @Prop(Collection(github.class.GithubReview), getEmbeddedLabel('Reviews'))
    reviews!: number
  
  @Prop(Collection(chunter.class.ChatMessage), getEmbeddedLabel('Comments'))
    comments!: number
}
```

### Comment Synchronization

```typescript
// Comment sync between Huly and GitHub
async function syncCommentToGithub(
  hulyComment: ChatMessage,
  githubIssue: DocSyncInfo,
  octokit: Octokit
): Promise<void> {
  const commentSyncInfo = await findCommentSyncInfo(hulyComment._id)
  
  if (commentSyncInfo?.githubNumber) {
    // Update existing GitHub comment
    await octokit.rest.issues.updateComment({
      owner: githubRepo.owner,
      repo: githubRepo.name,
      comment_id: commentSyncInfo.githubNumber,
      body: await convertMarkupToMarkdown(hulyComment.message)
    })
  } else {
    // Create new GitHub comment
    const githubComment = await octokit.rest.issues.createComment({
      owner: githubRepo.owner,
      repo: githubRepo.name,
      issue_number: githubIssue.githubNumber,
      body: await convertMarkupToMarkdown(hulyComment.message)
    })
    
    // Create comment sync info
    await createCommentSyncInfo(hulyComment, githubComment.data, githubIssue)
  }
}
```

## Advanced Features

### GitHub Projects v2 Integration

```typescript
// GitHub Projects v2 synchronization
async function syncProjectsV2Item(payload: ProjectsV2ItemEvent): Promise<void> {
  const item = payload.projects_v2_item
  
  if (item.content_type === 'Issue') {
    // Sync issue project assignment
    const syncInfo = await findSyncInfoByNodeId(item.content_node_id)
    if (syncInfo) {
      await updateIssueProject(syncInfo.objectId, item.project_node_id)
    }
  } else if (item.content_type === 'PullRequest') {
    // Sync PR project assignment
    const syncInfo = await findPRSyncInfoByNodeId(item.content_node_id)
    if (syncInfo) {
      await updatePRProject(syncInfo.objectId, item.project_node_id)
    }
  }
}
```

### Branch and Commit Tracking

```typescript
// Branch information tracking
interface GithubBranch {
  name: string
  sha: string
  protected: boolean
  default: boolean
}

// Commit linking
interface GithubCommit {
  sha: string
  message: string
  author: GithubUser
  url: string
  additions: number
  deletions: number
  files: GithubFile[]
}

// Link commits to issues via commit messages
async function linkCommitsToIssues(
  commits: GithubCommit[],
  repository: GithubIntegrationRepository
): Promise<void> {
  for (const commit of commits) {
    // Parse issue references from commit message
    const issueRefs = parseIssueReferences(commit.message)
    
    for (const issueRef of issueRefs) {
      const syncInfo = await findIssueSyncInfo(repository._id, issueRef.number)
      if (syncInfo) {
        // Add commit reference to issue
        await addCommitToIssue(syncInfo.objectId, commit)
      }
    }
  }
}
```

### Code Review Workflow

```typescript
// GitHub Review model
@Model(github.class.GithubReview, core.class.AttachedDoc, DOMAIN_GITHUB)
export class TGithubReview extends TAttachedDoc implements GithubReview {
  @Prop(TypeString(), getEmbeddedLabel('State'))
    state!: GithubPullRequestReviewState  // 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED'
  
  @Prop(TypeMarkup(), getEmbeddedLabel('Body'))
    body!: Markup
  
  @Prop(TypeRef(contact.class.Person), getEmbeddedLabel('Reviewer'))
    reviewer!: Ref<Person>
  
  @Prop(TypeDate(), getEmbeddedLabel('Submitted At'))
    submittedAt!: Timestamp
  
  // GitHub specifics
  githubId!: number
  htmlUrl!: string
  
  // Review comments collection
  @Prop(Collection(github.class.GithubReviewComment), getEmbeddedLabel('Comments'))
    comments!: number
}

// Review synchronization
async function syncReviewFromGithub(
  githubReview: any,
  pullRequest: GithubPullRequest,
  repository: GithubIntegrationRepository
): Promise<void> {
  const reviewer = await mapGithubUserToPerson(githubReview.user)
  
  await client.addCollection(
    github.class.GithubReview,
    repository.githubProject!,
    pullRequest._id,
    github.class.GithubPullRequest,
    'reviews',
    {
      state: githubReview.state,
      body: githubReview.body || '',
      reviewer: reviewer._id,
      submittedAt: new Date(githubReview.submitted_at).getTime(),
      githubId: githubReview.id,
      htmlUrl: githubReview.html_url
    }
  )
}
```

## Rate Limiting and Error Handling

### Rate Limiting Strategy

```typescript
// Rate limiting configuration
const rateLimitConfig = {
  maxRequests: config.RateLimit,     // Default: 25 requests
  windowMs: 60 * 1000,              // Per minute
  retryAfter: 60 * 1000             // Retry after 1 minute
}

// Rate limit handling
async function makeGithubRequest<T>(
  request: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
      const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000
      const waitTime = resetTime - Date.now()
      
      if (retries > 0 && waitTime > 0) {
        await sleep(waitTime)
        return makeGithubRequest(request, retries - 1)
      }
    }
    throw error
  }
}
```

### Error Recovery

```typescript
// Sync error handling
async function handleSyncError(
  error: any,
  syncInfo: DocSyncInfo,
  operation: string
): Promise<void> {
  const errorInfo = {
    operation,
    error: errorToObj(error),
    timestamp: Date.now(),
    syncInfo: syncInfo._id
  }
  
  // Log error for monitoring
  ctx.error('Sync operation failed', errorInfo)
  
  // Update sync info with error state
  await client.update(syncInfo, {
    needSync: 'error',
    lastModified: Date.now()
  })
  
  // Schedule retry for transient errors
  if (isTransientError(error)) {
    await scheduleRetry(syncInfo, operation)
  }
}
```

## MCP Integration Patterns

### GitHub Integration Setup

```typescript
// MCP method to configure GitHub integration
async function setupGithubIntegration(
  workspaceId: string,
  installationId: number,
  repositories: string[]
): Promise<void> {
  // Create integration record
  const integration = await client.createDoc(
    github.class.GithubIntegration,
    workspaceId,
    {
      installationId,
      clientId: config.ClientID,
      name: '', // Will be filled by GitHub data
      nodeId: '',
      alive: true,
      repositories: 0,
      type: 'Organization'
    }
  )
  
  // Enable repositories
  for (const repoName of repositories) {
    await enableRepositorySync(integration._id, repoName)
  }
}
```

### Sync Status Monitoring

```typescript
// MCP method to get sync status
async function getGithubSyncStatus(
  projectId: string
): Promise<GithubSyncStatus> {
  const syncInfos = await client.findAll(github.class.DocSyncInfo, {
    space: projectId
  })
  
  const pendingSync = syncInfos.filter(info => info.needSync !== '')
  const errors = syncInfos.filter(info => info.needSync === 'error')
  
  return {
    totalDocuments: syncInfos.length,
    pendingSync: pendingSync.length,
    errors: errors.length,
    lastSync: Math.max(...syncInfos.map(info => info.lastModified || 0))
  }
}
```

This comprehensive guide covers all aspects of Huly's GitHub integration, providing the foundation for advanced utilization and MCP server integration.
