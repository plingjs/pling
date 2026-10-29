# Example 02: Order workspace

The order workspace exercises the capability surface on a business queue rather
than an abstract list. Orders can be searched and filtered, opened in a detail
panel, given a follow-up note, and approved. Approval is a dangerous operation:
the declaration pauses for a human before the existing Vue handler runs.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open:

- `http://127.0.0.1:5191/demos/orders/?lang=zh`
- `http://127.0.0.1:5191/demos/orders/`

Model access is served by `examples/gateway.mjs` through `/api/agent/v1`.
Provider credentials are configured in `examples/.env.local`; see
[`examples/GATEWAY.md`](../../GATEWAY.md).

## What to try

Start with **Summarize the pending queue**, then ask:

> Approve the highest-risk pending order.

The assistant must find the visible order, select its record-specific approve
action, and wait at the confirmation gate. Only the human decision releases the
same handler used by the visible Approve button. Then open the order details and
ask for a follow-up note to observe a parameterized write action.

## Source map

- `src/OrderWorkspace.vue` — queue, filters, order detail, record declarations,
  confirmation gate, and `AgentDock`;
- `src/main.ts` — one runtime, model gateway path, and demo limits;
- `src/quick.ts` — the suggested operating tasks;
- `src/copy.ts` — bilingual business and capability copy;
- `index.html` — standalone Vite entry.

Orders live in page memory. There is no order database in this example; the
gateway is the only server-side process.
