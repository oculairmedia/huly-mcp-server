# Wizard Prompts: Why they keep failing to load (deep dive)

## TL;DR
We’re tripping over strict constructor-time validation plus a few structural mismatches:
- BasePrompt requires a handler function at construction time
- WizardPrompt requires annotations.wizard === true
- Our wizard classes try to mutate a non-existent this.definition and pass the wrong type to WizardStateManager.createSession
- Sprint/Issue wizards never register their steps with WizardState sessions
- ProjectSetupWizard calls PromptUtils methods that don’t exist
- Several runtime-only dependencies (createHulyClient, services, getLogger) are referenced but not imported

Fixing those eliminates the recurring “prompt|wizard|ERROR … Invalid value …” loader failures and prevents runtime TypeErrors.

---

## What the base layer enforces (and where we violate it)

### 1) handler must exist at construction
<augment_code_snippet path="src/prompts/base/PromptInterface.js" mode="EXCERPT">
````javascript
// BasePrompt validation
if (!definition.handler || typeof definition.handler !== 'function') {
  throw HulyError.invalidValue('handler', definition.handler, 'function');
}
````
</augment_code_snippet>

- Some wizard constructors originally did not pass a handler in super({...}). That fails immediately during module load/registration.
- Adding a trivial default handler in the definition is fine, but see “Don’t mutate this.definition” below.

### 2) annotations.wizard must be true for wizard prompts
<augment_code_snippet path="src/prompts/base/PromptInterface.js" mode="EXCERPT">
````javascript
// WizardPrompt constructor
if (!this.annotations.wizard) {
  throw HulyError.invalidValue(
    'annotations.wizard', this.annotations.wizard, 'true for wizard prompts'
  );
}
````
</augment_code_snippet>

- ProjectSetupWizard’s super(...) definition has no annotations; it fails here every time it’s imported.

---

## Concrete problems in our wizards

### A) ProjectSetupWizard
- Missing annotations.wizard in super({...}). Causes HulyError during import.
- Uses PromptUtils.createSuccessResponse / createErrorResponse which do not exist.

<augment_code_snippet path="src/prompts/base/PromptInterface.js" mode="EXCERPT">
````javascript
export const PromptUtils = {
  // ...
  createResponse(content, data = {}) {
    return { content: [{ type: 'text', text: content }], data: { timestamp: new Date().toISOString(), ...data } };
  }
};
````
</augment_code_snippet>

- There are no createSuccessResponse / createErrorResponse helpers. Calls to them will throw when executed.

Recommended fixes:
- Add annotations: { wizard: true } (optionally maxSteps/sessionTimeout) in super(...).
- Replace PromptUtils.createSuccessResponse / createErrorResponse with PromptUtils.createResponse or add thin wrappers.

Example change:
<augment_code_snippet path="src/prompts/wizards/ProjectSetupWizard.js" mode="EXCERPT">
````javascript
super({
  name: 'project-setup-wizard',
  description: 'Interactive wizard to create and configure new Huly projects',
  annotations: { wizard: true, maxSteps: 5 },
  // keep arguments...
  handler: async () => ({ messages: [] })
});
````
</augment_code_snippet>

### B) SprintPlanningWizard and IssueWorkflowWizard
1) this.definition is undefined
- BasePrompt never sets a this.definition object, so this.definition.handler = ... throws.

<augment_code_snippet path="src/prompts/wizards/SprintPlanningWizard.js" mode="EXCERPT">
````javascript
// Wrong: BasePrompt doesn’t create this.definition
this.definition.handler = this.execute.bind(this); // TypeError
````
</augment_code_snippet>

Use this.handler = this.execute.bind(this) instead:
<augment_code_snippet path="src/prompts/wizards/SprintPlanningWizard.js" mode="EXCERPT">
````javascript
// Right: override the actual handler field on BasePrompt
this.handler = this.execute.bind(this);
````
</augment_code_snippet>

2) Passing wrong type to WizardStateManager.createSession
- createSession expects a string wizardName, not an object.

<augment_code_snippet path="src/prompts/base/WizardState.js" mode="EXCERPT">
````javascript
createSession(wizardName, initialData = {}) {
  if (!wizardName || typeof wizardName !== 'string') {
    throw new Error('Wizard name is required and must be a string');
  }
  // ...
}
````
</augment_code_snippet>

But current code passes this.definition instead of a string:
<augment_code_snippet path="src/prompts/wizards/IssueWorkflowWizard.js" mode="EXCERPT">
````javascript
// Wrong
session = stateManager.createSession(this.definition, { /* ... */ });
````
</augment_code_snippet>

Fix by using this.name (or the literal id):
<augment_code_snippet path="src/prompts/wizards/IssueWorkflowWizard.js" mode="EXCERPT">
````javascript
// Right
session = stateManager.createSession(this.name, { /* ... */ });
````
</augment_code_snippet>

3) Steps are never registered with WizardState
- WizardState doesn’t know about your step schema unless you call setSteps([...]).

<augment_code_snippet path="src/prompts/base/WizardState.js" mode="EXCERPT">
````javascript
setSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Steps must be a non-empty array');
  }
  this.steps = steps.map(/* ... */);
}
````
</augment_code_snippet>

- Sprint/Issue put steps inside the object passed to super(...), but BasePrompt ignores unknown keys and doesn’t preserve them. Result: session.getCurrentStep() returns null and downstream code breaks.

Recommended pattern (like ProjectSetupWizard already does):
- Keep steps on the class (this.steps = [...])
- After creating the session, call session.setSteps(this.steps)

Example change:
<augment_code_snippet path="src/prompts/wizards/SprintPlanningWizard.js" mode="EXCERPT">
````javascript
// After creating a new session
session = stateManager.createSession(this.name, { projectId: args.projectId, sprintName: args.sprintName });
session.setSteps(this.steps);
````
</augment_code_snippet>

4) Unimported runtime dependencies (will blow up at execution time)
- Both Sprint/Issue wizards reference getLogger, createHulyClient, ProjectService, IssueService, TemplateService, MilestoneService, tracker without importing or mocking.
- Constructors avoid using them, so module load succeeds; but any execution path that uses them will throw ReferenceError.

Recommended approaches:
- Import the needed symbols or consistently access them from context (e.g., context.logger, context.services.*) and ensure the MCP host injects them.
- If using dynamic imports, do so consistently (e.g., await import('.../services')).

---

## Why the exact error messages appear

1) “Invalid value for field 'handler'”
- Triggered by BasePrompt.validateDefinition when super({...}) is called without handler.
- Fixed by providing any async () => ({ messages: [] }) placeholder; later override with this.handler = this.execute.bind(this).

2) “Invalid value for field 'annotations.wizard'”
- Triggered by WizardPrompt constructor if annotations.wizard isn’t truthy.
- ProjectSetupWizard lacked annotations, hence this message right after the handler fix.

3) TypeErrors such as cannot set properties of undefined (setting 'handler')
- Caused by trying to mutate this.definition.*, which does not exist in BasePrompt-derived classes.

4) Session/name validation errors at runtime
- Passing an object to createSession instead of a string wizardName leads to “Wizard name is required and must be a string”.

5) Wizard step flow breaks
- Without session.setSteps([...]), session.getCurrentStep() is null and follow-on code (e.g., accessing step.form.fields[...]) fails.

---

## Minimal, safe fix plan

Apply in this order to stop loader errors and get basic flows working.

1) In ALL wizard constructors:
- Ensure super({...}) includes handler: async () => ({ messages: [] })
- Ensure annotations: { wizard: true, maxSteps?: N }
- Immediately after super, set this.handler = this.execute.bind(this)
- Keep your step arrays as this.steps = [ ... ] on the class (do not put steps into super definition)

2) In execute/start paths where a new session is created:
- Call stateManager.createSession(this.name, initialData)
- Then call session.setSteps(this.steps)

3) In ProjectSetupWizard:
- Replace PromptUtils.createSuccessResponse / createErrorResponse with PromptUtils.createResponse

4) Import or inject runtime deps before first use
- Add imports or consume from context to avoid ReferenceErrors

5) Only after the above passes, iterate on step-specific dynamic loading (projects, issues, labels, etc.)

---

## Snippets of recommended changes

Override handler properly:
<augment_code_snippet path="src/prompts/wizards/IssueWorkflowWizard.js" mode="EXCERPT">
````javascript
// After super({...})
this.handler = this.execute.bind(this);
````
</augment_code_snippet>

Create session with name and set steps:
<augment_code_snippet path="src/prompts/wizards/IssueWorkflowWizard.js" mode="EXCERPT">
````javascript
let session = sessionId ? stateManager.getSession(sessionId) : null;
if (!session) {
  session = stateManager.createSession(this.name, { mode: args.mode || 'create', projectId: args.projectId });
  session.setSteps(this.steps);
}
````
</augment_code_snippet>

Add annotations to ProjectSetupWizard:
<augment_code_snippet path="src/prompts/wizards/ProjectSetupWizard.js" mode="EXCERPT">
````javascript
super({
  name: 'project-setup-wizard',
  description: 'Interactive wizard to create and configure new Huly projects',
  annotations: { wizard: true, maxSteps: 5 },
  handler: async () => ({ messages: [] })
});
````
</augment_code_snippet>

Replace non-existent PromptUtils helpers:
<augment_code_snippet path="src/prompts/wizards/ProjectSetupWizard.js" mode="EXCERPT">
````javascript
// Before
return PromptUtils.createSuccessResponse('Project Setup Wizard', content);
// After
return PromptUtils.createResponse(content, { title: 'Project Setup Wizard' });
````
</augment_code_snippet>

---

## Verification checklist
- Restart container and confirm registry load shows no handler/annotations errors
- Smoke-call each wizard’s start action and confirm the first step renders
  - start → getCurrentStep returns a step with expected form
  - next/previous transitions work (validateCurrentStep and nextStep)
- Watch logs for ReferenceError on unimported utilities; add imports as needed
- Optional: add light unit tests around WizardState and a simple mock wizard to assert setSteps+flow

---

## Notes on the older working reference
If the “Letta-MCP-server” sample worked for you, it likely:
- Passed a handler in the initial definition to satisfy BasePrompt
- Explicitly marked wizard prompts with annotations.wizard = true
- Created sessions with a string name and registered steps via session.setSteps([...])
- Avoided mutating non-existent this.definition and/or stored steps on the class

Mirroring those patterns here should make the wizard prompts robust.

