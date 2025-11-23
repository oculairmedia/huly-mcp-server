import { definition as queryDefinition } from '../query/hulyQuery.js';
import { definition as issueDefinition } from '../issue_ops/hulyIssueOps.js';
import { definition as templateDefinition } from '../template_ops/hulyTemplateOps.js';
import { definition as workflowDefinition } from '../workflow/hulyWorkflow.js';
import { definition as entityDefinition } from '../entity/hulyEntity.js';
import { definition as accountDefinition } from '../account_ops/hulyAccountOps.js';

describe('Huly tool input schemas', () => {
  test('huly_query exposes precise filter and options metadata', () => {
    const { properties, definitions } = queryDefinition.inputSchema;
    const filtersSchema = properties.filters;
    const optionsSchema = properties.options;

    expect(filtersSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    const filterObjectBranch = filtersSchema.oneOf.find((branch) => branch?.type === 'object');
    expect(filterObjectBranch).toBe(definitions.IssueSearchFilters);
    expect(filtersSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(optionsSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    const optionsObjectBranch = optionsSchema.oneOf.find((branch) => branch?.type === 'object');
    expect(optionsObjectBranch).toBe(definitions.ListOptions);
    expect(optionsSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(definitions.IssueSearchFilters.additionalProperties).toBe(false);
    expect(definitions.ListOptions.additionalProperties).toBe(false);
  });

  test('huly_issue_ops documents array payloads with item metadata', () => {
    const { properties, definitions } = issueDefinition.inputSchema;
    const itemsSchema = properties.items;
    const updatesSchema = properties.updates;
    const identifiersSchema = properties.issue_identifiers;
    const defaultsSchema = properties.defaults;
    const dataSchema = properties.data;
    const updateSchema = properties.update;
    const optionsSchema = properties.options;

    const itemsArrayBranch = itemsSchema.oneOf.find((branch) => branch?.type === 'array');
    expect(itemsArrayBranch).toBeTruthy();
    expect(itemsArrayBranch.items).toBe(definitions.BulkCreateIssue);

    expect(itemsSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const updatesArrayBranch = updatesSchema.oneOf.find((branch) => branch?.type === 'array');
    expect(updatesArrayBranch).toBeTruthy();
    expect(updatesArrayBranch.items).toBe(definitions.BulkUpdateItem);

    expect(updatesSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const identifiersArrayBranch = identifiersSchema.oneOf.find((branch) => branch?.type === 'array');
    expect(identifiersArrayBranch).toBeTruthy();
    expect(identifiersArrayBranch.items).toEqual({
      type: 'string',
      description: 'Issue identifier (e.g., "HULLY-1").',
    });

    expect(identifiersSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(defaultsSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    expect(defaultsSchema.oneOf.some((branch) => branch === definitions.IssueDefaults)).toBe(true);
    expect(defaultsSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(dataSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    expect(dataSchema.oneOf.some((branch) => branch === definitions.IssueCreateData)).toBe(true);
    expect(dataSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(updateSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    expect(updateSchema.oneOf.some((branch) => branch === definitions.IssueUpdateData)).toBe(true);
    expect(updateSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(optionsSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    const optionsObjectBranch = optionsSchema.oneOf.find((branch) => branch?.type === 'object');
    expect(optionsObjectBranch).toBe(definitions.IssueOptions);
    expect(optionsSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(definitions.BulkCreateIssue.additionalProperties).toBe(false);
    expect(definitions.BulkUpdateItem.additionalProperties).toBe(false);
  });

  test('huly_template_ops data payload describes template shape and children items', () => {
    const { properties, definitions } = templateDefinition.inputSchema;
    const dataSchema = properties.data;

    expect(dataSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    expect(dataSchema.oneOf.some((branch) => branch === definitions.TemplateData)).toBe(true);
    expect(dataSchema.oneOf.some((branch) => branch === definitions.ChildTemplateData)).toBe(true);
    expect(dataSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const overridesSchema = properties.overrides;
    expect(overridesSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    expect(overridesSchema.oneOf.some((branch) => branch === definitions.TemplateOverrides)).toBe(true);
    expect(overridesSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const templateChildren = definitions.TemplateData.properties.children;
    const childItems = templateChildren.items;
    expect(childItems).toBe(definitions.ChildTemplateData);
    expect(definitions.TemplateData.additionalProperties).toBe(false);
    expect(definitions.ChildTemplateData.additionalProperties).toBe(false);
  });

  test('huly_workflow context schema enumerates project setup and sprint planning payloads', () => {
    const { properties, definitions } = workflowDefinition.inputSchema;
    const contextSchema = properties.context;

    expect(contextSchema.oneOf?.length).toBeGreaterThanOrEqual(3);
    expect(contextSchema.oneOf.some((branch) => branch === definitions.ProjectSetupContext)).toBe(true);
    expect(contextSchema.oneOf.some((branch) => branch === definitions.SprintPlanningContext)).toBe(true);
    expect(contextSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const componentBranch =
      definitions.ProjectSetupContext.properties.components.items.oneOf.find((branch) => branch?.type === 'object');
    expect(componentBranch).toBe(definitions.ProjectSetupComponent);
    expect(componentBranch.additionalProperties).toBe(false);

    const milestoneItems = definitions.ProjectSetupContext.properties.milestones.items;
    expect(milestoneItems).toBe(definitions.ProjectSetupMilestone);
    expect(milestoneItems.additionalProperties).toBe(false);

    const templateChildItems = definitions.TemplateSeedData.properties.children.items;
    expect(templateChildItems).toBe(definitions.TemplateSeedChild);

    expect(definitions.SprintPlanningBacklogFilter.additionalProperties).toBe(false);
  });

  test('huly_entity data/options enforce per-entity payload shapes', () => {
    const { properties, definitions } = entityDefinition.inputSchema;
    const dataSchema = properties.data;
    const optionsSchema = properties.options;

    expect(dataSchema.oneOf?.length).toBeGreaterThanOrEqual(4);
    expect(dataSchema.oneOf).toEqual(
      expect.arrayContaining([
        definitions.ProjectCreateData,
        definitions.ComponentCreateData,
        definitions.MilestoneCreateData,
        definitions.CommentCreateData,
      ])
    );
    expect(dataSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(optionsSchema.oneOf?.length).toBeGreaterThanOrEqual(2);
    expect(optionsSchema.oneOf).toContain(definitions.DeletionOptions);
    expect(optionsSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(definitions.ProjectCreateData.additionalProperties).toBe(false);
    expect(definitions.ComponentCreateData.additionalProperties).toBe(false);
    expect(definitions.MilestoneCreateData.additionalProperties).toBe(false);
    expect(definitions.CommentCreateData.additionalProperties).toBe(false);
  });

  test('huly_account_ops constrains payloads and filters with explicit schemas', () => {
    const { properties, definitions } = accountDefinition.inputSchema;
    const dataSchema = properties.data;
    const updatesSchema = properties.updates;
    const filtersSchema = properties.filters;

    expect(dataSchema.oneOf).toEqual(
      expect.arrayContaining([
        definitions.EmployeeData,
        definitions.PersonData,
      ])
    );
    expect(dataSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const updatesObjectBranch = updatesSchema.oneOf.find((branch) => branch?.type === 'object');
    expect(updatesObjectBranch).toBe(definitions.EmployeeUpdateData);
    expect(updatesSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    const filtersObjectBranch = filtersSchema.oneOf.find((branch) => branch?.type === 'object');
    expect(filtersObjectBranch).toBe(definitions.EmployeeFilters);
    expect(filtersSchema.oneOf.some((branch) => branch?.type === 'string')).toBe(true);

    expect(definitions.EmployeeData.additionalProperties).toBe(false);
    expect(definitions.EmployeeUpdateData.additionalProperties).toBe(false);
    expect(definitions.EmployeeFilters.additionalProperties).toBe(false);
    expect(definitions.PersonData.additionalProperties).toBe(false);
  });
});
