# @plingjs/delegation

Optional delegation contracts for granting a scoped Agent access to a page
without handing it a user's long-lived credentials. The package defines the
credential lifecycle, event, and identity ports, an in-memory test adapter,
browser client, and Web-standard HTTP/SSE handlers.

```bash
npm install @plingjs/delegation
```

Production storage, event fan-out, SSO, and policy remain the host
application's responsibility. The in-memory adapter is for tests and local
development only.

## Documentation

- [Delegation and trust boundaries](https://plingjs.dev/reference/delegation-and-trust-boundaries)
- [Delegated access with user consent](https://plingjs.dev/recipes/delegated-access-with-user-consent)
- [Identity, consent, and delegation](https://plingjs.dev/surface/identity-consent-and-delegation)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
