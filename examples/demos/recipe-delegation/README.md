# Recipe 11: delegated access with user consent

Run `pnpm dev:examples`, open
`http://localhost:5191/demos/recipe-delegation/?lang=zh`, and sign in with
`demo@example.com` / `pling-demo`. Choose scopes and issue a short-lived
delegation. Invoke an allowed capability, then revoke it and invoke again: the
server returns `SESSION_REVOKED` before any business operation.

The local backend stores only a hash of the token. This page displays the raw
token once to make the demo inspectable; production clients must keep it in a
secret store and never place it in model context or page state.
