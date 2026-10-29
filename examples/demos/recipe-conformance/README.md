# Recipe 14: Surface conformance

Run `pnpm dev:examples` and open
`http://localhost:5191/demos/recipe-conformance/?lang=zh`. Press **Run suite**.
The page creates a fresh fixture and executes nine request vectors against
`@plingjs/surface`, showing the expected and actual result for each one.

This is a repository vector suite, not a certification programme. It does not
cover transport, SSO, multi-tenant identity, browser compatibility, or a second
independent implementation. For CI, run `pnpm --filter @plingjs/surface test`
and `pnpm --filter @plingjs/surface-gateway test`; for another implementation,
record the fixture, protocol version, environment, and uncommitted state.
