/**
 * Milestone Tools Module
 * 
 * Exports all milestone-related tools
 */

export { definition as createMilestoneDefinition, handler as createMilestoneHandler, validate as createMilestoneValidate } from './createMilestone.js';
export { definition as listMilestonesDefinition, handler as listMilestonesHandler, validate as listMilestonesValidate } from './listMilestones.js';

// Consolidated exports for registration
export const tools = [
  {
    definition: (await import('./createMilestone.js')).definition,
    handler: (await import('./createMilestone.js')).handler,
    validate: (await import('./createMilestone.js')).validate
  },
  {
    definition: (await import('./listMilestones.js')).definition,
    handler: (await import('./listMilestones.js')).handler,
    validate: (await import('./listMilestones.js')).validate
  }
];