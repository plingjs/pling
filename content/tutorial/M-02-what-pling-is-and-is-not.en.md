---
id: M-02
title: What Pling is, and is not
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# What Pling is, and is not

Suppose an order page has two buttons side by side: **Approve** and **Reject**. A person can see the difference immediately. A DOM tree reports two buttons. A screenshot shows where they are. Neither tells an agent, on its own, which business operation each button performs, whether the current user may perform it, whether confirmation is required, or which order will change.

That gap is where Pling operates.

## In one sentence

**Pling is the agent capability layer for web applications.** A page declares its executable operations once, beside the business code. Pling exposes those actions, their targets, bounded context, and execution results to an in-page assistant or, through Agent Surface, to an external agent.

The page remains the application. It owns state, validation, business rules, and access decisions. Pling defines how an application describes the actions it chooses to expose and how an execution is reported.

Models, agent runtimes, and browser automation tools are outside this layer. Pling does not decide what an agent should attempt next.

## The responsibilities behind one operation

These responsibilities are often described together as "the agent". Separating them makes their limits much clearer.

| Responsibility | What it decides | Typical implementation |
| --- | --- | --- |
| Host application | What is true, valid, and permitted in this business system | The Vue, React, Vanilla, or jQuery application and its backend |
| Pling SDK and page runtime | Which actions exist, which record they affect, whether they are available, and what happened after execution | `@plingjs/core`, `@plingjs/dom`, and the framework adapters |
| In-page assistant (optional) | What to do next and how to reply to the user | `@plingjs/agent` and the assistant interface chosen by the application |
| Agent Surface | What an external agent may discover and invoke | The page-side Surface implementation |
| Surface specification | Which rules independent implementations must share | `pling.surface/0.1`, currently a public draft |
| External agent runtime | Which agent, model, or client is operating the page | The user's agent, another application, or an extension |

These roles may be delivered together, but they are not interchangeable. The in-page assistant is only one client. The declarations define Pling.

## What the page exposes

For each declared action, Pling gives the agent the information needed to decide: business meaning, target, current availability, confirmation requirement, and the result of an execution.

The page may also expose related records, read-only state, validation messages, and feedback. This view is intentionally narrow. The agent does not receive the whole DOM, the whole frontend store, or every backend field. A smaller, structured view is easier to reason about and keeps unrelated or sensitive data out of the model context.

Sensitive values can be masked or referenced while the page keeps the real value for display and execution. A model may refer to a customer without learning the customer's full identity document number.

## A declaration is not a second business implementation

When an agent invokes an action, the page runs the same handler, validation, and state transition that a user would trigger. The declaration describes the entry point and its constraints; it does not duplicate the business logic.

The result must be more specific than "done". It should identify the action, the target, whether execution succeeded, what the page observed afterwards, and whether a confirmation or human handoff took place. That is what allows an assistant or audit system to distinguish a completed action from an attempted one.

## Actions that are not declared

An action that is not declared is outside the page's capability surface. An in-page assistant must not invent a fallback by finding a similar button with a selector or guessing from a screenshot.

```text
No declaration
    → not part of the capability surface
    → cannot be invoked by the in-page assistant
    → no selector or screenshot fallback
```

This rule has a clear limit. An external agent with browser-level access, such as one using the Chrome DevTools Protocol, can still interact with the page outside Pling's contract. That is a different permission boundary. Pling does not claim to prevent every form of browser automation.

In all cases, the backend remains responsible for final authorization. A page can establish that `approve_order` exists. It cannot establish, by itself, that a particular user may approve a particular amount at this particular time.

## One declaration, two clients

An application can offer an assistant inside its own interface. It can also expose the same declarations to a user's external agent through Agent Surface. These are two ways to use one page model, not two separate integrations.

The in-page assistant suits an application that wants to provide a complete experience without requiring another installation. An external agent suits a user who already has an agent and wants it to work under the application's terms. Changing clients should not require redeclaring the page.

## What it does not replace

Pling is not a model, a reasoning engine, or a prompt-management system. It is not a replacement for Vue, React, or another frontend framework, and it is not a selector-based browser automation tool.

It does not replace backend authorization, rate limits, tenant isolation, secret management, workflow systems, or human review. Those systems answer different questions. Pling makes the page-side contract explicit; it does not compress every security decision into the page.

For a third-party page that cannot integrate, browser automation or visual interaction may remain the practical option. Pling addresses the case where the page owner can declare what the page does and under which conditions an agent may act.

## What you can rely on today

The current SDK supports declarations, target resolution, execution, and result reporting. The reference implementation includes both an in-page assistant and an external Surface client.

`pling.surface/0.1` is still a public draft. It is published so implementations can be compared and reviewed, and it may change. Pling is not yet a cross-vendor standard, and this documentation does not describe it as one.

The narrower claim is supported today: an integrated page can expose a bounded set of business actions to an agent, execute them through the page, and return a result. Production suitability still depends on the application's own authorization, data, and operational boundaries.

## Continue reading

To understand how declarations relate to consent, delegation, and audit, continue with [Trust, authority, and audit](/about/mission/trust-authority-and-audit).

To integrate an application, start with the [Vue quick start](/vue/quick-start-add-pling-to-a-vue-app) or [React quick start](/react/quick-start-add-pling-to-a-react-app). The concepts are shared; the integration paths differ.
