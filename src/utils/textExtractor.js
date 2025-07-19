/**
 * Text Extraction Utilities
 * 
 * Functions for extracting plain text from various document formats
 * used in the Huly platform, including ProseMirror JSON documents
 */

/**
 * Extract text from ProseMirror JSON markup
 * 
 * ProseMirror documents have a tree structure with nodes containing
 * text content and formatting information. This function traverses
 * the tree and extracts only the text content.
 * 
 * @param {Object} doc - ProseMirror document object
 * @returns {string} Extracted plain text
 */
export function extractTextFromMarkup(doc) {
  if (!doc || typeof doc !== 'object') return '';
  
  let text = '';
  
  function traverse(node) {
    if (!node) return;
    
    // Extract text from text nodes
    if (node.type === 'text' && node.text) {
      text += node.text;
    }
    
    // Recursively process child nodes
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }
  
  traverse(doc);
  return text.trim();
}

/**
 * Extract text from a ProseMirror document with better formatting
 * 
 * This function extracts text while preserving paragraph breaks
 * and handling different node types for better readability.
 * 
 * @param {Object} doc - ProseMirror document object
 * @returns {string} Extracted text with formatting
 */
export function extractTextFromDoc(doc) {
  if (!doc || !doc.content) return '';
  
  let text = '';
  
  const processNode = (node) => {
    if (!node) return;
    
    // Handle text nodes
    if (node.type === 'text' && node.text) {
      text += node.text;
    }
    
    // Process child nodes
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(processNode);
    }
    
    // Add line breaks for block elements
    if (node.type === 'paragraph' || node.type === 'heading') {
      text += '\n';
    }
  };
  
  // Process all content nodes
  if (Array.isArray(doc.content)) {
    doc.content.forEach(processNode);
  } else if (doc.content) {
    processNode(doc.content);
  }
  
  return text.trim();
}

/**
 * Extract text from a ProseMirror document with advanced formatting
 * 
 * This function provides more sophisticated text extraction with
 * support for lists, quotes, code blocks, and other formatting.
 * 
 * @param {Object} doc - ProseMirror document object
 * @param {Object} options - Extraction options
 * @param {boolean} options.preserveFormatting - Preserve markdown-like formatting
 * @param {boolean} options.includeLinks - Include link URLs in output
 * @returns {string} Extracted text with optional formatting
 */
export function extractTextAdvanced(doc, options = {}) {
  if (!doc || !doc.content) return '';
  
  const {
    preserveFormatting = false,
    includeLinks = false
  } = options;
  
  let text = '';
  let listLevel = 0;
  
  const processNode = (node, depth = 0) => {
    if (!node) return;
    
    switch (node.type) {
      case 'text':
        if (node.text) {
          // Handle marks (bold, italic, etc.)
          let nodeText = node.text;
          if (preserveFormatting && node.marks) {
            node.marks.forEach(mark => {
              switch (mark.type) {
                case 'bold':
                case 'strong':
                  nodeText = `**${nodeText}**`;
                  break;
                case 'italic':
                case 'em':
                  nodeText = `*${nodeText}*`;
                  break;
                case 'code':
                  nodeText = `\`${nodeText}\``;
                  break;
                case 'link':
                  if (includeLinks && mark.attrs?.href) {
                    nodeText = `[${nodeText}](${mark.attrs.href})`;
                  }
                  break;
              }
            });
          }
          text += nodeText;
        }
        break;
        
      case 'paragraph':
        processChildren(node);
        text += '\n\n';
        break;
        
      case 'heading':
        if (preserveFormatting && node.attrs?.level) {
          text += '#'.repeat(node.attrs.level) + ' ';
        }
        processChildren(node);
        text += '\n\n';
        break;
        
      case 'bulletList':
      case 'orderedList':
        listLevel++;
        processChildren(node);
        listLevel--;
        if (listLevel === 0) {
          text += '\n';
        }
        break;
        
      case 'listItem':
        if (preserveFormatting) {
          text += '  '.repeat(Math.max(0, listLevel - 1));
          text += node.parent?.type === 'orderedList' ? '1. ' : '- ';
        }
        processChildren(node);
        text += '\n';
        break;
        
      case 'codeBlock':
        if (preserveFormatting) {
          text += '```';
          if (node.attrs?.language) {
            text += node.attrs.language;
          }
          text += '\n';
        }
        processChildren(node);
        if (preserveFormatting) {
          text += '\n```';
        }
        text += '\n\n';
        break;
        
      case 'blockquote':
        if (preserveFormatting) {
          const lines = [];
          const tempText = text;
          text = '';
          processChildren(node);
          const quotedText = text;
          text = tempText;
          quotedText.split('\n').forEach(line => {
            if (line.trim()) {
              text += '> ' + line + '\n';
            }
          });
        } else {
          processChildren(node);
        }
        text += '\n';
        break;
        
      case 'horizontalRule':
        if (preserveFormatting) {
          text += '---\n\n';
        } else {
          text += '\n\n';
        }
        break;
        
      default:
        processChildren(node);
    }
  };
  
  const processChildren = (node) => {
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => processNode(child));
    }
  };
  
  // Process the document
  if (Array.isArray(doc.content)) {
    doc.content.forEach(node => processNode(node));
  } else if (doc.content) {
    processNode(doc.content);
  }
  
  // Clean up extra whitespace
  return text
    .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with double
    .replace(/[ \t]+$/gm, '')     // Remove trailing spaces
    .trim();
}

/**
 * Try to parse a string as ProseMirror JSON and extract text
 * 
 * @param {string} jsonString - JSON string that might contain a ProseMirror document
 * @returns {string|null} Extracted text or null if not valid ProseMirror JSON
 */
export function extractTextFromJSON(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Check if it looks like a ProseMirror document
    if (parsed && parsed.type === 'doc' && parsed.content) {
      return extractTextFromDoc(parsed);
    }
    
    return null;
  } catch (error) {
    // Not valid JSON
    return null;
  }
}

/**
 * Extract text from various input types
 * 
 * This function attempts to extract text from different input formats,
 * including plain strings, ProseMirror documents, and JSON strings.
 * 
 * @param {string|Object} input - Input to extract text from
 * @param {Object} options - Extraction options
 * @returns {string} Extracted text
 */
export function extractText(input, options = {}) {
  if (!input) return '';
  
  // If it's already a string, check if it's JSON
  if (typeof input === 'string') {
    const extracted = extractTextFromJSON(input);
    return extracted !== null ? extracted : input;
  }
  
  // If it's an object, try to extract as ProseMirror document
  if (typeof input === 'object') {
    if (input.type === 'doc' && input.content) {
      return options.preserveFormatting 
        ? extractTextAdvanced(input, options)
        : extractTextFromDoc(input);
    }
  }
  
  // Fallback to string conversion
  return String(input);
}

/**
 * Truncate text to a maximum length, preserving word boundaries
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  // Adjust for suffix length
  const truncateAt = maxLength - suffix.length;
  
  // Find the last space before the truncate point
  let lastSpace = text.lastIndexOf(' ', truncateAt);
  
  // If no space found, just truncate at the limit
  if (lastSpace === -1 || lastSpace < truncateAt * 0.8) {
    lastSpace = truncateAt;
  }
  
  return text.substring(0, lastSpace).trim() + suffix;
}

/**
 * Clean and normalize text
 * 
 * Removes extra whitespace, normalizes line endings, and optionally
 * removes special characters.
 * 
 * @param {string} text - Text to clean
 * @param {Object} options - Cleaning options
 * @param {boolean} options.removeSpecialChars - Remove special characters
 * @param {boolean} options.lowercase - Convert to lowercase
 * @returns {string} Cleaned text
 */
export function cleanText(text, options = {}) {
  if (!text) return '';
  
  let cleaned = text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  if (options.removeSpecialChars) {
    // Remove non-alphanumeric characters except basic punctuation
    cleaned = cleaned.replace(/[^\w\s\-.,!?'"]/g, '');
  }
  
  if (options.lowercase) {
    cleaned = cleaned.toLowerCase();
  }
  
  return cleaned;
}