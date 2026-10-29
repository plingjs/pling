---
id: TS-08
title: "Sensitive value leaks or is missing"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Sensitive value leaks or is missing

Sensitive-value bugs have opposite forms: the model sees raw text it should not, or an action needs a value and receives a mask. First establish the intended exposure mode, then inspect execution-time restoration and outbound redaction.

## Modes

| Mode | Model sees | Action receives | Use |
| --- | --- | --- | --- |
| `hidden` | `[hidden]` | Nothing usable | Indicate existence only |
| `masked` | Lossy mask | Not reversible | Human tail check |
| `token` | Short-lived alias | Real value at execution | Action truly needs it |
| `hint` | Type description | Nothing usable | Explain the field |

The default is `hidden`. If an action needs a real phone number, use a token and protect the action; do not pass a mask to business code.

## Leak investigation

1. Check that records, state, feedback, and errors all apply the same sensitivity declaration.
2. Check whether business code interpolates a real value into `message`; outbound redaction is a safety net, not the only defense.
3. Check application logs, APM, analytics, and URL parameters. Leakage outside the framework boundary is not automatically fixed.
4. Check tool results, debug panels, and audit events for raw arguments.
5. Check whether tokens enter localStorage, cross-session URLs, or third-party services.
6. Check whether `sensitive()` is nested in a way that prevents detection.

## Missing-value investigation

1. Confirm the field uses token, not masked/hidden.
2. Confirm the token belongs to the current page session; old aliases may expire after refresh.
3. Confirm arguments remain an object and the schema does not reject an alias format.
4. Confirm business code receives executor-restored arguments.
5. Confirm error redaction is not so broad that diagnosis is impossible; use record id or field name.

Unknown or forged tokens MUST be rejected before execution. Business code must not parse `{p:...}` itself; that is executor responsibility.

## Audit and debug

A debug panel may show an alias or mask, never the real value. Audit keeps record id, capability, outcome, and public approval id, not full arguments.

## Acceptance

- One field follows the same rule in records, state, feedback, and errors.
- A mask cannot be used for a write.
- Tokens are valid only in the current page session.
- A forged token is rejected and the business handler does not run.
- Application logs and analytics do not collect raw values.
- Debug, audit, and model context do not expose original values.

## Related

[Sensitive data](/vue/sensitive-data), [Context and sensitive data](/surface/context-and-sensitive-data), [Security and privacy specification](/spec/0.1/security-and-privacy).
