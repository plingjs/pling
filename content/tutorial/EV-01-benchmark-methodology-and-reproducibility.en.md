---
id: EV-01
title: "Benchmark methodology and reproducibility"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Benchmark methodology and reproducibility

A benchmark is useful only if a reader can tell what was compared, under which conditions, and what the result does not establish. Pling's current evidence is deliberately narrow: two frozen page fixtures, one model alias, one deterministic DOM baseline, and a small set of pre-registered tasks.

## What was compared

The main comparison is between a Surface/MCP path and a DOM-plus-Playwright path on the same application and task oracle. Both paths must produce the same business state, perform the same number of confirmations, and avoid the same prohibited side effects.

| Condition | Surface / MCP | DOM / Playwright |
| --- | --- | --- |
| Page | Frozen order-admin fixture | Same fixture |
| Tasks | Pre-registered manifest | Same manifest |
| Model | `deepseek-chat` | Same model |
| Temperature / output cap | `0` / `1024` | Same |
| Turn budget | `24` | Same |
| Tool result cap | `24,000` characters | Same |
| Confirmation | Deterministic oracle | Same oracle |

The Surface arm may call only declared capabilities. The DOM arm may inspect accessible roles, labels, text, and placeholders, and must operate the real controls. It may not read Pling declarations or the registry. This distinction is essential: comparing a capability surface with an arm that also receives the same declarations would measure prompt shape, not the protocol.

## Pre-registration

The confirmatory run fixed the tasks, thresholds, model, prompt, fixture, turn budget, and analysis method before execution. It did not replace failed runs with better ones. Warm-up runs were kept out of the formal set. The aggregate checks that both arms share the same fixture, task manifest, model conditions, system prompt, and repetition count.

The current primary result is:

| Metric | Surface / MCP | DOM / Playwright |
| --- | ---: | ---: |
| Core pass@1 | 60 / 60 | 60 / 60 |
| Median steps on successful runs | 3 | 7 |
| Median tokens on successful runs | 11,462.5 | 22,543 |
| `falseSuccess` | 0 | 0 |

The ratios are `0.4286` for steps and `0.5085` for tokens. They are descriptive statistics for this frozen setting. The 95% Wilson interval for 60/60 is 93.98%–100%; it is not a promise that every future run succeeds.

## Reproducing a result

Start with the repository's benchmark documentation and the fixture's result directories. Each run directory contains a manifest, `runs.jsonl`, `summary.json`, and, where applicable, a report. Check the fixture hash, task manifest hash, system prompt hash, git SHA, dirty-worktree flag, model alias, and repetitions before comparing runs.

Run the deterministic tests first. They do not require a model key and catch fixtures that no longer match the task oracle. Only then run a real-model smoke on a small task subset. A full run should be a separate, recorded experiment, not an iterative way to tune a prompt until a number improves.

## What the evidence does not prove

- It does not establish statistical significance across the population of web applications.
- It does not show that the same token or step ratios hold for another model or a model service that changes under the same alias.
- It does not prove that a Surface will be safe without backend authorization, audits, and confirmation.
- It does not cover visual-only controls, cross-site discovery, production network failures, or every framework adapter.
- It does not turn a deterministic confirmation oracle into a human usability study.

## Reading a new result

Ask five questions before trusting a benchmark:

1. Are both arms using the same page and task definitions?
2. Could the DOM arm see Pling metadata or the Surface arm use private shortcuts?
3. Is the confirmation path the same for both arms?
4. Are failures, infrastructure errors, and retries retained in the denominator?
5. Does the claim stay inside the frozen model and fixture?

Publish the raw records and the failed cases. A benchmark that hides its failures is a marketing artifact, not evidence. See [Failure catalog and known limitations](/evidence/failure-catalog-and-known-limitations) and [Surface vs DOM, Playwright, and vision](/evidence/surface-vs-dom-playwright-and-vision).
