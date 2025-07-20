# uploadMarkup Method Documentation

## Overview

The `uploadMarkup` method is a core function in the Huly platform used to save markup content (rich text) for document objects. It provides a unified interface for uploading content in multiple formats (HTML, Markdown, or internal markup) and stores it in the collaborative document system.

## Method Signature

```typescript
async uploadMarkup(
  objectClass: Ref<Class<Doc>>,
  objectId: Ref<Doc>,
  objectAttr: string,
  value: string,
  format: MarkupFormat
): Promise<MarkupRef>
```

## Parameters

### 1. `objectClass: Ref<Class<Doc>>`
- **Type**: Reference to a document class
- **Purpose**: Identifies the type/class of the document where the markup will be stored
- **Examples**: 
  - `document.class.Document`
  - `task.class.Issue`
  - `contact.class.Person`

### 2. `objectId: Ref<Doc>`
- **Type**: Reference to a specific document instance
- **Purpose**: Identifies the specific document instance where the markup will be stored
- **Examples**: 
  - `"doc123"`
  - `"issue456"`
  - `"person789"`

### 3. `objectAttr: string`
- **Type**: String
- **Purpose**: The attribute/field name on the document where the markup should be saved
- **Examples**: 
  - `"content"` - for main document content
  - `"description"` - for descriptions
  - `"comments"` - for comment fields
  - `"notes"` - for note fields

### 4. `value: string`
- **Type**: String
- **Purpose**: The actual markup content to be uploaded
- **Format**: Content format depends on the `format` parameter
- **Examples**:
  ```html
  <!-- HTML format -->
  "<p>Hello <strong>world</strong>!</p>"
  
  <!-- Markdown format -->
  "Hello **world**!"
  
  <!-- Internal markup format -->
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello "},{"type":"text","marks":[{"type":"bold"}],"text":"world"},{"type":"text","text":"!"}]}]}'
  ```

### 5. `format: MarkupFormat`
- **Type**: Union type `'markup' | 'html' | 'markdown'`
- **Purpose**: Specifies the format of the input `value` parameter
- **Options**:
  - `'markup'` - Internal Huly markup format (JSON-based)
  - `'html'` - Standard HTML markup
  - `'markdown'` - Markdown syntax

## Return Value

- **Type**: `Promise<MarkupRef>`
- **Description**: Returns a promise that resolves to a reference to the stored markup blob
- **Usage**: This reference can be used later with `fetchMarkup` to retrieve the content

```typescript
type MarkupRef = Ref<Blob>
```

## Implementation Details

### Format Processing

The method handles three different input formats through automatic conversion:

1. **`'markup'`**: Uses the value directly as internal markup format
2. **`'html'`**: Converts HTML to internal markup format via `htmlToJSON` → `jsonToMarkup`
3. **`'markdown'`**: Converts Markdown to internal markup format via `markdownToMarkup` → `jsonToMarkup`

```typescript
switch (format) {
  case 'markup':
    markup = value
    break
  case 'html':
    markup = jsonToMarkup(htmlToJSON(value))
    break
  case 'markdown':
    markup = jsonToMarkup(markdownToMarkup(value, { refUrl: this.refUrl, imageUrl: this.imageUrl }))
    break
  default:
    throw new Error('Unknown content format')
}
```

### Collaborative Document Integration

The method uses the collaborative document system:

1. Creates a collaborative document ID using `makeCollabId(objectClass, objectId, objectAttr)`
2. Stores the markup using `this.collaborator.createMarkup(collabId, markup)`
3. Returns a blob reference for future retrieval

## Usage Examples

### Basic Usage

```typescript
// Upload HTML content
const markupRef = await client.uploadMarkup(
  document.class.Document,
  documentId,
  'content',
  '<p>Hello <strong>world</strong>!</p>',
  'html'
);

// Upload Markdown content
const markupRef = await client.uploadMarkup(
  task.class.Issue,
  issueId,
  'description',
  'This is a **bold** statement with a [link](https://example.com)',
  'markdown'
);
```

### Using with MarkupContent Helpers

```typescript
import { html, markdown } from '@hcengineering/api-client'

// Create MarkupContent objects
const htmlContent = html('<p>Rich <em>text</em> content</p>');
const markdownContent = markdown('# Header\n\nSome **bold** text');

// These can be used in document creation
const docData = {
  title: 'My Document',
  content: htmlContent,
  description: markdownContent
};
```

### Automatic Processing in Document Operations

The `uploadMarkup` method is automatically called when creating or updating documents with `MarkupContent` fields:

```typescript
// This automatically processes markup fields
await client.createDoc(
  document.class.Document,
  spaceId,
  {
    title: 'My Document',
    content: html('<p>Document content</p>'),
    description: markdown('Document **description**')
  }
);
```

## Error Handling

The method throws an error for unsupported formats:

```typescript
// This will throw: "Unknown content format"
await client.uploadMarkup(objectClass, objectId, 'content', 'text', 'unsupported');
```

## Related Methods

### fetchMarkup
Retrieves previously uploaded markup content:

```typescript
async fetchMarkup(
  objectClass: Ref<Class<Doc>>,
  objectId: Ref<Doc>,
  objectAttr: string,
  markup: MarkupRef,
  format: MarkupFormat
): Promise<string>
```

## Key Features

1. **Multi-format Support**: Accepts HTML, Markdown, and internal markup formats
2. **Automatic Conversion**: Converts input formats to internal representation
3. **Collaborative Storage**: Integrates with the collaborative document system
4. **URL Context**: Properly handles links and images in Markdown/HTML conversion
5. **Type Safety**: Fully typed with TypeScript for better development experience
6. **Blob Storage**: Returns references for efficient content management

## Best Practices

1. **Choose the Right Format**: Use the format that matches your input data
2. **Handle Promises**: Always await the method call or handle the promise properly
3. **Store References**: Keep the returned `MarkupRef` for future content retrieval
4. **Error Handling**: Wrap calls in try-catch blocks for production code
5. **Content Validation**: Validate input content before uploading when possible

## File Locations

- **Implementation**: `packages/api-client/src/markup/client.ts`
- **Types**: `packages/api-client/src/markup/types.ts`
- **Client Interface**: `packages/api-client/src/client.ts`
