# Huly Atomic Operations and Concurrency Control Guide

## Overview

This guide provides comprehensive information about atomic operations, concurrency control, and sequence generation in the Huly platform, covering MongoDB atomic operations, transaction support, and best practices for handling concurrent updates.

## Atomic Operations Support

### $inc Operator Implementation

Huly fully supports MongoDB's `$inc` operator for atomic increments:

```typescript
// Core $inc operator implementation
function $inc (document: Doc, keyval: Record<string, number>): void {
  const doc = document as unknown as Record<string, number | undefined>
  for (const key in keyval) {
    const cur = doc[key] ?? 0
    doc[key] = cur + keyval[key]
  }
}

// Available operators in Huly
const operators: Record<string, _OperatorFunc> = {
  $push,    // Add to array
  $pull,    // Remove from array
  $update,  // Update array elements
  $inc,     // Atomic increment/decrement
  $unset,   // Remove fields
  $rename   // Rename fields
}
```

### Client API Atomic Updates

```typescript
// TxOperations supports atomic updates with $inc
interface IncOptions<T extends object> {
  $inc?: Partial<OmitNever<NumberProperties<T>>>
}

// DocumentUpdate includes atomic operations
type DocumentUpdate<T extends Doc> = Partial<Data<T>> &
  PushOptions<T> &
  SetEmbeddedOptions<T> &
  IncOptions<T> &        // Atomic increment support
  UnsetOptions &
  SpaceUpdate

// Example: Atomic increment usage
await client.updateDoc(
  tracker.class.Project,
  core.space.Space,
  projectId,
  { $inc: { sequence: 1 } },  // Atomic increment
  true                        // Return updated document
)
```

## MongoDB findOneAndUpdate Integration

### Server-Side Atomic Operations

```typescript
// MongoDB findOneAndUpdate in storage layer
async function atomicUpdate(tx: TxUpdateDoc<Doc>): Promise<TxResult> {
  if (tx.retrieve === true) {
    // Use findOneAndUpdate for atomic read-modify-write
    const res = await this.collection(domain).findOneAndUpdate(
      { _id: tx.objectId },
      {
        ...tx.operations,           // Include $inc, $set, etc.
        $set: {
          modifiedBy: tx.modifiedBy,
          modifiedOn: tx.modifiedOn,
          '%hash%': this.curHash()
        }
      } as unknown as UpdateFilter<Document>,
      { 
        returnDocument: 'after',    // Return updated document
        includeResultMetadata: true 
      }
    )
    return res.value as TxResult
  }
}
```

### Workspace Processing with Atomic Updates

```typescript
// Atomic workspace processing counter
async function getNextWorkspaceForProcessing(): Promise<WorkspaceRecord | undefined> {
  return await this.workspace.collection.findOneAndUpdate(
    query,
    {
      $inc: {
        'status.processingAttempts': 1  // Atomic increment
      },
      $set: {
        'status.lastProcessingTime': Date.now()
      }
    },
    {
      returnDocument: 'after',
      sort: {
        'status.lastVisit': -1  // Priority by last visit
      }
    }
  )
}
```

## Sequence Generation Patterns

### Issue Number Generation

```typescript
// Atomic issue number generation
async function getNextIssueNumber(projectId: Ref<Project>): Promise<number> {
  const project = await client.findOne(tracker.class.Project, { _id: projectId })
  if (!project) throw new Error('Project not found')
  
  // Atomic increment with document return
  const result = await client.updateDoc(
    tracker.class.Project,
    core.space.Space,
    projectId,
    { $inc: { sequence: 1 } },  // Atomic increment
    true                        // Return updated document
  )
  
  return (result as any).object.sequence
}

// Usage in issue creation
const incResult = await client.updateDoc(
  tracker.class.Project,
  core.space.Space,
  projectSpace,
  { $inc: { sequence: 1 } },
  true
)
const number = (incResult as any).object.sequence
const identifier = `${project.identifier}-${number}`
```

### Training Sequence Generation

```typescript
// Generic sequence generation using core.class.Sequence
async function getNextTrainingSeqNumber(): Promise<number> {
  const client = getClient()
  
  // Find sequence document for training class
  const sequence = await client.findOne(
    core.class.Sequence, 
    { attachedTo: training.class.Training }
  )
  
  if (sequence === undefined) {
    throw new Error(`Sequence for ${training.class.Training} not found`)
  }
  
  // Atomic increment
  const inc = await client.update(
    sequence, 
    { $inc: { sequence: 1 } }, 
    true
  )
  
  return (inc as { object: Sequence }).object.sequence
}
```

### Project Model with Sequence

```typescript
// Project model includes sequence field for atomic numbering
@Model(tracker.class.Project, task.class.Project)
export class TProject extends TTaskProject implements Project {
  // Issue numbering sequence (hidden from UI)
  @Prop(TypeNumber(), tracker.string.Number)
  @Hidden()
    sequence!: number  // Atomically incremented for issue numbers
  
  // Project identifier for issue formatting
  @Prop(TypeString(), tracker.string.ProjectIdentifier)
  @Index(IndexKind.FullText)
    identifier!: IntlString  // Used in "PROJ-123" format
}
```

## Transaction Support

### TxApplyIf - Conditional Transactions

```typescript
// TxApplyIf provides conditional transaction support
interface TxApplyIf extends Tx {
  scope?: string                        // Synchronization scope
  match: DocumentClassQuery<Doc>[]      // Conditions that must match
  notMatch: DocumentClassQuery<Doc>[]   // Conditions that must not match
  txes: TxCUD<Doc>[]                   // Transactions to apply if conditions met
  measureName?: string                  // Performance measurement
}

// Create conditional transaction
const applyIf = txFactory.createTxApplyIf(
  core.space.Tx,
  'issue-creation-scope',  // Synchronization scope
  [],                      // Match conditions
  [],                      // Not match conditions
  [createTx, updateTx],    // Transactions to apply
  'create-issue'           // Measurement name
)
```

### Scoped Synchronization

```typescript
// Scope-based concurrency control
async function verifyApplyIf(applyIf: TxApplyIf): Promise<{
  onEnd: () => void
  passed: boolean
}> {
  if (applyIf.scope == null) {
    return { passed: true, onEnd: () => {} }
  }
  
  // Wait for existing scope operations to complete
  const scopePromise = this.scopes.get(applyIf.scope)
  if (scopePromise != null) {
    await scopePromise
  }
  
  // Create new scope lock
  let onEnd = (): void => {}
  this.scopes.set(
    applyIf.scope,
    new Promise((resolve) => {
      onEnd = () => {
        this.scopes.delete(applyIf.scope)
        resolve(null)
      }
    })
  )
  
  return { passed: true, onEnd }
}
```

### Apply Operations Pattern

```typescript
// Batch operations with transaction support
class ApplyOperations {
  private txes: TxCUD<Doc>[] = []
  private scope?: string
  private matches: DocumentClassQuery<Doc>[] = []
  private notMatches: DocumentClassQuery<Doc>[] = []
  
  // Add operations to batch
  async update<T extends Doc>(
    doc: T, 
    operations: DocumentUpdate<T>
  ): Promise<void> {
    const tx = this.ops.txFactory.createTxUpdateDoc(
      doc._class,
      doc.space,
      doc._id,
      operations
    )
    this.txes.push(tx)
  }
  
  // Commit all operations atomically
  async commit(): Promise<{ result: boolean, time: number, serverTime: number }> {
    if (this.txes.length > 0) {
      const aop = this.ops.txFactory.createTxApplyIf(
        core.space.Tx,
        this.scope,
        this.matches,
        this.notMatches,
        this.txes
      )
      
      const result = await this.ops.tx(aop) as TxApplyResult
      this.txes = []
      
      return {
        result: result.success,
        time: Date.now() - startTime,
        serverTime: result.serverTime
      }
    }
    return { result: true, time: 0, serverTime: 0 }
  }
}
```

## Concurrency Control Mechanisms

### Optimistic Locking with Hash

```typescript
// Document hash for optimistic locking
interface Doc {
  '%hash%'?: string  // Document hash for change detection
}

// Update with hash verification
async function updateWithOptimisticLock<T extends Doc>(
  doc: T,
  operations: DocumentUpdate<T>
): Promise<void> {
  const currentHash = doc['%hash%']
  
  const result = await client.updateDoc(
    doc._class,
    doc.space,
    doc._id,
    {
      ...operations,
      $set: {
        '%hash%': generateNewHash()
      }
    },
    true
  )
  
  // Verify hash hasn't changed (optimistic locking)
  if (result && (result as any).object['%hash%'] !== currentHash) {
    throw new Error('Document was modified by another process')
  }
}
```

### PostgreSQL Row Locking

```typescript
// PostgreSQL SELECT FOR UPDATE support
async function rawUpdateWithLocking<T extends Doc>(
  domain: Domain,
  query: DocumentQuery<T>,
  operations: DocumentUpdate<T>
): Promise<void> {
  await this.mgr.write(undefined, this.mgrId, async (client) => {
    // Lock rows for update
    const res = await client.execute(
      `SELECT * FROM ${translateDomain(domain)} WHERE ${translatedQuery} FOR UPDATE`,
      vars.getValues()
    )
    
    // Apply operations to locked rows
    // ... update logic
  })
}
```

## Best Practices for MCP Implementation

### 1. Use Atomic Increments for Sequences

```typescript
// Always use $inc for sequence generation
async function generateIssueNumber(projectId: Ref<Project>): Promise<string> {
  const project = await client.findOne(tracker.class.Project, { _id: projectId })
  
  // Atomic increment
  const result = await client.updateDoc(
    tracker.class.Project,
    core.space.Space,
    projectId,
    { $inc: { sequence: 1 } },
    true  // Return updated document
  )
  
  const number = (result as any).object.sequence
  return `${project.identifier}-${number}`
}
```

### 2. Use Scoped Transactions for Related Operations

```typescript
// Group related operations in scoped transactions
async function createIssueWithComments(issueData: any, comments: string[]): Promise<void> {
  const operations = client.apply('issue-creation', 'create-issue-with-comments')
  
  // Create issue
  const issueId = await operations.createDoc(
    tracker.class.Issue,
    projectSpace,
    issueData
  )
  
  // Add comments
  for (const comment of comments) {
    await operations.addCollection(
      chunter.class.ChatMessage,
      projectSpace,
      issueId,
      tracker.class.Issue,
      'comments',
      { message: comment }
    )
  }
  
  // Commit all operations atomically
  await operations.commit()
}
```

### 3. Handle Concurrent Updates Gracefully

```typescript
// Retry pattern for concurrent updates
async function updateWithRetry<T extends Doc>(
  doc: T,
  operations: DocumentUpdate<T>,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await client.updateDoc(doc._class, doc.space, doc._id, operations)
      return
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
      
      // Refresh document state
      const updated = await client.findOne(doc._class, { _id: doc._id })
      if (updated) {
        doc = updated
      }
    }
  }
}
```

### 4. Use Sequence Documents for Global Counters

```typescript
// Create sequence document for custom counters
async function createSequence(attachedTo: Ref<Class<Doc>>): Promise<void> {
  await client.createDoc(
    core.class.Sequence,
    core.space.Model,
    {
      attachedTo,
      sequence: 0
    }
  )
}

// Use sequence for atomic numbering
async function getNextSequenceNumber(attachedTo: Ref<Class<Doc>>): Promise<number> {
  const sequence = await client.findOne(
    core.class.Sequence,
    { attachedTo }
  )
  
  if (!sequence) {
    throw new Error(`Sequence not found for ${attachedTo}`)
  }
  
  const result = await client.update(
    sequence,
    { $inc: { sequence: 1 } },
    true
  )
  
  return (result as any).object.sequence
}
```

## Summary

Huly provides comprehensive atomic operation support through:

1. **MongoDB Atomic Operations**: Full support for `$inc`, `$push`, `$pull`, `$set`, `$unset`
2. **findOneAndUpdate**: Server-side atomic read-modify-write operations
3. **Transaction Support**: TxApplyIf for conditional, scoped transactions
4. **Sequence Generation**: Atomic counter patterns for issue numbers and IDs
5. **Concurrency Control**: Optimistic locking with document hashes and scoped synchronization
6. **PostgreSQL Support**: Row-level locking with SELECT FOR UPDATE

These mechanisms ensure data consistency and handle concurrent access safely in production environments.
