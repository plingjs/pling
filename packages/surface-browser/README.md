# @plingjs/surface-browser

Browser-side runtime for a Pling Agent Surface. It owns page sessions, the
gateway WebSocket, `describe` / `invoke` bridging, approval notifications,
pairing, token access, reconnect, and teardown.

The page keeps its existing Pling registry, explicit capability allowlist,
permissions, confirmation UI, and business implementation.

```bash
npm install @plingjs/surface-browser
```

Vue 3 applications should normally use `useSurfaceGateway()` from
`@plingjs/vue`:

```ts
import { useSurfaceGateway } from "@plingjs/vue";

const gateway = useSurfaceGateway({
  app: "todo",
  mode: "bff",
  expose: ["todo.overview", "todo.add"],
  getPageSession: () => api.createPageSession(),
  confirm: approval.confirm,
  approval,
});
```

Framework-independent hosts can compose the lower-level primitives:

```ts
import {
  createPlingSurface,
  createSurfaceBridge,
  createSurfaceTransport,
} from "@plingjs/surface-browser";

const transport = createSurfaceTransport({ url: page.surfaceUrl, app: "todo" });
const { surface } = createPlingSurface(registry, {
  app: "todo",
  expose: ["todo.overview", "todo.add"],
  confirm,
  session: () => transport.agent,
});
const bridge = createSurfaceBridge({ surface, transport, approval });
```

## Security boundaries

- `expose` is always explicit and is intersected with the verified Agent scope.
- The page token authenticates the page socket; it is not an Agent token.
- The bridge forwards only protocol requests and pending-confirmation metadata.
- There is no generic selector click or script execution.
- The page remains the only place that can approve a destructive action.
- `public-demo` is for hosted demonstrations only. Production page sessions must
  be created by an authenticated BFF; an admin token must never reach the browser.

## Documentation

- [Surface basics: describe and invoke](https://plingjs.dev/surface/surface-basics-describe-and-invoke)
- [Expose capabilities to external agents](https://plingjs.dev/operations/expose-capabilities-to-external-agents)
- [Deploy a Surface gateway](https://plingjs.dev/surface/deploy-a-surface-gateway)
- [Surface protocol](https://plingjs.dev/reference/surface-protocol)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
