/**
 * Text Extractor Tests
 *
 * Tests for text extraction utilities
 */

import { describe, test, expect } from '@jest/globals';
import {
  extractTextFromMarkup,
  extractTextFromDoc,
  extractTextAdvanced,
  extractTextFromJSON,
  extractText,
  truncateText,
  cleanText,
} from '../../../src/utils/textExtractor.js';

describe('Text Extractor Tests', () => {
  describe('extractTextFromMarkup', () => {
    test('should handle null or undefined input', () => {
      expect(extractTextFromMarkup(null)).toBe('');
      expect(extractTextFromMarkup(undefined)).toBe('');
      expect(extractTextFromMarkup('')).toBe('');
    });

    test('should handle non-object input', () => {
      expect(extractTextFromMarkup('string')).toBe('');
      expect(extractTextFromMarkup(123)).toBe('');
      expect(extractTextFromMarkup([])).toBe('');
    });

    test('should extract text from simple text node', () => {
      const doc = {
        type: 'text',
        text: 'Hello, world!',
      };
      expect(extractTextFromMarkup(doc)).toBe('Hello, world!');
    });

    test('should extract text from nested structure', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }],
          },
        ],
      };
      expect(extractTextFromMarkup(doc)).toBe('First paragraphSecond paragraph');
    });

    test('should handle empty content arrays', () => {
      const doc = {
        type: 'doc',
        content: [],
      };
      expect(extractTextFromMarkup(doc)).toBe('');
    });

    test('should skip non-text nodes', () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'horizontalRule' },
          { type: 'text', text: 'Text content' },
          { type: 'image', attrs: { src: 'image.png' } },
        ],
      };
      expect(extractTextFromMarkup(doc)).toBe('Text content');
    });
  });

  describe('extractTextFromDoc', () => {
    test('should handle null or undefined input', () => {
      expect(extractTextFromDoc(null)).toBe('');
      expect(extractTextFromDoc(undefined)).toBe('');
      expect(extractTextFromDoc({})).toBe('');
    });

    test('should extract text with paragraph breaks', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }],
          },
        ],
      };
      expect(extractTextFromDoc(doc)).toBe('First paragraph\nSecond paragraph');
    });

    test('should handle headings with line breaks', () => {
      const doc = {
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Title' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content below' }],
          },
        ],
      };
      expect(extractTextFromDoc(doc)).toBe('Main Title\nContent below');
    });

    test('should handle nested content structures', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Text with ' },
              {
                type: 'strong',
                content: [{ type: 'text', text: 'bold' }],
              },
              { type: 'text', text: ' content' },
            ],
          },
        ],
      };
      expect(extractTextFromDoc(doc)).toBe('Text with bold content');
    });

    test('should handle non-array content', () => {
      const doc = {
        content: {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Single paragraph' }],
        },
      };
      expect(extractTextFromDoc(doc)).toBe('Single paragraph');
    });
  });

  describe('extractTextAdvanced', () => {
    test('should extract plain text by default', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Plain text' }],
          },
        ],
      };
      expect(extractTextAdvanced(doc)).toBe('Plain text');
    });

    test('should preserve bold formatting when requested', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bold text',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe('**bold text**');
    });

    test('should preserve italic formatting when requested', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'italic text',
                marks: [{ type: 'italic' }],
              },
            ],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe('*italic text*');
    });

    test('should preserve code formatting when requested', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'code snippet',
                marks: [{ type: 'code' }],
              },
            ],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe('`code snippet`');
    });

    test('should handle links with includeLinks option', () => {
      const doc = {
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'click here',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true, includeLinks: true })).toBe(
        '[click here](https://example.com)'
      );
    });

    test('should handle headings with formatting', () => {
      const doc = {
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Section Title' }],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe('## Section Title');
    });

    test('should handle bullet lists', () => {
      const doc = {
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'text', text: 'First item' }],
              },
              {
                type: 'listItem',
                content: [{ type: 'text', text: 'Second item' }],
              },
            ],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe(
        '- First item\n- Second item'
      );
    });

    test('should handle code blocks', () => {
      const doc = {
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 42;' }],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe(
        '```javascript\nconst x = 42;\n```'
      );
    });

    test('should handle blockquotes', () => {
      const doc = {
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quoted text' }],
              },
            ],
          },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe('> Quoted text');
    });

    test('should handle horizontal rules', () => {
      const doc = {
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
          { type: 'horizontalRule' },
          { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
        ],
      };
      expect(extractTextAdvanced(doc, { preserveFormatting: true })).toBe('Before\n\n---\n\nAfter');
    });
  });

  describe('extractTextFromJSON', () => {
    test('should handle null or invalid input', () => {
      expect(extractTextFromJSON(null)).toBe(null);
      expect(extractTextFromJSON(undefined)).toBe(null);
      expect(extractTextFromJSON('')).toBe(null);
      expect(extractTextFromJSON('not json')).toBe(null);
    });

    test('should extract text from valid JSON', () => {
      const json = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'JSON content' }],
          },
        ],
      });
      expect(extractTextFromJSON(json)).toBe('JSON content');
    });

    test('should return null for non-ProseMirror JSON', () => {
      const json = JSON.stringify({ foo: 'bar' });
      expect(extractTextFromJSON(json)).toBe(null);
    });
  });

  describe('extractText', () => {
    test('should handle plain strings', () => {
      expect(extractText('Plain string')).toBe('Plain string');
    });

    test('should extract from JSON strings', () => {
      const json = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'JSON text' }],
          },
        ],
      });
      expect(extractText(json)).toBe('JSON text');
    });

    test('should extract from ProseMirror objects', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Object text' }],
          },
        ],
      };
      expect(extractText(doc)).toBe('Object text');
    });

    test('should use advanced extraction with options', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      };
      expect(extractText(doc, { preserveFormatting: true })).toBe('# Title');
    });

    test('should convert non-string/object to string', () => {
      expect(extractText(123)).toBe('123');
      expect(extractText(true)).toBe('true');
    });
  });

  describe('truncateText', () => {
    test('should not truncate short text', () => {
      expect(truncateText('Short text', 20)).toBe('Short text');
    });

    test('should truncate long text at word boundary', () => {
      const text = 'This is a very long text that needs to be truncated';
      expect(truncateText(text, 20)).toBe('This is a very...');
    });

    test('should use custom suffix', () => {
      const text = 'This is a very long text';
      expect(truncateText(text, 15, '…')).toBe('This is a very…');
    });

    test('should handle text without spaces', () => {
      const text = 'verylongtextwithoutspaces';
      expect(truncateText(text, 10)).toBe('verylon...');
    });

    test('should handle null or empty text', () => {
      expect(truncateText(null, 10)).toBe(null);
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('cleanText', () => {
    test('should normalize line endings', () => {
      expect(cleanText('Line1\r\nLine2\rLine3')).toBe('Line1\nLine2\nLine3');
    });

    test('should remove zero-width characters', () => {
      expect(cleanText('Text\u200Bwith\u200Czero\u200Dwidth')).toBe('Textwithzerowidth');
    });

    test('should normalize whitespace', () => {
      expect(cleanText('Text   with    multiple    spaces')).toBe('Text with multiple spaces');
    });

    test('should remove excessive newlines', () => {
      expect(cleanText('Line1\n\n\n\nLine2')).toBe('Line1\n\nLine2');
    });

    test('should remove special characters when requested', () => {
      expect(cleanText('Text!@#$%^&*()_+', { removeSpecialChars: true })).toBe('Text!_');
    });

    test('should convert to lowercase when requested', () => {
      expect(cleanText('UPPERCASE Text', { lowercase: true })).toBe('uppercase text');
    });

    test('should handle null or empty text', () => {
      expect(cleanText(null)).toBe('');
      expect(cleanText('')).toBe('');
    });

    test('should trim whitespace', () => {
      expect(cleanText('  Text with spaces  ')).toBe('Text with spaces');
    });
  });
});
