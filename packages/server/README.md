# @plingjs/server

A thin Node gateway for OpenAI-compatible model requests. It keeps provider
credentials on the server and adds authentication, model allowlists, request
limits, retries, streaming passthrough, and metadata-only audit hooks.

```bash
npm install @plingjs/server
```

```ts
import { createPlingGateway, toNodeHandler } from "@plingjs/server";

const gateway = createPlingGateway({
  upstream: {
    baseUrl: process.env.MODEL_BASE_URL!,
    apiKey: process.env.MODEL_API_KEY!,
  },
  model: "your-model",
  authorize: async ({ headers }) => verifyUser(headers),
  onAudit: (event) => audit.write(event),
});

http.createServer(toNodeHandler(gateway)).listen(8080);
```

The gateway does not run the agent loop, store conversation memory, forward
browser cookies automatically, or expose provider keys to the client. Without
an `authorize` hook, configure `allowAnonymous: true` explicitly or the gateway
fails closed with `503`.

## Documentation

- [Node gateway reference](https://plingjs.dev/reference/node-gateway)
- [Connect a model gateway](https://plingjs.dev/operations/connect-a-model-gateway)
- [Model access and trust boundaries](https://plingjs.dev/concepts/model-access-and-trust-boundaries)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
