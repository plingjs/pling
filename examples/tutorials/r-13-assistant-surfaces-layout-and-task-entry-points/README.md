# R-13 · Assistant surfaces, layout, and task entry points

This fixture starts from R-12. The Todo app keeps its routes and adds two
assistant surfaces: a floating dock that can become an edge sidebar, and task
entrances that send prompts through `pling.ask()`. The shell can move without
creating a second runtime. Task buttons remain outside the model action list,
and every entrance shares one conversation history.

```bash
pnpm tutorial:dev r-13
pnpm tutorial:dev r-13 --locale zh
pnpm tutorial:check r-13
```
