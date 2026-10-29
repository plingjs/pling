---
id: SITE-07
title: "Governance and community"
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Governance and community

Pling is currently maintainer-led. This page explains how decisions are made, how to propose a protocol change, and which boundaries apply when participating. It does not describe a foundation, committee, or election process that does not yet exist.

## How decisions are made today

- The project is maintained publicly on GitHub.
- A small maintainer group owns code review, releases, security coordination, and protocol publication.
- Small documentation fixes and clearly bounded defects can be resolved in a pull request.
- Changes to capability semantics, protocol messages, authorization boundaries, or public API contracts require a written rationale, compatibility analysis, tests, and migration guidance.
- Security fixes may be prepared privately until users have had a reasonable opportunity to upgrade.

While the project remains small, it will not describe itself as an independent governance body. Governance claims should follow practice, not precede it.

## Proposing a protocol change

Open an issue to describe the problem, then submit an implementation or specification change. A reviewable proposal answers at least:

1. Which observable behaviour changes for a page, client, gateway, or independent implementation?
2. Is this a clarification, additive change, breaking change, or security fix?
3. Which version identifier changes, and how does an old client fail closed?
4. Which tests establish both the new behaviour and the rejected cases?
5. How does an operator migrate without widening access or losing audit correlation?
6. What is the rollback path if one implementation cannot upgrade immediately?

A working reference implementation is not enough. The specification text, type definitions, error registry, conformance cases, and migration notes must describe the same behaviour.

## Decisions and records

Maintainers record the decision and main rationale in the issue or pull request, including reasons for rejection. Security-sensitive work may remain private during the remediation window; other protocol discussion should be publicly inspectable.

There is currently no numbered RFC archive and no independent protocol committee. Changes to public behaviour still require public discussion and review. The absence of a formal archive is not a reason for an undocumented change.

If the project later adds technical steering or a governance body, its members, selection method, term, decision scope, and removal process must be published before it is described as independent. No such body exists today.

## Maintainer responsibilities

People who contribute consistently and with high quality to code review, documentation, interoperability, or security may be given maintenance responsibilities. Each new role should publish the person, scope, and reason so that permissions can be inspected rather than guessed from repository access.

Maintainer status is not an endorsement of an organization or commercial relationship. Technical judgment should rest on reproducible evidence, compatibility consequences, and security boundaries.

## Conflicts of interest

Maintainers, reviewers, and proposal authors should disclose financial, employment, or commercial interests that could reasonably affect a protocol decision. A person with a material conflict should not be the sole decision-maker for that proposal. Disclosure and recusal should be recorded in the relevant review.

The same rule applies to model providers, hosting providers, automation vendors, and customer organizations. Technical evidence outweighs the proposer's title or commercial position.

## Security reports

Do not disclose exploit details, real credentials, customer data, or private prompts in a public issue. Use the repository's private **Security → Report a vulnerability** channel. The boundary is described in the [Security and trust center](/security/).

## Contributing

- Open an issue before changing public behaviour, protocol semantics, security boundaries, or package structure.
- Keep pull requests focused. Behavioural changes need tests and corresponding reference or tutorial updates.
- Explain compatibility and failure behaviour, not only the successful path.
- Contributions are accepted under Apache-2.0 unless a file states otherwise.
- There is no guaranteed response time, and not every contribution will be accepted.

See [Contributing](https://github.com/plingjs/pling/blob/main/CONTRIBUTING.md) and [Security](https://github.com/plingjs/pling/blob/main/SECURITY.md) for development commands and submission requirements.

## Community conduct

Participation should be specific, evidence-based, and respectful. Harassment, discrimination, disclosure of private data, and pressure to weaken a security boundary are not accepted. Maintainers may close or remove contributions that violate these expectations and will state the reason when doing so does not create a security risk.

Protocol disagreement is expected. Critique the claim, the evidence, and the compatibility consequence; do not turn review into a contest over affiliation or status.
