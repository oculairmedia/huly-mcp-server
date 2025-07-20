/**
 * Component Tools Module
 *
 * Exports all component-related tools
 */

export {
  definition as createComponentDefinition,
  handler as createComponentHandler,
  validate as createComponentValidate,
} from './createComponent.js';
export {
  definition as listComponentsDefinition,
  handler as listComponentsHandler,
  validate as listComponentsValidate,
} from './listComponents.js';
export {
  definition as deleteComponentDefinition,
  handler as deleteComponentHandler,
  validate as deleteComponentValidate,
} from './deleteComponent.js';

// Consolidated exports for registration
export const tools = [
  {
    definition: (await import('./createComponent.js')).definition,
    handler: (await import('./createComponent.js')).handler,
    validate: (await import('./createComponent.js')).validate,
  },
  {
    definition: (await import('./listComponents.js')).definition,
    handler: (await import('./listComponents.js')).handler,
    validate: (await import('./listComponents.js')).validate,
  },
  {
    definition: (await import('./deleteComponent.js')).definition,
    handler: (await import('./deleteComponent.js')).handler,
    validate: (await import('./deleteComponent.js')).validate,
  },
];
