/**
 * Integration tests for prompt system
 */

import { jest } from '@jest/globals';
import { promptRegistry, registerPrompt, registerWizardPrompt } from '../PromptRegistry.js';
import { executePrompt, getAllPromptDefinitions } from '../../index.js';

describe('Prompt System Integration', () => {
  beforeEach(() => {
    // Clear registry before each test
    promptRegistry.clear();
  });

  describe('Basic Prompt Registration and Execution', () => {
    it('should register and execute a basic prompt', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        success: true,
        message: 'Test prompt executed'
      });

      // Register a test prompt
      registerPrompt({
        name: 'test-integration',
        description: 'Integration test prompt',
        handler: mockHandler,
        arguments: [
          { name: 'input', description: 'Test input', required: true }
        ]
      });

      // Verify registration
      expect(promptRegistry.has('test-integration')).toBe(true);

      // Execute the prompt
      const result = await executePrompt('test-integration', { input: 'test value' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test prompt executed');
      expect(mockHandler).toHaveBeenCalledWith(
        { input: 'test value' },
        expect.objectContaining({
          registry: promptRegistry
        })
      );
    });

    it('should register and execute a wizard prompt', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        step: 1,
        completed: false,
        nextPrompt: 'Please provide more information'
      });

      // Register a wizard prompt
      registerWizardPrompt({
        name: 'test-wizard-integration',
        description: 'Integration test wizard',
        handler: mockHandler,
        annotations: {
          wizard: true,
          maxSteps: 3
        }
      });

      // Verify registration
      expect(promptRegistry.has('test-wizard-integration')).toBe(true);

      // Execute with wizard state
      const wizardState = { currentStep: 1 };
      const result = await executePrompt('test-wizard-integration', {}, { wizardState });

      expect(result.step).toBe(1);
      expect(result.completed).toBe(false);
      expect(mockHandler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          wizardState,
          registry: promptRegistry
        })
      );
    });

    it('should get MCP-compatible prompt definitions', () => {
      // Register multiple prompts
      registerPrompt({
        name: 'prompt-one',
        description: 'First prompt',
        handler: jest.fn()
      });

      registerPrompt({
        name: 'prompt-two',
        description: 'Second prompt',
        handler: jest.fn(),
        arguments: [
          { name: 'arg1', description: 'First argument', required: true }
        ]
      });

      const definitions = getAllPromptDefinitions();

      expect(definitions).toHaveLength(2);
      expect(definitions[0]).toEqual({
        name: 'prompt-one',
        description: 'First prompt',
        arguments: []
      });
      expect(definitions[1]).toEqual({
        name: 'prompt-two',
        description: 'Second prompt',
        arguments: [
          { name: 'arg1', description: 'First argument', required: true }
        ]
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle prompt execution errors gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Test error'));

      registerPrompt({
        name: 'error-prompt',
        description: 'Prompt that throws error',
        handler: errorHandler
      });

      await expect(executePrompt('error-prompt', {})).rejects.toThrow();
    });

    it('should handle non-existent prompt execution', async () => {
      await expect(executePrompt('non-existent', {})).rejects.toThrow();
    });
  });

  describe('Statistics and Metadata', () => {
    it('should provide accurate statistics', () => {
      registerPrompt({
        name: 'regular-prompt',
        description: 'Regular prompt',
        handler: jest.fn()
      }, 'category1');

      registerWizardPrompt({
        name: 'wizard-prompt',
        description: 'Wizard prompt',
        handler: jest.fn(),
        annotations: { wizard: true }
      }, 'category2');

      const stats = promptRegistry.getStatistics();

      expect(stats.totalPrompts).toBe(2);
      expect(stats.categories).toBe(2);
      expect(stats.wizardPrompts).toBe(1);
      expect(stats.regularPrompts).toBe(1);
      expect(stats.categoryBreakdown.category1).toBe(1);
      expect(stats.categoryBreakdown.category2).toBe(1);
    });

    it('should validate all prompts', () => {
      registerPrompt({
        name: 'valid-prompt',
        description: 'A valid prompt with good description',
        handler: jest.fn(),
        arguments: [
          { name: 'arg1', description: 'Test argument', required: true }
        ]
      });

      registerPrompt({
        name: 'short-desc',
        description: 'Short',
        handler: jest.fn()
      });

      const validation = promptRegistry.validate();

      expect(validation.valid).toContain('valid-prompt');
      expect(validation.valid).toContain('short-desc');
      expect(validation.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('very short description'),
          expect.stringContaining('no arguments defined')
        ])
      );
    });
  });
});