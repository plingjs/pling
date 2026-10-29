# R-15 · Confirmation and human handoff

This fixture starts from R-14. The release panel separates two boundaries:
approval before a dangerous action, and a human-only step that the agent must
not simulate. Saving asks once, archiving and resetting ask every time, and
publishing waits for a person to enter the verification code.

```bash
pnpm tutorial:dev r-15
pnpm tutorial:dev r-15 --locale zh
pnpm tutorial:check r-15
```
