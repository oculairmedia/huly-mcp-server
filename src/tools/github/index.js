/**
 * GitHub Tools Module
 * 
 * Exports all GitHub-related tools
 */

export { definition as listRepositoriesDefinition, handler as listRepositoriesHandler, validate as listRepositoriesValidate } from './listRepositories.js';
export { definition as assignRepositoryDefinition, handler as assignRepositoryHandler, validate as assignRepositoryValidate } from './assignRepository.js';

// Consolidated exports for registration
export const tools = [
  {
    definition: (await import('./listRepositories.js')).definition,
    handler: (await import('./listRepositories.js')).handler,
    validate: (await import('./listRepositories.js')).validate
  },
  {
    definition: (await import('./assignRepository.js')).definition,
    handler: (await import('./assignRepository.js')).handler,
    validate: (await import('./assignRepository.js')).validate
  }
];