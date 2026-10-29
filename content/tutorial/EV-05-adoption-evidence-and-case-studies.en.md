---
id: EV-05
title: "Adoption evidence and case studies"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Adoption evidence and case studies

This page records the available adoption evidence and the limits of what it supports. There are no independent production deployments yet. The repository contains reference applications, tutorial fixtures, and an authenticated Surface demo; those demonstrate behavior, not market adoption.

## Current evidence

| Artifact | What it shows | What it does not show |
| --- | --- | --- |
| Tutorial examples | The documented APIs can run in a controlled app | Production usage or customer value |
| Surface and MCP cases | A page can expose a bounded capability surface to an external client | A generalized transport or enterprise identity deployment |
| Authenticated Todo case | A page, BFF, and gateway can separate credentials and require human approval | Multi-tenant production scale or independent security review |
| Benchmark reports | A frozen comparison on one fixture and model | Broad superiority or adoption |

## How to publish a case study

A credible case should identify the organization only with permission, the page type, the capabilities exposed, the identity and approval path, and the measured operational result. It should state what was not measured. Remove customer data, credentials, and screenshots containing personal information.

Useful metrics include successful task rate against a defined completion oracle, time to complete, number of human interventions, error categories, and the cost of integration. Token count alone is not a business outcome. A shorter run that misses the requested operation is a failure.

## What would count as adoption

The project needs an unaffiliated production site using the protocol, with evidence that its page remains operable when the Surface is disconnected, that a revoked agent loses access before execution, and that a real human approval is required for its stated destructive actions. A second independent client implementation would strengthen the interoperability claim.

Until then, the honest description is “reference implementation and initial evidence”. Do not convert a demo deployment, a tutorial, or a synthetic benchmark into a customer logo.

## Invitation for review

If you operate a site and want to evaluate the approach, start with one read-only capability, one bounded write, and one destructive capability behind a human approval. Record the failures before adding scope. The most useful contribution is a reproducible negative result, not a polished success story that omits the path to it.

See [Benchmark methodology](/evidence/benchmark-methodology-and-reproducibility) and [Security and trust center](/security/).
