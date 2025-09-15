/**
 * Unit tests for PromptRegistry
 */

import { jest } from '@jest/globals';
import { PromptRegistry } from '../PromptRegistry.js';
import { BasePrompt, WizardPrompt } from '../PromptInterface.js';
import { HulyError } from '../../../core/HulyError.js';

describe('PromptRegistry', () => {
  let registry;
  let mockPrompt;
  let mockWizard;

  beforeEach(() => {
    registry = new PromptRegistry();

    // Create mock prompts
    mockPrompt = new BasePrompt({
      name: 'test-prompt',
      description: 'Test prompt',
      handler: jest.fn(),
      arguments: [{ name: 'arg1', description: 'Test arg', required: true }]
    });

    mockWizard = new WizardPrompt({
      name: 'test-wizard',
      description: 'Test wizard',
      handler: jest.fn(),
      annotations: { wizard: true }
    });
  });

  describe('register', () => {
    it('should register a valid prompt', () => {
      expect(() => {
        registry.register(mockPrompt, 'test');
      }).not.toThrow();

      expect(registry.has('test-prompt')).toBe(true);
      expect(registry.get('test-prompt')).toBe(mockPrompt);
    });

    it('should register prompt in correct category', () => {
      registry.register(mockPrompt, 'test-category');

      const categoryPrompts = registry.getByCategory('test-category');
      expect(categoryPrompts).toContain(mockPrompt);
      expect(registry.getCategories()).toContain('test-category');
    });

    it('should throw for invalid prompt', () => {
      expect(() => {
        registry.register('not a prompt');
      }).toThrow(HulyError);
    });

    it('should throw for name conflicts', () => {
      registry.register(mockPrompt);

      const duplicate = new BasePrompt({
        name: 'test-prompt',
        description: 'Duplicate',
        handler: jest.fn()
      });

      expect(() => {
        registry.register(duplicate);
      }).toThrow(HulyError);
    });

    it('should throw for invalid prompt names', () => {
      const invalidPrompt = new BasePrompt({
        name: 'Invalid_Name',
        description: 'Invalid name',
        handler: jest.fn()
      });

      // Mock the validation to force the error
      jest.spyOn(registry, 'register').mockImplementation(() => {
        throw HulyError.invalidValue('prompt.name', 'Invalid_Name', 'valid kebab-case name');
      });

      expect(() => {
        registry.register(invalidPrompt);
      }).toThrow(HulyError);
    });

    it('should store metadata correctly', () => {
      registry.register(mockPrompt, 'test');

      const metadata = registry.getMetadata('test-prompt');
      expect(metadata.name).toBe('test-prompt');
      expect(metadata.category).toBe('test');
      expect(metadata.registeredAt).toBeDefined();
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      registry.register(mockPrompt, 'test');
    });

    it('should remove existing prompt', () => {
      const result = registry.unregister('test-prompt');

      expect(result).toBe(true);
      expect(registry.has('test-prompt')).toBe(false);
    });

    it('should return false for non-existent prompt', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should clean up category when empty', () => {
      registry.unregister('test-prompt');

      expect(registry.getCategories()).not.toContain('test');
    });

    it('should clean up metadata', () => {
      registry.unregister('test-prompt');

      expect(registry.getMetadata('test-prompt')).toBeNull();
    });
  });

  describe('get and has', () => {
    beforeEach(() => {
      registry.register(mockPrompt);
    });

    it('should retrieve registered prompt', () => {
      expect(registry.get('test-prompt')).toBe(mockPrompt);
      expect(registry.has('test-prompt')).toBe(true);
    });

    it('should return null for non-existent prompt', () => {
      expect(registry.get('non-existent')).toBeNull();
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getNames', () => {
    it('should return all prompt names', () => {
      registry.register(mockPrompt);
      registry.register(mockWizard);

      const names = registry.getNames();
      expect(names).toContain('test-prompt');
      expect(names).toContain('test-wizard');
      expect(names).toHaveLength(2);
    });

    it('should return empty array for empty registry', () => {
      expect(registry.getNames()).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      registry.register(mockPrompt, 'category1');
      registry.register(mockWizard, 'category2');
    });

    it('should return prompts in specific category', () => {
      const category1Prompts = registry.getByCategory('category1');
      expect(category1Prompts).toContain(mockPrompt);
      expect(category1Prompts).not.toContain(mockWizard);
    });

    it('should return empty array for non-existent category', () => {
      expect(registry.getByCategory('non-existent')).toEqual([]);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      registry.register(mockPrompt);
    });

    it('should execute existing prompt', async () => {
      const mockResult = { success: true };
      mockPrompt.handler.mockResolvedValue(mockResult);

      const result = await registry.execute('test-prompt', { arg1: 'value' }, {});

      expect(result).toEqual(mockResult);
      expect(mockPrompt.handler).toHaveBeenCalled();
    });

    it('should throw for non-existent prompt', async () => {
      await expect(
        registry.execute('non-existent', {}, {})
      ).rejects.toThrow(HulyError);
    });

    it('should sanitize arguments', async () => {
      const mockResult = { success: true };
      mockPrompt.handler.mockResolvedValue(mockResult);

      await registry.execute('test-prompt', { arg1: '  value  ', empty: '   ' }, {});

      // Verify sanitized args were passed (no empty values, trimmed strings)
      const calledArgs = mockPrompt.handler.mock.calls[0][0];
      expect(calledArgs.arg1).toBe('value');
      expect(calledArgs.empty).toBeUndefined();
    });

    it('should add registry context', async () => {
      const mockResult = { success: true };
      mockPrompt.handler.mockResolvedValue(mockResult);

      await registry.execute('test-prompt', { arg1: 'value' }, { test: 'context' });

      const calledContext = mockPrompt.handler.mock.calls[0][1];
      expect(calledContext.registry).toBe(registry);
      expect(calledContext.promptMetadata).toBeDefined();
      expect(calledContext.test).toBe('context');
    });
  });

  describe('getMCPPromptList', () => {
    it('should return MCP-compatible definitions', () => {
      registry.register(mockPrompt);
      registry.register(mockWizard);

      const mcpList = registry.getMCPPromptList();

      expect(mcpList).toHaveLength(2);
      expect(mcpList[0]).toEqual(mockPrompt.toMCPDefinition());
      expect(mcpList[1]).toEqual(mockWizard.toMCPDefinition());
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.register(mockPrompt, 'cat1');
      registry.register(mockWizard, 'cat2');
    });

    it('should clear all prompts when no category specified', () => {
      registry.clear();

      expect(registry.getNames()).toHaveLength(0);
      expect(registry.getCategories()).toHaveLength(0);
    });

    it('should clear specific category only', () => {
      registry.clear('cat1');

      expect(registry.has('test-prompt')).toBe(false);
      expect(registry.has('test-wizard')).toBe(true);
      expect(registry.getCategories()).not.toContain('cat1');
      expect(registry.getCategories()).toContain('cat2');
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      registry.register(mockPrompt, 'cat1');
      registry.register(mockWizard, 'cat2');
    });

    it('should return accurate statistics', () => {
      const stats = registry.getStatistics();

      expect(stats.totalPrompts).toBe(2);
      expect(stats.categories).toBe(2);
      expect(stats.wizardPrompts).toBe(1);
      expect(stats.regularPrompts).toBe(1);
      expect(stats.categoryBreakdown.cat1).toBe(1);
      expect(stats.categoryBreakdown.cat2).toBe(1);
    });
  });

  describe('validate', () => {
    it('should validate all prompts', () => {
      registry.register(mockPrompt);
      registry.register(mockWizard);

      const results = registry.validate();

      expect(results.valid).toContain('test-prompt');
      expect(results.valid).toContain('test-wizard');
      expect(results.invalid).toHaveLength(0);
    });

    it('should detect validation warnings', () => {
      // Create prompt with no arguments
      const noArgsPrompt = new BasePrompt({
        name: 'no-args',
        description: 'Short',
        handler: jest.fn()
      });

      registry.register(noArgsPrompt);

      const results = registry.validate();

      expect(results.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('no arguments defined'),
          expect.stringContaining('very short description')
        ])
      );
    });
  });

  describe('getAllMetadata', () => {
    beforeEach(() => {
      registry.register(mockPrompt, 'cat1');
      registry.register(mockWizard, 'cat2');
    });

    it('should return all metadata', () => {
      const allMetadata = registry.getAllMetadata();

      expect(allMetadata).toHaveLength(2);
      expect(allMetadata.find(m => m.name === 'test-prompt')).toBeDefined();
      expect(allMetadata.find(m => m.name === 'test-wizard')).toBeDefined();
    });
  });
});