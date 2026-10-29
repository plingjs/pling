# R-02 · Install, provider, and first mount

This fixture verifies the React installation path: one app-level `createPling()`,
one `<PlingProvider>`, and the assistant entry. It deliberately exposes no page
actions, so the capability registry must stay empty.

```bash
pnpm tutorial:dev r-02
pnpm tutorial:dev r-02 --locale zh
pnpm tutorial:check r-02
```
