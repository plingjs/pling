---
id: R-18
title: "Sensitive data"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Sensitive data

An order record may contain a phone number, an identity number, or an internal rating. Removing those fields makes the assistant less useful: it cannot identify the customer or complete an action that needs the value. Sending them unchanged is worse: the value enters the prompt, the conversation history, and potentially a third-party model provider's logs.

Pling separates “the model knows this field exists” from “the model sees the value.” A field can remain part of the record while its value is hidden, masked, or replaced by a session token.

## Declare sensitivity where the record is exposed

The order row keeps the same record declaration and wraps only the sensitive values:

```tsx
import { sensitive, usePlingRecord } from "@plingjs/react";

const rowRef = usePlingRecord<HTMLTableRowElement>({
  data: order,
  id: order.id,
  label: `Order ${order.id}`,
  fields: {
    customer: order.customer,
    status: order.status,
    phone: sensitive(order.phone, "token"),
    idCard: sensitive(order.idCard, "masked"),
    grade: sensitive(order.grade),
  },
});

return <tr ref={rowRef}>…</tr>;
```

The model sees four different levels of information:

| Declaration | Model sees | The original value is recoverable |
| --- | --- | --- |
| `sensitive(value)` / `sensitive(value, 'hidden')` | `[hidden]` | No |
| `sensitive(value, 'masked')` | A masked string such as `P-1****1198` | No |
| `sensitive(value, 'token')` | <code v-pre>{{p:…}}</code> | Yes, inside this page session |
| `sensitive(value, { mode: 'hint', hint: 'US phone number' })` | `[US phone number]` | No |

The default is `hidden`, not `masked`. A developer who has not decided how a value will be used should expose less, not more.

`masked` is lossy. It is suitable for checking the final digits or confirming that a field has the expected shape. It is not an alternate way to make a value usable by an action.

## A token is a capability, not an obfuscated string

The phone field uses token mode. The model can copy <code v-pre>{{p:…}}</code> into an action parameter:

```json
{ "phone": "{{p:1a2b3c4}}" }
```

Before parameter validation and before the business function runs, the executor restores the real value. The business code receives the same kind of phone number it would receive from a human click:

```ts
run: (args) => callCustomer(order, String(args.phone))
```

This supports the common case where an action genuinely needs the value. It also means the action must be designed carefully: a tool that accepts a phone token can cause a call, a message, or another real-world side effect. Sensitive data handling does not replace approval. Mark the action with the appropriate `kind`, `confirm`, or handoff rules.

Tokens are page-session scoped. The same value maps to the same token within the session, so the model can refer to “this customer” across turns. Refresh the page and the token space changes. A guessed or stale token is rejected before the action runs:

```text
Arguments reference unknown sensitive-value tokens: <code v-pre>{{p:madeup1}}</code>
```

Do not treat a token as a secret that can be pasted into another environment. It is a short-lived reference, not a portable credential.

## Prevent the value from returning through another channel

It is not enough to sanitize the record. A business function may throw an error that includes the real value, or a page may render it into feedback. Pling records known tokenized values and redacts them on outbound paths: tool receipts, error messages, and page feedback.

For example, the verification tool throws an error containing the restored phone number. The model receives the token instead:

```text
Customer <code v-pre>{{p:1a2b3c4}}</code> is already registered.
```

This reverse redaction is a safety net, not permission to print sensitive values everywhere. Application logs, analytics, and your own telemetry are outside that boundary. Keep them on the same discipline: log identifiers or masked values, not raw data.

## Sensitive state follows the same rule

The same `sensitive()` marker works in `useAgentState` and other read-only exposures:

```ts
useAgentState('customer', () => ({
  name: customer.name,
  phone: sensitive(customer.phone, 'token'),
  level: customer.level,
}));
```

Do not expose the entire store and assume the agent will ignore fields it does not need. Sensitive fields should be explicit, and the view should contain only what the agent needs to make a decision.

## Run the example

```bash
pnpm tutorial:dev r-18
```

Open `http://127.0.0.1:5258/?lang=en`.
The complete example is in `examples/tutorials/r-18-sensitive-data`.

1. Ask the assistant to call the customer on `SO-1002`. The model passes the phone token; the business function receives the real number.
2. Ask it to verify the same customer. The thrown error is redacted before it returns to the model.
3. Inspect the record in Activity. The phone is a token, the identity number is masked, and the internal rating is hidden.

The deterministic check:

```bash
pnpm tutorial:check r-18
```

It covers projection, token restoration, reverse redaction, and rejection of invented tokens.

## Failure modes

**Using token mode by default.** Token mode is for values an action needs. A value that only provides context should be hidden or hinted. The most permissive mode should be a deliberate choice.

**Believing masked values are usable.** The mask cannot be reversed. If an action needs the phone number, use token mode and protect the action instead of trying to parse a mask.

**Logging the value before it reaches the framework.** `sensitive()` cannot redact a request your application sends to its own analytics service. Data collection needs its own review.

**Putting a token in a URL or sharing it across sessions.** Tokens are page-scoped references. They do not replace authorization, and they should not become a shortcut for carrying a value between systems.
