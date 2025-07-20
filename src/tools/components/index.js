/**
 * Component Tools Module
 * 
 * Exports all component-related tools
 */

export { definition as createComponentDefinition, handler as createComponentHandler, validate as createComponentValidate } from './createComponent.js';
export { definition as listComponentsDefinition, handler as listComponentsHandler, validate as listComponentsValidate } from './listComponents.js';

// Consolidated exports for registration
export const tools = [
  {
    definition: (await import('./createComponent.js')).definition,
    handler: (await import('./createComponent.js')).handler,
    validate: (await import('./createComponent.js')).validate
  },
  {
    definition: (await import('./listComponents.js')).definition,
    handler: (await import('./listComponents.js')).handler,
    validate: (await import('./listComponents.js')).validate
  }
];