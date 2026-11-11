---
name: retrofit-pling
description: Plan and apply a controlled Pling retrofit to an existing Vue, React, or vanilla application. Use when adding agent-visible capabilities to a real codebase, producing a capability manifest, reviewing scope and risk, or turning a legacy page into a Pling-enabled application without rewriting its business logic.
---

# Controlled Pling Retrofit

Use this skill to retrofit an existing application. The goal is not to make the
agent "click around". The goal is to publish a small, reviewable set of stable
business capabilities while the application remains the execution authority.

## Non-negotiables

1. **Scanning is read-only by default.** Inspect the repository and report a
   concrete plan without editing files, installing packages, changing env files,
   or generating artifacts. Stop after the report unless the user explicitly
   asks to apply it.
2. **Baseline first.** Before an approved retrofit, prove the application builds,
   tests, and works without Pling. Preserve that version as a separate entry,
   branch, or copy-forward snapshot.
3. **No generic escape hatch.** Never add `click(selector)`, `eval`, arbitrary
   script execution, or a tool that forwards raw DOM events.
4. **One business operation, one tool.** Do not expose "open dialog, fill field,
   click Save" as three capabilities when the business operation is "set note".
5. **Read only what the agent needs.** Records and state are allowlists, not a
   dump of the component, store, or API response.
6. **Review the contract before implementation.** A scanner may propose a plan.
   The application owner must approve the capabilities, scopes, kinds,
   parameters, confirmation rules, and any external exposure before code
   changes. Do not infer approval from silence or a request to inspect the app.
7. **Stop on the dangerous boundary.** Authentication, authorization, personal
   data, payment, approval, deletion, permission changes, and external exposure
   require explicit human review and a rollback point.

## Operating modes

### Scan mode (default)

Read the app structure, existing business services, forms, routes, state, and
tests. Record current verification evidence when it is available. Produce a
capability inventory and a proposed integration diff map. Do not create a
baseline copy or edit the project in this mode.

The report must separate facts from proposals. For each proposed action, include
the user goal, existing business function, required inputs, dynamic references,
read/write risk, confirmation boundary, data returned to the model, and a way to
verify success. Flag missing authorization checks and unknown business rules
instead of filling them in by guess.

### Apply mode (only after explicit approval)

Work in the approved branch, worktree, or copy-forward snapshot. Keep the
business service as the source of validation and persistence. Implement one
workflow slice at a time, then compare it with the saved baseline. If an
approved action requires a new permission, database migration, external
allowlist, or broader data exposure than the reviewed plan, stop and present
that change separately.

Finish with an integration report that distinguishes unchanged business code
from Pling declarations, lists touched files and verification results, and
reports source line counts as code size rather than estimated effort. Include
observed model failures, retries, ambiguous references, and untested workflows.

## Phase 0: establish the baseline

Record the exact commands and results before editing:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If the project uses another package manager, substitute its commands. Capture
one browser smoke test of the main workflow. Do not "fix" unrelated failures;
record them and decide whether they block the retrofit.

In approved apply mode, create a baseline page or a tag before edits. The most useful fixture is two runnable entry
points that share business functions and CSS:

```text
src/baseline/   ordinary application, no @plingjs imports
src/integrated/ same UI plus declarations, records, state, assistant
```

## Phase 1: inventory without changing behavior

Read the pages and list five things separately:

| Inventory | What to find |
| --- | --- |
| Regions | stable sections, lists, dialogs, and their nesting |
| Actions | buttons, links, form submissions, and the business operation behind each |
| Records | rows that an agent must identify and the minimal fields it needs |
| State | filters, counts, pagination, selection, and other context that explains the view |
| Sensitive data | credentials, tokens, payment data, identity data, internal scores, private notes |

In scan mode, include a provisional capability manifest in the report only. Do
not write `retrofit/capabilities.json` or edit templates. In approved apply
mode, add the manifest as a reviewable artifact before implementing actions.

```json
{
  "app": "order-desk",
  "scopes": { "queue": "Order list" },
  "capabilities": [
    {
      "id": "orders.set_note",
      "kind": "write",
      "scope": "queue",
      "review": "human"
    }
  ],
  "state": [{ "key": "queue_view", "fields": ["filter", "shown", "total"] }],
  "external": { "allowlist": [], "excluded": [] },
  "forbidden": ["generic click or eval"]
}
```

Classify each item:

- **read**: returns information without changing application state;
- **write**: changes view or business state and needs a stable id;
- **danger**: destructive or irreversible; requires the confirmation boundary;
- **blocked**: should not be exposed in this iteration.

Clicking a filter is still a write. A destructive action mislabeled as `write`
is a review failure, not a shortcut.

## Phase 2: produce a human review plan

For every capability, write down:

- stable id and namespace;
- scope and record reference, if any;
- description in the operator's language;
- parameters, types, bounds, and defaults;
- business precondition and a readable unavailable reason;
- success expectation, especially for async operations;
- risk level and confirmation policy;
- minimal record fields and state fields;
- whether it belongs in the external allowlist.

Review the plan with the person who owns the workflow. Ask them to confirm
names, permissions, and destructive behavior. Do not infer approval from
silence or from a generic "go ahead" on an earlier step.

## Phase 3: apply in small slices

Install the adapter first, then add one slice at a time. After each slice:

1. run typecheck, unit tests, and build;
2. run the baseline smoke test;
3. run one integrated browser smoke test;
4. inspect the request in the debug view;
5. record the rollback point.

Recommended order:

1. adapter and namespace;
2. regions;
3. records and bounded read state;
4. low-risk view actions;
5. business actions with explicit parameters;
6. danger actions and confirmation;
7. in-page assistant;
8. external Surface allowlist.

Do not combine a framework upgrade, a visual redesign, and a capability
retrofit in one change set.

### Action and record rules

- Prefer a function tool when the UI workflow is multi-step but the business
  operation is singular.
- Put type and range bounds on parameters. An open string is not a contract.
- Use `available` for business preconditions and return a reason the model can
  act on.
- Use `expect` for asynchronous work so success is verified against the page.
- Keep record ids stable across renders. Do not include timestamps or array
  indexes in ids.
- Expose only the fields needed to choose and verify an operation. Never spread
  a store object into a record or state declaration.

### External exposure rules

- Start with the smallest allowlist that completes one real task.
- Exclude approval, deletion, permission changes, and bulk destructive actions
  unless a separate design review approves them.
- Use the same namespaced ids in the page allowlist, deployment config, and
  audit/tests. Add a test that fails when they drift.
- Keep provider keys, cookies, page tokens, and user credentials out of Surface
  requests and tool results.

## Phase 4: verify evidence, not just clicks

Add tests for:

- exact capability ids after namespace qualification;
- record fields after the row object is replaced;
- unavailable reasons when a precondition fails;
- confirmation refusal for danger actions;
- evidence that a business write changed the expected record field;
- Surface `describe` count and excluded capability families;
- `CAPABILITY_NOT_EXPOSED` for a guessed destructive id.

Manual checks:

- the baseline still works with Pling absent;
- the agent uses the business tool, not a sequence of synthetic clicks;
- the activity log shows the action id, parameters, result, and changed fields;
- a dialog that covers controls makes the covered controls unavailable;
- restarting the page does not change stable action or record ids.

## Stop conditions

Stop and ask for review when a change would:

- send personal data, secrets, or payment data to a model or external agent;
- add an approval, deletion, refund, transfer, or permission operation;
- widen an external allowlist;
- add a new authentication or delegation path;
- execute a business operation whose failure cannot be observed;
- require a database migration or a change to authorization rules.

Stop if tests fail for an unrelated reason and you cannot prove the retrofit is
independent of that failure.

## Deliverables

A completed apply-mode retrofit leaves:

- a runnable baseline;
- a runnable integrated page;
- `retrofit/capabilities.json` as the approved review contract;
- tests for ids, records, preconditions, evidence, and external exposure;
- a README with a change map, verification steps, rollback boundary, and known
  limits.
