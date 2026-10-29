# J-07 · Forms, async updates, and dialogs

An edit dialog registers its controls only while open. Saving updates the record
after a short asynchronous delay, and the save action waits for the visible
result before reporting success.

```bash
pnpm tutorial:dev j-07
pnpm tutorial:dev j-07 --locale zh
pnpm tutorial:check j-07
```
