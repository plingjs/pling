# Production and Verification

Use this reference to decide whether an integration is merely demonstrable or
actually operable. The key question is not “does the happy path work?” but “what
happens when identity, storage, the page, the Agent, or the network is wrong?”

## 1. Production gate

Do not call an integration production-ready until all of these are true:

- the application authenticates the user before creating a page session;
- the browser never holds an admin token or provider key;
- a page can only expose capabilities the signed-in user is allowed to use;
- the Agent receives less capability than the page, not the full page surface;
- human confirmation is required for the risk class the business requires;
- the Agent has no approval endpoint;
- page, Agent, tenant, and admin credentials are distinct;
- expiry, revocation, restart, and disconnect fail closed;
- production state is durable enough for the promised session/audit behavior;
- deployment has TLS, exact Origin checks, shared abuse controls, and monitoring;
- the team can revoke one Agent, one page, or a whole tenant without a code
  deployment.

If any item is unknown, record it as a gap. A green demo does not compensate for
an unanswered production question.

## 2. Recommended topology

```text
User browser
  │ same-origin app session / cookie
  ▼
Application BFF / API gateway
  ├─ authenticate user
  ├─ authorize business capabilities
  ├─ create page session with server-side admin credential
  └─ audit and abuse controls
         │
         ├── Surface Gateway ── WebSocket ── open business page
         │                                  └── existing Pling executor
         │
         └── Model proxy (@plingjs/server) ── provider API

External Agent ── HTTPS MCP + Agent token ── Surface Gateway
```

Keep the model proxy and Surface Gateway separate. The model proxy protects
provider credentials and model budgets. The Surface Gateway brokers page
capabilities and Agent sessions. Combining them can be acceptable in a small
deployment only if the credential and scope boundaries remain explicit.

## 3. Production checklist

### Identity and authorization

- [ ] BFF validates an HttpOnly/Secure session, OIDC session, or equivalent.
- [ ] `userId`, tenant, and scope come from the verified server session, never
  from user-controlled JSON alone.
- [ ] The application still checks business authorization on the actual
  operation, not only when creating the Pling session.
- [ ] A user cannot create a page session for another user by changing a request
  field.
- [ ] Logout/session revocation prevents new page/Agent access and revokes or
  expires existing sessions when required.
- [ ] Tenant boundaries are identifiable in storage, audit, rate limits, and
  admin APIs.

### Sessions and tokens

- [ ] Page, Agent, and admin tokens are cryptographically random and stored only
  where each trust zone needs them.
- [ ] Token lifetime is bounded by tenant policy and the business risk.
- [ ] One page session has one active Agent unless a reviewed design supports
  more.
- [ ] Revoking a page revokes its Agents and pending requests.
- [ ] Revoking an Agent makes future MCP calls fail closed.
- [ ] A restart does not silently revalidate a lost or expired session.
- [ ] Token values do not appear in browser analytics, access logs, error
  responses, audit rows, or model-visible tool output.

### Surface scope

- [ ] The page allowlist, manifest, BFF page-session scope, and any public-demo
  tenant scope use the same fully qualified ids.
- [ ] `describe` and `invoke` apply the same scope decision.
- [ ] A guessed excluded id fails closed without execution.
- [ ] Scope families (`@`, `:`) are tested with real ids.
- [ ] `*` is absent unless a specific reviewed requirement justifies it.
- [ ] A page route change or namespace change does not leave stale allowlists.

### Risk and approval

- [ ] `danger` or equivalent destructive operations require trusted human
  confirmation.
- [ ] The Agent only receives `pending_approval` and status, never an approve
  function.
- [ ] Approval binding covers request id, capability, record, normalized
  arguments hash, user, Agent, session, and expiry.
- [ ] Approval tokens, receipt tokens, and their hashes do not enter the Surface
  response or audit table.
- [ ] Approval denial, timeout, and page navigation fail closed and are visible
  to the Agent.
- [ ] A wide or irreversible action cannot bypass the same business checks by
  using an external route.

### Records, state, and data minimization

- [ ] Records use stable business ids and only necessary fields.
- [ ] State is a purpose-built read view, not a store/component/API dump.
- [ ] Sensitive values are omitted or wrapped with the project's sensitive-value
  mechanism; they are not merely hidden in the UI.
- [ ] Free-text fields have length/format bounds and a clear business purpose.
- [ ] The page does not send secrets through tool arguments or error messages.
- [ ] Retention and deletion policy covers session records, audit, and logs.

### Gateway deployment

- [ ] TLS terminates at a trusted reverse proxy; Node binds to loopback or a
  private interface unless a reviewed network design says otherwise.
- [ ] The public base URL is correct and generated WebSocket/MCP URLs use HTTPS
  where appropriate.
- [ ] Exact tenant origins are configured; wildcard CORS is not used as a
  convenience.
- [ ] `SURFACE_TRUST_PROXY` is enabled only when the proxy overwrites the client
  IP header.
- [ ] Health checks do not reveal secrets or admin state.
- [ ] Process shutdown drains or fails pending requests explicitly.
- [ ] Config is versioned and validated before deployment; invalid tenant data
  fails startup rather than silently narrowing/widening access.
- [ ] The default in-memory stores are replaced or explicitly accepted for a
  bounded, non-critical deployment.

### Abuse, rate limiting, and replay

- [ ] Pairing claims are rate limited by a trustworthy client identity.
- [ ] Public-demo session creation has its own limits and active-session cap.
- [ ] MCP calls, page sessions, and admin operations have appropriate limits.
- [ ] Shared limits are used across multiple replicas; per-process counters are
  not mistaken for global protection.
- [ ] A repeated request id cannot execute the same write twice when the
  deployment promises idempotency.
- [ ] Rate-limit backend failure fails closed for writes and does not silently
  grant unlimited access.
- [ ] Clock skew is controlled by server/database time, not browser time.

### Audit and observability

Minimum metadata to record:

- request id, timestamp, tenant, user id, Agent id, session id;
- capability id, scope decision, outcome, stable error code, duration;
- public approval association id, never the approval secret;
- page connection state and disconnect reason;
- pairing creation/claim/revoke and rate-limit events;
- gateway start/shutdown and config version.

Never record:

- bearer tokens, cookies, provider keys, token hashes where the policy forbids
  them;
- raw sensitive arguments or response bodies;
- passwords, card data, health data, private notes, or full PII payloads.

Alerts should cover repeated authentication failures, abnormal pairing claims,
scope-denied spikes, approval timeout/latency, page disconnect bursts, gateway
5xx/timeout rates, and audit write failures.

### Reliability

- [ ] A missing page returns a typed error, not a bogus success.
- [ ] Reconnect is bounded and does not create duplicate Agent sessions.
- [ ] Request and approval timeouts are explicit.
- [ ] Delayed or duplicate responses cannot execute a second business write.
- [ ] A page that navigates away invalidates pending calls.
- [ ] A database/Redis/outbox failure has a documented fail-open/fail-closed
  policy; writes default to closed.
- [ ] Restart and rolling deployment preserve or explicitly invalidate sessions
  according to the chosen architecture.
- [ ] Backups/restores cover durable control-plane and audit data.

## 4. Verification matrix

### Framework and declaration tests

- capability ids after namespace qualification;
- parameter validation and defaults;
- primitive kind floors and danger defaults;
- availability reason when a precondition fails;
- stable record ids after rerender;
- state serialization bounds and sensitive-value behavior;
- `expect`/evidence behavior for asynchronous operations.

### Surface protocol tests

- `describe` only returns the page allowlist;
- `invoke` of an excluded id returns a structured failure and does not call the
  executor;
- page/page-session/Agent scope intersection; public-demo policy seeds the page
  scope where used;
- expired session, revoked session, and changed scope;
- record window and pagination bounds;
- approval-required action returns pending and cannot be approved by the Agent;
- rate-limit and replay adapters fail closed.

### Gateway integration tests

- admin Bearer required for page-session creation;
- exact Origin required for page pairing and WebSocket;
- page token cannot be used as an Agent token or admin token;
- pairing is single-use, expires, and is rate limited;
- Agent scope cannot exceed page scope;
- one active Agent per page;
- revocation of page/Agent and pending request cleanup;
- reconnection and disconnect behavior;
- tenant isolation and unknown-tenant errors.

### End-to-end browser tests

1. Sign in through the real application flow.
2. Create a page session through the BFF.
3. Open and keep the page connected.
4. Pair a real MCP client.
5. Run `describe` and verify excluded capabilities are absent.
6. Invoke a low-risk action and inspect changed evidence.
7. Invoke a confirmation-required action, confirm in the page, and verify the
   final status.
8. Refuse a confirmation and verify the business state did not change.
9. Revoke the Agent and prove the next call fails.
10. Reload/navigate and verify pending calls fail safely rather than producing a
    false success.

### Cross-instance and failure tests

If the deployment has more than one Gateway replica:

- session created on A is visible/valid on B;
- revocation on A is observed by B before the next call;
- rate limits are shared;
- a request id does not execute twice across replicas;
- an expired/old token cannot be revived;
- restart of one replica does not make a closed session valid again.

Inject failures for the model proxy, surface page, Gateway, database, Redis,
outbox, and network. Record the user-visible error and whether the write side
effect is known, unknown, or certainly not committed.

## 5. Engineering rules for the implementation

### Keep layering intact

- `@plingjs/core`: declarations, policy, execution, evidence.
- `@plingjs/surface`: protocol and session-scope intersection.
- `@plingjs/surface-browser`: page transport and bridge lifecycle.
- `@plingjs/surface-gateway`: transport/control-plane reference.
- application BFF: human identity, business authorization, page-session
  provisioning.
- business backend: final domain authorization and commit.

Do not add Vue/React code to core, database clients to surface, or business
selectors to the Gateway.

### Prefer feature flags and narrow rollouts

Roll out in this order:

1. local baseline and integrated page;
2. in-page assistant with low-risk actions;
3. external Surface read-only;
4. one reversible write with confirmation;
5. durable audit and limits;
6. broader tenant rollout after evidence.

Each stage needs a kill switch that revokes external sessions or disables
Surface creation without reverting business code.

### Make failures truthful

If a business write may have occurred but the page disconnected before evidence
was observed, report the outcome as unknown, not success. Preserve the request
id and audit metadata so an operator can reconcile it. Do not retry a
non-idempotent write automatically.

### Keep the test contract maintainable

Put fully qualified ids and scope results in one shared test fixture. Tests
should fail on drift between:

- page declarations;
- `retrofit/capabilities.json`;
- page `expose`;
- BFF page-session scope;
- any public-demo tenant scope or deployment-level narrowing config;
- MCP smoke expectations.

## 6. Release commands

In this repository, use the narrowest checks first and broaden after:

```bash
pnpm --filter @plingjs/surface-gateway test
pnpm --filter @plingjs/surface-gateway check
pnpm --filter @plingjs/vue test
pnpm --filter @plingjs/react test
pnpm check
pnpm typecheck
pnpm test
```

If package exports, dependencies, or build configuration changed:

```bash
pnpm build
pnpm pack:check
pnpm release:check
```

If a tutorial fixture changed, also run its chapter check:

```bash
pnpm tutorial:check <chapter-id>
```

Do not claim a release check passed unless the command actually completed. If
the workspace has unrelated failures, distinguish them from the integration and
report the exact evidence.

## 7. Incident runbook

When external access is suspected to be wrong:

1. **Stop new access:** disable the Surface feature flag and revoke affected page
   sessions or tenant access.
2. **Contain credentials:** rotate the admin token and revoke Agent tokens; do
   not paste tokens into the incident channel.
3. **Preserve evidence:** retain audit, request ids, session ids, page disconnect
   reasons, and deployment/config versions. Do not rewrite logs.
4. **Establish scope:** identify which users, tenants, capabilities, records, and
   time window were affected; distinguish attempted, approved, executed, and
   unknown outcomes.
5. **Fix the boundary:** update allowlists, authorization, approval, or session
   invalidation, not just the UI copy.
6. **Add a regression test:** reproduce the exact bypass or failure and make it
   fail closed.
7. **Re-enable gradually:** read-only first, then one reversible write after
   human review.

## 8. Acceptance evidence

The handoff should include:

- command output for baseline, integrated tests, Gateway tests, typecheck, and
  build;
- a capability manifest and explicit external allowlist;
- a redacted sample `describe` and `invoke` trace;
- proof that an excluded id failed without execution;
- proof that approval was performed by the page and not the Agent;
- proof that page/page-session/Agent scope intersection held, with any public-demo
  policy accounted for;
- revocation/expiry/reconnect evidence;
- deployment topology, exact origins, TTLs, and storage choice;
- known risks, open decisions, rollback steps, and the owner of each remaining
  production task.

