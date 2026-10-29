---
id: EV-02
title: "Surface vs DOM, Playwright, and vision"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Surface vs DOM, Playwright, and vision

These approaches solve different problems. They can be combined, but they should not be compared as if they were interchangeable implementations of one layer.

| Approach | Sees | Strength | Limits |
| --- | --- | --- | --- |
| Surface | Declared business capabilities, bounded page context | Stable intent, approval and audit hooks, fewer UI steps | Requires page integration and honest declarations |
| DOM extraction | Accessible tree, text, roles, attributes | Works on many existing pages with less integration | Ambiguous elements, long prompts, stale layout |
| Playwright / CDP | Browser control and real events | Strong for testing and automation | Selector brittleness, UI-only meaning, can bypass page intent |
| Vision agent | Pixels | Handles visual-only interfaces | Cost, latency, coordinate ambiguity, weak business semantics |

The benchmark in this repository compares Surface with a DOM + Playwright baseline on a declared fixture. It does not compare against a production vision model, and it does not claim that one approach replaces all browser automation. A capable agent with CDP may still operate a page even when a Surface exists; the Surface is the authorized business path, not a universal wall against automation.

## When Surface is the better fit

Choose a capability surface when the page has stable business operations and the enterprise needs to control them: record selection, approval, scope, revocation, and audit. The payoff comes from knowing what an action means, not merely where its button is.

Surface is a poor fit when the required operation cannot be expressed as a bounded business action, when the page cannot be changed, or when the task genuinely depends on visual inspection without a semantic equivalent. Leaving it to a human or another automation path may be more honest than inventing an unsafe universal tool.

## Why the benchmark separates arms

The DOM arm must not read Pling metadata; otherwise it is not a DOM baseline. The Surface arm must not click hidden controls; otherwise it is not exercising the capability contract. Both use the same business component, tasks, confirmation oracle, and assertions. This matters more than the exact prompt.

The benchmark's main result supports a narrow claim: in the frozen fixture and model setting, the Surface path used fewer steps and tokens while matching success and safety assertions. It does not establish a general efficiency law. Model changes, page structure, network failures, and human approval can alter the result.

## Cost and reliability

A shorter action sequence is useful, but it is not the only cost. A Surface has integration work, schema maintenance, and the need to keep descriptions aligned with behavior. A DOM path has prompt overhead and selector repair. A vision path has perceptual cost and ambiguity. Compare total operating cost, not only tokens in one run.

Reliability also differs by failure mode. A browser automation path may recover from a selector change by searching again; a capability surface returns `ACTION_NOT_FOUND` and forces the page author to declare the operation. The second behavior is less flexible but more auditable. Neither is universally superior.

## Choosing a safety story

If the operation is low risk and the page is third-party, browser automation may be the only option. If the operation changes money, records, or permissions, the page and backend should expose a bounded capability even if an agent also has browser control. The Surface cannot stop a rogue Clicker, but it gives the enterprise a place to grant, deny, log, and revoke the business action.

See [Benchmark methodology](/evidence/benchmark-methodology-and-reproducibility) and [Safe capabilities](/surface/designing-safe-capabilities).
