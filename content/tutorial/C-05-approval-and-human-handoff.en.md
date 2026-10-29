---
id: C-05
title: Approval and human handoff
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Approval and human handoff

The execution lifecycle reaches a confirmation decision before an agent may run a declared action. That decision is one of two different forms of human involvement.

**Approval** answers whether the agent may perform the current invocation. The agent remains the actor. If the user approves, the page's declared handler runs. If the user denies, the invocation ends without entering that handler.

**Human handoff** answers which part of an operation a person must perform. The actor changes. The agent requests the step, the person acts in the page, and the runtime waits before continuing. The agent does not simulate the person's work.

In this chapter, approval means the page runtime's interactive confirmation for one invocation. It is not an enterprise approval record, an identity proof, or a replacement for backend authorization. Those are separate concerns.

The execution pipeline calls this stage confirmation. This chapter uses approval for the decision a person makes at that stage.

## Two questions, not one ladder

An order page may offer both “Approve refund” and “Sign with security key”. Both are high risk, but they require different responses.

| Decision | Question | Who acts | Runtime behavior |
| --- | --- | --- | --- |
| Approval | May the agent perform this invocation? | Agent | Ask the user; run only after an affirmative decision |
| Human handoff | Which part must a person perform? | User | Do not run the agent path; wait for the person, then verify the result |

These are not two strength levels of the same control. A stronger approval prompt still cannot enter a one-time code, select a local file, or use a hardware key. A handoff does not automatically mean the agent has been authorized to prepare, submit, or finish the surrounding operation.

An operation can need both. A person may approve a refund, then complete a bank confirmation that only they can perform. A compound action may also have agent-executed steps before and after a human step. Approval and handoff can be adjacent in one business operation, but they answer different questions.

## Approval is a decision about one invocation

Approval is a gate in the execution path. The agent has already selected an action and supplied arguments; the runtime has resolved the target and validated the input. The decision now is whether this concrete invocation may proceed.

The page model marks actions that require confirmation, so the model can anticipate the interruption and explain why it is needed. The marker is not a grant. It only tells the agent that a gate exists. The gate is enforced when the action is invoked.

The relevant unit is business consequence, not the kind of DOM element or HTTP method. A filter change can be read-only. A note update may be reversible. Deleting a batch can be irreversible. Exporting customer records is read-only in code but may move data outside the page.

| Operation | Likely default | Reason |
| --- | --- | --- |
| Change a list filter | No prompt | Reversible view change with no business write |
| Edit a note | Application-defined | Low-impact, but may be visible to other users |
| Approve a refund | Prompt | Changes a financial state and may be expensive to reverse |
| Delete selected orders | Prompt every time | Irreversible and potentially broad in scope |
| Export all customer records | Prompt | Read-only, but the data leaves the page boundary |

The label `read` does not make an action harmless, and `write` does not by itself determine severity. The declaration has to describe what the operation changes, what it affects, and whether its result can be undone.

## Approval policies and their scope

The capability description expresses the choice as no additional confirmation, `ask`, or `always`. The runtime resolves it to `none`, `ask`, or `ask-always`. Three behaviors are sufficient for most applications:

| Policy | Behavior |
| --- | --- |
| No extra confirmation | Run without asking |
| Ask | Ask before the invocation; a user may be offered a session-wide shortcut for the same action shape |
| Ask every time | Ask on every invocation; no “always allow” option |

The action declaration can request a stricter policy than its default. An action can also be declared as requiring no confirmation, but that should be a deliberate decision by the application, not a shortcut around the runtime. A declaration never grants backend permission.

A destructive action normally uses the ask-every-time policy. If a user chooses “always allow” under an ask policy, the shortcut applies to the same action shape in the current runtime session, not to one record and not to every action. This is useful for repeated list operations, but it is a poor fit for destructive operations where a previous approval should not cover a different target.

The current reference implementation defaults to asking only for actions declared dangerous. An application can choose a stricter policy that also asks for writes. The first mode produces fewer interruptions; the second gives more protection when declarations are incomplete. Neither mode replaces accurate declarations or backend authorization.

Once an action resolves to ask or ask every time, a missing confirmation channel cannot silently become approval. The invocation is denied. An unanswered prompt is also treated as denial. Clearing a pending prompt denies the request rather than leaving the agent loop waiting indefinitely.

## What the user is approving

An approval decision should identify the operation, not merely the widget. The confirmation request therefore carries the action id, its business description, its risk class, and the arguments that will be used. The confirming interface must show enough for the user to identify the operation. At minimum, it should expose the action id and description; when an argument materially changes the consequence, the interface should expose that argument as well. For a compound action, the ordered steps should be inspectable.

Arguments may contain references that were resolved before the decision, so a richer interface can show the values that will actually run. The confirming interface may mask sensitive values, but it must not substitute different values without showing the change. Approval of one displayed operation cannot authorize a different hidden one.

A compound action is approved as one business operation. The runtime takes the highest risk it can resolve from the steps and asks once at that level. If a later step turns out to be stricter than the approved scope, that step asks again before it runs. A resumed flow reuses the approved scope for the remaining steps; it does not acquire a new, broader permission.

An individual decision covers that invocation. It does not extend to a different target, a new operation, or a later session. The ask shortcut is the explicit exception: the user has chosen to remember permission for the same action shape within the current runtime session.

A denial ends the invocation. The agent may explain the consequence or ask the user for a new decision, but it must not describe the denial as approval or silently switch to a lower-level sequence that produces the same effect.

## What approval does not establish

Runtime approval records a decision by a person using the page. It does not prove who that person is, what roles the backend has granted, or whether the business rules allow the operation.

| Approval establishes | Approval does not establish |
| --- | --- |
| A person allowed this invocation to proceed | The user's identity or business role |
| The decision was made with the displayed arguments and target | Backend authorization for the resource |
| A denied invocation did not enter the page handler | That the business operation succeeded |
| A user intent was collected for this runtime session | A durable, transferable, or organization-wide consent |

For regulated or high-value operations, a page confirmation may need to be followed by a backend approval bound to the user, agent, session, capability, target, normalized arguments, expiry, and request id. The approval receipt remains between the trusted page flow and the approval backend; it does not enter the agent's context. These controls supplement runtime approval, not replace it.

## Human handoff is an execution mode

Some steps cannot be delegated to an agent even when the surrounding task can. Entering a one-time code, solving a visual challenge, choosing a local file, tapping a hardware key, signing with a personal certificate, or passing a biometric check all require the person to act.

Such a step is declared as a handoff. The action may still appear in the page model because the agent needs to know that the business operation exists and must be initiated. When invoked, the runtime validates the action and its target, then asks the person to complete the step. It does not call the action's normal page handler.

The handoff request carries a reason that the interface can show to the user. The person completes the step through the page's own controls. The runtime waits for one of three outcomes: done, cancelled, or timeout. The default wait is five minutes and can be configured per step or by the application.

The same step is not given an additional approval prompt. The person is performing the action, so a separate “may the agent do this?” decision would be redundant. This does not remove approval from other agent-executed steps in the same operation.

When the person says the step is done, the runtime checks the declared postcondition. If the condition holds, the operation continues and the receipt records that the step was completed by the user. If the condition fails, the result is `HANDOFF_FAILED`; a clicked completion button is not accepted as proof that the business result occurred.

An expectation is strongly recommended for every handoff. Without one, the runtime can record that the user asserted completion, and it may still compare page snapshots, but it cannot independently verify the business condition.

Cancellation and timeout are not proof that the page is unchanged. The agent did not run the declared handler, but the user may already have interacted with the page. The safe next step is to inspect the current state or ask the user, not to repeat the handoff automatically.

## Guided handoff

A person may need more than one instruction. A guided handoff presents an ordered list of steps, such as choosing a file and then confirming its name. Each step contains a short instruction and may identify a target to highlight.

The highlight is a visual guide, not a capability. It can point to an existing action, to a display-only guide target, or to the action that initiated the handoff when no target is specified. A display-only target does not appear as a tool, does not enter the page observation, and does not grant the agent access to the underlying control.

This matters for fields that must remain human-only. A one-time-code input can be highlighted so the user knows where to type, while remaining unregistered as an agent action. The runtime does not read the entered value into the model context merely because the field was highlighted.

Moving to the next or previous instruction changes only what the interface is explaining. It does not execute a business action or mark a step complete. The built-in interface shows the completion control on the final step, and the runtime verifies the handoff once, using the declared expectation.

Per-step verification is deliberately absent. Some steps produce no independently observable state, and requiring a check after every instruction would give a false impression of precision. The final condition is the contract; the instructions help the person reach it.

## Handoffs inside compound actions

A compound action can contain both agent-executed and human-executed steps. The agent invokes one tool; the runtime runs the earlier steps, stops at the handoff, waits for the person, then continues with the remaining steps. The step ledger records which step required human work.

The handoff belongs on the action for the specific step that a person must perform. Marking the whole compound action as a handoff transfers the whole operation to the user and skips its internal steps. That may be correct for a process that is entirely manual, but it is not a way to mark one manual step.

The outer invocation may still require approval because earlier or later steps are performed by the agent. That approval covers the agent-executed consequences of the operation. The human step itself is not approved again. If a later step exceeds the approved risk, the runtime asks before running it.

For example, an invoice export may open a dialog, ask the user to enter a one-time code, and then let the page generate the file. The agent can initiate the export and open the dialog. The code entry is a handoff. The final expectation verifies that the file exists before the operation is reported as complete.

## Failure outcomes

Approval and handoff failures have different meanings. The error code and the actor that had control at the point of failure determine what is known.

| Situation | Result | What is known |
| --- | --- | --- |
| No approval channel is configured | `PERMISSION_DENIED` | The agent path did not run |
| The user denies approval | `PERMISSION_DENIED` | The agent path did not run |
| The approval wait times out | `PERMISSION_DENIED` | The agent path did not run |
| No handoff channel is configured | `HANDOFF_FAILED` | The agent did not simulate the human step |
| The user cancels the handoff | `HANDOFF_CANCELLED` | The agent path did not run; the user's own actions may persist |
| The handoff times out | `HANDOFF_TIMEOUT` | The agent stopped waiting; the page may already have changed |
| The user reports completion, but the expectation fails | `HANDOFF_FAILED` | The business condition was not observed; the page may be partially changed |

These results are starting points for recovery, not automatic retry instructions. After a handoff failure, the agent should inspect the page or ask the user where the process stopped. Repeating the step without that check can duplicate a manual action or interrupt a process that is still completing.

Approval failure does not authorize a different execution path. If the user denies a declared action, the agent should not use an undeclared DOM operation or a different low-level sequence to produce the same result. Any alternative must be its own declared business action, with its own consequence and approval policy.

## Summary

Approval and human handoff both involve a person, but they change different parts of the execution lifecycle. Approval keeps the agent as the actor and decides whether the current invocation may proceed. Handoff changes the actor for a step and requires a person to complete work that the agent cannot perform.

Approval must bind a decision to the displayed operation and its arguments. It does not replace identity, backend authorization, or enterprise approval. Handoff must skip simulated execution, wait for the person, and verify the declared result. Both paths fail closed, and neither should be reported as success before the page provides the required evidence.
