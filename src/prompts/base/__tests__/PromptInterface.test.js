/**
 * Unit tests for PromptInterface
 */

import { jest } from '@jest/globals';
import { BasePrompt, WizardPrompt, PromptUtils } from '../PromptInterface.js';
import { HulyError } from '../../../core/HulyError.js';

describe('BasePrompt', () => {
  const validDefinition = {
    name: 'test-prompt',
    description: 'A test prompt',
    handler: jest.fn(),
    arguments: [
      { name: 'arg1', description: 'First argument', required: true },
      { name: 'arg2', description: 'Second argument', required: false }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create prompt with valid definition', () => {
      const prompt = new BasePrompt(validDefinition);

      expect(prompt.name).toBe('test-prompt');
      expect(prompt.description).toBe('A test prompt');
      expect(prompt.arguments).toHaveLength(2);
      expect(prompt.handler).toBe(validDefinition.handler);
    });

    it('should throw error for invalid definition', () => {
      expect(() => new BasePrompt(null)).toThrow(HulyError);
      expect(() => new BasePrompt({})).toThrow(HulyError);
      expect(() => new BasePrompt({ name: 'test' })).toThrow(HulyError);
    });

    it('should throw error for invalid name', () => {
      const invalidDef = { ...validDefinition, name: '' };
      expect(() => new BasePrompt(invalidDef)).toThrow(HulyError);
    });

    it('should throw error for invalid handler', () => {
      const invalidDef = { ...validDefinition, handler: 'not a function' };
      expect(() => new BasePrompt(invalidDef)).toThrow(HulyError);
    });

    it('should work with minimal definition', () => {
      const minimalDef = {
        name: 'simple',
        description: 'Simple prompt',
        handler: jest.fn()
      };

      const prompt = new BasePrompt(minimalDef);
      expect(prompt.arguments).toEqual([]);
      expect(prompt.annotations).toEqual({});
    });
  });

  describe('validateExecutionArguments', () => {
    let prompt;

    beforeEach(() => {
      prompt = new BasePrompt(validDefinition);
    });

    it('should pass with all required arguments', () => {
      expect(() => {
        prompt.validateExecutionArguments({ arg1: 'value1' });
      }).not.toThrow();
    });

    it('should pass with all arguments', () => {
      expect(() => {
        prompt.validateExecutionArguments({ arg1: 'value1', arg2: 'value2' });
      }).not.toThrow();
    });

    it('should throw for missing required arguments', () => {
      expect(() => {
        prompt.validateExecutionArguments({ arg2: 'value2' });
      }).toThrow(HulyError);
    });

    it('should pass with empty args if no required args', () => {
      const noRequiredDef = {
        name: 'test',
        description: 'Test',
        handler: jest.fn(),
        arguments: [{ name: 'optional', description: 'Optional arg', required: false }]
      };

      const noRequiredPrompt = new BasePrompt(noRequiredDef);
      expect(() => {
        noRequiredPrompt.validateExecutionArguments({});
      }).not.toThrow();
    });
  });

  describe('execute', () => {
    let prompt;
    const mockHandler = jest.fn();

    beforeEach(() => {
      const definition = {
        ...validDefinition,
        handler: mockHandler
      };
      prompt = new BasePrompt(definition);
    });

    it('should execute handler with valid arguments', async () => {
      const args = { arg1: 'value1' };
      const context = { test: 'context' };
      const expectedResult = { success: true };

      mockHandler.mockResolvedValue(expectedResult);

      const result = await prompt.execute(args, context);

      expect(mockHandler).toHaveBeenCalledWith(args, context);
      expect(result).toEqual(expectedResult);
    });

    it('should throw for missing required arguments', async () => {
      const args = { arg2: 'value2' }; // missing required arg1

      await expect(prompt.execute(args)).rejects.toThrow(HulyError);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle handler errors', async () => {
      const args = { arg1: 'value1' };
      const error = new Error('Handler failed');

      mockHandler.mockRejectedValue(error);

      await expect(prompt.execute(args)).rejects.toThrow(HulyError);
    });

    it('should preserve HulyError from handler', async () => {
      const args = { arg1: 'value1' };
      const error = HulyError.notFound('test', 'value');

      mockHandler.mockRejectedValue(error);

      await expect(prompt.execute(args)).rejects.toThrow(error);
    });

    it('should throw if handler returns non-object', async () => {
      const args = { arg1: 'value1' };
      mockHandler.mockResolvedValue('not an object');

      await expect(prompt.execute(args)).rejects.toThrow();
    });
  });

  describe('toMCPDefinition', () => {
    it('should return MCP-compatible definition', () => {
      const prompt = new BasePrompt(validDefinition);
      const mcpDef = prompt.toMCPDefinition();

      expect(mcpDef).toEqual({
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [
          { name: 'arg1', description: 'First argument', required: true },
          { name: 'arg2', description: 'Second argument', required: false }
        ]
      });
    });
  });

  describe('getMetadata', () => {
    it('should return prompt metadata', () => {
      const annotations = { category: 'test' };
      const definition = { ...validDefinition, annotations };
      const prompt = new BasePrompt(definition);

      const metadata = prompt.getMetadata();

      expect(metadata.name).toBe('test-prompt');
      expect(metadata.description).toBe('A test prompt');
      expect(metadata.argumentCount).toBe(2);
      expect(metadata.requiredArguments).toBe(1);
      expect(metadata.annotations).toEqual(annotations);
    });
  });
});

describe('WizardPrompt', () => {
  function createWizardDefinition(overrides = {}) {
    return {
      name: 'test-wizard',
      description: 'A test wizard',
      handler: jest.fn(),
      annotations: { wizard: true, maxSteps: 5 },
      ...overrides
    };
  }

  it('should create wizard with valid definition', () => {
    const wizardDefinition = createWizardDefinition();
    const wizard = new WizardPrompt(wizardDefinition);

    expect(wizard.name).toBe('test-wizard');
    expect(wizard.maxSteps).toBe(5);
    expect(wizard.sessionTimeout).toBe(3600);
  });

  it('should throw if wizard annotation missing', () => {
    const invalidDef = createWizardDefinition({
      annotations: { maxSteps: 5 } // missing wizard: true
    });

    expect(() => new WizardPrompt(invalidDef)).toThrow(HulyError);
  });

  it('should use default maxSteps and sessionTimeout', () => {
    const minimalWizard = createWizardDefinition({
      name: 'minimal-wizard',
      description: 'Minimal wizard',
      annotations: { wizard: true } // no maxSteps specified
    });

    const wizard = new WizardPrompt(minimalWizard);
    expect(wizard.maxSteps).toBe(10);
    expect(wizard.sessionTimeout).toBe(3600);
  });

  describe('execute', () => {
    let wizard;
    let mockHandler;

    beforeEach(() => {
      mockHandler = jest.fn();
      const definition = createWizardDefinition({
        handler: mockHandler
      });
      wizard = new WizardPrompt(definition);
    });

    it('should require wizardState in context', async () => {
      const args = {};
      const context = {};

      await expect(wizard.execute(args, context)).rejects.toThrow(HulyError);
    });

    it('should execute with valid wizard state', async () => {
      const args = {};
      const context = {
        wizardState: { currentStep: 1 }
      };
      const expectedResult = { success: true };

      mockHandler.mockResolvedValue(expectedResult);

      const result = await wizard.execute(args, context);
      expect(result).toEqual(expectedResult);
    });

    it('should throw if max steps exceeded', async () => {
      const args = {};
      const context = {
        wizardState: { currentStep: 10 } // exceeds maxSteps of 5
      };

      await expect(wizard.execute(args, context)).rejects.toThrow(HulyError);
    });
  });

  describe('getMetadata', () => {
    it('should return wizard-specific metadata', () => {
      const wizardDefinition = createWizardDefinition();
      const wizard = new WizardPrompt(wizardDefinition);
      const metadata = wizard.getMetadata();

      expect(metadata.type).toBe('wizard');
      expect(metadata.maxSteps).toBe(5);
      expect(metadata.sessionTimeout).toBe(3600);
    });
  });
});

describe('PromptUtils', () => {
  describe('isValidPromptName', () => {
    it('should validate correct names', () => {
      expect(PromptUtils.isValidPromptName('test')).toBe(true);
      expect(PromptUtils.isValidPromptName('test-prompt')).toBe(true);
      expect(PromptUtils.isValidPromptName('project-setup')).toBe(true);
      expect(PromptUtils.isValidPromptName('a1-b2-c3')).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(PromptUtils.isValidPromptName('')).toBe(false);
      expect(PromptUtils.isValidPromptName('Test')).toBe(false);
      expect(PromptUtils.isValidPromptName('test_prompt')).toBe(false);
      expect(PromptUtils.isValidPromptName('test-')).toBe(false);
      expect(PromptUtils.isValidPromptName('-test')).toBe(false);
      expect(PromptUtils.isValidPromptName('test--prompt')).toBe(false);
      expect(PromptUtils.isValidPromptName(null)).toBe(false);
    });
  });

  describe('sanitizeArguments', () => {
    it('should sanitize valid arguments', () => {
      const input = {
        str: '  test  ',
        num: 42,
        bool: true,
        null: null,
        undefined: undefined,
        empty: '   '
      };

      const result = PromptUtils.sanitizeArguments(input);

      expect(result).toEqual({
        str: 'test',
        num: 42,
        bool: true
      });
    });

    it('should handle null/undefined input', () => {
      expect(PromptUtils.sanitizeArguments(null)).toEqual({});
      expect(PromptUtils.sanitizeArguments(undefined)).toEqual({});
    });
  });

  describe('createResponse', () => {
    it('should create standardized response', () => {
      const content = 'Test response';
      const data = { key: 'value' };

      const response = PromptUtils.createResponse(content, data);

      expect(response.content).toEqual([
        { type: 'text', text: 'Test response' }
      ]);
      expect(response.data.key).toBe('value');
      expect(response.data.timestamp).toBeDefined();
    });

    it('should work with minimal parameters', () => {
      const response = PromptUtils.createResponse('Simple');

      expect(response.content[0].text).toBe('Simple');
      expect(response.data.timestamp).toBeDefined();
    });
  });
});