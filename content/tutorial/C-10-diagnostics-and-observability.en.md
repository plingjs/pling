---
id: C-10
title: "Diagnostics and observability"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Diagnostics and observability

A failed assistant turn is not one event. It can mean that the page sent the wrong context, the model chose a nonexistent tool, the action existed but was unavailable, a person declined confirmation, the business function threw, or the declared result never appeared. Observability must preserve those distinctions.

Diagnostics answer “what did this particular run see and do?” Observability answers “how is the system behaving across runs?” They share identifiers and event shapes, but they have different retention and privacy requirements.

## Three records, three purposes

| Record | Answers | Typical contents |
| --- | --- | --- |
| Request trace | What exactly was sent and received during one run? | System context, history, tool schemas, model response, tool result |
| Telemetry | How much did it cost, and where did it fail? | Model call count, latency, token estimates, retry and tool status |
| Audit | Who authorized this operation, and what happened? | User, agent, session, capability, record id, outcome, request id |

The trace is the most sensitive. It can contain page snapshots, user messages, and model output. It belongs in a bounded development buffer, not in unconditional production logging. Telemetry should omit prompt and response text. Audit must identify authorization and execution without copying business parameters or credentials.

## Follow one request id

Give every request a stable id at the transport boundary. Keep it with the model call, the tool invocation, the business result, and any audit event. A user can then report an id without pasting a conversation, and an operator can connect a failed screen to the gateway and execution path.

Do not make the request id the business idempotency key. The id associates observations; it does not guarantee that a payment, deletion, or inventory change happens once. Durable business operations still need their own idempotency rule.

## Inspect a run in layers

When a run fails, inspect it in this order:

1. **Page projection.** Was the target region active? Did the relevant record have a stable id? Was the action visible and available?
2. **Tool schema.** Did the model receive the correct action name, description, and input shape?
3. **Model response.** Did it choose a declared capability, or invent one?
4. **Executor result.** Was the call denied, unavailable, invalid, failed, or unverified?
5. **Post-execution state.** Did the record or page state actually change?
6. **Transport and gateway.** Did authentication, rate limiting, retry, or upstream failure intervene?

This order prevents a common mistake: increasing the model budget because the page never declared the action. It also prevents blaming the page when a gateway rejected the request before it arrived.

## Useful counters

At minimum, group the following by application, model alias, release, and outcome:

- model calls, latency, and token estimates;
- turns used and budget exhaustion;
- tool calls by capability id and status;
- `ACTION_NOT_FOUND`, `ACTION_UNAVAILABLE`, `INVALID_PARAMS`, `EXECUTION_FAILED`, `EXPECTATION_FAILED`, and approval denial;
- retry attempts and exhausted retry budgets;
- Surface requests, rejected scopes, rate limits, replay rejection, and revoked sessions.

Counts without denominators are easy to misread. A rising number of successful tool calls may simply reflect more traffic; a falling success rate while traffic grows is the actionable signal.

## Privacy and retention

The safest trace is the one that is not collected by default. When it is enabled, restrict access, cap the number of retained calls, redact known sensitive fields, and define a short retention period. Treat page content and model output as untrusted data: a diagnostic viewer must render them as text, not execute them as instructions.

Telemetry endpoints need authentication and a transport policy. A random public endpoint that accepts page snapshots is a data leak with extra steps. Audit storage needs access control, tamper resistance appropriate to the risk, and a clear retention rule.

## A practical release check

Before shipping, verify that a staged failure produces a stable code and a request id visible to the user; that an operator can find the same id in gateway and tool events; and that turning diagnostics off removes both the trace UI and its data collection, not merely the button.

Diagnostics do not make a system safe by themselves. They make the boundary between page, model, and backend visible enough to repair. See [Failure model and error codes](/concepts/failure-model-and-error-codes) and [Runtime limits, observability, and error codes](/vue/runtime-limits-observability-and-error-codes).
