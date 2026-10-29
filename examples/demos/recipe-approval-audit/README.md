# Recipe 12: approval, audit, and revocation

Run `pnpm dev:examples`, open
`http://localhost:5191/demos/recipe-approval-audit/?lang=zh`, and sign in with
`demo@example.com` / `pling-demo`. Request deletion of `INV-2042`, reject it once
and check that the invoice remains, then request it again and approve it. The
audit panel shows the request and decision. **Test revoked external call**
returns a failure instead of reaching the business layer.

Approval is a page action; the model receives neither an approval tool nor the
approval token. The local service is in-memory and does not replace a durable
approval or audit system.
