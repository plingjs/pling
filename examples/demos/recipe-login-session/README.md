# Recipe 01: login, session, and protected pages

This Vue page demonstrates an HttpOnly browser session, protected invoice
records, session expiry, and sign-out. The local API is
`examples/recipe-backends/access-service`; it starts automatically with
`pnpm dev:examples`.

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-login-session/?lang=zh` and sign in
with `demo@example.com` / `pling-demo`. Then ask the assistant to add a note.
Use **Expire session** or **Sign out** and repeat the request: the record and the
tool are gone because the page no longer renders the protected scope.

The browser never passes the password or cookie to the model. The API service is
an in-memory teaching fixture and must be replaced by the application's real
identity and authorization layers in production.
