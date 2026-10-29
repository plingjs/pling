# R-10 · Long lists, scrolling, and offscreen actions

This fixture starts from R-09. The Todo page keeps its regions, portal editor,
record actions, and function-level tool. The list now contains 24 tasks inside
a fixed-height scroll container. Rows below the fold keep stable record ids,
folded row actions retain an offscreen target, and the executor reveals a known
row before invoking it. The scrolling element itself also supplies a bounded
discovery action.

```bash
pnpm tutorial:dev r-10
pnpm tutorial:dev r-10 --locale zh
pnpm tutorial:check r-10
```
