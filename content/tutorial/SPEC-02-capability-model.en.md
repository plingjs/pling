---
id: SPEC-02
title: "Capability model"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Capability model

A capability is a business operation that a page permits an external caller to perform. It is not a button, DOM node, or arbitrary function. The descriptor states what can be done; the executor decides whether it is allowed now and whether it succeeded.

## Required fields

Every capability MUST contain:

| Field | Requirement |
| --- | --- |
| `id` | Non-empty, stable within the application, and unique within the session |
| `description` | Business-facing explanation; user-generated content MUST NOT be presented as instructions |
| `effect` | `read`, `write`, or `destructive` |

`inputSchema` MAY be omitted when the capability takes no properties. When present, it MUST be a JSON Schema object describing only the action's input, not internal selectors or credentials.

## Optional fields

| Field | Meaning |
| --- | --- |
| `approval` | `none`, `ask`, or `always`; omission is equivalent to `none` |
| `fidelity` | Confidence in target resolution; omission means `high` |
| `source` | `declared` or `derived`; omission means developer-declared |
| `scopePath` | Region path for the capability |
| `handoff` | A human must complete the step, with a reason |
| `flowSteps` | Number of steps in a composite action |
| `offscreen` | The target is outside the viewport but referenceable by record id |
| `record` | Record parameter and coverage for a folded row-action template |

These fields describe execution risk and conditions. They are not authorization. `approval: none` does not make backend authorization unnecessary, and `effect: read` does not make data unconditionally public.

## Identifier stability

Capability ids MUST be application-defined, for example `task.add` or `order.update_note@order`. A caller MUST NOT derive an id from button copy, and MUST NOT assume that an id survives navigation.

The same business operation SHOULD mean the same thing across adapters. An adapter may change installation, but MUST NOT invent a conflicting schema or risk level for the same operation.

A `destructive` capability MUST satisfy the application's approval policy before execution. When a capability is hidden or denied, the caller MUST stop rather than search for a similar id that bypasses the restriction.

## Folded row-action templates

When every row has the same kind of action, the surface MAY expose one template id:

```json
{
  "id": "order.update_note@order",
  "description": "Update the note on a selected order",
  "effect": "write",
  "inputSchema": {
    "type": "object",
    "properties": { "note": { "type": "string" } },
    "required": ["note"]
  },
  "record": { "param": "record", "total": 48, "offscreen": 12 }
}
```

The invocation MUST place the target record in `input.record`. The surface passes the template, record id, and remaining input to the existing executor; the protocol layer MUST NOT synthesize a selector. A missing, filtered, or out-of-scope record causes failure.

The template description SHOULD describe the class of rows, not the current label of one row.

## Exposure

Site-level exposure and verified session scope MUST be intersected:

```text
visible capabilities = site expose ∩ session scope ∩ current registry
```

`describe` and `invoke` MUST use the same intersection. Filtering in only one method is an authorization defect. After scope changes, an old capability list no longer grants access.

## Denied by default

A capability MUST NOT be:

- arbitrary selector clicks;
- arbitrary script evaluation;
- raw DOM or complete store reads;
- Cookie, JWT, delegation-token, or model-key access;
- an administrative bypass of approval, handoff, or backend authorization.

If a task cannot be expressed through declared business capabilities, the application should add a capability or hand the task to a person. It should not add an escape hatch.
