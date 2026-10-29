# J-12 · Test and debug vanilla capabilities

This fixture keeps the work queue intentionally small so the test boundaries
remain visible: declarations, executor results, replay-driven agent turns, and
the exact model request captured by the optional trace.

```bash
pnpm tutorial:dev j-12
pnpm tutorial:dev j-12 --locale zh
pnpm tutorial:check j-12
```
