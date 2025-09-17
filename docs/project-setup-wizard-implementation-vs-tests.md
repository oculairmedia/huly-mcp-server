# ProjectSetupWizard: Implementation vs Test Expectations (Read-only Analysis)

This document summarizes discrepancies between the current ProjectSetupWizard implementation and its unit tests, based solely on static inspection (no commands run).

## Files Inspected
- src/prompts/wizards/ProjectSetupWizard.js
- src/prompts/base/WizardState.js
- src/prompts/base/PromptInterface.js
- src/prompts/wizards/__tests__/ProjectSetupWizard.test.js
- src/__mocks__/jest.setup.js
- jest.config.mjs
- src/services/ProjectService.js (for reference)

## Executive Summary
Multiple mismatches exist between the wizard’s current API/behavior and the test suite’s expectations:

- Session handling interface differs (context.sessionId vs internal state manager; start/continue vs action-driven flow).
- Action set differs (tests expect `finish`; implementation only handles `next`, `previous`, `cancel`).
- Response payload shape differs (tests expect structured `form`/`review` objects; implementation returns Markdown content only).
- Step data schemas differ (tests pass fields like `owners`, `private`, `createDefaultStates`; implementation expects different keys like `members[] of objects`, `components`, etc.).
- Validation rules and error messages differ (identifier format allows underscores in tests; implementation forbids underscores and has different error text).
- Finalization flow differs (tests expect one-shot `finish`; implementation requires step data with `confirm: true`).
- Dependency model differs (tests mock `../services/ProjectService.js` module import; implementation uses `context.services.*`, so the mock is not engaged).

These discrepancies explain the test failures without executing the suite.

## Detailed Findings

### 1) Session Handling and Navigation
- Implementation
  - `execute({ mode='start' | 'continue' | 'status', sessionId, stepData, action }, context)`.
  - If `action` is present, it routes to `handleAction()` which supports: `next`, `previous`, `cancel`. No `finish`.
  - `startWizard(context)` creates a session via the global `getWizardStateManager()` and returns a response containing `data.sessionId`. It does not mutate `context.sessionId`.
  - `continueWizard(sessionId, stepData, context)` calls `session.nextStep(stepData)` and then renders current step or completion summary.
- Tests
  - Often call `await wizard.execute({}, { sessionId })` without `mode`, expecting to resume current step rather than create a new session.
  - In some places, expect `context.sessionId` to hold the active session after the first call (they read it back from `context`).
  - Expect `action`-based navigation controlling the flow (`next`, `previous`, `finish`, `cancel`).
- Mismatch points
  - No `finish` action support in code.
  - Default `mode` is `start`; tests don’t pass `mode=continue` when resuming.
  - Implementation does not write `context.sessionId`, while tests sometimes read it.

### 2) Response Payload Shape
- Implementation
  - `renderCurrentStep()` returns a success response whose `data` includes: `content` (Markdown text), `sessionId`, `currentStep: { id, name, description }`, `progress`, `state`.
  - No `form` object in `currentStep`; UI is delivered as markdown text strings like "renderProjectSettingsForm(state)".
  - Final summary via `renderCompletionSummary()` returns a big Markdown string; no structured `data.project` field.
- Tests
  - Expect `result.data.currentStep.form.fields` to be an array with entries (e.g., `private` with `defaultValue: false`, `defaultAssignee`, `autoClose` with `defaultValue: false`).
  - On finalization review, expect `result.data.currentStep.review` object with specific fields (name, identifier, owners, ...).
  - On finish, expect `result.data.completed === true` and a `result.data.project` object with `id` and `identifier`.
- Mismatch points
  - Implementation returns narrative Markdown, not structured form/review objects required by tests.

### 3) Step Definitions and Data Schemas
- Implementation steps (5 total):
  1. project-basic-info (required). Expects `{ name, identifier, description, type?, priority? }`.
  2. project-settings (required). Expects `{ defaultAssignee?, issueTypes?, workflow?, notifications?, privacy? }`.
  3. team-setup (optional). Expects `{ members: [{ email, role, permissions? }, ...] }`.
  4. initial-structure (optional). Expects `{ milestones?, components?, labels?, createTemplates? }`.
  5. finalization (required). Expects `{ confirm: true, createSampleIssues?, sendNotifications?, generateReport? }`.
- Tests expect step data:
  - Step 1: `{ name, identifier, description }` where `identifier` like `TEST_PROJECT` (with underscore) is valid.
  - Step 2: `{ private, defaultAssignee, autoClose, autoCloseTimeoutDays }` or empty for defaults.
  - Step 3: `{ owners: string[], members: string[] }` (both arrays of emails), not objects with roles.
  - Step 4: `{ createDefaultStates, createDefaultPriorities, createSampleIssues, initialComponents }`.
  - Finish: `action: 'finish'` with no additional `stepData`.
- Mismatch points
  - Field names and shapes differ in all non-trivial steps.
  - Team step expects strings vs. implementation expecting objects with roles.
  - Initial structure expects `initialComponents` vs. implementation expecting `components`.

### 4) Validation Rules and Error Messages
- Implementation (Step 1)
  - Identifier regex: `/^[A-Z][A-Z0-9]{1,10}$/` → 2–11 chars, uppercase alnum, must start with a letter, no underscore.
  - Error message: "Project identifier is required and must be 2-11 uppercase characters starting with a letter".
- Tests
  - Expect identifiers with underscores (e.g., `TEST_PROJECT`) to be valid.
  - Expect error message to mention "uppercase letters, numbers, and underscores" for invalid identifiers.
- Mismatch points
  - Regex and error messaging differ from test expectations.

### 5) Finalization Flow
- Implementation
  - `validateFinalization(data)` requires `confirm: true`.
  - `handleFinalization(data, state, session)` uses `context.services.projectService`, `issueService`, etc., and returns a Markdown summary via `renderCompletionSummary`.
- Tests
  - Call `execute({ action: 'finish' }, { sessionId })` (no `stepData`) and expect completion.
  - Expect `data.project` object and `data.completed === true` in the response.
- Mismatch points
  - No `finish` action handler; confirm flag requirement unmet by tests.
  - Different output structure (structured data vs rendered markdown string).

### 6) Dependency Model and Mocks
- Implementation
  - Does not import `ProjectService` directly; relies on `context.services.projectService` and `context.client`.
- Test setup (src/__mocks__/jest.setup.js)
  - Mocks `../services/ProjectService.js` providing a `ProjectService` with `createProject(data)` returning `{ id: 'mock-project-id', identifier: data.identifier, ... }`.
- Mismatch points
  - Because the wizard never imports `ProjectService`, this Jest module mock is not engaged. Tests likely expect the wizard to use the mocked module.

## Representative Code Excerpts (for reference)

- Action handling (no `finish`):
```js
switch (action) {
  case 'next': ...
  case 'previous': ...
  case 'cancel': ...
  default: error
}
```

- Identifier validation (no underscores allowed):
```js
!/^[A-Z][A-Z0-9]{1,10}$/.test(data.identifier)
```

- Rendered current step (markdown, no `form` object):
```js
return createSuccessResponse('Project Setup Wizard', {
  content,
  sessionId,
  currentStep: { id, name, description },
  progress,
  state
})
```

## Alignment Options (for future implementation work)
If aligning implementation to tests:
- Session handling
  - Support `action: 'finish'` and mutate `context.sessionId` on `start` to ease test usage.
  - When `context.sessionId` is present and no `action`/`mode` is provided, treat it as "show current step for existing session" instead of starting a new one.
- Response shape
  - Return `currentStep.form.fields` arrays and `currentStep.review` objects as tests expect.
  - On finish, include `{ completed: true, project: { id, identifier, ... } }` in `data`.
- Step schemas
  - Accept test field names (`owners`, `members` as strings; `private`, `autoClose`, etc.; `initialComponents`, `createDefaultStates`, etc.).
- Validation
  - Allow underscores in identifiers and update error messages accordingly.
- Finalization
  - Support `action: 'finish'` without extra `stepData`, using accumulated state.
- Dependency
  - Import and use `ProjectService` so Jest mocks apply, or wire `context.services` in tests.

Alternatively, if keeping current implementation contract, update tests accordingly.

## Open Questions
- Should identifiers allow underscores? Tests assume yes; implementation assumes no.
- Do we want a markdown-driven UI or structured `form`/`review` data returned by the API?
- Should team members be strings or typed objects with roles and permissions?
- Should the wizard rely on DI via `context.services` or perform direct module imports for service calls?

## Conclusion
The failures observed in the test suite are consistent with the above mismatches. Deciding which contract (test vs. implementation) is the source of truth will determine the path forward. This document can guide the subsequent refactor in a targeted way.

