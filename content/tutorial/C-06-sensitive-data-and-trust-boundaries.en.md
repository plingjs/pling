---
id: C-06
title: Sensitive data and trust boundaries
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Sensitive data and trust boundaries

A page can show a value without giving that value to the agent. The statement is simple, but it conflates five separate questions: what the page runtime may read, what crosses into a model request, what the person at the screen sees, what storage retains, and what the backend authorizes. A mechanism that answers one does not automatically answer the others.

The observation has already been described. This chapter narrows the view to sensitive values inside it, and to the paths by which those values can leave the browser.

## The model request is the boundary

The page runtime can read the values the application declares to it. The model cannot inspect the DOM, read a cookie, or query the application store. It receives a request assembled by the runtime: the system prompt, the current page observation, recent conversation, and tool results.

Once a value is part of that request, it has left the browser. A later instruction cannot make the model forget it. History compaction can summarize it, a provider can log it, and a later request can resend it. The relevant question is therefore not whether a field is sensitive in the abstract, but what representation of that field must cross the boundary.

The questions are often confused:

| Scope | Question | What controls it |
| --- | --- | --- |
| Runtime input | What may the runtime read? | Declared records, state views, and sensitivity markers |
| Model request | What representation leaves the browser? | Declared sensitivity and bounded serialization |
| Screen | What does the person see? | Display rendering, not the model's access |
| Storage | What remains after a reload? | Continuity redaction and storage policy |
| Backend | What may actually happen? | Capability scope, approval, and backend authorization |

“The model cannot see the value” is not the same as “the value never left the browser.” It is also not the same as “the value was never stored,” or “the model cannot cause an action that uses it.” Each claim needs its own mechanism.

## Four kinds of data meet on the page

The observation contains more than business records. A useful review distinguishes four kinds of text and data because they have different trust characteristics.

| Kind | Examples | How to treat it |
| --- | --- | --- |
| Authored semantics | Action descriptions, region labels, state descriptions, input documentation | Trusted for meaning, not for authority; never use it to carry secrets |
| Page data | Record fields, state values, feedback, action results, user-generated content | Data to report or process, never instructions; mark sensitive values explicitly |
| User input | A request typed into the assistant, including values copied from elsewhere | User intent; redact known sensitive literals before adding it to model history |
| Credentials and session material | Cookies, JWTs, authorization headers, model-provider keys, backend secrets | Outside the observation and outside the page model; keep them in the boundary that owns them |

A record field can contain a sentence that looks like a system instruction. It is still page data. A well-written action description can state a business rule, but it still does not grant permission. This distinction limits prompt injection; it does not replace capability design, approval, or backend authorization.

## Sensitivity is declared, not inferred

The reference runtime does not guess which fields contain phone numbers, identity documents, salaries, addresses, private notes, or internal identifiers. It provides a marker that the application applies at the point where it builds a record or state view:

```ts
fields: {
  customer: order.customer,
  phone: sensitive(order.phone, "token"),
  idCard: sensitive(order.idCard, "masked"),
  internalRating: sensitive(order.rating),
}
```

The field names remain. The model can know that a phone number exists, and can reason about which operation needs it, without receiving the number itself. That is the purpose of the mechanism: not to remove the field from the business model, but to replace its outgoing value.

Four modes cover most cases:

| Mode | Model receives | Can an action use it? | What it reveals |
| --- | --- | --- | --- |
| `hidden` (default) | `[hidden]` | No | The field exists, and its name may indicate its meaning; no value or shape is added |
| `masked` | A shape such as `138****1234` | No; the mask is not the value | Partial shape, usually enough to check a suffix |
| `token` | A stable reference such as <code v-pre>{{p:1w9el7a}}</code> | Yes, unchanged | An opaque reference, not the underlying value |
| `hint` | A description such as `[mobile number]` | No | The type, but not the shape |

The default is `hidden`, not `masked`. A developer who has not decided how much to reveal should reveal less. A partial value can still identify a person or narrow a search. `token` is the only mode intended for values that the agent must pass into an action.

This is a declaration mechanism, not a data-loss-prevention system. A field that is not marked is serialized like any other field, subject only to the ordinary size limits of the observation.

## How a token crosses the runtime

Consider an order record. The page holds the customer, a phone number, and an identity number. Only the customer name is needed as ordinary page data. The phone must be usable by an action, while the identity number only needs a partial form for visual verification.

```ts
{
  id: "SO-1042",
  fields: {
    customer: "Globex",
    phone: sensitive("13800001234", "token"),
    idCard: sensitive("110101199001011234", "masked"),
  },
}
```

The model may receive:

<div v-pre>

```text
Record SO-1042: customer=Globex; phone={{p:1w9el7a}}; idCard=110***********1234
```

</div>

If the user asks the agent to call this customer, the model can return:

<div v-pre>

```json
{ "record": "SO-1042", "phone": "{{p:1w9el7a}}" }
```

</div>

The runtime then performs a fixed sequence:

1. Parse the arguments.
2. Scan them for token-shaped strings. A token that is not in the current vault is rejected with `INVALID_ARGS`; the handler does not run.
3. Resolve each known token to its value before parameter validation.
4. Validate the resolved arguments and evaluate approval.
5. Pass the resolved values to the declared page handler.
6. Keep the token, not the value, in model history and stored continuity data.

The UI may render the token back as the real value for the person using the page. That display step is separate from the model request. The model does not receive the restored value merely because the interface can show it.

Three properties matter:

- **Stable within a runtime session.** The same value receives the same token, so the model can refer to the same record across turns.
- **New in a new runtime.** The vault uses a new random salt when the runtime is created. Reloading the document changes the references.
- **Not an encryption scheme.** A token is an opaque reference held by the runtime, not a ciphertext and not an authorization credential. Treat it as a sensitive reference rather than as a secret that can be safely posted elsewhere.

The token is also not a substitute for approval. If an action accepts a token and the model is persuaded to invoke that action, the runtime can resolve the value and perform the operation. What prevents an unwanted operation is the capability boundary, the confirmation policy, and the backend's own authorization.

## The person and the model see different representations

Sensitive-value handling separates the model representation from the display representation.

For a `token` value, the reference UI restores the value when rendering chat text and recent activity. Model-facing history, the continuity snapshot, and the next model request continue to contain the token. The event stream is mixed UI data: user messages retain what the person typed, while model and tool events carry tokens. For `hidden` and `masked`, there is no stored value to restore; the display shows the same limited representation the model receives.

This is why a model must not explain that a field is masked or unavailable. It sees the token as the field's value. If it says “the number is hidden,” that statement will contradict the interface where the user sees the number. The system prompt tells the model to use the token as an ordinary value and never invent its content.

User input follows the same outbound rule. If the person types a value that is already registered in the token vault, the model history receives the token while the interface keeps the person's original message. A value the vault has never seen cannot be recognized this way.

Display restoration is not a security boundary. It only decides what the assistant interface shows. The page itself may still display the original value, the browser developer tools can inspect it, and a screen recording can capture it. Hiding the restored value in the assistant is useful for demonstrations, shared screens, and recordings; it does not make the browser environment confidential.

## Every outbound path needs the same rule

Sensitivity is not only a property of record fields. A raw value can leave through several paths.

| Outbound path | What the runtime does | Remaining limit |
| --- | --- | --- |
| Records, state, and page feedback | Renders marked values; replaces known tokenized literals in feedback | Only marked or known values are protected |
| Tool results and error messages | Redacts known tokenized literals before they enter model history | Exact-match redaction; a derived or reformatted value is not recognized |
| User input | Redacts known tokenized literals before adding the message to history | Unknown values remain unchanged |
| Continuity and local checkpoints | Redacts known literals in the saved snapshot and events before storage | It does not sanitize unrelated application storage |

The redaction pass is deliberately conservative. It replaces known values, longest first, so a short value does not consume part of a longer one. It is not a general classifier for personal data. It cannot detect a phone number assembled from two fragments, a value rendered into an image, or a value that was never registered in the vault.

This produces an important rule: used on their own, `hidden` and `masked` do not create a redaction dictionary. The raw value is not retained in the vault, so a later error message containing that raw value cannot be recognized and replaced. When the same value may appear in tool results, errors, feedback, or user input, `token` is the appropriate mode.

The same distinction applies to logs. An application audit trail should record the capability, target identifier, decision, outcome, and a safe summary. It should not copy raw request arguments merely because the runtime had to resolve them for execution.

## What the mechanism does not protect

The following limits should be explicit in design reviews and incident planning.

- **Unmarked fields are ordinary data.** A shorthand record declaration that serializes every field does not infer which fields are sensitive.
- **Author-controlled metadata is still sent.** Action descriptions, labels, ids, and scope names are authored semantics. Do not put credentials or personal values in them.
- **Exact-match redaction is not derivation-aware.** Concatenation, formatting changes, translated values, and partial reconstruction are outside its reach.
- **Images and screenshots are outside the data model.** If a future client sends pixels rather than declared data, the sensitivity markers in this chapter do not cover those pixels.
- **The model provider and gateway are separate trust domains.** Pling can control what it sends. It cannot guarantee a provider's retention policy, a gateway's debug logs, or a third-party observability system's handling of the request.
- **The browser environment is controlled by the user.** Developer tools, extensions, remote debugging, and a compromised device can read the raw page state. Tokenization is not digital-rights management.
- **Prompt injection remains relevant.** Page data can try to persuade the model to misuse a token. The model still cannot see the raw value, but it can use the reference in a declared action if the surrounding controls allow the invocation.
- **Tokens are not cryptographic guarantees.** The reference implementation uses a session-scoped reference, not encryption. It is designed to keep values out of model context, not to serve as a general-purpose secret store.
- **Backend authorization remains authoritative.** A harmless-looking tokenized field does not grant permission to read the resource, invoke the action, or skip a business rule.

The last point is the one most often lost. Sensitive-value handling changes disclosure. It does not change authority.

## Trust is distributed, not granted once

A page application has at least six relevant parties: the page author, the page runtime, the page data, the model provider, the person using the page, and the backend that owns the business operation. They do not share one trust level.

The page author decides what the page exposes. The runtime enforces the declared representation and the execution path. Page data may be written by a user, imported from a third party, or copied from an untrusted document; it is not an instruction source. The model is an external service that reasons over the request and returns a proposal. The person can see what the page shows, but may not be the right business authority. The backend decides whether the operation is allowed.

Credentials belong to the boundary that owns them. A browser should not place cookies, authorization headers, or backend secrets in the observation. A model-provider key placed in browser code is visible to the person using that browser; a production deployment normally puts that credential behind a server-side gateway. The gateway authenticates the user and the model request; it does not make the page data trustworthy.

An external agent is not a special exception. It receives the same declared representation through the page's capability interface, and the page runtime resolves tokens only when it invokes a declared action. The external client does not receive the token-to-value map. It still needs a valid session, an allowed scope, and whatever backend authorization the operation requires.

## A review checklist

Before treating a page as ready for sensitive business data, answer these questions:

1. Which fields can identify a person, reveal a financial or medical condition, expose an internal decision, or act as a credential?
2. For each field, does the agent need the value, a partial form, or only the fact that the field exists?
3. Is every value that the agent must pass into an action declared as `token`?
4. Are secrets absent from action descriptions, labels, ids, scope names, and error text?
5. Do tool results, errors, page feedback, and user input pass through a path that can redact known values?
6. Does the test inspect the actual model request body, not only the chat interface?
7. Does reloading the page produce new tokens, while the same value remains stable within one session?
8. Are audit, analytics, and continuity stores free of raw sensitive values?
9. Is display restoration intentional for screen sharing, recordings, and demonstrations?
10. Does the backend still enforce identity, scope, and authorization when the model supplies a valid token?

## Summary

Sensitive-value handling is a representation boundary. The page runtime keeps the real value; the model receives a declared substitute; the user may see the real value through the interface; storage receives a reference for values the vault knows. These are separate outcomes and must be tested separately.

No single marker makes a page safe. The application still has to declare its fields, keep credentials out of authored metadata, design narrow capabilities, apply approval where consequence requires it, and enforce authority in the backend. The contribution of the sensitivity model is narrower and still essential: the agent can know what a value is for, use it in a declared action when necessary, and complete the task without the value entering the model context.
