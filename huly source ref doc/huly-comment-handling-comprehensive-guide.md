# Huly Comment Handling Comprehensive Guide

## Overview

This guide provides complete information about comment handling in Huly, covering all comment types, creation patterns, threading, reactions, and advanced features for building comprehensive comment functionality in MCP servers.

## Comment System Architecture

### Core Comment Classes

```typescript
// Base activity message
interface ActivityMessage extends AttachedDoc {
  modifiedBy: PersonId
  modifiedOn: Timestamp
  isPinned?: boolean
  repliedPersons?: Ref<Person>[]
  lastReply?: Timestamp
  replies?: number
  reactions?: number
  editedOn?: Timestamp
}

// Regular chat message
interface ChatMessage extends ActivityMessage {
  message: Markup              // Direct markup storage
  attachments?: number         // Attachment count
  editedOn?: Timestamp
  provider?: Ref<SocialChannelProvider>
}

// Thread message (reply to another message)
interface ThreadMessage extends ChatMessage {
  attachedTo: Ref<ActivityMessage>        // Parent message
  attachedToClass: Ref<Class<ActivityMessage>>
  objectId: Ref<Doc>                      // Original object (e.g., Issue)
  objectClass: Ref<Class<Doc>>            // Original object class
}

// Document-specific comments
interface DocumentComment extends ChatMessage {
  nodeId?: string             // Specific node in document
  resolved?: boolean          // Comment resolution status
  index?: number             // Comment sequence number
}
```

### Comment Attachment Patterns

#### 1. Direct Attachment (Regular Comments)
```typescript
// Comments attached directly to objects
{
  attachedTo: issueId,                    // The issue ID
  attachedToClass: tracker.class.Issue   // The issue class
}
```

#### 2. Thread Attachment (Replies)
```typescript
// Thread messages attached to parent messages
{
  attachedTo: parentMessageId,            // Parent comment ID
  attachedToClass: chunter.class.ChatMessage,
  objectId: issueId,                      // Original object
  objectClass: tracker.class.Issue       // Original object class
}
```

#### 3. Document Comments (Node-specific)
```typescript
// Comments on specific document nodes
{
  attachedTo: documentId,
  attachedToClass: documents.class.Document,
  nodeId: "paragraph-123",               // Specific document node
  resolved: false,
  index: 1                               // Sequential comment number
}
```

## Comment Creation

### Basic Comment Creation

```typescript
// Create a regular comment on an issue
const commentId = await client.addCollection(
  chunter.class.ChatMessage,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'comments',
  {
    message: 'This is a **markdown** comment with formatting'
  }
)
```

### Thread Reply Creation

```typescript
// Create a reply to an existing comment
const replyId = await client.addCollection(
  chunter.class.ThreadMessage,
  projectSpace,
  parentCommentId,
  chunter.class.ChatMessage,
  'replies',
  {
    message: 'This is a reply to the comment',
    objectId: issueId,                    // Reference back to original object
    objectClass: tracker.class.Issue
  }
)
```

### Document Comment Creation

```typescript
// Create a comment on a specific document node
const docCommentId = await client.addCollection(
  documents.class.DocumentComment,
  documentSpace,
  documentId,
  documents.class.Document,
  'comments',
  {
    message: 'Comment on this specific paragraph',
    nodeId: 'paragraph-123',
    resolved: false,
    index: await getNextCommentIndex(documentId)
  }
)

// Helper function to get next comment index
async function getNextCommentIndex(documentId: Ref<Document>): Promise<number> {
  const result = await client.update(document, { $inc: { commentSequence: 1 } }, true)
  return (result as any).object.commentSequence
}
```

## Comment Querying and Retrieval

### Get All Comments for an Object

```typescript
// Get all activity messages (includes all comment types)
const allComments = await client.findAll(
  activity.class.ActivityMessage,
  {
    attachedTo: issueId,
    attachedToClass: tracker.class.Issue
  },
  {
    sort: { createdOn: SortingOrder.Ascending },
    lookup: {
      createdBy: contact.class.Person,
      reactions: activity.class.Reaction
    }
  }
)

// Get only chat messages (excludes system messages)
const chatComments = await client.findAll(
  chunter.class.ChatMessage,
  {
    attachedTo: issueId,
    attachedToClass: tracker.class.Issue
  }
)
```

### Get Threaded Comments

```typescript
// Get thread messages for a specific object
const threadMessages = await client.findAll(
  chunter.class.ThreadMessage,
  {
    objectId: issueId,
    objectClass: tracker.class.Issue
  },
  {
    sort: { createdOn: SortingOrder.Ascending },
    lookup: {
      attachedTo: chunter.class.ChatMessage  // Parent message
    }
  }
)

// Build comment tree structure
function buildCommentTree(comments: ActivityMessage[], threads: ThreadMessage[]) {
  const commentMap = new Map()
  
  // Add root comments
  comments.forEach(comment => {
    commentMap.set(comment._id, { ...comment, replies: [] })
  })
  
  // Add thread replies
  threads.forEach(thread => {
    const parent = commentMap.get(thread.attachedTo)
    if (parent) {
      parent.replies.push(thread)
    }
  })
  
  return Array.from(commentMap.values())
}
```

### Document Comments with Filtering

```typescript
// Get document comments with resolution filtering
const unresolvedComments = await client.findAll(
  documents.class.DocumentComment,
  {
    attachedTo: documentId,
    resolved: { $ne: true }  // Only unresolved comments
  },
  {
    sort: { index: SortingOrder.Ascending }
  }
)

// Get comments for specific document node
const nodeComments = await client.findAll(
  documents.class.DocumentComment,
  {
    attachedTo: documentId,
    nodeId: 'paragraph-123'
  }
)
```

## Comment Editing and Management

### Update Comment Content

```typescript
// Edit comment message
await client.updateCollection(
  chunter.class.ChatMessage,
  projectSpace,
  commentId,
  issueId,
  tracker.class.Issue,
  'comments',
  {
    message: 'Updated comment content',
    editedOn: Date.now()
  }
)
```

### Delete Comments

```typescript
// Delete a comment
await client.removeCollection(
  chunter.class.ChatMessage,
  projectSpace,
  commentId,
  issueId,
  tracker.class.Issue,
  'comments'
)

// Note: This automatically decrements the parent object's comment counter
```

### Resolve Document Comments

```typescript
// Mark document comment as resolved
await client.updateCollection(
  documents.class.DocumentComment,
  documentSpace,
  commentId,
  documentId,
  documents.class.Document,
  'comments',
  {
    resolved: true
  }
)
```

## Comment Reactions

### Reaction Structure

```typescript
interface Reaction extends AttachedDoc {
  emoji: string               // Emoji character or custom emoji ID
  createBy: PersonId         // Who added the reaction
  attachedTo: Ref<ActivityMessage>  // The comment being reacted to
}
```

### Add Reactions

```typescript
// Add reaction to a comment
const reactionId = await client.addCollection(
  activity.class.Reaction,
  projectSpace,
  commentId,
  chunter.class.ChatMessage,
  'reactions',
  {
    emoji: '👍'
  }
)
```

### Query Reactions

```typescript
// Get all reactions for a comment
const reactions = await client.findAll(
  activity.class.Reaction,
  {
    attachedTo: commentId
  },
  {
    lookup: {
      createBy: contact.class.Person
    }
  }
)

// Group reactions by emoji
const reactionsByEmoji = reactions.reduce((acc, reaction) => {
  if (!acc[reaction.emoji]) {
    acc[reaction.emoji] = []
  }
  acc[reaction.emoji].push(reaction)
  return acc
}, {} as Record<string, Reaction[]>)
```

### Toggle Reactions

```typescript
// Toggle reaction (add if not exists, remove if exists)
async function toggleReaction(commentId: Ref<ChatMessage>, emoji: string) {
  const account = await client.getAccount()
  
  const existingReaction = await client.findOne(
    activity.class.Reaction,
    {
      attachedTo: commentId,
      emoji: emoji,
      createBy: account.primarySocialId
    }
  )
  
  if (existingReaction) {
    // Remove existing reaction
    await client.removeCollection(
      activity.class.Reaction,
      projectSpace,
      existingReaction._id,
      commentId,
      chunter.class.ChatMessage,
      'reactions'
    )
  } else {
    // Add new reaction
    await client.addCollection(
      activity.class.Reaction,
      projectSpace,
      commentId,
      chunter.class.ChatMessage,
      'reactions',
      {
        emoji: emoji
      }
    )
  }
}
```

## Comment Attachments

### Add Attachments to Comments

```typescript
// Upload file and attach to comment
async function addCommentAttachment(
  commentId: Ref<ChatMessage>,
  file: File
): Promise<Ref<Attachment>> {
  // 1. Upload file as blob
  const blobId = await client.uploadBlob(file)
  
  // 2. Create attachment record
  const attachmentId = await client.addCollection(
    attachment.class.Attachment,
    projectSpace,
    commentId,
    chunter.class.ChatMessage,
    'attachments',
    {
      name: file.name,
      file: blobId,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      description: ''
    }
  )
  
  return attachmentId
}
```

### Query Comment Attachments

```typescript
// Get all attachments for a comment
const attachments = await client.findAll(
  attachment.class.Attachment,
  {
    attachedTo: commentId,
    attachedToClass: chunter.class.ChatMessage
  }
)
```

## Real-time Comment Updates

### Live Comment Subscriptions

```typescript
// Subscribe to comment updates for an issue
const unsubscribe = client.query(
  activity.class.ActivityMessage,
  {
    attachedTo: issueId,
    attachedToClass: tracker.class.Issue
  },
  (result) => {
    console.log('Comments updated:', result)
    // Update UI with new comments
    updateCommentsUI(result)
  },
  {
    sort: { createdOn: SortingOrder.Ascending }
  }
)

// Clean up subscription
unsubscribe()
```

### Comment Notifications

```typescript
// Comments automatically trigger notifications through the activity system
// The notification system handles:
// - Notifying mentioned users (@username)
// - Notifying issue assignees and watchers
// - Notifying document collaborators
// - Email notifications based on user preferences
```

## Advanced Comment Features

### Comment Mentions

```typescript
// Comments support @mentions which automatically notify users
const commentWithMention = await client.addCollection(
  chunter.class.ChatMessage,
  projectSpace,
  issueId,
  tracker.class.Issue,
  'comments',
  {
    message: 'Hey @john.doe, can you review this?'
  }
)
// The system automatically parses mentions and creates notifications
```

### Comment Search

```typescript
// Search comments by content
const searchResults = await client.findAll(
  chunter.class.ChatMessage,
  {
    $search: 'bug critical',
    space: projectSpace
  }
)

// Search comments by author
const authorComments = await client.findAll(
  chunter.class.ChatMessage,
  {
    createdBy: authorId,
    attachedTo: issueId
  }
)
```

### Comment Export

```typescript
// Export all comments for an issue
async function exportComments(issueId: Ref<Issue>) {
  const comments = await client.findAll(
    activity.class.ActivityMessage,
    {
      attachedTo: issueId,
      attachedToClass: tracker.class.Issue
    },
    {
      lookup: {
        createdBy: contact.class.Person,
        attachments: attachment.class.Attachment
      }
    }
  )
  
  return comments.map(comment => ({
    id: comment._id,
    author: comment.$lookup?.createdBy?.name,
    content: comment.message,
    createdOn: new Date(comment.createdOn),
    attachments: comment.$lookup?.attachments || []
  }))
}
```

## Best Practices for MCP Implementation

### 1. Use Collection Counters
```typescript
// Always use the collection counter for accurate counts
const commentCount = issue.comments || 0
// Don't manually count query results
```

### 2. Handle All Comment Types
```typescript
// Query all activity messages, not just ChatMessage
const allComments = await client.findAll(activity.class.ActivityMessage, query)
```

### 3. Implement Threading
```typescript
// Always consider thread messages when building comment systems
const threads = await client.findAll(chunter.class.ThreadMessage, {
  objectId: issueId,
  objectClass: tracker.class.Issue
})
```

### 4. Support Real-time Updates
```typescript
// Use live queries for real-time comment updates
const unsubscribe = client.query(activity.class.ActivityMessage, query, callback)
```

### 5. Handle Permissions
```typescript
// Check permissions before comment operations
const canComment = client.getHierarchy().hasPermission(
  account, 
  core.permission.CreateDoc, 
  projectSpace
)
```

This comprehensive guide covers all aspects of comment handling in Huly, providing the foundation for building robust comment functionality in MCP servers.
