---
id: TS-03
title: "Action is unavailable"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Action is unavailable

`ACTION_UNAVAILABLE` means the action is registered but cannot execute now. This differs from a missing action: the declaration exists, but a business or interface gate rejects it. Explain and clear the precondition; do not retry or seek a bypass.

## What to inspect

| Check | Meaning |
| --- | --- |
| `available()` | Whether a business precondition returns false |
| `disabled` | Whether the native control is disabled |
| Region | Is the action in an active region, modal, or hidden step? |
| Overlay | Is a modal, loading mask, or fixed layer covering the target? |
| Record state | Is the row locked, deleted, or owned by another user? |
| Role | Does the current user have permission? |
| Filter / page | Has the target left the current business view? |

## Read the reason

The message may name a precondition, record state, or active region. It gives direction, but program logic still uses the stable code. The debug panel should retain action id, target record, and the snapshot at failure time.

The executor returns a structured result rather than throwing:

```json
{
  "error": {
    "code": "ACTION_UNAVAILABLE",
    "message": "Action is currently unavailable: approve@order:SO-1042; reason: order is locked"
  }
}
```

The example reason is page-defined. Do not parse the message for control flow; expose a stable business reason in your own diagnostics if operators need to group failures.

## Diagnostic sequence

1. Copy the action id and target record from the failed request, not from an older transcript.
2. Describe the page again. Confirm that the action is still present and that its region is active.
3. Compare the present DOM with the page snapshot: disabled control, hidden step, closed dialog, or replaced row.
4. Call the page's read path or state view to establish the current business record.
5. If the control is outside the viewport, use a declared reveal or scroll capability before retrying.
6. If a person must unlock, approve, or complete a prerequisite, stop and hand off the task.

Do not “repair” the situation by switching to a similar action, issuing DOM clicks, or editing the record directly. Those paths bypass the contract that made the action safe in the first place.

## Do not

- retry an unavailable action unchanged;
- switch to a similar id to bypass permission;
- use generic clicking or scripts to fake availability;
- treat “waiting for approval” as unavailable;
- change business state without human authorization.

## Recovery

1. A missing prerequisite: perform an allowed prerequisite, then describe again.
2. A filtered target: restore the filter or choose a new business view.
3. A covered control: close or complete the modal.
4. A locked record: ask its owner to resolve it.
5. Insufficient permission: hand off to a person; the agent cannot self-authorize.
6. A `handoff`: show the human action and wait for the result.

## Page design

- Return a specific reason instead of a bare false.
- Keep ids stable; do not make an action disappear when it is merely unavailable unless the business must conceal it.
- Distinguish confirmation, handoff, and unavailability.
- Expose step, role, and record state that affect availability.

## Acceptance

- An unavailable action never runs its business handler.
- The returned message names a concrete precondition when one exists.
- Re-describing after the prerequisite is cleared makes the action available again.
- Permission failures remain distinct from temporary interface state.
- A retry after restoration does not duplicate the earlier business effect.

## Related

[Execution lifecycle](/concepts/execution-lifecycle), [Approval and human handoff](/concepts/approval-and-human-handoff), [Error codes and diagnostics](/reference/error-codes-and-diagnostics).
